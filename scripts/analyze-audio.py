"""Decode real delivery files and measure them; never equate this with listening QA.

Requires ffmpeg and NumPy. Run from any directory. Outputs go to evidence/audio.
The audition contains three complete repetitions of each existing engine band,
with silence between bands. No existing production asset is modified.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
import re
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence/audio'
RATE = 44100
LOOPS = {'engine-idle', 'engine-mid', 'engine-high', 'wind', 'tire', 'tour-music',
         'road-roll', 'shoulder-roll', 'coastal-air'}


def decode(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
                                   '-f', 'f32le', '-ac', '2', '-ar', str(RATE), 'pipe:1'])
    return np.frombuffer(raw, dtype='<f4').reshape(-1, 2).copy()


def db(value):
    return round(20 * math.log10(max(float(value), 1e-12)), 3)


def measure(path):
    pcm = decode(path)
    proc = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af',
                           'loudnorm=I=-23:TP=-6:LRA=7:print_format=json', '-f', 'null', '-'],
                          capture_output=True, text=True, check=True)
    stats = json.loads(re.search(r'\{\s*"input_i".*?\}', proc.stderr, re.S).group())
    # Compare wrap discontinuity with in-file derivative distribution, per channel.
    delta = np.abs(np.diff(pcm, axis=0))
    seam = np.max(np.abs(pcm[0] - pcm[-1]))
    adjacent_p999 = float(np.quantile(delta, .999))
    window = RATE // 10
    edge_rms = [db(np.sqrt(np.mean(x * x))) for x in [pcm[:window], pcm[-window:]]]
    # Spectral strongest bins are descriptive only, not validated engine RPM.
    mono = pcm.mean(axis=1)
    strongest = []
    for start in np.linspace(0, max(0, len(mono) - RATE), 6).astype(int):
        frame = mono[start:start + RATE]
        spectrum = abs(np.fft.rfft(frame * np.hanning(len(frame))))
        frequencies = np.fft.rfftfreq(len(frame), 1 / RATE)
        mask = (frequencies >= 35) & (frequencies <= 800)
        strongest.append(round(float(frequencies[mask][np.argmax(spectrum[mask])]), 1))
    return {'id': path.stem, 'file': str(path.relative_to(ROOT)).replace('\\', '/'),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size,
            'decodedSeconds': len(pcm) / RATE, 'decodedFrames': len(pcm), 'sampleRate': RATE,
            'channelsMeasured': 2, 'samplePeakDbFS': db(np.max(abs(pcm))),
            'integratedLUFS': float(stats['input_i']), 'truePeakDbTP': float(stats['input_tp']),
            'loudnessRangeLU': float(stats['input_lra']), 'loop': path.stem in LOOPS,
            'wrapJumpDbFS': db(seam), 'inFileAdjacentDifferenceP999DbFS': db(adjacent_p999),
            'wrapToP999Ratio': round(float(seam) / max(adjacent_p999, 1e-12), 4),
            'firstLast100msRmsDbFS': edge_rms, 'strongest35to800HzBins': strongest,
            'auditoryApproval': 'not performed; numerical inspection and playable audition only'}


def write_wav(path, pcm):
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes((np.clip(pcm, -1, 1) * 32767).astype('<i2').tobytes())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    paths = sorted([*ROOT.glob('public/audio/*.mp3'), *ROOT.glob('public/audio/*.wav')])
    with ThreadPoolExecutor(max_workers=3) as pool:
        assets = list(pool.map(measure, paths))
    report = {'method': 'FFmpeg loudnorm/decoded PCM inspection; not a listening pass',
              'auditionGain': .55 * .58 * .5, 'assets': assets}
    (OUT / 'decoded-audio-audit.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    manifest_path = ROOT / 'AUDIO-SUPPLEMENTS.json'
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        for item in manifest['assets']:
            measured = next(a for a in assets if a['id'] == item['id'])
            item.update(integratedLUFS=measured['integratedLUFS'], truePeakDbTP=measured['truePeakDbTP'],
                        wrapJumpDbFS=measured['wrapJumpDbFS'],
                        measurementReport='evidence/audio/decoded-audio-audit.json')
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    clips, cues, seconds = [], [], 0.0
    for name in ['engine-idle', 'engine-mid', 'engine-high']:
        pcm = decode(ROOT / f'public/audio/{name}.mp3') * report['auditionGain']
        cues.append({'id': name, 'startSeconds': seconds, 'durationSeconds': len(pcm) * 3 / RATE,
                     'description': 'Original delivered band, three full decoded loop repetitions.'})
        clips.extend([pcm, pcm, pcm, np.zeros((RATE, 2), np.float32)])
        seconds += len(pcm) * 3 / RATE + 1
    write_wav(OUT / 'existing-engine-loop-audition.wav', np.concatenate(clips))
    (OUT / 'existing-engine-loop-audition.json').write_text(json.dumps(cues, indent=2), encoding='utf-8')
    print(json.dumps({'analyzed': len(assets), 'report': str(OUT / 'decoded-audio-audit.json'),
                      'peakMaximumDbTP': max(a['truePeakDbTP'] for a in assets)}))


if __name__ == '__main__':
    main()
