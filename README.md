# SlingMods: Three-Wheel Tour — v0.4.1

**Play online:** https://slingmods-three-wheel-tour.vercel.app/ — hosted on Vercel, no local server required. See `DEPLOYMENT.md` for the deployed version and update commands.

A playable, original 3D arcade racer built for SlingMods.com. Five regional circuits, an eight-chapter sponsor story, six-rider grids, drafting, drift rewards, boost, and a garage funded by race winnings.

## Repository and automatic deployment

Private source: [DanielKinsner/slingmods-three-wheel-tour](https://github.com/DanielKinsner/slingmods-three-wheel-tour).

Push or merge to `main` to update the existing public Vercel game. Vercel installs the locked dependencies with `npm ci`, runs all tests, builds with TypeScript/Vite, and publishes `dist/` after success. Failed tests or builds leave the last successful deployment live. Other branches receive preview deployments under the existing Vercel protection settings. Local edits alone do not publish anything; commit and push them to GitHub.

Current vehicle, Miami, saved-progress and validation notes are in [STATUS.md](STATUS.md). See [DEPLOYMENT.md](DEPLOYMENT.md) for the workflow and rollback procedure. Secrets, dependencies and local build output are git-ignored.

## New in v0.3.2

The initial loading screen now displays the official SlingMods logo, loaded immediately from the static page before the 3D engine starts.

## New in v0.3.1

Closed and smoothly shaded front hood/grille bodywork, continuous headlamp brows, opaque engine-bay liners, and brighter night/showroom front LEDs with soft surface-aligned glow. Headlight road illumination is stronger; daytime running lights remain restrained.

## Play locally

Requires Node.js 22.12+ or a newer supported release.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. Click **Start your story** or **Quick race**. All five tracks are available in quick race; the story moves through them in order. A race takes about 35–100 seconds, depending on the course, laps, build, and driving.

## Controls

| Action                  | Keyboard              | Standard gamepad            |
| ----------------------- | --------------------- | --------------------------- |
| Steer                   | A / D or Left / Right | Left stick                  |
| Brake                   | S or Down             | LT                          |
| Drift                   | Space while steering  | A while steering            |
| Boost                   | Shift                 | RB                          |
| Throttle in manual mode | W or Up               | RT                          |
| Pause                   | Escape or P           | Menu                        |
| Recover to the road     | R                     | Pause and restart if needed |

Auto-accelerate is on initially. Touch buttons are provided on small screens and touch devices. For stronger drift control, release drift before exiting the corner. Slipstream behind another rider recharges boost. Running wide slows you down. Recovery keeps your race alive but cuts speed.

## Included

- **Daytona After Dark:** a night race variant with street lighting, working headlights, illuminated windows and signs, and RGB underglow. Chapter 4 runs at night. Select Sunset / After Dark for quick races.

- **Smoky Mountain Run / Maggie Valley, NC:** forest bends and elevation changes.
- **Atlantic Boulevard / Daytona Beach, FL:** a coastal city loop with detailed hotel/storefront blocks, balcony towers, palms, streetlights, a promenade, pier, sailboats, and animated water.
- **Hill Country Heat / Texas:** flowing rural roads and rolling terrain.
- **Red Rock Reckoning / Las Vegas, NV:** canyon turns and desert rock formations.
- Eight story chapters with original fictional characters and increasing race objectives.
- Easy and Hard modes in quick races and the story. Hard has unassisted handling, build-matched faster rivals, stricter cornering and boost management, and a 30% larger race purse.
- Nine upgrade stages across power, grip, and boost; five paint choices, six RGB colors and a spectrum cycle. A dedicated 3D showroom features six verified SlingMods products with original catalog photos and direct store links. Stage 3 power calibration and Tour Boost remain clearly fictional.
- Local best times, credits, campaign progress, race/win counts, and settings.
- Reference-built vehicle geometry, physical materials, original/procedural scenery, generated asphalt and coastal building textures, a CC0 HDR sky, generated ElevenLabs audio, and the official SlingMods site logo.
- Responsive interface, keyboard focus states, focus-contained dialogs, reduced-motion support, automatic pause on lost focus, and graphics settings.

## Technology

TypeScript + Vite 8 + Three.js r186. The WebGPU renderer automatically falls back to WebGL 2. Append `?webgl=1` to explicitly test the fallback. Physics uses a fixed 120 Hz arcade model in road-relative coordinates with BVH triangle-mesh collisions for barriers/scenery and road-height queries; this is a racing game, not a vehicle simulator. Rendering uses instanced scenery, batched vehicle parts, physical paint materials, HDR environment lighting and reflections, shadows, smoke, and skid marks. Web Audio plays 20 bundled ElevenLabs clips after a player gesture: three engine loops with RPM crossfades and gear changes, wind, tires, restrained impacts, shifts, installation, eight story briefings, race calls, and a 45-second instrumental. Exports are loudness-normalized, loops are crossfaded, the master bus is compressed, and the music/engine duck under radio. Separate mix controls are available.

The production game has no runtime CDN, analytics, authentication, database, API keys, or paid services. Font files, logo, HDR sky, building/road textures, product photos, audio, scripts, and styles are bundled locally. Game credits have no cash value and do not connect to store balances, discounts, or checkout.

## Build and verify

```sh
npm test
npm run build
npm run preview
```

Upload only `dist/` when the company is ready to publish. See [DEPLOYMENT.md](DEPLOYMENT.md), [QA.md](QA.md), and [RESEARCH.md](RESEARCH.md).

## Source map

| File               | Responsibility                                               |
| ------------------ | ------------------------------------------------------------ |
| `src/content.ts`   | Tracks, chapter dialogue, rival names, upgrades, paint       |
| `src/core.ts`      | Driving, save validation, economy, race rewards              |
| `src/world.ts`     | Renderer, road meshes, cameras, visual effects |
| `src/vehicle.ts` | Detailed roadster geometry, articulated wheels and steering |
| `src/environment.ts` | Regional scenery, buildings, vegetation, water and wind shaders |
| `src/materials.ts` | Local assets, surface maps, tangent-space normals and caching |
| `src/collision.ts` | Triangle-mesh BVH contact detection and response |
| `src/audio.ts`     | Layered engine samples, effects, score, radio and mix metering                 |
| `src/main.ts`      | Screens, input, AI racers, campaign flow, persistence        |
| `src/style.css`    | Responsive presentation                                      |
| `src/core.test.ts` | Economy, saves, driving, and circuit tests                   |

## Scope of this delivery

This is a playable browser game deployed on Vercel with downloadable static output. It has not been installed on the live SlingMods site. The vehicle is an original 2025-style Slingshot interpretation built against reference views and published dimensions. It is substantially more detailed than v0.1, but is not OEM CAD or a verified exact reproduction of every model year. Factory-grade identity will require an approved model-year asset or scan and owner review. Routes are fictional closed courses inspired by real destinations. The release still needs the company's final visual/brand signoff, representative physical-phone/controller playtests, and verification inside the actual site embed. See the evidence and remaining checks in QA.md.

Copyright/asset notices are included in `public/THIRD_PARTY_NOTICES.txt` and copied into the production build.
