# Asset usage and provenance

`ASSET_MANIFEST.json` inventories every shipped visual/audio asset and font package with hashes or package provenance. Source art, Blender files and audition masters stay outside `public/`.

- The hero vehicle, Miami geometry/maps, procedural surfaces, garage, circuits and new DSP sound beds are original project-authored work. The vehicle is a documented 2025 R-inspired interpretation, not OEM CAD or a fitment model. Reference photographs are not shipped as artwork.
- Existing asphalt, coastal stucco and facade imagery came from OpenAI image generation; source masters and original provenance are retained. Generated normals are artistic approximations, not physically measured material scans.
- `public/textures/coastal-sky.hdr` is the existing Poly Haven Kloppenheim sky, distributed under CC0. See https://polyhaven.com/license and the asset URL in the manifest.
- Barlow and Barlow Condensed use SIL Open Font License 1.1. Exact package license files are copied to `docs/licenses/`.
- The SlingMods company mark is used under the user's explicit company-owner authorization. It is not regenerated lettering.
- Six existing catalog images/links remain from SlingMods. Source pages, image URLs and fitment snapshots are in `PRODUCT-SOURCES.json`. Company use is owner-authorized; any supplier-specific redistribution entitlement has not been independently verified. The game uses fictional credit prices and performance benefits.
- All 20 existing ElevenLabs assets are preserved with their prompts, IDs and hashes in `AUDIO-PROVENANCE.json`. They are generated approximations, not authentic vehicle recordings. Their original commercial subscription entitlement has not been independently reverified. No additional ElevenLabs requests were made this turn because the secret is absent from the current development environment.

This preview does not resolve every commercial entitlement for inherited material. Do not present this inventory as blanket legal clearance or approved OEM accuracy. No production promotion is included.
