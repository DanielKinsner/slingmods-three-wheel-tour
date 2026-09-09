# Research and design decisions

Research checked September 9, 2026. The implementation is a browser-first arcade game designed for short repeat visits on an ecommerce site.

## Engine choice

| Option                       | Relevance                                                                             | Decision                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Three.js WebGPU + TypeScript | Modern rendering, WebGL 2 fallback, direct browser/UI integration, small distribution | Implemented; suited to custom racing visuals and immediate website entry                                                                         |
| Babylon.js + Havok           | Full-featured web engine, WebGPU/WebGL support, advanced rigid-body physics           | Strong alternative for a future free-driving physics expansion; unnecessary physics/WASM complexity for this road-relative arcade handling model |
| Godot web export             | Full game editor and export pipeline                                                  | Viable, but introduces a WASM export pipeline; threaded exports require isolation headers that complicate a storefront embed                     |

Primary sources:

- [Three.js WebGPU renderer guide](https://threejs.org/manual/en/webgpurenderer): automatic fallback, material/postprocessing differences, and current maturity caveats. The page still describes the renderer as experimental; the fallback and real-browser verification matter.
- [Three.js renderer reference](https://threejs.org/docs/pages/WebGPURenderer.html).
- [Babylon.js WebGPU documentation](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU.md).
- [Babylon.js physics documentation](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/physics/v2/usingPhysicsEngine.md).
- [Godot web export guide](https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_web.html): web platform requirements and threaded-export constraints.

The stack is chosen for this site's delivery needs, rather than claimed to be the universally best engine. Version 0.2 moves to a more realistic reference-built vehicle, high-dynamic-range lighting, textured materials, and a denser coastal city. This remains original real-time browser art, not photorealistic AAA art. The code is structured so an approved higher-detail glTF vehicle and authored environments can replace procedural assets later.

## Destination grounding

- **Maggie Valley:** the town's [Slingshots in the Smokies event page](https://www.maggievalleync.gov/events/annual-slingshots-in-the-smokies-2026-2/) identifies an established Slingshot owner gathering there.
- **Daytona Beach and Las Vegas:** both appear in the manufacturer's [Slingshot vacation destinations article](https://slingshot.polaris.com/en-us/stories/top-vacation-destinations-for-slingshot-owners/).
- **Texas Hill Country:** [Texas tourism](https://www.traveltexas.com/articles/post/all-terrain-texas/) describes Slingshot riding in the region; [Bandera Slingshot Rentals](https://www.banderaslingshotrentals.com/about) offers rides there. These establish destination relevance, not a population ranking.

The circuits use original control points and scenery. They are not reconstructions of public roads or licensed reproductions of actual event courses.

## Sponsor and garage

[SlingMods' company page](https://www.slingmods.com/about-us) and [store](https://www.slingmods.com/) establish its aftermarket accessories/performance focus. This inspired the garage loop and sponsor story. The actual public company wordmark was obtained from the [SlingMods-hosted logo file](https://www.slingmods.com/image/catalog/slingmods-logo-main.png), following the owner's request to create this game for their company.

The garage does not copy real prices, claim measured performance gains, or sell parts. Upgrade names and progression are fictional game abstractions. No supplier logos, OEM logos, commercial songs, stock photographs, or downloaded vehicle models are included. Fictional named characters do not portray actual staff.


## Coastal update: vehicle and graphics references

- [Polaris 2025 Slingshot R comparison/specifications](https://slingshot.polaris.com/en-us/2025/slingshot-r/compare/) supplied the 3.8 m length, 1.98 m width, 2.667 m wheelbase, 1.755 m track and 1.318 m height targets. Wheel sizes follow the model's published front/rear tire dimensions. The generated geometry approximates these targets; it is not an engineering model.
- [Polaris 2025 Slingshot R](https://slingshot.polaris.com/en-us/2025/slingshot-r/) identifies the redesigned nose, vented sport hood and open cockpit details. Front/rear photographs in [GearJunkie's 2025 review](https://gearjunkie.com/motors/2025-polaris-slingshot-r-review) were studied for visible shape only; photographs are not part of the deliverable.
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) provides accelerated triangle queries. Barriers use their visible instanced mesh geometry. Road triangles supply height; buildings and rocks contribute static mesh colliders. The vehicle uses a three-sphere contact envelope and arcade response, rather than full rigid-body vehicle dynamics.
- [Three.js](https://threejs.org/docs/) physical materials, HDRLoader, node materials and TSL support both WebGPU and the WebGL 2 backend used here. Water has vertex displacement, animated normals/color and shoreline foam; banner meshes and palm fronds move with time.
- [Poly Haven sky asset](https://polyhaven.com/a/kloppenheim_06_puresky), [CC0 license](https://polyhaven.com/license): a real HDR sky for reflections and background. Included locally at 2K; original source MD5 checked against the asset metadata.

The desktop palette follows the supplied SlingMods wordmark: red, black, white and neutral gray. The coast is an original Florida-inspired circuit, not a surveyed recreation of Daytona streets or a claim that local businesses sponsor this game. Building names are fictional scenery.

An original asphalt base-color image was generated with OpenAI image generation and integrated into the actual road material. A discovered Meshy model catalog did not expose a callable 3D generation endpoint in this session; the vehicle remains editable authored geometry. No Higgsfield generation credits were spent.
