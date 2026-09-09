# Audio audit and bounded production workflow

Inspected 2026-09-09. This workspace contains `engine-idle.mp3`, `engine-mid.mp3`, and `engine-high.mp3`, not the brief's `prostar2000-*` filenames. Existing provenance describes ElevenLabs-generated approximations, not recordings of a Polaris engine. Their prompts request nominal 1200 / 3300 / 5800 RPM; those numbers are sound-design anchors, not measured engine identity.

## Before changing sound

All 20 original engine, voice, effects, and music files are preserved. `scripts/analyze-audio.py` decodes the actual delivery files using FFmpeg, measures integrated loudness and true peak, inspects sample discontinuities at the loop wrap, and creates a playable audition with three complete repeats of each existing engine band. The separate short audition has three seconds per band, idle then mid then high. Both use a conservative .1595 gain, corresponding to the game's .55 master × .58 engine × .5 final trim before any compressor makeup.

Evidence lives in `evidence/audio/decoded-audio-audit.json`, `existing-engine-loop-audition.wav`, its timestamp cue sheet, and `existing-engine-short-audition.mp3`. These are real decoded audio renders, not gameplay recordings. Attempting model audio input returned **“audio content omitted because you do not support audio input.”** Therefore no model auditory quality pass, owner listening approval, headphones test, or ordinary-speaker test is claimed. No existing recording was replaced without audition.

| Delivered sound | Integrated LUFS | True peak dBTP | Wrap jump dBFS | Wrap / in-file 99.9th-percentile difference |
| --- | ---: | ---: | ---: | ---: |
| Idle | -21.65 | -11.03 | -36.11 | 2.66 |
| Mid | -21.08 | -11.39 | -37.32 | 0.08 |
| High | -21.10 | -12.15 | -33.45 | 0.40 |
| Road rolling supplement | -30.58 | -20.89 | -54.32 | 0.34 |
| Shoulder supplement | -27.61 | -15.58 | -47.58 | 0.29 |
| Coastal air supplement | -36.51 | -24.23 | -68.72 | 0.16 |

The largest true peak across all 23 assets is -6.34 dBTP. The idle wrap has a larger discontinuity than typical interior sample differences and warrants a headphone loop check. This is a numerical flag, not proof of an audible click. Strong low spectral bins remain approximately 67 / 113 / 238 Hz across the respective engine clips; harmonics and mechanical content mean these must not be interpreted as verified crankshaft RPM. Browser decoder wrapping still needs runtime review.

## Original supplementary assets delivered

`scripts/build-surface-audio.py` authors three deterministic periodic sound beds without any API, recordings, or third-party samples:

- `public/audio/road-roll.wav`: subdued dry-road rolling texture.
- `public/audio/shoulder-roll.wav`: more irregular granular rolling texture for off-road contact.
- `public/audio/coastal-air.wav`: quiet coastal air approximation for Miami/Daytona ambience.

These are sound-designed synthetic layers, not field recordings or verified Slingshot sound. Periodic spectral noise and amplitude envelopes keep the loop continuous; PCM WAV avoids codec delay/padding. Use at most .18 for road/shoulder and .12 for coastal ambience before the existing effect/master/trim chain. Crossfade surfaces smoothly; don't substitute the shoulder bed for slip-driven tire squeal. `AUDIO-SUPPLEMENTS.json` records their seed, source, loop region, rate, checksums, and intent. Delivery payload is 2,822,532 bytes in total; load the optional coastal bed only when useful. Original masters/auditions are outside `public/` and do not enter the initial client download.

## Shared telemetry integration contract

Physics owns `rpm`, `gear`, `load`, `shiftRemaining`, `shiftSerial`, three wheel angular speeds, `slipRatio`, `surface`, `throttle`, and `brake`. Audio must not derive a second gear state from road speed. Suggested retained-band design:

- Blend adjacent RPM bands with equal-power weights, retaining provisional 1200 / 3300 / 5800 sample anchors and restrained pitch ratios.
- Scale engine level/filter by load; briefly dip during the authoritative shift interruption, then recover smoothly.
- Play the existing restrained shift effect on a new `shiftSerial`, not when an independent audio gear counter changes.
- Use absolute physical speed in meters/second for wind/rolling levels. Use slip magnitude and surface to separate tire scrub from rolling texture.
- Preserve the .55 master, protective compressor, and .5 trim after it. Dialogue ducks engine/music; the original recordings are already quiet enough to retain headroom.

The main implementation agent owns runtime integration and its measurements. This audit is not evidence that a full gameplay A/B or every runtime state has been heard.

## ElevenLabs safe generation

Current official documentation confirms [the sound-generation endpoint](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) accepts `eleven_text_to_sound_v2`, `loop`, duration, and optional billing header `character-cost`. [Subscription documentation](https://elevenlabs.io/docs/api-reference/user/subscription/get) defines `max_credit_limit_extension=0` as disabled usage-based billing. These sources were checked during implementation; they do not prove this account's entitlement.

`scripts/generate-audio.py` is local/build-time only. Its default is a no-network dry run for two supplemental auditions, never an engine replacement. It accepts the existing secret only from process environment `ELEVENLABS_API_KEY`. The observed dry run reports that name **not configured**. No key is printed, written to the manifest, put in a `VITE_*` variable, or requested from gameplay.

Execution requires an explicit credit budget, a current per-second upper pricing bound and evidence, and a read-only subscription response proving no overage plus enough included credits. It never changes a plan or billing setting. A lock prevents concurrent writers. Requests are serial, with zero automatic retries, and every attempted/uncertain request reserves its full budget before submission in a durable ledger. At most 24 requests including reruns can be submitted; the default total cap is 2. Completed hash-verified jobs are cached. Unknown or over-budget returned billing stops this and subsequent runs for review. Uncertain network failures keep their budget reservation. Generated masters remain in `artwork/audio-generated` until separately decoded, auditioned, and approved for integration.

**Exact current blocker:** `ELEVENLABS_API_KEY` is absent in this process; account no-overage state, included credits, and current credit pricing cannot therefore be verified. New ElevenLabs generation submitted: **0 requests**. The lawful fallback is the authored supplemental DSP files above. The presence of historical generated assets does not establish current commercial entitlement; retain the existing account/license review requirement.

## Reproduce

```powershell
python scripts/build-surface-audio.py
python scripts/analyze-audio.py
python scripts/test-audio-generation.py
python scripts/generate-audio.py
```

Python requires NumPy and FFmpeg on PATH. The safety suite exercises no-network dry run, missing secret, missing budget, hash cache, timeout reservation across restarts, unknown billing stop, insufficient included credits, and overage rejection. All eight pass without real network calls or credentials.
