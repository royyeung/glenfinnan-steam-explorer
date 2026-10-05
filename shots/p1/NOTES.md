# Phase 1 notes (2026-10-05)

All captures come from the fixed views in `src/debug/views.ts`, rendered headless with SwiftShader (software). The time of day is 24 August 2026, 11:15 BST at Glenfinnan (sun elevation 37.9°, azimuth 138.4°).

| File | What |
|---|---|
| `contact_high.jpg` | All 11 fixed views at High |
| `contact_kinematics.jpg` | Left-side motion at 0°, 45° … 315° of wheel rotation |
| `*.jpg` views | Individual views (JPG copies of the PNG captures) |
| `compare_*.jpg`, `overlay_*.jpg` | Reference photo vs render. These contain reference photos, so they are **not committed**; they stay on the server and were sent to you directly. |
| `checks-*.json` | Machine-readable results of every check |

## Silhouette and comparison: what matches and what doesn't

Right elevation against S33 (45407, right side, 22 Oct 2025), 80 px/m, aligned on the front buffer face and rail top:

| Feature | Render | Photo / published | Difference |
|---|---|---|---|
| Front buffer face (d) | 0.012 m | 0 | 1.2 cm (one pixel at 80 px/m) |
| Chimney top | 3.862 m | 3.855 photo / 3.861 published | +0.1 cm |
| Dome top | 3.850 m | 3.85 | 0 |
| Cab roof | 3.712 m | 3.71 | +0.2 cm |
| Wheel centres | (visual) | | Coupled, bogie and tender wheels all line up within a few pixels (≈ ±3–5 cm) |

Explained exceedances:

- **Tender "coal sides" (+11.5 cm) and "rear tank" (+15 cm):** the metric's measuring windows catch the estimated coal heap and the water filler. The tank top and side tops themselves follow the photo.
- **Front view:** only the buffer-beam plane is comparable, because perspective shrinks the cab and anything further back in the photo. Within that plane, the buffers, beam depth and smokebox door ring line up. The render's overall width of 2.82 m comes from the **estimated** cab steps, which stick out 0.10 m beyond the cab side. That needs a reference.

What the blockout leaves out on purpose (Phase 2 work):

- lining, emblem, numerals and the shaped nameplate (a plain box for now);
- lamps and headboard;
- pipework, lubricators and sandboxes;
- cab roof ventilator and the cab side profile;
- tender frames and axleboxes in detail;
- Walschaerts valve gear;
- real spoke and balance-weight shapes.

The circularity: most compared values were measured from the same photo, so these numbers mainly prove the generator builds what the specs say. The independent checks are:

- published height vs photo scale: 0.15 %;
- 8 ft 0 in coupled spacing vs photo: 0.4 %;
- the estimated axles (bogie, tender) falling on the photo's wheels.

## Checks

| Check | Result |
|---|---|
| Kinematics, 720 steps per revolution | **Pass.** Rod length drift 1.3e-15 m; worst rod-end to crankpin gap (scene nodes, not solver) 2.0e-15 m; sides quartered at exactly 90° (right leads, an estimate) |
| Unit tests (vitest) | **Pass**, 15/15: solver, solar position (London and Glenfinnan solstices), spec integrity, wheelbase 27 ft 2 in vs photo |
| Human scale | **Pass.** Cab headroom 2.05 m for a 1.70 m avatar; doorway 0.89 m |
| | Platform → step → footplate rises 0.235 and 0.45 m; the scripted walk ends on the footplate at 1.600 m |
| | A walk along the platform past the cab doesn't snag |
| | From track level the first rise is ~1 m above the ballast and the walker does not climb, as in reality: boarding is from a platform |
| Audio | **Pass.** Context running; levels by view: |
| | site-wide −35.1 dBFS RMS / −24.8 peak |
| | front 3/4 −32.6 / −21.1 |
| | cab −28.6 / −16.0 |
| | platform −29.7 / −17.1 |
| | muted: silent |
| Live site | **Pass.** `/glenfinnan/` 200 with `X-Robots-Tag`; `/glenfinnan` 308; 403 for crawler User-Agents |

## Performance (relative only: software rendering, no GPU on the server)

Frame times are synced (`gl.finish` + `readPixels`). They are useful only for comparing tiers; open `?perf=1` on your laptop and phone for real numbers.

| Viewport | Tier | front 3/4 ms | wide ms | Draw calls | Triangles (incl. shadow/AO passes) | Texture MB (est.) |
|---|---|---|---|---|---|---|
| 1280×720 | Low | 3617 | 3125 | 97 | 66.6k / 44.2k | 8 |
| 1280×720 | Medium | 5872 | 5390 | 114 | 66.6k / 44.2k | 8 |
| 1280×720 | High | 9730 | 8939 | 212 | 133.2k / 88.4k | 8 |
| 844×390 touch | Low | 1447 | 1174 | 97 | 66.6k / 44.2k | 8 |
| 844×390 touch | Medium | 2242 | 2004 | 114 | 66.6k / 44.2k | 8 |
| 844×390 touch | High | 3907 | 3522 | 212 | 133.2k / 88.4k | 8 |

Everything is far inside the budgets (High: ≤ 600 calls, ≤ 3.0 M triangles, ≤ 768 MB textures).

**Download:** 5.35 MB in total. That covers JS (1.15 MB, 333 kB gzipped), the Basis transcoder (0.58 MB), all model LODs (0.38 MB) and textures (3.24 MB, mostly the two UASTC normal maps). The budget is ≤ 20 MB on Low.

## Problems found and fixed during the phase

1. **Washed-out image:** the Preetham sky is high-range, so bloom picked it up. Raised the bloom threshold and rebalanced exposure.
2. **Sky vs sun units:** the scene was lit mostly by the sky. Recalibrated to a sun ≈ 2.6× the sky irradiance, the sky's reflections equal to the visible sky, and exposure 0.3.
3. **Black below the horizon:** the Preetham sky has nothing there, so metal looked black. Added a lit ground disc to the environment capture.
4. **Metal still black:** three's CSM addon swaps in an outdated core lighting shader and kills reflections on metal in r186. Proven with test spheres. Replaced it with a texel-snapped sun shadow following the focus.
5. **Steel and brass too dark:** reflectance was set too low. Corrected to physical values (steel F0 ≈ 0.55).
6. **Solid wheels:** tyres were solid discs that hid the spokes. Rebuilt as rings.
7. **Collider merge:** GLB positions are quantized, which broke the collider merge. Positions are now read through the accessor.
8. **Lost anti-tiling:** CSM overwrote the ground's anti-tiling shader hook. Moot after item 4; anti-tiling replaced by a stochastic version.
9. **Elevations used the coarsest model:** the 120 m ortho camera triggered LOD2. Ortho views now force full detail.
10. **Steps hidden under the cab floor:** the walker couldn't board. Steps moved out below the doorway, 1.75 cm clear of the platform edge.
11. **S33 mislabelled:** the photo shows the engine's **right** side (front to the right), not the left. Docs corrected.
12. **Slow harness:** it re-rendered continuously in deterministic mode (minutes per shot). It now renders on demand.
