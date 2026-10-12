# Phase 5: Glenfinnan environment (2026-10-12)

The train now stands at Glenfinnan, either on the viaduct or at the station. The landscape is built from OS open data: terrain, Loch Shiel, the River Finnan, woodland, roads, buildings, the monument and the line. Captures use the fixed date (24 Aug 2026, 11:15 BST, sun at 38°) unless named otherwise. Settings: High, SwiftShader, 1280×720.

- `contact.jpg`: every view.
- `compare_p5.jpg` (sent, not committed): renders beside dated Commons and Geograph photos.

## What is in the world

| Part | Built from | Notes |
|---|---|---|
| Terrain | OS Terrain 50 (S55), shaped near the line | Two grids: 25 m posts over 12.8 km, 5 m posts over the central 2.56 km. Mesh detail adapts to the view. Ground colour from slope, height and cover (grass, bracken, heather, rock, woodland floor, wet shore) |
| Railway | OS OpenMap Local centreline (S56) | Rail level fitted to the ground and held to 1 in 40. Rails, sleepers and ballast follow the curve and the grade |
| Viaduct | REFERENCE §7 and photos S58–S60 | 21 arches of 15.24 m, 376 m long, curve radius 236 m. Battered piers, projecting arch rings, impost bands, pilasters, parapets, lift lines, lime streaks, moss |
| Water | OS polygons | Loch Shiel at its OS level, plus the River Finnan. Peaty water with moving ripples |
| Trees | OS woodland polygons, plus scattered trees in the glen | About 119,000 trees, broadleaf and conifer. Drawn in three distance rings |
| Village | OS buildings and roads | Generic white houses with slate roofs. Roads by class. The monument, simplified. A 165 m station platform |
| Weather and time | `?weather=sunny\|fair\|overcast\|mist`, `?hour=` | Mist and evening shown below |
| Sound | Wind, river, loch waves, birds by day, owls at night | Echo below the viaduct, within 90 m of it |
| Attribution | In the app (bottom left, world mode) and in About | "Contains OS data © Crown copyright and database right 2026" and the no-LiDAR note |

## Checks

| Check | Result |
|---|---|
| Train on the track | **Pass.** Every vehicle sits on its own supports. Worst error 4.6 mm on the viaduct, 4.4 mm at the station |
| Viaduct | 376 m, 21 spans, 2.8 m piers. Rail up to 32.4 m above the ground (published: 30.5 m) |
| Walking | **Pass.** 28 m along the deck at track level, kept inside the parapet. 56 m on the ground under the arches. At the station, from the platform into the buffet coach |
| Sound | **Pass.** Five places plus night: average −31 to −28 dB, peaks −18 to −15.5 dB, no clipping. Echo 0.07 at the river, 0 elsewhere. Muted is silent |
| Earlier phases | **Pass.** Kinematics, human scale, cab (23 controls), coaches (whole-train walk), test-site audio and performance |
| Unit tests | **Pass** (36) |
| Performance | **Pass at both sizes.** Worst view per tier: Low 0.39 M triangles and 145 calls (budget 0.4 M and 150); Medium 0.89 M and 162 (1.2 M, 300); High 2.63 M and 308 (3 M, 600) |
| Texture memory | 45.7 MB (Low budget 160 MB) |
| Download to first view | 16.0 MB (Low budget 20 MB) |
| Console errors | None, in all views and tiers |

**Low triangle fix.** The first measurement on Low was 0.75 M triangles, nearly double the budget. Three changes brought it down:
- Rails and sleepers now come in 150 m pieces. Pieces out of view are skipped. Beyond 175 m the rails are plain, and beyond 1.2 km they are not drawn.
- Far trees use 6 triangles instead of 8.
- On Low there are fewer far trees and the terrain mesh is coarser.

## Against the photos (`compare_p5.jpg`)

**1. Classic hillside view (V01).** The renders are taken from the camera GPS of the 2019 and 2014 photos.
- Hill shapes and the order of the ridges roughly match.
- The viaduct looks **smaller and further away** than in the photos.
- The track is **too far to the right** in the frame.
- The likely cause: the photographers stood on a knoll above the line that the 50 m data does not show, and phone GPS is only good to about 10–20 m.
- The `v01-classic` view uses a hand-placed camera on that knoll instead (63 m, with a tree clearing).
- **This does not meet the "V01 matches" criterion yet.**

**2. River side (Geograph, Apr 2026).**
- Arch shape, impost bands and the projecting rings are similar.
- The real concrete is darker, and more stained and mossy.
- The real river is a rocky stream in a steeper gorge. Mine is a flat channel in a wide flat valley floor.

**3. Loch Shiel head (2017).** The layout of the glen, the plantation on the east slope and the viaduct across the glen match. The real hills are rockier and the grass is more varied.

**4. Train on the viaduct (Oct 2025).** The parapet and arches are similar. The real train had a diesel at the rear (not modelled), and the ground was autumn bracken.

**V07 (360° panorama).** The only Commons panorama, from 2005, has no camera position, so no skyline overlay was made.

## Still unverified or missing

1. **The classic viewpoint:** its knoll and the exact spot (see above).
2. **Rail level:** fitted to 50 m ground, not surveyed. The station is at 73.6 m.
3. **Viaduct details:**
   - parapet height, arch ring and fill depth, and pier batter are estimates;
   - the colour is lighter than most photos;
   - the "thicker piers" mentioned in one source are not visible in the photos, so they are not modelled.
4. **Terrain** is from 50 m data, so crags, the gorge and small knolls are missing. There is still no LiDAR for Glenfinnan.
5. **Trees** are simple low-poly shapes. The species mix and sizes are estimates. There is no bracken, heather or rhododendron as 3D plants, only as ground colour.
6. **Buildings** are generic boxes from the OS footprints.
   - The station building's height and look are estimates; it shows as a plain grey wall beside the platform.
   - The visitor centre and the church are not modelled in detail.
7. **Station:**
   - the second platform and the passing loop are not modelled;
   - the platform length (165 m) and its position are estimates.
8. **The 2025 train's diesel** at the rear is not modelled.
9. **The river** is a smooth channel without rocks.
10. **Frame times** are measured in software rendering. Real-device numbers are still needed (Phase 7).
