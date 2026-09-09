# Hosting and embedding

## Current Vercel deployment

**Public game:** https://slingmods-three-wheel-tour.vercel.app/

Version **0.3.2**, deployed September 9, 2026 to `daniel-kinsners-projects/slingmods-three-wheel-tour`. Deployment ID: `dpl_kgBwd3XtaFjDF6sNR5egHrdnX31o`. No login is required at the public game URL. SlingMods.com integration is a separate step.

The deployment uses Vercel's [Build Output API](https://vercel.com/docs/build-output-api). The already-verified `dist/` files were copied into `.vercel/output/static/` and deployed without a remote rebuild. All 50 public files were fetched anonymously and their SHA-256 hashes matched `BUILD-MANIFEST.json`. The v0.3.2 initial loading screen shows the SlingMods logo before the engine initializes. Desktop and 390-pixel mobile layouts were checked, and normal startup reached the home screen. Prior vehicle/lighting and race/audio verification is preserved in QA-v0.3.1.md and QA-v0.3.0.md.

To publish a future update from this source folder after building and reviewing it:

```powershell
npm ci
npm test
npm run build
vercel link --yes --scope daniel-kinsners-projects --project slingmods-three-wheel-tour
npm run prepare:vercel
vercel deploy --prebuilt --prod --yes --scope daniel-kinsners-projects
```

The CLI requires Vercel authorization. `.vercel/` is local deployment metadata/output and is excluded from the source archive. No Git repository or automatic deploy trigger was configured. `vercel.json` also provides build/output/cache settings for a future source-based deployment.

To embed the hosted game, use `https://slingmods-three-wheel-tour.vercel.app/` as the iframe `src` in the example below. Saves are scoped to this origin and do not automatically transfer from localhost or to a later custom domain. Verify the actual storefront iframe before adding it for customers.

## Hosting directly on SlingMods.com

The output is static. No account system, application server, CORS changes, cross-origin isolation, or store integration is required. Do not upload `node_modules/` or the source folder to the public site.

## Suggested location

Serve the contents of `dist/` at a company-controlled path such as:

`https://www.slingmods.com/games/three-wheel-tour/`

This is a proposed path, not an existing deployment. Vite uses relative asset paths so a subdirectory works. Serve over HTTPS with normal MIME types for HTML, JS, CSS, PNG, WebP, JPEG, MP3, SVG, WOFF/WOFF2, and HDR (binary/octet-stream is acceptable). Keep textures/, audio/, and products/ beside index.html. Preserve `THIRD_PARTY_NOTICES.txt`.

Use a short cache lifetime for `index.html` and long immutable caching for hashed files inside `assets/`. Enable Brotli or gzip. Include a trailing slash on the game URL so relative assets resolve correctly.

## Embed example

```html
<iframe
  src="/games/three-wheel-tour/"
  title="SlingMods Three-Wheel Tour racing game"
  width="1440"
  height="900"
  loading="lazy"
  allow="fullscreen; gamepad"
  allowfullscreen
  style="display:block;width:100%;height:min(900px,90svh);min-height:600px;border:0"
></iframe>
<p>
  <a href="/games/three-wheel-tour/" target="_blank" rel="noopener">
    Open the game in its own window
  </a>
</p>
```

Same-origin hosting keeps browser save behavior straightforward. If hosting on a different subdomain, verify storage and the parent's frame/security policies there. Do not disable security headers across the storefront to embed a game. Configure the game route specifically using the site's existing security practices.

The game starts audio only after interaction. Clicking into the iframe gives the game keyboard focus. Moving focus elsewhere pauses the race. On phones, the separate-page link usually offers the best available space.

If the site enforces a strict Content Security Policy, validate the actual build on staging. The game creates canvases, procedural textures, Web Audio nodes, and inline style attributes for paint swatches and track colors. It does not need external script, font, image, or analytics domains.

## Release steps

1. Review the original vehicle portrayal, game name, actual SlingMods logo usage, story, and fictional performance upgrades. This delivery does not include a Polaris license or assert any OEM endorsement.
2. Run `npm ci`, `npm test`, and `npm run build` from the source folder, or use the supplied matching web build ZIP.
3. Host the build on the company's staging route. Test the iframe, fullscreen, focus/pause, fresh saves, returning saves, storage-denied behavior, and the outgoing store link.
4. Play at least one full race on representative physical iPhone and Android devices and with the controller models the company wants to support. Mobile browser emulation is not a substitute for that test.
5. Publish the static files through the company's normal process after review.

## Data and store boundaries

Progress is saved under `slingmods-tour-v1` in localStorage. It is local to the browser/origin, editable by the player, and not suitable for prizes or coupon eligibility. The game handles unavailable storage without requiring login, but progress in that session will not persist. A future online leaderboard or promotional reward feature needs its own validated server, rules, and abuse controls.

The garage's external link opens the SlingMods homepage in a new tab. It does not add products to carts or associate game stats with real product performance. Original arcade boost is explicitly fictional.

## Reversible rollout

Keep the previous build directory and replace the game files atomically where possible. To withdraw the game, remove the storefront entry/iframe first. Save format version 1 is independent of deployment filenames; rebuilding does not intentionally reset player progress.
