# Lofted hero body — September 9 rebuild

The hero vehicle in `scripts/build-hero.py` is now built from cross-section lofts instead
of stacked flat panels. This note records how the shape is defined so later passes can
tune it without re-deriving the approach. Coordinates are game metres: X lateral, Y up,
Z forward; the front axle is at Z 1.197 and the rear at Z −1.47.

## Reference and measurement

Owner references in `D:\slingshot angles` (2025 R, Granite Gray sequence) were compared
against the neutral orthographic evidence renders with an overlay script: the photo's dark
silhouette is scaled by overall length (side) or overall width (front/rear), aligned to
the nose tip or ground centre, and drawn over `artwork/vehicle/{side,front,rear}.png`.
The photos are not orthographic, so the far end carries some perspective error; the front
half of the side view and the whole front view are trustworthy, the rear view is close.

Key proportions read from the overlays and used in the lofts:

| Feature | Height (m) |
| --- | --- |
| Nose leading edge | 0.62 |
| Fender pod top at the front axle | 0.89 |
| Hood at the front axle | 0.84 |
| Cowl / windscreen base | 0.95 |
| Cockpit shoulder line | 0.81 – 0.85 |
| Rear deck at the hoops | 0.92 (spine 1.0) |
| Tail | 0.68 |

## Lofts

- `loft(name, sections, mat)` joins equal-length point rows into quads and mirrors them.
- **Hood**: `HOOD` is a list of `(z, crown height, half width)` stations from Z 1.95 to
  −0.02. `hood_top(z, u)` adds a soft centre crown and a shallow outer crease; the last two
  points of each row drop below the edge so the hood meets the pods.
- **Fender pods**: `POD` stations from Z 1.90 back to 0.56. `pod_section()` prefixes each
  row with two points derived from the hood edge so the pod and hood read as one wedge.
  The underside is open; the tire sits inside. A cap closes the front at Z 1.90.
- **Nose**: single-face upper band, dark trapezoid mouth, lower lip and swept cheeks, all
  V-shaped in plan (centre proud at Z ~1.97). Honeycomb, projector bar and eyebrow follow.
- **Cockpit flanks**: `FLANK` stations `(z, shoulder x, shoulder y)` from the cowl to the
  deck; five-point rows form the painted hip with a dark recess and open tub below.
- **Rear deck**: `DECK` stations `(z, spine, deck, width factor)` from Z −0.86 to −1.55;
  eight-point rows put a centre spine over a wide shoulder deck that overhangs a narrow
  lower body. Tail lamps sit on the rear face.

- **Tail lamps**: six-point housing and lens panels wrapping each deck corner, an LED bar
  and an amber reflector. The rear mudguard is a narrow black arc hugging the tire.
- **Dashboard**: a lofted cowl (`Dashboard cowl`) with a binnacle hood over the gauges.
- **Windscreen**: smoked deflector (darker base colour, 0.45 alpha in Blender, 0.42 opacity
  in `src/hero-vehicle.ts`).

Interior heights (dashboard, gauges, steering, windscreen, mirrors) were raised with the
cowl, and the in-game cockpit eye point moved to `(0.365, 1.19, -0.6)` in `src/world.ts`.
Headlight halos and spotlights in `src/lighting.ts` sit on the light bar, brow slashes and
corner accents. Wheel nodes, pivots, material names and the animation contract are unchanged, so
`src/hero-vehicle.ts` and `scripts/validate-hero.py` did not need edits.

## Creases

The owner's note was that the real car has sharper, more aggressive lines. Smooth lofts now
run through an edge-split at 28° in `mesh()`, so any bend sharper than that keeps a hard
shading break while gentle curvature stays smooth. The hood crown is a V spine
(`0.05·(1−|u|)`) with a crisp shoulder line at 62% of the half width, the pods have a flat
top between two corners and a near-vertical outer face, and the deck and flanks carry hard
shoulder edges. Bevels stayed small (4–7 mm) so the creases read.

## Rebuild

```powershell
& 'work\blender-runtime\blender-4.5.3-windows-x64\blender.exe' --background --python scripts/build-hero.py -- --stills-only
python scripts/validate-hero.py
```

`work/` is git-ignored; the portable Blender 4.5.3 runtime lives there (sha256 verified
against the official release checksum). Drop `--stills-only` to also render the turntable.
