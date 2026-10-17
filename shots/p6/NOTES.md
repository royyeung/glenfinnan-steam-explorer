# Phase 6: Motion and effects (2026-10-17)

The train now runs at Glenfinnan. Captures at 11:15 BST, 24 Aug 2026, Low and High (`run_*_low.jpg`, `run_*_high.jpg`, `contact.jpg`), rendered in software (SwiftShader). The High shots come from a build a little earlier than the final one: the cab shot still shows the locked-doors label, which now appears only when you press E; tree shadows are unchanged in these views. The Low shots are from the final build.

## What was built

- **The run** (`src/sim/run.ts`):
  - One model for the whole train: pull from the regulator, cut-off and boiler pressure; rolling and air resistance; the gradient; the train brake.
  - An automatic driver and fireman work the same cab controls you see:
    - regulator and reverser, notching up as the speed rises;
    - the brake;
    - blower, dampers and an injector;
    - the whistle approaching the viaduct and before leaving;
    - drain cocks open when starting.
  - The run itself:
    - across the viaduct at your chosen speed (5–25 mph; 10 mph by default);
    - optionally a 30 s pause with the train centred on the viaduct (Q13);
    - on to Glenfinnan station: stop, 60 s, away west;
    - from the west end of the modelled track it starts again east of the viaduct.
  - On the bank the driver waits for full steam before starting, and holds the train on the brakes so it never runs back.
- **Drive it yourself:** choose "You drive", or work the regulator, reverser or brake in the cab, and the automatic driver hands over.
- **Wheels:** every wheel turns with the distance run: engine, tender, coaches and the Class 47. The valve gear follows the reverser.
- **Exhaust beats** (`src/sim/beats.ts`):
  - Each cylinder end releases to the chimney when its valve passes mid travel.
  - Those crank angles are solved from the Walschaerts gear for the current cut-off, so there are 4 beats per wheel turn, shifting with the reverser as on the real engine.
  - Each beat is timed within the 1/120 s step, and its sound is scheduled at that exact moment.
- **Steam and smoke** (`src/render/exhaust.ts`):
  - Soft, lit puffs in one draw call: two per beat, plus a steady plume between beats.
  - The puffs keep the train's speed only briefly, so they stream back over the train and drift with the wind (from the south-west; strength by weather).
  - Also:
    - the blower's haze when standing;
    - the safety valves' plume;
    - the whistle's jet;
    - drain-cock bursts at the cylinders.
- **Sound** (`src/audio/running.ts` and others):
  - Exhaust beats locked to the wheels.
  - Rolling noise from every vehicle, and the "di-dum" of every axle over the rail joints (jointed rail assumed).
  - Flange squeal on the 236 m curve, now and then.
  - Wind on the open footplate.
  - Inside a coach: the outside muffled through the body, plus a floor rumble.
  - The Doppler shift as the train passes (whistle, beats, rolling).
  - Every engine sound moves with the engine.
- **Riding:**
  - Each vehicle is its own collider in its own frame, so you are carried along standing or walking in a coach or on the footplate.
  - The doors lock while the train moves; pressing E says so for a moment.
- **HUD:** run/stop, viaduct speed, pause on the viaduct, automatic driver or you, follow train. The title bar shows the speed and what the train is doing.
- **Your report:** the coaches either side of the one you are in are always drawn in full with their interiors, so the view down the gangways no longer shows hollow far models. The gangway door beyond them is drawn closed.

- **Your second report (the train breaking up when seen from above):** not the models. The ground covered the line in four places: up to 4.2 m where the knoll at the classic viewpoint (added after the formation was cut, in `tools/terrain/build.py`) spreads over the cutting west of the viaduct; up to 2.2 m where a road bench crosses the line about 530 m west of the station; and at the west end, where the line ran out over the 25 m surround, which has no cutting. The coaches were partly buried, so only roofs showed. The app now cuts the formation into the 5 m ground after loading (0.75 m below rail top, 3.4 m each side, 1:1.5 slopes, as `build.py` does; only ever lowering), trees there sit on the lowered ground, and the track and the run stop 70 m inside the 5 m ground (the line is 200 m shorter at the west end and 85 m at the east end, still 670 m past the station). Checked: nothing covers the rails anywhere (`tools/harness/burprobe.mjs`), no tree within 3 m of the line, the viewpoint view unchanged; shots in `fix/`.

## Checks

| Check | Result |
|---|---|
| Beats in phase with the wheels, any speed (automated) | **Pass.** 1, 5, 10, 25, 45 and 70 mph and in back gear: 4 beats per turn; at every beat the valve is at release (within 0.0001 mm); each sound is scheduled at its beat's exact time (spread under 0.001 ms). `checks-beats.json` |
| Crossing time matches the chosen speed | **Pass.** Viaduct 376 m plus train 159.5 m. 5 mph 239.5 s (expected 239.6); 10 mph 120.1 s (119.8; the guides' "almost two minutes"); 15 mph 80.8 s (79.9); 20 mph 61.5 s (59.9, +2.7 %: the heavy train sags to 17.7 mph on the climb). Limit ±3 %. `checks-cross.json` |
| Whole run | **Pass.** Stops 1.0 m past the mark at Glenfinnan, stands 60 s, leaves, starts again east of the viaduct; highest acceleration 0.28 m/s². |
| Riding a moving coach and cab | **Pass.** Standing in coach 5419 while it ran 48 m: moved 0.1 mm in the coach. Walked 4.2 m along the aisle at speed. On the footplate: no drift. Doors locked while moving. `checks-ride.json` |
| Sound while running | **Pass.** Under the arches -31.9 dB RMS (peak -19.7); on the deck as it passes -28.7 (-15.9); cab at 25 mph -18.8 (-6.4); coach at 25 mph -25.5 (-13.7); departing -30.1 (-16.4); whistle on the footplate -21.2 (-9.1); muted silent. Limits: peak under -1, RMS between -60 and -8. `checks-audio.json` |
| Performance while running (worst view, desktop and phone sizes) | **Medium and High pass:** Medium 291 draw calls, 1.04 M triangles (budget 300, 1.2 M); High 451, 2.90 M (600, 3 M). **Low slightly over in three views:** cab 153–155 calls (150); engine close-up at 25 mph 432k triangles (400k); standing at a gangway 161 calls and 417k. Everything else on Low is within budget. `checks-perf.json` |
| Gangway view (your report) | **Fixed.** Medium and High: the coaches either side are always drawn in full. Low: your coach in full, the next one in full when you are within 4 m of the gangway; the door beyond is drawn closed, never a hollow coach. Walking through to the next coach works on every tier. `checks-gangway.json` |
| Earlier phases | **Pass:** kinematics, human scale, test-site sound, cab, coaches, world, the walking flows from your laptop test, landscape sound (-34 to -28 dB RMS, echo 0.073 under the arches, muted silent). `regress/` |
| Unit tests | **Pass** (48, including 12 new for the beats and the run) |

## What it costs while running

The shadow map is redrawn every frame while the train moves, which first put every tier over budget. The fixes:
- **Medium and High:** only trees within 70 m of the shadow's centre cast shadows (were all near trees: 185k triangles); river boulders cast none.
- **Low:**
  - the engine and tender cast through one invisible stand-in shape (1 draw call instead of about 125 parts);
  - no rail-head strip, and the rails cast no shadow;
  - from inside a coach the engine uses its simplest model;
  - the next coach is drawn when you reach the gangway.
- **All tiers:** the simplest engine model has its static parts merged and leaves out the valve gear; the steam costs nothing when out of view.

The Low overages left (3–8 %) are for the Phase 7 pass on your phone: Low is the safety net for older phones, and your S26 will likely run Medium.

## Estimates and limits

- The **gradient**: the rail levels fitted to 50 m terrain climb at up to 1 in 40 from the viaduct to the station. That is the fit's own limit, and too steep for a Black 5 to lift this 445 t train. The physics caps it at 1 in 50; the real gradient is unverified.
- **Masses, tractive effort, power and the line speed (25 mph)** are class figures or estimates, not checked against a source (REFERENCE §9).
- **Exhaust lap** is taken as zero, so the beats fall where the valve passes mid travel.
- **Rail joints:** jointed track every 60 ft is assumed.
- **Steam** is billboards shaded as soft spheres, not a simulated volume. It cannot wrap around the boiler, and it does not cast shadows.
- **Sounds** are procedural: the whistle, beats and rolling are not recordings of 45407.
- The **station dwell (60 s) and the viaduct pause (30 s)** are chosen for the experience, not taken from a timetable.
