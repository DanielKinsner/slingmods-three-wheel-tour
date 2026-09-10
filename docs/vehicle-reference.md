# 2025 R-inspired hero vehicle — art checkpoint

The provisional reference is the **2025 Polaris Slingshot R**, a ProStar-era model
with the revised painted fascia and vented hood. This is bespoke Blender-authored
game geometry, not manufacturer CAD, an OEM-licensed replica, a fitment model, or
a representation of every model year. The source is repeatable and editable.

## Reference board and boundaries

The manufacturer’s [2025 US catalog](https://cdn1.polaris.com/globalassets/slingshot/2025/catalogs/slg-my25-724b-pga-catalog-us.pdf?v=d4119efd)
was inspected on September 9, 2026. PDF page 4 (printed pages 6–7) documents the
revised fascia/light signatures and hood; PDF page 8 (printed pages 14–15) shows
the R trim, front three-quarter/side details, cockpit, wheel and forged hoop
references. The [2025 R model page](https://slingshot.polaris.com/en-us/2025/slingshot-r/)
is a further reference link; its direct automated fetch returned 403, so it was
not treated as a successfully reviewed gallery.

The [2025 owner manual](https://publications.polaris.com/owner/owners-manuals/9941620/0000966144.xml?onepage=true)
and existing project scale define nominal 3.800 m length, 1.980 m width, 2.667 m
wheelbase and 1.755 m front track. Front wheel centers are ±0.8775 m at Z=1.197 m;
the single rear center is X=0, Z=−1.470 m. Front/rear contact radii are 0.333/0.354 m.
Those radii and minor panel dimensions remain artistic approximations. The
generated `asset-evidence.json` reports measured render bounds separately; nominal
manufacturer dimensions are not presented as millimetre-accurate mesh validation.

Existing local `work/references/front.jpg` and `rear.jpg` were used for visual
comparison only. No manufacturer photographs, logos, meshes, textures, badges,
CAD, or ripped game content are embedded in the GLB or shipped as part of it.

## Implemented geometry and material contract

- Continuous closed hood return and nose bridge, sculpted outer wings, recessed
  headlamp sockets, separate lens/reflector surfaces, honeycomb radiator face.
- Exactly two steering front wheels and one driven rear wheel, authored at the
  simulation’s axle positions. Distinct pivot and rolling parents preserve animation.
- Open two-seat tub, lower side blades, seats with bolsters and contrasting seams,
  forged-shape hoops, swept windscreen, mirrors, two gauges and center display.
- Exposed double-wishbone/coilover shapes, rear swingarm, belt cover, rear fender,
  low right-side exhaust. These are visual approximations, not engineered assemblies.
- PBR painted panels with clearcoat, graphite trim, rubber, metal, upholstery and
  translucent windscreen. Three original synthetic micro-normal maps are embedded;
  their source PNGs are preserved. They are not measured scanned surfaces.
- Independent `BodyPaint`, `WheelFinish`, `ExhaustFinish`, `FrontLamp`, `TailLamp`
  materials. A wheel-color change cannot recolor the mirrors or interior metal.

`src/hero-vehicle.ts` exposes `loadHeroAsset('full'|'low')` and
`makeHeroVehicle(color, withDriver, quality)`. Loading is cached, optional and
fails gracefully; the existing procedural constructor remains the fallback.
Geometry is shared between instances; each vehicle gets its own materials.
The reduced GLB is a real decimated tier, not a label on the full mesh. Root
integration decides when to request it; both tiers must not be loaded needlessly
on initial startup. It reduces triangles and transfer, but not draw-call count.

The lofted 2025 body (see `vehicle-lofts.md`) moved the lamps: the centre light bar is
centred at `(0, 0.565, 1.94)`, the brow slashes run from `(±0.58, 0.47, 1.905)` to
`(±0.89, 0.575, 1.885)`, and the corner accents from `(±0.905, 0.30, 1.87)` to
`(±0.92, 0.44, 1.86)`. `src/lighting.ts` halo strips and headlight spots follow these.

## Rebuild and evidence

The advertised machine installation under `C:\Program Files\Blender Foundation`
contained resources but no executable. A portable **Blender 4.5.3** runtime was
downloaded from the Blender NLUUG mirror into workspace `work/blender-runtime/`;
it is not included in the game. No paid service was used for these assets.

```powershell
& '<Blender 4.5.3 path>\blender.exe' --background --python scripts/build-hero.py
ffmpeg -y -framerate 12 -i artwork/vehicle/turntable-%02d.png -c:v libx264 -crf 20 -pix_fmt yuv420p artwork/vehicle/neutral-turntable.mp4
```

Actual Blender renders: `artwork/vehicle/front.png`, `side.png`, `rear.png`,
`three-quarter.png`, `cockpit.png`, and `neutral-turntable.mp4`. The neutral studio
does not use a neon environment, generated concept image, compositing, or a
manufacturer photo. Source scene: `slingshot-r-inspired.blend`. The generation
script exports the vehicle before adding evidence-only studio lights/floor/camera.

`artwork/vehicle/asset-evidence.json` records actual triangle/mesh counts, bounds,
file sizes, SHA-256 checksums and source classification. GLB node transforms were
inspected to verify Y-up, +Z forward and zero initial local wheel rotation.

## Honest limits

The owner approved the general model direction and supplied PNG angle references.
The follow-up in `owner-angle-refinements.md` improves hood channels, integrated
seat shapes, optical surrounds, rear deck/closeouts and coilover detail. Approval
of every revised contour has not been obtained; brake rotors, optical internals,
material weathering and exact panel curvature remain simplified.
Suspension rods are rigid visual parts, not a
fully articulated kinematic assembly. Gauge needles have separate `RpmNeedle` and
`SpeedNeedle` nodes; root integration must rotate their Z axis from telemetry.
The steering wheel and wheel pivots are separate animated nodes. No claim is made that neutral Blender renders prove
real-time browser quality, physical-device performance or exact OEM fidelity.
Browser decode, steering animation, lighting alignment, customization, and
performance are separate integration checks owned by the main implementation.
