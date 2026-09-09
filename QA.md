# Branded loading v0.3.2 — verification

Checked September 9, 2026.

- The official existing 360 x 86 transparent SlingMods logo is in the initial HTML. Eager loading, high fetch priority and an image preload let it load before the JavaScript engine initializes. Inline splash styles preserve positioning before application styles are available.
- Strict TypeScript and Vite production build pass. No gameplay tests were added or rerun for this static markup/style change; previous gameplay verification is preserved in QA-v0.3.1.md and QA-v0.3.0.md.
- Inspected the real static opening screen on desktop and at 390 x 844. Script execution was temporarily disabled in the isolated test tab to hold that screen for inspection; the game has no artificial loading delay. At phone width, the logo decoded at 360 pixels, rendered at 280.79 pixels, and the splash scroll width remained 390 pixels.
- After restoring script execution and reloading, build 0.3.2-branded-loading reached the home screen and removed the splash normally. The temporary browser tab was closed after verification.
- Vercel deployment dpl_kgBwd3XtaFjDF6sNR5egHrdnX31o is READY. All 50 public files were fetched anonymously and matched local SHA-256 values; the verification record is VERCEL-DEPLOYMENT.json. Public files contain no credential-pattern matches.
