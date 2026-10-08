# Phase 4 notes: carriages (2026-10-08)

Captures are fixed views at 24 Aug 2026, 11:15 BST, rendered with SwiftShader (software). The dusk view is at 21:18.

| File | What |
|---|---|
| `coach-ext`, `train-wide`, `front-34-l`, `rear-34-r` | The six-coach rake from the platform and from afar |
| `coach-bogie` | B4 bogie: red coil springs, yellow axle-box covers |
| `coach-door` | Looking in through an open door at the centre vestibule |
| `coach-vestibule`, `coach-aisle`, `coach-seat`, `gangway` | Inside: vestibule, saloon, a seated view, through the gangway into the next coach |
| `info_coach`, `info_inside` | Info markers outside and inside a coach |
| `dusk_coach` | Saloon at dusk |
| `*_medium_mobile` | Phone-sized views (844×390, Medium) |
| `compare_mk2.jpg` | Side by side with WCR Mk2 TSO 5249 (S39) and the interior of M5125 (S40). Contains reference photos, so **not committed**; sent directly. |

## What was built

**The coach:** a BR Mk2 (original) Tourist Standard Open in West Coast Railways maroon, built to S39 (5249, exterior) and S40 (M5125, interior). Every dimension is in `src/specs/mk2.ts` with its source and confidence.

**Exterior**
- **Body:** 64 ft 6 in body, 66 ft over buffers, on two B4 bogies at 46 ft 6 in centres.
- **Windows:** large windows with top-hung opening vents, set in black rubber.
- **Lining:** gold and black lining at the waist (broken at each door) and at the cantrail; "West Coast" lettering; each coach carries its own running number.
- **Doors:** hinged slam doors at both ends and at the centre vestibule, each with a door-lock (CDL) light above.
- **Roof:** black, with its row of pressure-ventilation domes.
- **Coach ends:** gangways with bridge plates, buckeye couplers and buffers.
- **Underframe:** equipment boxes; B4 bogies with red springs and yellow axle covers.
- **Weathering:** typical working condition, as on the locomotive: road dirt low down, roof grime, streaks.

**Interior**
- **Layout:** toilet and vestibule at the A end, saloon of four bays, centre vestibule, second saloon of four bays, vestibule at the B end.
- **Seating:** 2+2 high-back seats with blue vinyl headrests, blue check moquette and pale shells, in facing pairs at small tables.
- **Fittings:** luggage racks with light strips, ceiling lights, wood-effect wall lining, heaters under the saloon windows, aluminium window frames, glazed partitions, toilet doors, grab poles.

**The rake:** six coaches coupled behind the tender: 5249, 5229, 5222, 5216, 5200, 5171. These are real WCR maroon Mk2 TSOs on the 2026 register (S10). The order and the count are my estimate.

**What you can do**
- **Doors:** walk up to a door and it swings open (with the CDL beeps); walk away and it closes with a slam.
- **Moving through the train:** step up from the platform, walk the aisle, cross the gangway into the next coach, and walk back out.
- **Info mode:** separate markers outside and inside a coach.

**Sound**
- **Footsteps** change with the surface: ground, platform, carpet, the steel footplate.
- **Coach doors:** beeps and a clank on opening, a slam on closing.
- All of it is positioned in 3D.

**Draw-call savings:** the coach interior is drawn only when you are inside or right beside a coach. Far-away coaches use simpler models (doors and wheels merged, fewer materials).

## Checks

| Check | Result |
|---|---|
| Board and walk the train | **Pass.** Door opens (1.6 rad). |
| | Platform 0.915 m → coach floor 1.269 m (a 0.355 m step). |
| | Walked the aisle to the far saloon, through the gangway into coach 2, and back out onto the platform |
| Avatar fits | **Pass.** Door clear height 1.91 m, door width 0.62 m, aisle 0.68 m, aisle headroom 2.46 m, for a 1.70 m avatar (0.48 m wide) |
| Cab (unchanged) | **Pass.** 23 of 23 controls |
| Kinematics (unchanged) | **Pass.** Joints within 2e-15 m |
| Human scale | **Pass.** |
| Audio | **Pass.** No clipping; mute is silent. Peaks: |
| | site −24 / front −22 / cab −19 / platform −21 dBFS |
| | blower and injector −16; whistle −14.7 |
| | coach door and footsteps −16.4 (new this phase) |
| Live site | **Pass.** No errors; noindex; bots get 403 |

## Performance (relative only: software rendering)

Worst views, full rake of six coaches:

| Tier | Front 3/4 | Wide (whole train) | Cab (backhead) | **Coach aisle** |
|---|---|---|---|---|
| Low | 124 calls, 154k tris | 32 calls | 126 calls | 68 calls, 134k tris |
| Medium | 153 calls | 66 calls | 143 calls | 125 calls |
| High | 290 calls, 392k tris | 116 calls | 270 calls | 234 calls, 365k tris |

All tiers are within budget at both 1280×720 and 844×390. Textures: 32.4 MB.

## Problems found and fixed during the phase

1. **Over the draw-call budget at first** (Low 368, Medium 385, High 754 with six coaches). Fixes:
   - parts sharing a material are merged into one mesh;
   - far models use fewer materials, with doors and wheels merged in;
   - coach shadows come only from the close-up model, and not at all on Low;
   - on Low, the close-up model switches out sooner (25 m).
2. **Heater grilles blocked the doorways:** limited to the saloons.
3. **The gold waist line crossed the door gaps:** it now stops at each door.
4. **Invisible gangway doors** (hidden between coaches) still blocked walking: now skipped.
5. **Colour:** the first maroon was too brown against 5249. It was corrected, and pale seat shells and aluminium window frames were added (from S40).
6. **Door slam too loud:** it peaked at −8 dBFS, louder than the whistle. Now −16.4.
7. **Reference correction:** REFERENCE §6 said the doors were at the coach ends only. S39 shows a centre door too, as on all original Mk2 TSOs.

## Still unverified or simplified

1. **The 2026 coach set itself.** No photo of the 2026 Jacobite set has been found. The model follows S7's description (Mk2s with opening windows and central locking) and the WCR maroon Mk2 TSOs on the register. Your photo U01 shows **Mk1** coaches (number 4951), so it dates from 2025 or earlier.
2. **Formation:** the six numbers are real, but their order, the count, and whether a first-class (FO), buffet or support coach runs in the set are estimates. Only standard-class TSOs are built.
3. **Dimensions:** body length is well sourced. Width, height, floor height, bogie centres and the B4 bogie are low-confidence or estimated (±5 cm or more).
4. **Body shape:** the lower-body tumblehome (the inward curve below the waist) is omitted. The sides are straight.
5. **Interior simplified:**
   - the ceiling has fewer details than S40 (air vents and the light diffusers);
   - the luggage racks are simple shelves;
   - the window vents don't open;
   - the toilets are closed doors only.
6. **Door hinge side** is estimated from S39.
7. **Interior at night:** the ceiling lights glow but do not light the saloon, so at dusk it looks dark. Proper interior lighting at night is planned for Phase 7 (polish).
8. **Sound:** door and footstep sounds are synthesised.
