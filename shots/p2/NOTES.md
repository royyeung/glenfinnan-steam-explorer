# Phase 2 notes: locomotive exterior (2026-10-05)

Captures are fixed views from `src/debug/views.ts`, at 24 Aug 2026, 11:15 BST, rendered with SwiftShader (software). Files:

| File | What |
|---|---|
| `contact_high.jpg` | All 15 views at High |
| `contact_kinematics.jpg` | Motion at 0–315° |
| `info_*.jpg` | Info mode |
| `compare_*.jpg`, `overlay_*.jpg` | Comparisons with reference photos; **not committed** (they contain the photos), sent directly |

## What was built

**Running gear**
- **Wheels:** 20 tapered spokes on the drivers (counted on S33), crescent balance weights, crank bosses, black tyre faces with a bright tread, flanges. The driving wheels carry return cranks.
- **Motion:** fluted coupling and connecting rods, crosshead with drop arm, piston rod, slidebars and motion bracket.
- **Walschaerts valve gear:** eccentric rod, curved slotted expansion link on its girder, die block, radius rod with lifting-link slot, combination lever, union link, valve spindle, reversing shaft arm, lifting link, reach rod.
- **Reverser:** a slider in the HUD runs from full forward through mid gear to full back. All the gear is driven by the exact solver.

**Engine body**
- **Boiler:** taper boiler with lined bands, Belpaire firebox with washout plugs, dome, top feed with clack pipes, safety valves, whistle, handrails on stanchions.
- **Smokebox:** riveted ring, dished door with hinges and dart, numberplate and shed plate, steam pipes, lipped chimney.
- **Front end and frames:** frames and stretchers; riveted red buffer beam with sprung buffers, screw coupling and drooping brake hoses; lamp irons and modern lamp units; front steps.
- **Cylinders:** clad, with covers, drain cocks and glands.
- **Fittings:** mechanical lubricators (right side), sandboxes with sand pipes to the rails, AWS receiver, electrical boxes.
- **Under the engine:** axleboxes, leaf springs, brake hangers and blocks; bogie frame.
- **Cab:** spectacle plate with round-cornered windows, side sheets, two-pane side windows, roof with gutters and ventilator. The measured entrance has half-height gates that swing open when you walk up; steps and handrails; injector with pipes.

**Tender**
- Body with flared coal-space sides, rear step, coal heap, water filler, vents, ladder, lamp irons.
- Outside frames, axleboxes, leaf springs, brakes, rear beam, buffers, coupling and hoses.

**Finish**
- **Livery:** BR lined black (cream and red) on the cab panel, tender panel, boiler bands, valances and cylinders.
- **Painted in code** (my own simplified drawings): cab numbers, BR early emblem (mirrored on the left), arched nameplate with a generic crest, blue "THE JACOBITE" headboard, blue numberplate, 65J shed plate.
- **Weathering:** procedural, with no textures, so nothing repeats; it travels with the engine. It covers grime low down, soot on the smokebox and chimney, streaks, rust, oily wheels and rods, brake dust, coal dust on the tender and chipped buffer-beam paint.

**Info mode and sound**
- **Info mode:** 39 numbered parts with "what it is / what it does". Markers are thinned by distance and overlap.
- **Sound:** rod clank at each dead centre, cylinder drain cocks for 15 s after starting, steam leaks, the injector singing now and then. Phase 1 ambience and the engine at rest are still there.

## Checks

| Check | Result |
|---|---|
| Kinematics: 720 steps × 6 reverser settings (full forward to full back), both sides | **Pass.** Every rod and link keeps its length: drift 1.8e-15 m. Every joint in the scene (wheels ↔ rods ↔ link ↔ die ↔ radius rod ↔ lever ↔ union link ↔ crosshead ↔ lifting link) coincides within 2e-15 m. Sides at 90°. |
| Valve gear unit tests (25 total) | **Pass.** Valve travel 189 mm in full forward gear, 89 mm in mid gear, 193 mm in full back gear; reversing swaps the valve phase; die slip ≤ 34 mm |
| Human scale | **Pass.** Headroom 2.05 m; entrance 0.64 m (measured); platform → step → footplate rises 0.235 / 0.45 m; the scripted walk reaches the footplate (gate opens); a platform walk past the cab doesn't snag |
| Audio | **Pass.** Levels by view: |
| | site −34.6 dBFS RMS / −23.6 peak |
| | front −30.6 / −18.3 |
| | cab −28.8 / −16.5 |
| | platform −30.1 / −18.5 |
| | muted: silent |
| Live | **Pass.** 200, loads with no console errors |

## Silhouette vs S33 (right side, 22 Oct 2025)

| Feature | Render | Photo | Difference |
|---|---|---|---|
| Front buffer face | 0.012 m | 0 | 1 pixel |
| Chimney top | 3.862 | 3.855 | +0.7 cm |
| Dome | 3.850 | 3.85 | 0 |
| Cab roof | 3.762 | 3.71 | +5 cm (roof ventilator; its height is an estimate) |
| Tender coal / side tops | 3.312 | 3.31 | 0 |
| Tender rear tank | 2.838 | 2.66 (+0.17 water filler) | Filler included |

## Differences from the photo still visible (honest list)

1. **Valve-gear proportions are estimated.** The link position is now measured (d 5.76, h 1.44), but the lever, link and return-crank sizes are not. The parts sit where the photo shows them, but the exact angles differ frame by frame.
2. **Rods and steel:** in the photo they look darker and dirtier than the render's grimy steel at most angles.
3. **Paint:** the photo's black has a dusty grey-brown cast in places. The render is cleaner on the upper boiler.
4. **Emblem, crest and nameplate** are my own simplified drawings, not copies. The emblem is close in size and placement; the crest is generic.
5. **Hidden detail is representative, not exact:** brake gear, springs, the bogie, between the frames, the injector and pipe runs.
6. **Left side:** no recent broadside photo of the left side was found, so it mirrors the right except for the motion phase. The lubricators exist only on the right side as measured; the left side's pipework is unverified.
7. **Tender:** the shape follows S33. The tank's riveting and welding, and the details of the 4,710-gallon tank, are unverified.
8. **Cab interior** is still plain (Phase 3).

## Performance (relative only: software rendering)

| Viewport | Tier | front ms | wide ms | Draw calls | Triangles | Texture MB |
|---|---|---|---|---|---|---|
| 1280×720 | Low | 3915 | 3215 | 147 / 139 | 155k / 92k | 16.9 |
| 1280×720 | Medium | 6293 | 5477 | 206 / 190 | 161k / 96k | 16.9 |
| 1280×720 | High | 10582 | 9172 | 396 / 364 | 323k / 193k | 16.9 |
| 844×390 | Low | 1638 | 1230 | 147 / 139 | 155k / 92k | 16.9 |
| 844×390 | Medium | 2505 | 2057 | 206 / 190 | 161k / 96k | 16.9 |
| 844×390 | High | 4360 | 3705 | 396 / 364 | 323k / 193k | 16.9 |

- **Budgets:** all met.
  - Draw calls: High ≤ 600, Medium ≤ 300, Low ≤ 150 (on Low, the small moving parts skip shadow casting).
  - Triangles: far below the limits.
  - Textures: 16.9 MB against a 160 MB limit on Low.
- **Download:**
  - models 1.0 MB (all detail levels);
  - JavaScript 1.2 MB (350 kB gzipped);
  - textures 3.2 MB;
  - Basis transcoder 0.58 MB.

## Problems found and fixed during the phase

1. **Decals blank:** glTF-Transform's prune step dropped the UVs of the decal panels. UVs are now written only for decals and kept.
2. **Stray 2.6 m plate:** a lubricator call passed z values where y was expected, creating a plate sticking out of the right side. Fixed, and the helper now rejects inverted sizes.
3. **Reversing arm closure:** the arm moved with the die, so the lifting link stretched by up to 48 mm. It is now set once per reverser position, with die slip solved properly (a 3-unknown solve).
4. **Sand pipes:** they crossed the rods outside the wheels. Rerouted inside the rods to the treads.
5. **Cab, coal, springs, tyres** (found by comparing with the photo):
   - the entrance re-measured: 0.64 m, with gates;
   - the cab side extends down to 1.33 m;
   - the number panel enlarged to 1.40–2.23 m;
   - numerals and emblem enlarged;
   - coal lowered below the sides;
   - springs painted;
   - tyre faces black;
   - an unverified radio antenna removed.
6. **Info clutter:** markers overlapped at a distance. They are now thinned.
7. **Low tier over budget:** 189 draw calls. Brought down to 147.
