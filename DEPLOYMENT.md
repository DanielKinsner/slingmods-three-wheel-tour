# Hosting and embedding

## Current Git-connected Vercel project

**Public game:** https://slingmods-three-wheel-tour.vercel.app/

**Private repository:** https://github.com/DanielKinsner/slingmods-three-wheel-tour

**Project:** `daniel-kinsners-projects/slingmods-three-wheel-tour` (`prj_8GgNcjmAI4DbJjUjV9JmaF8etKVT`). The existing project and permanent URL are retained. Its connected GitHub repository is `DanielKinsner/slingmods-three-wheel-tour`; production branch is `main`, repository root is the game root, Node is 24.x.

## Normal updates

1. Edit and validate the game, then commit the changes.
2. Push or merge the reviewed changes to `main` on GitHub.
3. Vercel automatically runs `npm ci`, then `npm test && npm run build`, and serves `dist/` when successful. A failed build does not replace the current game.
4. Check the Vercel deployment for that exact Git commit before calling an update live.

Other branches get preview deployments. Preview access follows the existing Vercel deployment-protection settings. No separate deploy hook or Vercel credential stored in GitHub is required. Files saved only on a developer's computer do not trigger a deployment.

```sh
git switch main
git pull --ff-only
npm ci
npm test
npm run build
# Commit reviewed changes, then:
git push origin main
```

The repository preserves the game source, generated runtime assets, editable asset masters, checkpoints and evidence. `.env*`, `.vercel/`, `node_modules/`, `dist/` and raw capture WebMs remain excluded. A credential-pattern scan of tracked text history found no matches before the initial push.

## Rollback and manual fallback

For code rollback, revert the faulty commit on `main` and push the revert; Vercel rebuilds it automatically. For an urgent deployment rollback use the previous Ready deployment in Vercel, then reconcile `main` before further pushes. Historical v0.4.1 manual-promotion provenance is retained in PRODUCTION-DEPLOYMENT.json; it is not a rolling pointer to every later Git deployment.

A local prebuilt deployment remains available for deliberate recovery using `npm run build`, `npm run prepare:vercel`, and the Vercel CLI. Normal updates should use the connected repository so deployment provenance records the Git commit.

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
