# Phase 4 fix: first class and buffet from your photos (2026-10-12)

You sent three photos and asked me to research where they were not enough. This fix rebuilds first class and the buffet to match them. Captures: 24 Aug 2026, 11:15 BST, High, SwiftShader. `compare_p4c.jpg` (sent, not committed) puts each render beside its reference.

## Sources

| Ref | What it shows | Used for |
|---|---|---|
| U04 (your photo; source and date unknown) | A **Mk2** first-class saloon: flat ceiling, glazed end partition, black tables on yellow legs, no cloths | 5229/5239 layout, tables, lamps, curtains, carpet |
| S52 (WCR's own photo, 31 Mar 2018) | A **Mk1** first-class saloon with the same furnishings | Confirms the furnishings are WCR's Jacobite first class |
| U03 (your photo; railway unknown) | Buffet counter with shelves of goods behind it | Buffet layout |
| WCR Mk1 buffet 1860 (Flickr, awsnews, 13 Apr 2024; all rights reserved, comparison only) | A WCR Mk1 buffet in the 2024 Jacobite replacement set: gold "BUFFET" lettering on the side | "BUFFET" lettering on 99318 |
| Coach register (S10) | 99318 = ex-4912, a Mk1 **TSO** | Confirms it is an ordinary coach with a counter, not a built buffet car |

Your notes' other claims were checked:
- The Commons viaduct photo is from 24 Jul 2012 with K1 62005, not 10 Jul 2013.
- The "RMB, 1961, Lot 30691, Diagram 24" details do not match the register.
- The Vintage Carriages Trust link does not resolve.

## What changed

**First class (5229, 5239):**
- Wingback armchairs in navy-and-gold damask, with rolled arms, wings and short wooden legs.
- White "FIRST CLASS" headrest covers.
- Black round-cornered tables on yellow legs, without tablecloths.
- A tartan-shaded lamp on a brass column at every table.
- Black-and-white tartan curtains, pleated and tied back.
- Navy patterned carpet.
- 2 + 1 seating as before: pairs on the left, singles on the right. The aisle is 0.94 m.

**Every saloon:** "F" and "B" seat-direction cards on the window pillars, as in U04 and WCR's standard-class photo.

**Buffet (99318):**
- The counter now runs along the coach with the staff behind it.
- Goods sit on shelves against the bodyside, behind the staff, as in U03. The windows on that side are boarded over (as in S50).
- Back counter with coffee machine, hot-water urn and wall water boiler.
- On the counter: cake dome, chalkboard, till and a glass cabinet.
- Two dome lights over the counter.
- Customers stand on the left, in a 1.18 m passage.
- The side-of-coach shop shelves and the tall display are gone.
- Gold "BUFFET" lettering on both sides, as on WCR's buffet 1860.

## Checks

| Check | Result |
|---|---|
| Walk the whole train | **Pass.** 119 m through all six coaches. The walker steps round the buffet counter on the customer side (furthest point x = 0.65 m) and back to the centre for the gangway. Stays on the floor (1.269 m) |
| Doors | **Pass** (1.6 rad, all types) |
| Unit tests | **Pass** (36) |
| Performance | **Pass.** Draw calls, 1280×720: buffet 87 (Low), 107 (Medium), 198 (High); first class 55, 72, 128. The 844×390 figures are the same |
| Downloads | First-class coach 0.97 MB (close-up model), buffet 0.53 MB |

## Still unverified

1. Whether 5229 and 5239 are exactly the coach in U04. The furnishings are confirmed for WCR first class; the coach number in U04 is not visible.
2. The damask pattern and the tartan sett are generic patterns in the right colours, not copies.
3. 99318's own buffet: U03 is from an unknown railway. Its blue counter front is not copied; the goods are generic.
4. Whether 99318 carries "BUFFET" lettering like 1860.
5. The number of first-class seats: the model has 48 (8 bays). 5236 is listed with 42.
