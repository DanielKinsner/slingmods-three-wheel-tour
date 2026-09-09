# Coastal Update v0.2.1 — verification record

Checked locally on September 9, 2026. These are observed checks of the playable review build, not universal device support or a complete human campaign playthrough.

## v0.2.1 rollover fix

The reported barrel roll was reproduced in the actual `World.placeCar` method without a collision. Aligning only the forward axis with a shortest-arc quaternion let a shallow slope near the reverse heading turn the vehicle upside down: the up vector reached approximately -0.99955. Scans of every circuit also reproduced inversion before the fix.

The vehicle now uses a road frame constructed from forward and world-up directions. Pitch follows the grade; the frame preserves upright orientation through a full turn. Steering slip is limited to ±0.55 radians and decorative body lean to ±0.033 radians (about 1.9 degrees). Roadside rails and curb segments use the same upright frame. Simulation input direction and collision response are unchanged.

Seven new regression checks failed before the fix and pass afterward: the exact shallow-slope/reverse-heading reproduction, all four tracks sampled every 0.5 metres at neutral and both steering extremes, continuity through the reverse heading, and excessive lateral-impulse limits. They exercise the production placement method with lightweight vehicle fixtures.

Browser verification on the v0.2.1 WebGPU production build:

- Completed Maggie Valley in **38.59 seconds, first place**. All six vehicles stayed upright in 139 diagnostic samples over the monitored latter portion of the race; minimum world-up alignment was **0.99126**. The first approximately 12 seconds were not included in these numeric samples.
- A separate hard-left/hard-right run produced **20 barrier contacts**. The player's minimum world-up alignment across 105 samples was **0.99635**, with maximum absolute lane offset 9.923 metres. No inverted vehicle was observed.
- Preview and both archives updated to v0.2.1. Prior v0.2.0 renderer/economy evidence below is retained as history, not relabeled as a rerun of every check on this patch.

## Public Vercel deployment

Deployed v0.2.1 on September 9, 2026 to https://slingmods-three-wheel-tour.vercel.app/ at the user's request. Vercel reports deployment `dpl_4mQn2i9XS64JUTTMfuqjyy1rJ32a` READY with the production alias assigned.

- Anonymous HTTPS GETs verified all **22 runtime files**, totaling **9,562,781 bytes**, against the local SHA-256 manifest.
- Hosted WebGPU coastal race: **32.97 seconds**, second place, correct **451-credit** award. All six cars remained upright in 191 sampled observations (minimum world-up alignment 0.99984).
- Reload preserved credits, best time and race count on the public origin.
- No runtime exceptions or console errors in the complete, untruncated browser event window for the hosted race and reload.
- Temporary browser focus emulation was disabled after testing. No protection settings, paid plan, custom domain or SlingMods.com storefront changes were made.

## Automated checks

- `npm test`: **27 tests passed**, three test files.
- `npm run build`: **strict TypeScript and production build passed**.
- Runtime dependency audit: **0 reported vulnerabilities** when checked.
- Save validation: malformed data, bounds, settings and best-time keys.
- Economy: insufficient funds, stage costs/caps, failed objectives, one-time chapter bonuses, capped style rewards and all eight sequential chapter unlocks.
- Driving: upgrades, braking, boost, drifting, recovery, fixed-step consistency and keyboard/gamepad direction against the circuit/chase-camera projection basis.
- Circuits: four finite closed loops, simulated completion and terrain below sampled road positions.
- New mesh checks: road triangle height queries, transformed and instanced solids, lateral barrier pushout/speed response, clear space and disposal/rebuild behavior.

## Earlier v0.2.0 browser evidence

Windows Chromium browsers with an NVIDIA Lovelace adapter. Desktop/default views plus 1440×900, 390×844 and 844×390 viewport checks. Viewport emulation does not establish physical-phone GPU or multi-touch performance.

| Check | Observed result |
| --- | --- |
| Steering, WebGPU | Ordinary A taps moved lane from -2.79 to +0.69 (screen left); D taps then moved it to -2.71 (screen right). Wheel pivots steer independently of wheel spin. |
| Barrier/recovery | Deliberate contact incremented the mesh contact counter, reversed lateral velocity toward the road, reduced speed and showed the barrier notice. R recovered the vehicle. |
| Florida sprint, WebGPU | Intentional collision/recovery run: 34.06 seconds, fourth place, 246 credits. |
| Story, WebGL 2 | Forced with `?webgl=1`; Maggie Valley completed in 39.15 seconds, first place. Awarded 650 purse + 1 style + 900 sponsor credits and advanced chapter 0 to 1. |
| Garage/reload | Power stage 1 cost 700 and grip stage 1 cost 600. Balance changed from 1,797 to 497; stages, chapter, paint, best times and race counts survived reload. |
| Final coastal build, WebGPU | After guardrail/camera refinements: 1-lap Sport race completed in 33.07 seconds, second place, 451 credits. Switched from 1440×900 to 844×390 during the race. |
| Camera | Final race samples kept the player origin within the screen: horizontal NDC approximately -0.003 to +0.10, vertical -0.61 to -0.42. Screenshots inspected. Camera follows translation without accumulating extra distance at speed. |
| Pause/resume | Used during viewport checks and race verification; stopped until resumed. |
| Frame pacing | Warm foreground race samples around 16.67 ms (roughly 60 fps) on this machine, with both renderers. Loading and shader-compilation frames were slower. |
| Regions/garage | Inspected all four regions and front/side/rear garage views. Corrected grade-stepped barriers, portrait garage contrast/spacing and phone camera framing. |
| Phone controls | Activated visible left/right steering buttons at portrait width. Physical multi-touch and controllers still require device testing. |

The WebGL story pass predates the final guardrail alignment, scene disposal and chase-camera refinements. The final WebGPU race includes those changes. Shared logic and collision tests passed after final code changes.

Background tabs initially ran at about one frame per second despite short CPU render times. Bringing the testing tab forward and temporarily enabling browser focus emulation restored normal pacing. Focus emulation and viewport overrides were reset afterward. Frame-time reporting includes slow frames; it does not filter them out to manufacture a result.

## Assets and package checks

- Company logo is self-hosted. Vehicle/environment meshes are original artwork, not OEM CAD or manufacturer-supplied assets.
- Asphalt was generated for this game. The bundled 2K sky HDR is Poly Haven's CC0 `kloppenheim_06_puresky`; provenance and license links are in `THIRD_PARTY_NOTICES.txt`.
- Materials include clearcoat, environment reflections, tread/leather/carbon detail and normal maps. Water, banners, foliage and boats have time-driven animation.
- Engine, effects and music are synthesized. No downloaded recordings.
- Three.js and three-mesh-bvh MIT notices and Barlow SIL OFL text are included in the static build.
- Production JavaScript: approximately **1.057 MB raw / 301 KB gzip**. HDR, asphalt, fonts and logo are additional files.
- Runtime assets are self-hosted. The explicit SlingMods store link is external navigation; no account, checkout, analytics or prize backend was added.
- ZIPs exclude `node_modules`. Every served web file is compared with its local SHA-256 and both ZIPs are integrity checked. `BUILD-MANIFEST.json` records web-file sizes/hashes; `SHA256SUMS.txt` records archive hashes.

## Scope and release validation

The vehicle is a substantially more detailed original 2025-style approximation informed by published dimensions and visual references. Exact model-year/OEM fidelity is not established. A manufacturer-approved or professionally authored production model is the next step for that standard. No OEM endorsement or licensing clearance is claimed.

Collisions query actual road/scenery triangles with a three-sphere vehicle envelope. Driving remains a fixed-step arcade simulation, not a full rigid-body tire/suspension simulator. Florida is an original coastal city environment, not a scanned replica of Daytona Beach.

Before a SlingMods.com customer rollout: company vehicle/brand review; full human campaign and sound/balance playthrough; physical phones/controllers; Safari/Firefox and low-power hardware; actual SlingMods staging iframe, fullscreen, storage, CSP and storefront checks. These remain uncompleted. The Vercel review build is publicly deployed; real purchases, coupons and prizes are not connected.
