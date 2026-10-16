# Fixes from your laptop test (2026-10-16)

You reported: the opening view is far out; wheel zoom is slow and never gets close; Walk didn't work and you could not climb up into the train; the train doesn't move; drop-down lists are white with pale text.

| Problem | Cause | Fix | Check |
|---|---|---|---|
| Opening view far out | It opened on the classic hillside view, 250 m from the train | Opens on **the train on the viaduct**, 43 m from the engine (also "Go to → The train") | `open.png` |
| Zoom slow, never close | Each wheel notch zoomed only 5%, towards a point in the middle of the viaduct, not the train | Each notch now zooms about 15%, **towards whatever is under the cursor**. **Double-click** (double-tap on a phone) flies to the point you click | 8 notches over the engine: 43 m → 8 m (`zoomed.png`) |
| Couldn't climb into the train | On the viaduct you stand at track level. The cab's first step is 0.62 m up and Mk2 doors have no steps (floor 1.27 m); the walker climbs at most 0.45 m | **"Climb into the cab / coach (E)"** appears beside every cab entrance and coach door (a button on phones); **"Step down"** appears inside a doorway | Cab: in and out again; coach 5419 boarded from the viaduct deck, then walked 5 m down the aisle (`walk_incab.png`, `walk_coach.png`) |
| Drop-down lists unreadable | Windows draws the list white; the text colour was inherited light cream | Dark rows, light text | Option colours checked: rgb(29,33,38) on rgb(242,239,230) |
| Train not moving | The train running along the line is Phase 6 (motion and effects). "Motion" only turns the wheels in place | Not changed: waiting for your Phase 6 approval | — |

Earlier checks re-run: kinematics, human scale, cab, coaches, world (train on track, walking on the deck, under the arches, boarding at the station), test-site audio, landscape audio: all pass. Flow test: `tools/harness/walktest.mjs`.
