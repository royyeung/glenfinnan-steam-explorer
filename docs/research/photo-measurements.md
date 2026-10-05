# Photo measurements of 45407 (Phase 1 blockout)

Values entered in `src/specs/*.ts` as `photo:S33` or `photo:S35b` come from here. Measured 2026-10-05 on full-resolution files, using pixel grids (`tools/refs/` scripts plus grid crops).

## Side elevation: S33 (RIGHT side, 22 Oct 2025, 8241 × 4636 px)

The front of the engine is to the right of the picture, so this is the engine's right-hand (fireman's) side. My first notes called it the left side; corrected 2026-10-05. Side-specific details measured here (nameplate, pipework, air pump) belong to the right side.

**Scale: 235.0 px/m.**

- Front buffer face (x = 4661) to tender rear buffer face (x = 103) is 4558 px. Set against the published 63 ft 7¾ in (19.40 m, S1/S2), that gives the scale.
- **Check 1, height:** chimney top (y = 2674) to near-rail top (y = 3580) is 906 px, i.e. **3.855 m**, against the published 12 ft 8 in (3.861 m, S2): −0.15 %.
- **Check 2, wheel spacing:** rear-to-middle coupled hub is 575 px, i.e. **2.447 m**, against 8 ft 0 in (2.438 m, S24): +0.4 %.

Below, d = distance behind the front buffer face (m) = (4661 − x) / 235, and h = height above rail top (m) = (3580 − y) / 235.

| Feature | Pixel | d (m) | h (m) | Note |
|---|---|---|---|---|
| Front buffer face | x 4661 | 0.00 | | |
| Front buffer centre | y 3335 | | 1.04 | |
| Buffer beam front face | x 4536 | 0.53 | | Beam top h 1.27 |
| Front running-plate drop starts | x 4315 | 1.47 | | Curves down to the beam |
| Smokebox door face | x 4363 | 1.27 | | |
| Smokebox front ring | x 4329 | 1.41 | | |
| Smokebox top | y 2762 | | 3.48 | |
| Chimney centre | x 4070 | 2.51 | | Lip width 151 px = 0.64 m |
| Chimney top | y 2674 | | 3.855 | |
| Smokebox / barrel seam | x ≈ 3876 | 3.34 | | ±0.05 |
| Top feed casing | x ≈ 3302 | 5.78 | 3.75 | |
| Dome centre | x ≈ 3096 | 6.66 | 3.85 (top) | |
| Barrel / firebox seam | x ≈ 2945 | 7.30 | 3.55 → 3.65 | Belpaire top higher |
| Cab front (spectacle plate) | x 2298 | 10.06 | | |
| Cab roof top | y ≈ 2709 | | 3.71 | |
| Cab roof rear end | x ≈ 1691 | 12.64 | | ±0.10 |
| Cab side window | x 1954–2236, y 2861–3019 | 10.32–11.52 | 2.39–3.06 | |
| Cab side lower edge | y ≈ 3198 | | 1.63 | |
| Running plate (high) | y ≈ 3133 | | 1.90 | |
| Cylinder block (clad) | x 3952–4175, y 3176–3426 | 2.07–3.02 | 0.66–1.72 | Includes the valve chest |
| Front bogie wheel hub | x ≈ 4319, y ≈ 3452 | 1.455 | 0.54 | |
| Rear coupled hub | x ≈ 2360, y ≈ 3387 | 9.79 | 0.82 | |
| Middle coupled hub | x ≈ 2935, y ≈ 3390 | 7.34 | | |
| Tender front (bulkhead top) | x ≈ 1722 | 12.51 | | |
| Tender body rear | x ≈ 202 | 18.98 | | |
| Tender rear buffer face | x ≈ 103 | 19.40 | | Buffer centre h ≈ 0.98 (perspective; 1.04 used) |
| Tender side top (coal space) | y ≈ 2801 | | 3.31 | |
| Tender rear tank top | y ≈ 2955 | | 2.66 | Step at x ≈ 511, d 17.66 |
| Tender tank bottom edge | y ≈ 3300 | | 1.19 | |

**Wheel-position cross-check.** Engine wheelbase 6 ft 3 in + 5 ft 11 in + 7 ft 0 in + 8 ft 0 in = 27 ft 2 in. The split of the first two figures is an *estimate* (one low-confidence snippet gives 27 ft 2 in; 7 ft 0 in + 8 ft 0 in is S24).

- Starting from the photo's front bogie axle (d 1.455), the rear coupled axle lands at d **9.735**. The photo gives **9.79**: 5 cm apart, which supports the 27 ft 2 in total.
- The rear bogie wheel is partly hidden behind the cylinder. The photo suggests d ≈ 3.6 against 3.36 from the 6 ft 3 in estimate, so it stays an **estimate (±0.25 m)**.

**Tender axles.** They are not resolvable (dark, behind the frames). They are placed symmetrically about the tender body centre with the 7 ft 6 in + 7 ft 6 in wheelbase (S25), flagged as an **estimate**.

## Front view: S35b (York, 1 Nov 2023, 5438 × 3598 px, head-on)

**Scale: 388.8 px/m**, from the buffer centres (676.5 px) set equal to the standard 5 ft 8½ in (1.740 m). The buffer spacing is *assumed standard*, so these are Medium confidence. Only features in the buffer-beam/smokebox-front plane are used; perspective makes features further back read smaller.

| Feature | px | m |
|---|---|---|
| Buffer beam width | 907.5 | 2.33 |
| Buffer beam depth | 183 | 0.47 |
| Buffer head diameter | 151 | 0.39 |
| Smokebox shell outer diameter | ≈ 665 | ≈ 1.71 |
| Smokebox door ring outer diameter | ≈ 591 | ≈ 1.52 |
| Chimney lip | ≈ 254 | ≈ 0.65 (side view 0.64) |
| Width at running-plate valances | ≈ 1013 | ≈ 2.60 |

Shed plate on the smokebox door (2023): **65J**, the BR code of Fort William shed (blue plate). The smokebox numberplate is blue with white numerals.

## Limits

- **Perspective:** S33 is not a true orthographic elevation. The camera stood close beside the line at the viaduct end, and the loco may sit on the curve. The scale cross-checks agree to 0.4 % over the loco; local errors of about ±5 cm are expected, and ±10–25 cm on hidden undergear.
- **Dark undergear:** wheels and frames are hard to resolve. Positions of hidden parts come from the cross-checked wheelbase, not from the photo.
- **Widths:** these are from one head-on photo and a standard-practice assumption. Cab and tender widths are not measured (perspective); they are estimates.
