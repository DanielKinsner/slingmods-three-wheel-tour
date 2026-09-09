# SlingMods Three-Wheel Tour — Playground live


## Owner-approved production merge — September 9

The owner explicitly requested "please merge it" after reviewing the preview. `feature/harbor-playground` was fast-forwarded into `main` at `c6a6129168510215f94d141a76c8bf68c5d16fab` and pushed. Vercel's first production deployment for this update, `dpl_284kN5NarPK6mJg9XywoP1tdn9HC`, is Ready at https://slingmods-three-wheel-tour.vercel.app/. All 113 tests and the TypeScript/Vite build passed on Vercel. Anonymous GETs of HTML, JS and CSS returned 200 and SHA-256 matched the tested local build. Later documentation-only commits may rebuild these identical game assets.

The permanent public URL now includes Harbor Run, Drift Attack, Free Ride and the removal of Easy-mode road-centering steering. The tested build still identifies itself as `0.5.0-playground-preview`; this label does not mean the public URL is still running v0.4.1. Existing browser progress stays on the same origin. The earlier preview-only boundary below was superseded by this explicit merge approval; no SlingMods storefront changes.

## Historical preview — September 9 fun-first Playground pass

Implemented on `feature/harbor-playground`. [Open the Playground preview](https://slingmods-three-wheel-tour-git-156a60-daniel-kinsners-projects.vercel.app/). The first Git preview (`58b1a2f`, `dpl_Bj1EoUe3rQ9y6NqvSfShTqSKGCrW`) is Ready: Vercel passed all 113 tests and built the same `index-Di4D-ey2.js` / `index-UjAHhiPa.css` filenames as the locally rendered evidence. Existing Vercel sign-in protection is unchanged. The branch alias follows later preview commits. Production `main` remains at `76c7a478cf56e5ccdff229da78f660a2d6baff92`; this pass is preview-only. The five existing destinations, eight chapters, purchased builds, product links, save key/version, ordered gates and receipt accounting remain. New race records use `playground-v2` because handling changed; older records remain stored.

Delivered: progressive steering/recentering and grip recovery, analog throttle/brake, per-wheel road/shoulder grip, shared braking/cornering budget, grade response and contact-direction wall response. Easy assists grip and corner braking without spline steering. Wheels follow contact height, chassis attitude is damped, tire effects use individual contact/slip, and the camera adds restrained corner/acceleration response. Road patches, seams, wear and drains are shared across routes. The original hero mesh, colors/RGB, quality tiers and restrained audio are retained.

Playable expansion: distinct 1.93 km Harbor Run with warehouses, freight stacks, covered inspection lane, tank farm, cranes, cargo ship and waterfront skyline; day/night options. Drift Attack runs 90 seconds on all routes with controlled-slide combos, banking and separate saved bests. Free Ride removes opponents/countdown/end pressure and adds twelve session-only boost tokens. No paid assets, API requests, new services or desktop/browser-session interaction.

Validation: 113 tests and TypeScript/Vite build pass. Isolated headless WebGL checks exercise original races, new modes, steering/throttle, score saving, cockpit and 390×844 mobile/reduced-motion layout. A full 90-second virtual-gamepad Drift Attack earned/saved 1,624 points without altering campaign credits/chapter. Actual screenshots, silent gameplay recording and raw telemetry are indexed in `evidence/playground/README.md`. The final visual pass caught an initial-render stall that paused Free Ride: scene preparation now finishes before the event clock begins; subsequent long-frame protection remains intact.

Limits: headless Windows/ANGLE WebGL is the current visual lane. WebGPU code remains, but this pass did not establish a new WebGPU, physical phone/controller, GPU-timing or human listening result. The planar model does not simulate airborne rigid bodies; existing suspension-link meshes are not separately rigged. No claim of an OEM simulator or an open world. Earlier production/manual-browser evidence below is historical.

## Git delivery — September 9 follow-up

Private repository created at https://github.com/DanielKinsner/slingmods-three-wheel-tour with the existing source history and `main` default branch. Connected to the existing Vercel project; its Git settings confirm `productionBranch: main`. `vercel.json` now gates automatic publishing on all tests and the TypeScript/Vite build. End-to-end verified: push `23c2d52` automatically created production deployment `dpl_4uC1CDVB9tZccFivCYLtuwWaoma4` with source `git`; all 99 tests passed on Vercel, TypeScript/Vite built successfully, and GitHub reported success. The permanent URL resolved to that deployment and its public game assets matched the verified visual build. See evidence/git-auto-deploy.json. Historical deployment IDs below refer to the earlier visual-finish promotion, not later Git rebuilds. See DEPLOYMENT.md for updates and rollback.

## Historical release — September 9 visual finish

[Play the current game](https://slingmods-three-wheel-tour.vercel.app/). The owner explicitly approved production promotion. Vercel reports production Ready at `dpl_BDutzGXHPPjyH9WMYh1a1poXHTxn`, promoted from verified preview `dpl_AFGdWQAQcS8pcvzZXgtGc75966ei`. Anonymous GETs of HTML, JS, CSS, both vehicle meshes and the new window atlas all returned 200 and byte-matched the local build. See PRODUCTION-DEPLOYMENT.json. The original permanent address is retained; no storefront changes.

This bounded visual pass adds softer clearcoat reflections, less reflective upholstery, clearer non-shadow-casting windshield glass, soft underbody contact shading, a quieter night sky, warmer Miami coastal sunlight and eight illustrated window-interior variants with curtains, furniture and lamps. The new atlas is 13,338 bytes; existing geometry, paint/RGB choices, audio mix, race/save rules and all five destinations are retained. No paid generation or credential use this pass.

Validation: TypeScript/Vite production build and all 99 tests pass. Actual Windows Chrome/WebGPU garage and Miami day/night views were inspected, including the uploaded preview; no console errors observed. Permanent production boot shows v0.4.1, five stops, and the existing owner save at chapter 06/08 with 8 credits. Evidence is indexed in evidence/visual-finish/README.md. These are real desktop checks, not physical-phone testing.

This pass adds one soft-shadow draw per vehicle and a 512x384 room atlas; it adds no building triangles. No new sustained frame-rate or GPU timing claim. A background-tab race check auto-paused, so it does not establish a new completed-lap result. Earlier complete-lap and audio recordings below remain historical evidence. Human audio audition, physical mobile/controller checks, OEM validation and full manual campaign balancing are still open; promotion does not certify them.

## Owner-angle refinement — September 9 follow-up

Implemented from the owner's `D:\slingshot angles` R references: contoured bucket seats, hood channels/shoulders, integrated center-light eyebrow, recessed outer optics, rear deck/spine, wraparound tail lamps and rear spring. All paint/RGB choices, axle transforms and gameplay code are unchanged. Both GLBs and Blender masters/turntable were rebuilt. Full: 53,212 triangles / 2,343,704 bytes; reduced: 22,938 triangles / 1,227,008 bytes. Both retain 45 mesh groups.

Build and 99 tests pass; GLB structure, animation/customization contracts and wheel transforms validated. Actual WebGPU garage paint/RGB changes, rear lights and moving night-race cockpit were inspected without console errors. Before/after frames are under evidence/reference-refinement. This art follow-up does not renew the older full Miami performance claim; a short gameplay clip includes a background/long-frame pause and is visual evidence only. Updated preview model hashes match local assets. See docs/owner-angle-refinements.md.

Historical preview boundary: production stayed at v0.3.2 until the owner explicitly approved promotion on September 9. The current production release is documented above. The real storefront remains unchanged.

## Historical verified v0.3.2 baseline

The live JS/CSS bytes match this workspace. Actual stack: TypeScript, Three.js 0.186.0, Vite 8.2.2. No Vue dependency. Four preserved tracks: smokies, coast, texas, desert. Eight chapters and existing real product links remain authoritative. Miami will be an explicitly new fifth destination. The brief's Ozarks/Sturgis/Vue findings do not match the inspected code.

Chapter bonus is currently paid once; result replay still needs persistent idempotency. Engine gears/RPM are speed-derived. Finish is accumulated-distance-only. 120 Hz fixed stepping already exists but caps wall delta at 50 ms. HUD already uses m/s x 2.237. Shadow map is 2048, not 8192. Space is drift; Shift is boost. Preserve these controls.

## Checkpoints

1. Baseline source commit and playable frozen copy on localhost:4174. Capture harness records actual canvas plus final audio bus; UI frames are separate. No race inputs are automated by that harness.
2. Implemented: ordered 32-gate races, persistent receipt IDs, version-2 save migration, shared physical drivetrain/gear/RPM, planar independent X/Z/yaw controller, three contact/load samples, automatic/manual shifting, bounded body attitude, same controller for AI. Existing record keys survive; new rules use separate best-time keys. No full rigid-body rollover/jump simulation claim.
3. Integrated: original Blender R-inspired GLBs (full 46,060 triangles; LOD 19,916), animated gauges/wheels/steering, original material maps, Miami fifth circuit and three facade families. Owner rim/exhaust finish, garage lighting and actual rendered build-photo download added.
4. Integrated: three original DSP surface/air loops, staged audio loading, shared RPM/load mixing, restrained levels, radio subtitles/cooldowns. All existing engine/voice/music files retained. ELEVENLABS_API_KEY is absent in current process/user/machine environment. Zero new ElevenLabs requests; bounded fail-closed cached generator and dry run delivered.
5. Final review candidate: build/typecheck, 99 game tests and 8 mocked-network generation safety tests pass. All five routes complete in simulation through 32 gates. Tests cover 30/60/120/144 Hz, ordered gates, thin walls, reverse seams, shoulders, receipts, migration and three-wheel grounding. Manifests, playable recordings and measured profiles delivered; see REVIEW.md and evidence/INDEX.md.

Live browser testing caught a shoulder-height bug absent from the center-road fixture: the car dropped to lower terrain beside asphalt and could pass under a rail. The failed recording is retained. Ground contacts now query shoulder and terrain triangles too. Outward collision tests pass on all five tracks (maximum lane 9.922 m, zero lost ground contacts); fresh full Miami gameplay passed. Easy adds corner braking assistance; Hard retains unassisted control.

Physical iPhone/Safari, controller hardware and human speaker/headphone audition are not available/verified. Do not infer them from viewport or software checks.

## Historical review deployment and evidence

[Play preview](https://slingmods-three-wheel-tour-riwaaa1fb-daniel-kinsners-projects.vercel.app/). Existing Vercel protection requires an authorized account. Verified in the owner's signed-in Chrome session; anonymous requests redirect to Vercel login. Protection was not changed. JS/CSS hashes match the local build (PREVIEW-DEPLOYMENT.json). At this review checkpoint production remained dpl_kgBwd3XtaFjDF6sNR5egHrdnX31o; the later owner-approved release above supersedes that state.

Actual baseline Daytona, full Miami night and garage customization videos, comparable garage frames, downloaded owner photo, neutral vehicle views/turntable and engine/gameplay A/B are delivered. Canvas videos omit the DOM HUD; actual UI was inspected in browser screenshots. New preview origin correctly starts at zero credits; production progress is not copied.

Final Miami night lap: 73.802 s, 4,423 raw frame intervals. p50 16.7 ms / p95 16.8 ms / p99 16.9 ms; two frames above 33.34 ms, maximum 83.4 ms. RTX 4080/i9-12900K Windows Chrome/WebGPU; viewport 2560×1215, drawing buffer 2248×1067. CPU render-submission p95 8.6 ms; GPU timing not measured. Not a midrange/mobile or locked-frame-rate claim.

WebGL 2 boot and garage/cockpit inspected at 390×844 portrait and 844×390 landscape desktop emulation. Only reduced GLB loaded at mobile boot. No console errors; no physical-phone or simultaneous multi-touch hardware claim. Latest cockpit correction was checked separately after the full benchmark.

Recorded Miami mix: -35.0 LUFS integrated, -13.8 dBFS true peak. Short baseline/upgraded gameplay comparison retains actual levels. This model cannot hear audition input; human listening approval remains open. No new ElevenLabs calls/spend or paid overages. Three original DSP assets were generated and integrated; inherited engine/voice/music files retained.

The first capture harness held mutable CPU/nested telemetry references; those early distributions are invalid and excluded. Final snapshots are copied. Baseline timing is smoothed only and cannot establish an apples-to-apples raw-frame improvement.

## Partial and deferred

Owner/OEM proportion and upholstery/panel-curvature review remain. Drivetrain calibration is provisional, not OEM validated. All chapters remain reachable in tests, but the full manual eight-chapter balance playthrough is unfinished. Physical iPhone/Safari/controller testing, human mix audition, inherited asset commercial entitlement review and broader hardware/GPU profiling remain open validation gaps and have not been certified by the production promotion. Ghosts, multiplayer, remapping, jumps and KTX2/Draco are deferred.

Reproduce: `npm ci`, `npm test`, `npm run build`, `npm run preview -- --port 4173`. Editable asset masters and generation scripts are included. Source checkpoints: 1106826 baseline, fd5bdba integration; final evidence checkpoint is in git history.
