# Phase 5 follow-up: research and the unverified items (2026-10-16)

You asked me to keep the partial classic-view match, add the diesel, keep the viaduct colour, find the photos myself, and work through the unverified list. Captures: 24 Aug 2026 (`contact.jpg`; a Low phone-size pair is included as `*_low_mobile.jpg`), 11:15 BST unless noted; High; SwiftShader. `compare_p5b.jpg` (sent, not committed) shows photos beside renders.

## What I found

| Question | Finding | Source |
|---|---|---|
| Which coaches in 2026? | The 2026 season started on 1 June with **Mk2 coaches** (not air-conditioned) plus the Mk1 buffet 99318 with central door locking. West Coast plans to bring the Mk1s back later. **The modelled set stands.** | S70, S42 |
| The diesel at the rear (Oct 2025) | At full size it is a **Class 47** in WCR maroon (flat cab front). The number is not readable. In 2024–25 the rear diesel powered the air-conditioned Mk2s. The 2026 coaches are not air-conditioned, so **a 2026 rear diesel is unconfirmed**. | S58, S71 |
| 45407 in 2026 | Two CC0 photos from **8 July 2026** (Fort William) confirm the blue number plate, the blue "THE JACOBITE" headboard and the **"65J / SC" shed plate**, all as modelled. | S66 |
| Thicker piers | The official listing says "**Thicker pylons flank centre portion**". They are after the **8th and 13th arch** from the west. | S67, S60, S69 |
| The classic viewpoint | Geograph records the camera position: **NM 9072 8122** (2014) and **NM 9078 8132 (5 July 2026)**. | S69 |
| The station | Two platforms either side of a loop. The chalet building and signal box are on platform 1, a shelter on platform 2. The platforms are about **94 m long**. The Jacobite overhangs the platform (2024 photo). | S68, S56 |
| LiDAR | Still **not published** for Glenfinnan. Checked the portal again on 2026-10-16; the national programme was last updated 30 Sep 2026. | S19, S21 |
| Rail level | **No reliable published figure.** One site says the station is at "10 m", which cannot be right: it stands well above Loch Shiel. | — |
| A 2026 side view of the train | **None found** showing the coaches. The two July 2026 photos show 45407 alone. | S66 |

## What changed

- **Class 47 at the rear:**
  - three levels of detail;
  - maroon with a black roof, gold line, yellow warning panel and red tail lights;
  - "WEST COAST RAILWAYS" lettering; no number (not readable in the photo);
  - an idling engine sound;
  - the **"Diesel at rear"** button and `?diesel=0` turn it off.
- **Glenfinnan station:**
  - passing loop and platform 2 with its shelter;
  - the chalet building with its platform canopy;
  - the signal box with its nameboard and stairs;
  - the museum carriages in the south siding;
  - lamps, name boards, barrow crossings and a fence;
  - new viewpoints: station overview and platform 2.
- **Viaduct:** the two pylons are 4.45 m wide; the other piers are now 2.61 m.
- **Classic views:** cameras fitted to the photographers' recorded positions, by marking points on the viaduct in each photo:
  - `v01-classic` from the 2014 photo (6 points, 3.6 px error);
  - `v01-2026` from the 5 July 2026 photo (5 points, 1.5 px error).
- **Terrain:** a knoll added at the classic viewpoint.
- **River:** boulders on the bed and banks near the viaduct (Medium and High).
- **Ground cover:** bracken on the lower ground and heather higher up, within 70 m (Medium) or 110 m (High) of the camera. The first renders showed pale flakes: the colours had been set in the wrong colour space and the clumps were flat-shaded. Both are fixed and the views re-rendered.
- **Full screen on phones:** a "Full screen" button in the HUD (Android Chrome and desktop; iPhone Safari does not allow it), and "Add to Home screen" now opens the site full screen with no address bar.

## The classic view, explained

Both fitted cameras need to be **10–13 m higher, relative to the viaduct,** than the 50 m terrain allows. There are two possible causes, probably both:
- The 50 m data smooths away the knoll the photographers stand on.
- It also fills in the gorge, which made my fitted rail level too high.

I cannot separate the two without LiDAR. For now the fitted cameras stand on a modelled knoll. The views now frame the viaduct as the photos do, but the hills are smoother and the ground less varied.

## Checks

| Check | Result |
|---|---|
| Train on the track | **Pass.** Every vehicle including the diesel is within 5 mm, on the viaduct and at the station. |
| Viaduct | 376 m, 21 spans, piers 2.61 m, pylons 4.45 m |
| Walking | **Pass:** deck, parapet, under the arches. At the station, boarding the buffet coach 99318 by its A-end door. Coaches 5487, 5453, 5419 and 99318 are alongside the 94 m platform. |
| Sound | **Pass.** No clipping; echo 0.07 at the river; muted is silent. |
| Earlier phases | **Pass:** kinematics, human scale, cab, coaches, test-site audio. |
| Unit tests | **Pass** (36) |
| Performance | **Pass.** At Glenfinnan, worst views across desktop and phone sizes: Low 148 calls and 396k triangles (budget 150 and 400k); Medium 167 and 931k (300 and 1.2 M); High 318 and 2.78 M (600 and 3 M). Test site: worst Low 128 calls and 155k, Medium 158 and 197k, High 300 and 394k; no errors. Download to first view on Low: 16 MB (budget 20). Frame times are from a software renderer, so they say nothing about your phone. |

## Still unverified or missing

1. **The classic viewpoint's height:** the knoll, or the rail level, or both (see above).
2. **Rail level** is fitted to 50 m ground; no survey or published figure.
3. **Whether the diesel runs in 2026**, and its number.
4. **Station:**
   - sizes estimated from photos;
   - switches and crossings simplified;
   - the car park and footpaths not modelled;
   - the museum carriages are plain shapes in estimated colours.
5. **Viaduct:** the pylons' exact width; parapet, arch ring and fill sizes remain estimates.
6. **Terrain** is still 50 m data: crags and the gorge are missing until LiDAR.
7. **Trees and ground cover** are simple shapes; the ground cover reads as scattered green mounds, not continuous bracken. The species mix and the bracken/heather split by height are estimates.
8. **Other buildings** (houses, church, visitor centre) are generic.
9. **No 2026 side view of the train** has been found.
