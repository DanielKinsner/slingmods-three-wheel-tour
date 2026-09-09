"""Bounded local-only ElevenLabs audition generator; default is a NO-NETWORK dry run.

Never import this script into the client. No key is accepted on the command line.
Generation needs ELEVENLABS_API_KEY plus an explicit --max-credits and a verified
per-request bound from current account pricing via --credits-per-second-bound.
The account must report usage-based billing disabled. No plan changes are made.
All attempts reserve their full budget BEFORE HTTP submission; uncertain failures
retain the reservation and are not retried automatically. At most 24 attempts over
the persistent ledger, one request at a time. Retries, if requested by rerunning,
consume another reservation. Only completed, hash-verified requests hit the cache.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import argparse
import datetime
import hashlib
import json
import math
import os

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artwork/audio-generated'
API = 'https://api.elevenlabs.io/v1/'
JOBS = [
    {'id': 'coastal-marina-audition', 'text': 'Seamless quiet waterfront marina ambience: soft seawater lapping against a concrete quay, gentle distant coastal air. Dry natural perspective, no voices, no boat engines, no music, no dramatic gusts.', 'duration_seconds': 8, 'loop': True},
    {'id': 'garage-latch-audition', 'text': 'A single close mechanical garage tool drawer latch: restrained metal click and short soft rubber damped closure, no slam, no voices, no music, dry small room.', 'duration_seconds': 1.2, 'loop': False},
]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def persist(path, value):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w', encoding='utf-8') as handle:
        json.dump(value, handle, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def request(key, path, payload=None):
    req = Request(API + path, data=None if payload is None else json.dumps(payload).encode(),
                  headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    try:
        with urlopen(req, timeout=90) as response:
            return response.read(), dict(response.headers)
    except HTTPError as error:
        # Never include a provider error body, request headers, or secret in logs.
        raise RuntimeError(f'Provider HTTP {error.code}; response body withheld.') from None
    except (URLError, TimeoutError):
        raise RuntimeError('Provider transport failed; outcome uncertain, budget retained.') from None


def subscription(key):
    raw, _ = request(key, 'user/subscription')
    data = json.loads(raw)
    if data.get('max_credit_limit_extension') != 0:
        raise RuntimeError('No-overage gate: account must explicitly report max_credit_limit_extension=0.')
    count, limit = data.get('character_count'), data.get('character_limit')
    if not isinstance(count, int) or not isinstance(limit, int):
        raise RuntimeError('Account remaining-credit fields unavailable; no generation submitted.')
    return max(0, limit - count)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--max-requests', type=int, default=2)
    parser.add_argument('--max-credits', type=int, default=0)
    parser.add_argument('--credits-per-second-bound', type=float, default=0)
    parser.add_argument('--pricing-evidence', default='', help='Current account pricing URL or dated evidence, no secrets')
    args = parser.parse_args()
    if not 1 <= args.max_requests <= 24:
        parser.error('--max-requests must be between 1 and 24 inclusive')
    if args.max_credits < 0 or not math.isfinite(args.credits_per_second_bound) or args.credits_per_second_bound < 0:
        parser.error('Credit bounds must be finite and nonnegative')
    jobs = []
    for job in JOBS:
        payload = {k: v for k, v in job.items() if k != 'id'}
        payload.update(model_id='eleven_text_to_sound_v2', prompt_influence=.35)
        identity = digest(json.dumps(payload, sort_keys=True).encode())
        jobs.append({'id': job['id'], 'request': payload, 'cacheKey': identity,
                     'creditReservation': math.ceil(job['duration_seconds'] * args.credits_per_second_bound)})
    plan = {'mode': 'execute' if args.execute else 'dry-run', 'secretName': 'ELEVENLABS_API_KEY',
            'secretConfigured': bool(os.environ.get('ELEVENLABS_API_KEY')),
            'maxRequestsIncludingReruns': args.max_requests, 'hardMaximumRequests': 24,
            'maxCredits': args.max_credits, 'pricingEvidence': args.pricing_evidence,
            'concurrency': 1, 'automaticRetries': 0, 'jobs': jobs,
            'note': 'Generated audition masters are not integrated or approved automatically.'}
    CACHE.mkdir(parents=True, exist_ok=True)
    persist(CACHE / 'generation-plan.json', plan)
    if not args.execute:
        print(json.dumps(plan, indent=2))
        return
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        raise SystemExit('Blocked: ELEVENLABS_API_KEY is not configured in this process; no request submitted.')
    if args.max_credits < 1 or args.credits_per_second_bound <= 0 or not args.pricing_evidence:
        raise SystemExit('Blocked: explicit credit budget and current per-second pricing bound/evidence required.')
    lock_path = CACHE / '.generation.lock'
    try:
        lock = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise SystemExit('Generation locked. Check the previous process before removing a stale lock.') from None
    ledger_path = CACHE / 'generation-ledger.json'
    try:
        ledger = json.loads(ledger_path.read_text(encoding='utf-8')) if ledger_path.exists() else {'attempts': []}
        if any(a.get('status') == 'complete' and
               (a.get('billedCredits') is None or float(a['billedCredits']) > a['reservedCredits'])
               for a in ledger['attempts']):
            raise RuntimeError('Earlier billing is unknown or exceeded its reservation; review ledger before any further generation.')
        for job in jobs:
            path = CACHE / (job['cacheKey'] + '.mp3')
            cached = next((a for a in ledger['attempts'] if a['cacheKey'] == job['cacheKey'] and a.get('status') == 'complete'), None)
            if cached and path.exists() and digest(path.read_bytes()) == cached['sha256']:
                print(f"Cached: {job['id']}")
                continue
            # Count every submitted/uncertain attempt on all resumptions.
            if len(ledger['attempts']) >= min(24, args.max_requests):
                raise RuntimeError('Persistent request budget exhausted; no further submission.')
            reserved = sum(a['reservedCredits'] for a in ledger['attempts'])
            if reserved + job['creditReservation'] > args.max_credits:
                raise RuntimeError('Persistent credit reservation budget exhausted.')
            if subscription(key) < job['creditReservation']:
                raise RuntimeError('Insufficient included credits for full request reservation.')
            attempt = {'id': job['id'], 'cacheKey': job['cacheKey'], 'startedAt': now(),
                       'status': 'reserved', 'reservedCredits': job['creditReservation'],
                       'request': job['request'], 'pricingEvidence': args.pricing_evidence}
            ledger['attempts'].append(attempt)
            persist(ledger_path, ledger)
            try:
                raw, headers = request(key, 'sound-generation?output_format=mp3_44100_128', job['request'])
                if len(raw) < 4 or not (raw.startswith(b'ID3') or (raw[0] == 255 and raw[1] & 224 == 224)):
                    raise RuntimeError('Provider did not return an MP3 master; outcome retained for review.')
                temp = path.with_suffix('.download')
                temp.write_bytes(raw)
                temp.replace(path)
                headers = {k.lower(): v for k, v in headers.items()}
                attempt.update(status='complete', finishedAt=now(), sha256=digest(raw),
                               bytes=len(raw), requestId=headers.get('request-id'),
                               billedCredits=headers.get('character-cost'), path=str(path.relative_to(ROOT)))
                persist(ledger_path, ledger)
                cost = headers.get('character-cost')
                if cost is None or float(cost) > job['creditReservation']:
                    raise RuntimeError('Billing header missing or exceeds pricing bound; stopping for review.')
                print(f"Generated audition: {job['id']}; reserved {job['creditReservation']} credits; billed {cost}.")
            except Exception:
                if attempt['status'] != 'complete':
                    attempt.update(status='uncertain', finishedAt=now())
                    persist(ledger_path, ledger)
                raise
    except (RuntimeError, ValueError, OSError) as error:
        raise SystemExit(str(error).replace(key, '[redacted]')) from None
    finally:
        os.close(lock)
        lock_path.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
