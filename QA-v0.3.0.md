# After Dark v0.3.0 — verification

Checked September 9, 2026. Previous release evidence is preserved in QA-v0.2.1.md.

- 33 automated tests pass across four files. Coverage includes upright vehicle pose on all four circuits, actual mesh collision resolution, economy/save migration, correct steering direction, harder cornering/boost demands, faster corner-limited opponents, separate mode/time-of-day records, reward multipliers, and finite engine telemetry with RPM drops on shifts.
- Strict TypeScript and Vite production build pass.
- WebGPU Hard Daytona night sprint completed in 31.75 seconds, fifth place. Purse 234 (180 × 1.3) + style 4 = 238 credits, balance 497 → 735. Saved key `coast-1-hard-night` is independent of old/day/Easy records.
- Hard drive sample minimum vehicle up-vector Y: 0.999871. Barrier contacts occurred without a rollover or ground inversion. The run used ordinary steering/braking/boost keys; it was not an optimized human lap or a full campaign balance study.
- Night city inspected with lit windows, signs, streetlights, headlights and underglow; scenery texture maps and the 3D showroom inspected in-browser. Warm foreground sample was approximately 16.67 ms, CPU frame roughly 4.4 ms, on this desktop. Background/occluded test tabs were intermittently throttled; this is not a universal performance guarantee.
- WebGL 2 fallback loads the night scene and showroom. At 390 × 844, vehicle and customization controls fit; document scroll width is 390. All six product images decoded at their original dimensions and their live product URLs match the catalog.
- All 20 sound files decoded in-browser. In-game audio meter after showroom/UI playback measured approximately -26.34 dBFS peak. This is a sampled output-meter result, not a calibrated listening-volume claim. Per-file integrated loudness/true-peak values are in AUDIO-MIX-QA.json; all files peak below -6 dBTP.
- Generated textures and sounds have source/prompt/hash records. Product fitments were checked against the actual company listings. Account subscription/license details were not readable with the generation key; applicable ElevenLabs account terms still govern commercial use.

Remaining owner validation: listen on representative speakers/headphones; test physical phones, touch/controller feel, final campaign balance, and the actual SlingMods.com iframe. The car remains an original reference-built 2025-style model rather than OEM CAD or an exact asset for every model year.

## Final public build

Final production deployment: dpl_7KoQtEKaYNkh9wGUYskgdRfooir8. All 50 public files (12,482,337 bytes) were fetched anonymously and matched local SHA-256 values. No credential-pattern matches in distributable files.

Easy Daytona night race on the public site: 33.4917 seconds, first place; 650 purse + 2 style = 652 credits. Progress and the separate Easy/night best survived page reload. The final public build's 20 audio assets decoded; race and finish output-meter peak was -12.94 dBFS. Read-only browser event buffer contained no exceptions or log entries (not truncated). This is digital output measurement; actual listening volume still depends on the player's hardware and system setting.

Runtime textures use quality-92 WebP at the original dimensions, reducing the three raster materials from 9.86 MB to 1.88 MB. Original generated PNGs remain in artwork/textures/ in the source archive.
