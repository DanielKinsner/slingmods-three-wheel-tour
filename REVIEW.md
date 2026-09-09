# Owner Tour v0.4 — review candidate

This evolves the deployed game; it does not replace it with Apex Tour. Source inspection found TypeScript/Three.js/Vite and four existing circuits, not the brief's Vue/five-track description. Those four IDs and all eight chapters are preserved. Miami is a new fifth quick-race destination.

## What changed

1. Original Blender R-inspired hero and reduced-detail GLBs replace the default procedural vehicle, with a procedural fallback. Enclosed nose, separate front optics, three wheel pivots, dashboard needles, roll hoops, seats and mechanical details. The art remains an approximation requiring owner proportion review.
2. Independent X/Z/yaw driving, rear traction limit, braking/load transfer, three road/shoulder/terrain contacts and swept chassis collision queries. AI uses the same controller. Easy assists steering/corner braking; Hard requires the driver to steer and brake. This is a stable planar simcade model, not a full rigid-body/jump/rollover simulation.
3. One RPM/gear/load/shift state drives acceleration, dashboard, wheel rotation and audio. Automatic or Q/E manual shifts, brake-to-reverse, cockpit camera, and restrained RPM-band audio mixing. Engine timbre remains the inherited generated approximation.
4. Miami adds an original 1.81 km coastal city circuit, three facade families, ten new material/decal maps, marina/boats, streetlights, night windows and on-demand textures. Night RGB and headlight glow remain supported in Daytona too.
5. Owner paint/RGB, wheel and exhaust finish, studio presets, and a downloadable branded photo of the actual rendered build. Real product links and fictional game-credit upgrades remain intact.

Ordered 32-gate progress prevents distance-only wins. Race receipts prevent a repeated finish from paying twice. The alleged double chapter bonus did not reproduce in the original code; it was already paid once. Version-two saves retain credits, upgrades, campaign position, colors/settings and old bests. New-rule best times use separate keys. Saves remain local to this browser and origin; a preview URL starts its own save and does not inherit production progress.

## Validation and boundaries

Build/typecheck and 99 game tests pass; eight mocked-network generation safety tests pass. Tests exercise 30/60/120/144 Hz, actual road/shoulder BVHs on all five circuits, thin walls, outward shoulder impacts, reverse seams, checkpoint order, recovery, receipts, old-save migration and staged audio loading. All five routes complete with Easy assistance and with AI control through 32 gates. This is simulation evidence; it does not imply physical controller/iPhone testing or a manual playthrough of every campaign chapter.

Actual Chrome footage includes a frozen v0.3.2 Daytona baseline, full Miami night laps and garage customization. The first Miami attempt exposed a shoulder-height bug; the failed recording is retained. The fix adds actual shoulder/terrain contacts and has dedicated outward-steering regressions. Later full laps finished in 1:13.80 with the expected 680-credit purse/style reward and no sponsor bonus for quick racing.

Performance reports distinguish raw requestAnimationFrame intervals, sampled CPU submission time and GPU time (not measured). The identified test computer is a high-end RTX 4080/i9-12900K Windows desktop. Recording and background processing affect performance; no midrange, physical-mobile, locked-60-FPS or GPU-timer claim is made. Adaptive rendering now caps its initial pixel budget; High and Performance remain selectable.

The initial capture harness held mutable CPU/telemetry references. Its early CPU distributions and per-frame nested telemetry are invalid and excluded from acceptance; primitive time/speed/frame counts and actual media remain useful. The final harness copies snapshots. The capture records the 3D canvas and final audio bus; the HUD is visible in separately inspected browser screenshots, not in canvas videos.

Audio is decoded/measured and genuine playback captures are provided. This model cannot hear the audition tool's audio input, so no headphone/speaker listening approval or click-free claim is made. Existing engine assets were retained. Three original DSP surface/air loops were actually generated and integrated. No ElevenLabs key is present in the current environment; zero new ElevenLabs calls were made. The cached, bounded generator fails closed and never runs in gameplay.

Remaining work: closer owner/OEM shape review, richer upholstery/panel curvature, measured engine recordings and human mix audition, physical mobile/Safari/controller tests, full campaign balance playthrough, GPU timing, and a broader performance matrix. Ghosts, multiplayer, control remapping, physically simulated jumps and compressed KTX2/Draco delivery are deferred. Inherited commercial asset entitlement is documented in ASSET_LICENSES.md rather than assumed cleared.

## Reproduce

`npm ci`, `npm test`, `npm run build`, then `npm run preview -- --port 4173`.

For local evidence capture: run `python scripts/capture-server.py`, visit `http://127.0.0.1:4173/?review=1`, and use QA RECORD/FRAME. Captures go to `evidence/captures/`. The harness is inert on hosted domains. Raw WebM recordings stay in the local delivery and are git-ignored; edited MP4 evidence is versioned.

Vehicle authoring: Blender 4.5 LTS, `blender --background --python scripts/build-hero.py`. Miami textures: `python scripts/generate-miami-assets.py`. Sound beds: `python scripts/build-surface-audio.py`. Asset/hash/secret-pattern inventory: `python scripts/asset-manifest.py`. The ElevenLabs generator defaults to a no-network dry run and requires its documented secure environment and explicit budget before any request.

Deployment is a [separate Vercel preview](https://slingmods-three-wheel-tour-riwaaa1fb-daniel-kinsners-projects.vercel.app/) only. Existing Vercel protection requires an authorized account; verified in the owner's signed-in Chrome session. Anonymous requests redirect to Vercel login. Production and the real SlingMods storefront remain unchanged. See STATUS.md for final measured results and evidence/INDEX.md for recordings, comparison frames and the audio A/B.
