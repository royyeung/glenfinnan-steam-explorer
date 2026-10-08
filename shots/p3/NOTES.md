# Phase 3 notes: cab interior (2026-10-08)

Captures are fixed views at 24 Aug 2026, 11:15 BST, rendered with SwiftShader (software). The dusk view is at 21:36.

| File | What |
|---|---|
| `backhead`, `cab-driver`, `cab-fireman`, `tender-front` | Footplate views |
| `firehole_open` | The fire through the open doors |
| `panel_regulator` | A control panel |
| `info_cab` | Info markers in the cab |
| `dusk_cab` | Firelight and cab lamp at dusk |
| `compare_backhead_S41.jpg` | Comparison with a Black Five backhead photo. Contains a reference photo, so **not committed**; sent directly. |

## Sources and decisions

No photo or drawing of **45407's own cab** is public, so the layout is built from four sources (you agreed to let me decide):

| Source | Used for |
|---|---|
| **S41** (Black Five backhead, unidentified engine, 2011) | Overall backhead arrangement: steam manifold on top, two water gauges either side of centre, long regulator handle, vacuum gauge driver's side, small gauges fireman's side, brass handwheels, copper pipes, cream cab |
| **44871 footplate photo** (same owner, same modernisation) | Sliding firehole doors in brick-coloured housings, the firing tray above, chequer plate in front of the firehole, wooden boards behind |
| **S27** (list of the controls on 45407 / 44871 / 45212) | The complete control list, including modern items (M8 air brake valve, AWS, air compressor) |
| **Your photo U01** (45407 on the viaduct) | Tall front windows **outboard** of the firebox (Phase 2 had them too far in); the vacuum ejector exhaust pipe along the **left** side of the boiler (new); left-side pipework generally |

## What was built

**Backhead**
- Steam manifold with valve wheels.
- Two water gauges with live water levels.
- Four gauges with moving needles: boiler pressure, vacuum (2 needles), air (2 needles), steam heat.
- Regulator with its quadrant.
- Firehole cut through the backhead, cab front plate and firebox casing. Behind it: sliding doors, a deflector and a glowing, flickering fire bed inside the firebox.
- Firing tray, brick door housings, copper pipework.

**Driver's side**
- Reverser on a pedestal with a cut-off scale. It also drives the valve gear outside, both ways.
- M8 air brake valve and AWS indicator with its button (both marked unconfirmed).
- Brake valve, ejectors, whistle, sander, cylinder drain cock lever.

**Fireman's side:** blower, injector, front and rear dampers.

**Tender front:** coal doors over the shovelling plate, two "OPEN – WATER – SHUT" water valves, handbrake column, shovel.

**Cab:** tip-up seats, chequer-plate and wooden floor, cream lining, wooden window frames, cab lamp.

**23 operable controls**
- **How to work them:** click or tap to select; drag (or mouse wheel, `[` / `]`, slider); hold for the whistle and AWS button.
- **Labels:** each has a name, "what it is", "what it does", and its current setting, e.g. "forward gear, 54% cut-off".

**Footplate model:** a small, explainable simulation behind the gauges and sounds.
- **Fire:** draught from the blower and the exhaust, plus the dampers; open doors cool it.
- **Steam:** boiler pressure. The safety valves lift at 225 psi and reseat at 222.
- **Water:** the level falls with use; injectors refill it (water valves must be open).
- **Brakes:** vacuum created by the ejectors and destroyed by the brake valve; the air brake is charged by the pump.
- **Wheels on the rolling road:** driven by regulator × reverser and stopped by the brakes.

**Sound** (procedural):
- whistle (a hooter approximation; tone **unverified** against a recording of 45407);
- blower roar following its wheel;
- safety valves when they actually lift;
- ejector hiss;
- injectors singing when actually running;
- **exhaust beats ("chuffs") locked to the wheels** when working under steam;
- drain cocks;
- clanks for doors and levers.

**Lighting:**
- **Shelter:** the cab interior is shaded as sheltered from the sky (about 22% of open-air sky light), so it is no longer lit like outdoors.
- **Fire and lamp:** firelight spills into the cab when the doors are open; the cab lamp is switchable.

**Info mode:** cab markers appear only when you are on the footplate; the outside markers appear only when you are off it.

## Checks

| Check | Result |
|---|---|
| All 23 controls exist and move through their range | **Pass.** 23 of 23 |
| Footplate behaviour | **Pass.** |
| | Brake on: vacuum 21 → 1.2 in Hg. Ejector: back to 23.5. |
| | Injector: water level +20% of the glass, pressure 222 → 219 psi. |
| | Blower and dampers: pressure rises to 224, safety valves lift. |
| | Regulator in forward gear: wheels turn (2.9 rad/s). Brake: they stop. |
| | Reverser in the cab moves the valve gear outside |
| Kinematics (unchanged mechanism) | **Pass.** Joints within 2e-15 m at 6 cut-offs |
| Human scale | **Pass.** Platform → steps → footplate boards at 1.612 m; headroom 2.05 m |
| Audio | **Pass.** Every level below −14 dBFS peak, no clipping, mute silent: |
| | site −24 / front −19 / cab −17 / platform −20 dBFS peak |
| | blower and injector −16 |
| | whistle −14.7 |
| Live site | **Pass** |

## Performance (relative only: software rendering)

| Viewport | Tier | Front 3/4 | Wide | **Cab (backhead)** |
|---|---|---|---|---|
| 1280×720 | High | 10.7 s, 214 calls | 9.1 s, 198 calls | 14.2 s, 270 calls, 161k tris |
| 844×390 | Low | 1.6 s, 98 calls | 1.4 s, 90 calls | 2.5 s, 126 calls, 81k tris |
| 844×390 | Medium | 2.4 s, 115 calls | 2.0 s, 107 calls | 3.2 s, 143 calls |
| 844×390 | High | 4.2 s, 214 calls | 3.5 s, 198 calls | 5.5 s, 270 calls |

All tiers are within budget. Two changes this phase saved draw calls:
- The cab interior is a separate group, drawn only within 9 m and casting no sun shadows.
- The shadow map is redrawn only when the light moves or something moving casts shadows. The scene is mostly still, so this roughly halved draw calls everywhere.

## Problems found and fixed during the phase

1. **One dial on every gauge.** The model optimiser merged materials with identical settings, so all four gauge faces showed one dial. This also hid a **Phase 2 bug**: the lion on the left side of the tender was not mirrored. Materials are now kept distinct.
2. **Rails seen through the cab.** Hairline dotted lines appeared on every cab view: the test-track rails showed through solid parts. Each 360 m rail was a single triangle reaching behind the camera, which loses depth precision. The track is now built from 12 m sections.
3. **Firehole blocked by four plates.** The backhead plate, the cab front plate, its lining and the outer firebox casing all covered the firehole. The opening is now cut through all four.
4. **Fire and lamps didn't glow.** The model export drops the "glow" (emissive) part of materials, so the fire and the lamp lenses showed no light. It is restored at load time and scaled for the 0.3 exposure.
5. **Fire texture too dark** (coal lumps everywhere): repainted as a bright bed with lump outlines.
6. **Cab lit like the outdoors:** the shelter shading above was added.
7. **Lighting too bright on the cab's outside:** the first version of that shading also darkened the walls' outer faces. Outer faces are now excluded.
8. **Front windows too far in:** moved outboard and made taller (U01).
9. **Info markers cluttered** the cab: inside and outside markers are now separated.

## Still unverified or simplified

1. **The cab is a Black Five cab, not proven to be 45407's.** The positions of the M8 air valve, AWS unit, air gauge, cab lamp, seats, sander and dampers are estimates. If you can find or take a photo inside 45407's cab, it would replace them.
2. **The footplate simulation is explanatory, not engineering-grade.** Rates are tuned so a minute on the footplate shows the right behaviour.
3. **The whistle is synthesised,** not recorded from 45407.
4. **The fire through the doors is a small view.** You see a glowing bed through a short tube, not the full firebox interior.
5. **Numberplate colour conflict:** your photo U01 shows a **black** smokebox numberplate with white numerals; the 2023 and 2025 photos show **blue**. The model keeps blue for now (question below).
