# v0.4.1 visual finish

Actual local WebGPU canvas frames, saved through the visible QA FRAME control:

- [Garage materials](../captures/frame-1788990726045.png): Glacier paint, bronze wheels and ice-blue RGB retained; softer paint/reflections and darker matte seats.
- [Miami night](../captures/frame-1788990744976.png): window interiors, restrained sky, existing headlights/street lights.
- [Miami sunset](../captures/frame-1788990839080.png): warmer coastal sunlight and window variants.

Canvas frames omit the DOM HUD. Full-page browser screenshots in the task show the uploaded preview garage and production version/progress. No rendered mockups are presented as gameplay. The original [window atlas](../../public/textures/miami/window-interiors.webp) is 512x384, eight room illustrations, 13,338 bytes; rooms are illustrated distant detail, not ray-traced or parallax interiors. Existing Miami texture files retained their hashes.

## Verification

- [99-test report](../visual-finish-tests.json); TypeScript and Vite production build pass.
- [Production GET/hash checks](../../PRODUCTION-DEPLOYMENT.json): anonymous 200 and exact local-byte equality for HTML, JS, CSS, full/reduced GLBs and room atlas.
- Windows Chrome/WebGPU garage and Miami day/night views, uploaded preview garage and production home inspected. No browser console errors observed. Production displays OWNER TOUR / v0.4.1 and the prior owner save, chapter 06/08 and 8 credits.
- New race check auto-paused as its tab was backgrounded; no completed-lap or fresh performance credit. Previous completed-lap/profile/audio evidence predates this material pass.
- Geometry unchanged; one extra contact-shadow draw per hero instance, one small room atlas. No physical-device/mobile/controller test or new GPU timing performed.
- No audio changes, paid API requests, storefront mutations or save reset/import. Credential-pattern scan has zero matching files.

Owner explicitly approved production promotion. The permanent game URL is https://slingmods-three-wheel-tour.vercel.app/. Vercel promotion created production deployment dpl_BDutzGXHPPjyH9WMYh1a1poXHTxn from preview dpl_AFGdWQAQcS8pcvzZXgtGc75966ei; six public artifact comparisons prove the bytes carried across. Previous production dpl_kgBwd3XtaFjDF6sNR5egHrdnX31o remains identified for rollback.
