# Generated materials and sound â€” After Dark v0.3.0

The two new building textures were created with the built-in OpenAI image-generation tool and copied into the game. They are actively used on coastal hotel walls and rear facades. Exact files: `public/textures/deco-facade.webp` and `public/textures/coastal-stucco.webp`. Runtime normal maps are derived from these images.

## Facade prompt

Use case: photorealistic-natural. Asset type: seamless square 3D game PBR base-color texture, not a scene or presentation. Create a photorealistic Florida Art Deco hotel facade building material: flat straight-on orthographic elevation of exactly four equal window bays in a 2 by 2 grid across a square tile. Pale ivory weathered stucco wall, thin mint-green horizontal architectural trim between floors, recessed dark blue-gray glass windows with thin metal mullions and subtle cream curtains. Real fine plaster grain, salt-air patina, hairline cracks, slight staining beneath windows, believable construction details. All four outer edges must continue seamlessly when repeated across a large hotel exterior. Window openings aligned evenly and same dimensions. Uniform soft neutral ambient illumination, no directional light, no cast shadows, no perspective, no projecting balconies, no glow or lit windows, no signs, no words, no people, no ground, no sky, no border. Texture fills entire image edge to edge. Restrained natural base colors for game-engine lighting, maximum surface fidelity. Save the generated texture as a local image for the game.

## Stucco prompt

Use case: photorealistic-natural. Asset type: seamless square 3D racing game PBR base color material texture. Fill image edge to edge with a flat orthographic close-up of old pale warm ivory exterior stucco on a Florida coastal building. Fine granular sand and lime plaster, irregular hand-trowelled patches, subtle salt-weathering and hairline cracks, slight warm-gray discoloration, tiny exposed aggregate. Believable aged but maintained Art Deco hotel wall. Uniform overcast neutral lighting with absolutely no directional shadows, no perspective. No windows, no doors, no signs, no borders, no objects, no architectural shapes. Seamless matching edges for repeated texture mapping; variation fine and subtle so repeats are not obvious. High resolution tactile photographic detail.

## Audio generation and mix

Twenty original ElevenLabs clips are in `public/audio/`. Full prompts, stock voice/model details, and original/processed hashes are captured in `AUDIO-PROVENANCE.json`. No secret or API call is needed to play. Sounds are generated interpretations rather than field recordings of a Slingshot.

The mix follows the owner's request to keep everything restrained. Engine exports target -21 LUFS, radio -20 LUFS, short effects/wind/tires -23 LUFS, and music -25 LUFS. All measured exported true peaks are below -6 dBTP. The master gain is 0.55 and a compressor sits at -12 dB with 12:1 ratio, followed by a 0.5 output trim to counteract compressor makeup gain. The music ducks to 22% of its level and the engine to 70% while radio speaks. Loop seams are crossfaded. Settings expose independent effects, music, and radio levels plus master mute. `AUDIO-MIX-QA.json` records every measured clip.

Actual product photos were downloaded from the company's product pages; they were not generated or visually altered. See `PRODUCT-SOURCES.json` for all six source links and checked fitments. Game performance figures remain fictional.

Original generated PNGs are preserved in artwork/textures/ in the source delivery. Runtime WebP copies preserve image dimensions and use quality 92 encoding.
