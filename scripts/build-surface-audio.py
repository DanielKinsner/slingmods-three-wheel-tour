"""Author deterministic, periodic rolling/air beds without API calls or recordings.

These are synthetic supplementary effects, not recorded Slingshot/Florida sound.
Uses periodic spectral noise and periodic envelopes so WAV loops have no padding.
Requires NumPy. Existing engine, voice, and music assets are never modified.
"""
from pathlib import Path
import hashlib
import json
import wave
from datetime import datetime, timezone
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100


def bed(seconds, seed, center, low, high, roughness, rms):
    n = int(RATE * seconds)
    rng = np.random.default_rng(seed)
    f = np.fft.rfftfreq(n, 1 / RATE)
    gain = 1 / np.sqrt(1 + (f / center) ** 2)
    gain *= (1 - np.exp(-(f / low) ** 4)) * np.exp(-(f / high) ** 4)
    gain[0] = 0
    channels = []
    time = np.arange(n) / RATE
    # Integer cycles per loop guarantee continuous envelope and derivatives.
    envelope = 1 + roughness * (np.sin(2 * np.pi * time / seconds * 7) * .4
                               + np.sin(2 * np.pi * time / seconds * 19) * .25
                               + np.sin(2 * np.pi * time / seconds * 47) * .1)
    common = None
    for channel in range(2):
        spectrum = (rng.normal(size=len(f)) + 1j * rng.normal(size=len(f))) * gain
        spectrum[-1] = 0
        signal = np.fft.irfft(spectrum, n=n)
        if common is None:
            common = signal
        # Close, restrained stereo spread; rolling beds should not feel gigantic.
        signal = (common * .82 + signal * .18) * envelope
        signal *= rms / np.sqrt(np.mean(signal ** 2))
        channels.append(signal)
    return np.stack(channels, axis=1)


def main():
    assets = []
    specs = [
        ('road-roll', 4, 911, 320, 65, 1900, .13, .023,
         'Broadband low rolling texture for dry road; level follows ground speed.'),
        ('shoulder-roll', 4, 912, 650, 90, 2900, .65, .03,
         'More irregular granular rolling texture for shoulder contact, not a tire squeal.'),
        ('coastal-air', 8, 913, 250, 70, 1200, .5, .012,
         'Quiet synthetic coastal air bed; supplementary ambience, no real-world field recording.'),
    ]
    for name, duration, seed, center, low, high, roughness, rms, description in specs:
        pcm = bed(duration, seed, center, low, high, roughness, rms)
        if np.max(abs(pcm)) > .24:
            pcm *= .24 / np.max(abs(pcm))
        path = ROOT / f'public/audio/{name}.wav'
        with wave.open(str(path), 'wb') as handle:
            handle.setnchannels(2)
            handle.setsampwidth(2)
            handle.setframerate(RATE)
            handle.writeframes((pcm * 32767).astype('<i2').tobytes())
        assets.append({'id': name, 'path': str(path.relative_to(ROOT)).replace('\\', '/'),
                       'classification': 'original procedural sound design',
                       'generatedAt': datetime.now(timezone.utc).isoformat(),
                       'provider': 'local NumPy deterministic DSP', 'model': None,
                       'seed': seed, 'description': description, 'sampleRate': RATE,
                       'durationSeconds': duration, 'channels': 2, 'loopRegion': [0, duration],
                       'loopMethod': 'Periodic frequency-domain noise and periodic amplitude envelope; PCM WAV avoids MP3 padding.',
                       'sourceLicense': 'Original project-authored signal; no source recording or third-party sample.',
                       'generationRequests': 0, 'bytes': path.stat().st_size,
                       'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                       'intendedMixGainMaximum': .18 if name != 'coastal-air' else .12,
                       'auditionStatus': 'Review alongside gameplay; never a verified OEM or location recording.'})
    (ROOT / 'AUDIO-SUPPLEMENTS.json').write_text(json.dumps({'schemaVersion': 1, 'assets': assets}, indent=2), encoding='utf-8')
    print(json.dumps({'authored': [a['id'] for a in assets], 'apiRequests': 0,
                      'bytes': sum(a['bytes'] for a in assets)}))


if __name__ == '__main__':
    main()
