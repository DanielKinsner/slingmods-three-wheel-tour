# Legit Slingshot branch evidence (September 9, 2026)

Headless Chromium (WebGL via ANGLE) captures of `feature/legit-slingshot`, downscaled to 1280 px.
Seeded save: 20,000 CR, Power 2 / Apex 3 / Boost 1, Mesh V wheels, underglow kit, Royal Red Crystal.
Headless WebGL renders the studio darker than Chrome's WebGPU path.

| File | What it shows |
| --- | --- |
| garage-front/side/rear.png | Lofted, creased body with the full parts build |
| garage-night.png | RGB night mood, underglow kit, headlight halos on the new nose |
| race-day.png / race-night.png | Parts persist into racing; rivals carry seeded builds; night headlights |
| race-night-cockpit.png | Raised eye point over the 0.95 m cowl |
| install-moment.png | Wheel set caught mid drop-in animation |
| build-photo.png | Saved build photo with the spec line |
| mobile-garage.png | 390x844 layout, reduced GLB tier |
| production-preview.png | `npm run build` output served by `vite preview` |
| overlay-*.png | Reference silhouette (red/yellow) over the Blender evidence renders |

Regenerate: `node scripts/capture-build.mjs <outdir>` (add `--mobile`, or `BASE_URL=http://127.0.0.1:4173` for a production preview).
