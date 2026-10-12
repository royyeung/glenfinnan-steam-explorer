# Phase 4 addendum: first class, buffet/shop and the real 2026 set (2026-10-12)

You asked for a first-class coach and a buffet coach, so the two can be told apart from the standard coaches. While researching them I found a list of the vehicles actually taken north for 2026 (REFERENCE S42). The six coaches now follow that list.

Captures: same fixed time and renderer as Phase 4 (24 Aug 2026, 11:15 BST, SwiftShader). The dusk view is at 21:18.

## The set (from the engine backwards)

| # | Coach | Type | How to tell it apart |
|---|---|---|---|
| 1 | 5487 (F) | Mark 2B, standard | No centre door; one wide door right at each end; no toilet window |
| 2 | 5453 (E) | Mark 2B, standard | same |
| 3 | 5419 (D) | Mark 2A, standard | The Phase 4 coach: doors at both ends and in the middle, frosted toilet window |
| 4 | 99318 (C) | **Mark 1, buffet and shop** | Older body: narrower windows in aluminium frames with sliding top panes, rain strips over the doors, two rows of roof vents, truss rods under the floor. Inside: counter, coffee machine, urn, till, fridge, shop shelves, a "BUFFET · SHOP" sign |
| 5 | 5229 (B) | **Mark 2, first class** | Same body as 5419. Inside: 2 + 1 seats (tables for four on the left, for two on the right), white tablecloths, table lamps, cream tie-back curtains, white headrest covers. The lamps and curtains show through the windows from the platform |
| 6 | 5239 (A) | **Mark 2, first class** | same |

The letter is on a card in the corner of each end window, as on WCR coaches.

## Where this comes from

- **The vehicle list (S42).** A railforums.co.uk thread about the 2026 Jacobite lists:
  - 35517 (the owner's support coach), 35486, 94225 and BSO 9539;
  - the six passenger coaches above.

  The forum blocks automated access, so I could read it **only through search-engine summaries**. The coach register (S10) confirms every number as a WCR maroon coach.
- **Why a Mark 1 sits among Mark 2s.** WCR asked in April–June 2026 to return to Mark 1s, fitting door locks over time. One Mark 1 already fitted with locks can run in the Mark 2 set. No buffet was ever built to the Mark 2 design, so Mark 2 trains always used Mark 1 buffets.
- **First-class layout.** WCR's own description: "tables for 2 and tables for 4 at either side of the aisle". A sister coach, 5236, is listed on Commons as a **42-seat** Mark 2 "SO", which fits 2 + 1 seating. Its photo shows cream curtains and white tablecloths.
- **Mark 2B shape:** photos of 5455 and E5482 (S46, S47).
- **Mark 1 and the buffet conversion:** photos of M4910, 4346 (a Mark 1 with a buffet counter) and S1885 (S48–S50).

## Checks

| Check | Result |
|---|---|
| Walk the whole train | **Pass.** Boarded 5487 by its wide A-end door from the platform. Walked 119 m through all six coaches and five gangways (Mark 2B toilets, buffet, first class) without leaving the floor (1.269 m), up to the closed gangway door at the rear |
| Doors from the platform | **Pass.** 5487 A door, 99318 B door and 5239 centre door all open (1.6 rad) |
| Clearances | Aisle 0.68 m (standard), about 1.0 m (first class), 1.23 m past the buffet counter. Door clear height 1.91 m; Mark 2B doors 0.86 m wide |
| Cab, kinematics, human scale | **Pass** (unchanged) |
| Audio | **Pass.** Coach door with footsteps −16.4 dBFS peak; whistle −14.7 |
| Unit tests | **Pass.** 36 of 36, including 11 new ones: no window or door overlaps or runs off the body on any coach type; numbers sit on plain panels; formation letters |
| Live site | **Pass.** No errors |

## Performance (relative only: software rendering)

| Tier | Front 3/4 | Whole train | Cab | Standard aisle | **Buffet** | **First class** |
|---|---|---|---|---|---|---|
| Low | 124 | 33 | 126 | 61 | 83 | 51 |
| Medium | 153 | 66 | 143 | 113 | 103 | 68 |
| High | 290 | 116 | 270 | 210 | 190 | 120 |

Draw calls at 1280×720; the figures at 844×390 are the same or within 4. Every tier is within budget.

**Downloads:**
- The coaches are now four models instead of one: 3.4 MB instead of 0.85 MB.
- Video memory: 34.5 MB (was 32.4).

## Fixed during the work

1. The curtains first looked like flat pale slabs. They are now gathered folds with a tie-back band.
2. The buffet counter first stood in the walking line. It was moved so you can walk straight through the train.
3. An info marker for the Mark 1 underframe floated over the platform. It was moved up to the solebar.

## Still unverified or estimated

1. **The coach list** comes from a forum, read only through search summaries. **The order and the letters are my estimate** (I used the order of the list; A at the rear).
2. **Inside the buffet/shop 99318** nothing is published. The counter on the right, shop shelves on the left, the B end, windows kept: all estimated. Real buffets often have the counter windows panelled over.
3. **First-class seats:** I used the standard Mark 2 seats re-spaced 2 + 1. The real seats may be different (WCR says "more luxurious"). The model has 48 seats; 5236 is listed with 42.
4. **Mark 2B and Mark 1 dimensions** are measured from photos without a known scale (proportions only). The Mark 1 cross-section, roof profile and lower-body curve are the same as the Mark 2 in the model; the real Mark 1 differs slightly.
5. **The Mark 1's bogies** are modelled as B4; Mark 1s also ran on other types.
6. **Not modelled:** the support coach 35517 and the brake coach 9539. You chose six coaches.
7. **At dusk** the coach interiors are still dark: the lights glow but do not light the saloon. This is planned for Phase 7.
