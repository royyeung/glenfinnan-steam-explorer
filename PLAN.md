# PLAN: Glenfinnan steam explorer (private, unofficial)

A private, educational WebGL recreation of the Jacobite train as it runs in 2026:

- **Locomotive:** LMS Stanier Class 5 4-6-0 **45407 "The Lancashire Fusilier"** and its tender.
- **Coaches:** a rake of **BR Mk2** coaches.
- **Setting:** on the **Glenfinnan Viaduct**.
- **What you can do:** walk around and inside the train, see the motion work in cutaway, learn the parts in info mode, and watch it cross the viaduct.

Verified facts live in [REFERENCE.md](REFERENCE.md). This file covers how the project will be built and checked.

**Status:** Phase 1 (foundations) complete on 2026-10-05, live at https://royyeung.dev/glenfinnan/. **Awaiting "approved, continue to Phase 2".**

---

## 1. Hosting, naming, privacy

| | Proposal |
|---|---|
| Path | `https://royyeung.dev/glenfinnan/` (new path, not reused) |
| Repo | `royyeung/glenfinnan-steam-explorer`, **private** (please create it empty, no README; I'll push over SSH) |
| Clone | `/srv/projects/glenfinnan-steam-explorer` |
| Type | **Static**: Vite build output rsynced to `/srv/www/glenfinnan/`. No container: there is no server-side code. |
| Search engines and bots | **Blocked on the whole domain** (your request, 2026-10-05). Every response from `royyeung.dev` carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate`; `/robots.txt` disallows everything; known crawlers (Google, Bing, Baidu, Yandex, Sogou, Bytespider…), AI scrapers, SEO tools, archivers, link-preview fetchers, scripting clients, headless browsers and requests with no User-Agent get **403** on every path. Real browsers are unaffected. Bots that disguise themselves as a normal browser can only be stopped by a password, which is not enabled. The page also has a `noindex` meta tag. |
| Basic auth | **Not used** (decided 2026-10-05): noindex only. It can be added later in the Caddyfile alone, with the hash kept out of the repo. |
| Private inputs | `reference/` (your photos and `captions.md`) and `data/` (raw terrain downloads) are git-ignored and never deployed |

Caddy block (live since 2026-10-05), inside `royyeung.dev { }` before the catch-all. The `(no_bots)` snippet defines `@bots`/`@noua` and the `X-Robots-Tag` header for the whole site:

```
# Glenfinnan steam explorer (private, unofficial)
redir /glenfinnan /glenfinnan/ 308
handle_path /glenfinnan/* {
	respond @bots "Forbidden" 403
	respond @noua "Forbidden" 403
	root * /srv/www/glenfinnan
	file_server
}
```

The server's Caddy (v2.11.4) already maps `.glb`, `.ktx2`, `.wasm` and `.webmanifest` to the right MIME types (checked 2026-10-04). Responses are compressed with `encode zstd gzip`.

**Deploy:** `tools/npm.sh run build`, then `rsync -a --delete dist/ /srv/www/glenfinnan/`. Verification uses a normal browser User-Agent (curl's own is refused): 200 for `/glenfinnan/`, 308 for `/glenfinnan`, the `X-Robots-Tag` header, and 403 for a crawler User-Agent.

## 2. Rights and taste

- **The franchise:** no names, imagery, music or colour schemes associated with the boy-wizard films. That rules out red "castle" engines, "platform" jokes and soundalike themes. The viaduct is presented as railway and civil-engineering history only.
- **Unofficial note:** an "Unofficial private educational project" line on the loading screen and in About. It says the project is not affiliated with West Coast Railways, Riley & Son, Network Rail, the owners of 45407 or Historic Environment Scotland, and that "The Jacobite" is WCR's service name.
- **Real markings:** these are reproduced as the real vehicle carries them (number, nameplate, BR emblem, shed plate). There are no operator logos beyond that. A headboard is included only if you want it (Q5).
- **Attribution:** an in-app About panel and `CREDITS.md` list the terrain attributions (OGL, Crown copyright, and the dataset-specific wording in REFERENCE §8.1), every CC0 asset, and every library and its licence.
- **Reference photos:** comparison only. They are never committed, deployed or traced into textures.

## 3. Architecture

### 3.1 Stack (versions pinned exactly at Phase 1 setup; current releases on 2026-10-04)

| Part | Choice | Version today |
|---|---|---|
| Renderer | `three` (WebGLRenderer, WebGL 2) | 0.186.1 |
| Build | `vite`, static output, `base: '/glenfinnan/'` | 8.3.2 |
| Language | TypeScript, strict (falls back to the latest 5.x if 7.x tooling misbehaves) | 7.0.2 |
| Collision | `three-mesh-bvh` (capsule vs BVH for walking) | pin at Phase 1 |
| Tuning panel | `lil-gui` | 0.21.0 |
| Unit tests | `vitest` (kinematics, specs, solar position) | 5.0.3 |
| Asset processing | `@gltf-transform/cli` + `meshoptimizer`; KTX-Software `toktx` in a pinned Docker image | 4.5.1 / 1.3.0 |
| Terrain processing | GDAL in a pinned `ghcr.io/osgeo/gdal` image | pin at Phase 5 |
| Screenshots | Playwright in the official `mcr.microsoft.com/playwright` image (reusing the server's existing v1.49.1 image, Chromium 131) | 1.49.1 |
| Images | Python 3.12 slim + Pillow/numpy (contact sheets, overlays, diffs) | |

All tools run in throwaway containers. Nothing is installed on the host.

### 3.2 Coordinate conventions

- **Units:** metres and seconds. **Y is up.** Right-handed.
- **Vehicle local frame:**
  - Origin at **rail-top level**, on the track centreline, at the vehicle's **mid-length between buffer faces**.
  - **+Z points forward** (chimney end, or the coach's "A" end).
  - **+X is the vehicle's left side** (the driver's side on LMS engines).
  - Everything is modelled at 1:1.
- **World frame:**
  - x = Easting − 191000 and z = −(Northing − 781290), both in British National Grid (EPSG:27700, metric), so −Z is grid north.
  - y = height above Ordnance Datum (m).
  - The origin is the viaduct centre from the HER grid reference (REFERENCE §7). Because EPSG:27700 is already metric, terrain needs no reprojection beyond the offset.
- **Track:** a polyline/clothoid centreline in world space. Vehicles are placed by distance along it, with bogies and axles on the rails. The coach body follows its two bogie pivots, so it chords correctly on the 241 m curve.

### 3.3 Module layout

```
src/
  main.ts                 boot, mode switching, loading screen
  core/                   clock (fixed-step option), events, quality tiers, asset loader, units
  specs/                  dimension tables: one value + unit + source + confidence per entry
    black5.ts  tender4000.ts  mk2.ts  viaduct.ts
  render/                 renderer, tone mapping, post chain, sky + sun, shadows (CSM), haze, PMREM env
  materials/              PBR material library, procedural weathering (masks, curvature/AO, grime, soot, rust, oil)
  loco/                   one module per assembly:
    frames.ts  boiler.ts  smokebox.ts  chimney.ts  domes.ts  firebox.ts  cab.ts  cabInterior.ts
    runningPlate.ts  pipework.ts  cylinders.ts  wheels.ts  bogie.ts  motion/ (solver.ts, walschaerts.ts, rods.ts)
    brakes.ts  buffersCouplings.ts  lamps.ts  fittings.ts (AWS/TPWS/air kit)  tender/ (tank.ts, frames.ts, coalspace.ts)
  coach/                  mk2Body.ts  bogieB4.ts  gangway.ts  doors.ts  interior/ (seats.ts, tables.ts, racks.ts, lights.ts)
  world/                  terrain.ts (tiles, LOD)  viaduct.ts  track.ts  loch.ts  vegetation.ts  station.ts
  sim/                    train motion along the track, wheel rotation, exhaust timing
  controls/               orbit, first-person walk (capsule + steps), touch controls, gamepad (optional)
  modes/                  exterior, cab, coach, cutaway, landscape, info (hotspots)
  audio/                  procedural + CC0 samples: exhaust beats, whistle, rail joints, ambience
  debug/                  GX API, free camera, tuning panel, JSON export, perf overlay
tools/                    Docker-run scripts: build, shoot (Playwright), contact sheets, overlays, asset bake, terrain
tests/                    vitest: kinematics, specs integrity, solar position, human-scale clearances
```

Each assembly module is a pure function `(specs, quality) → THREE.Group`, with named sockets (pins, pivots, hotspot anchors). That lets each part be refined, tested and LOD-ed on its own.

## 4. Building from references

### 4.1 Parametric and traceable

- **One spec entry per number.** Every number the geometry uses comes from `src/specs/*.ts` and carries `{ value, unit, source: 'S1' | 'photo:L01' | 'estimate', confidence }`.
- **Unverified values stay visible:**
  - A test fails if any geometry reads a number that isn't in the spec tables.
  - The tuning panel lists every `estimate` / `UNVERIFIED` value in amber.
  - Info mode can show "estimated" next to a part.

### 4.2 Measuring from photos when drawings are missing

- **Photo measurement:** rectify the elevation photo (L01/L02), using the rail line as horizontal and wheel ellipses for perspective. Then scale it from the **6 ft 0 in drivers** and the coupled wheelbase.
- **Recording:** each measured value is entered as `photo:L01`, with its estimated error.
- **When a GA drawing (D01) arrives:** its values replace the photo values, and the change log records the difference.

### 4.3 Mechanical truth

- **Solver:** the motion is an exact pinned-joint solver (circle–circle intersections in each side's vertical plane), driven only by wheel angle θ and reverser cut-off. Rods are rigid by construction, so they cannot stretch or detach.
- **Phasing:** the sides are quartered at 90°. Which side leads is a spec value (REFERENCE §5).
- **Linkage geometry** (eccentric rod, expansion link, radius rod, combination lever) comes from D02 if you can get it. Otherwise it is fitted to photo positions and plausible valve events, and labelled "estimated".

## 5. Asset pipeline

| Stage | Tool | Output |
|---|---|---|
| Geometry generation | The same TS generators run in the browser (dev, hot reload) or headless Chromium (build) | three `Group`s |
| Export | `GLTFExporter` → `.glb`, one per assembly or vehicle, named nodes for animated parts | `build/raw/*.glb` |
| Optimise | `gltf-transform`: dedup, weld, `instance` (rivets, bolts, seats), `simplify` for LOD1/LOD2, `meshopt` compression | `public/models/*.glb` |
| Textures | Procedural (wear masks, grime, soot, rust and oil streaks, noise from world-space triplanar/curvature, **no tiling repeats**) plus CC0 detail maps (Poly Haven / ambientCG). Baked in headless Chromium to PNG, then KTX2: **UASTC** for normals and fine detail, **ETC1S** for colour and roughness. Mipmapped. | `public/textures/*.ktx2` |
| Terrain | GDAL: clip, fill, resample. Quadtree tiles at several LODs, meshes simplified with RTIN error bounds. Meshopt `.glb` per tile plus a KTX2 colour/normal map. | `public/terrain/<z>/<x>_<y>.glb` |
| Runtime | `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader` (Basis transcoder, served locally) | |

- **LOD:**
  - Loco and tender: LOD0 (close and cab), LOD1 (orbit at > 25 m), LOD2 (landscape at > 120 m).
  - Coaches: same three levels, with **interiors loaded only when you approach a door**.
  - Rivets, bolts and seats: instanced.
- **Loading:**
  - The loading screen shows real progress (bytes) and the unofficial note.
  - The first view (exterior orbit) needs only the LOD1 loco and tender plus a low-res terrain ring. Everything else streams in afterwards.
- **Git:**
  - Generated assets are rebuilt by one command (`npm run assets`, Docker-run).
  - Small processed assets are committed so a fresh clone runs without the raw data. Raw downloads stay in `data/`.
  - If committed assets would exceed about 50 MB, I'll stop and ask before using Git LFS.

## 6. Rendering and look

- **Lighting:**
  - Physically based materials (`MeshStandardMaterial` / `MeshPhysicalMaterial`), with physical light units.
  - The sun is computed from date, time and location (NOAA/SPA algorithm, unit-tested).
  - The sky is analytic (atmospheric scattering) with a CC0 HDRI cloud layer option. A PMREM environment is regenerated when time of day changes.
- **Shadows:** one sun shadow map centred on what you are looking at (4096 px on High, 2048 Medium, 1024 Low; ±45/40/30 m), snapped to whole texels so edges don't shimmer, PCF-filtered; plus AO (GTAO) on High. *Changed in Phase 1:* three's cascaded-shadow addon (CSM) breaks reflections on metal in r186: it swaps in an outdated lighting shader, as shown by test spheres. Long-range landscape shadows (Phase 5) will need a fixed CSM or a custom cascade.
- **Post:**
  - Tone mapping is AgX or Neutral; I'll compare both against reference photos in Phase 1.
  - Subtle bloom (firebox, lamps, sun glints).
  - Height fog with aerial perspective (haze), so distant hills read correctly.
  - AO (GTAO) on High.
  - Anti-aliasing: MSAA on High; SMAA/FXAA on Medium.
- **Interiors:**
  - Cab: firebox glow as an animated emissive plus a point light.
  - Coaches: interior lights with real luminous values.
  - Daylight through the windows uses the same sun and sky.

## 6a. Sound (whole project, every mode)

Sound is part of every phase, not an add-on (your request, 2026-10-05).

- **Engine:** Web Audio. Master bus with a safety limiter, mute and volume, and unlock on the first tap or click. Spatial sources (HRTF on High and Medium) follow the moving vehicles; the listener follows the active camera.
- **Sources:** procedural synthesis first. CC0 recordings only where synthesis can't convince, each listed in CREDITS.md. No film music anywhere.
- **Checks every phase:** an AnalyserNode harness measures RMS and peak dBFS at fixed positions. It verifies no clipping (peak < −1 dBFS), sound present (RMS > −60 dBFS), and silence when muted.

| Phase | Sounds added |
|---|---|
| 1 | Highland ambience (wind with gusts, a burn, small birds). Engine standing in steam: blower roar at the chimney, safety valves feathering, air-pump double beats, low firebox roar heard on the footplate. |
| 2 | Exterior detail: cylinder drain cocks, injector "singing", drips and hiss, coupling clanks, motion clatter when turning |
| 3 | Footplate: firehole doors, shovel on the shovelling plate, coal, regulator and reverser clicks, gauge-glass cocks, blower valve, whistle valve; cab acoustics |
| 4 | Coach interior: door slams and locks, footsteps on floor and vestibules, seat creaks, muffled exterior, interior rumble |
| 5 | Viaduct and landscape: wind on the viaduct, River Finnan, loch shore, wildlife by time of day, echo off the piers |
| 6 | Running: exhaust beats locked to wheel rotation (4 per revolution), whistle, wheel and rail joints, flange squeal on the 241 m curve, Doppler, cab and coach mixes |
| 7 | Final mix, loudness balance, captions for sounds (accessibility) |

## 7. Quality tiers and performance budget

The tier is chosen automatically from the GPU, screen and device memory, and can be changed in settings and with `?q=high|medium|low`.

| Budget (per frame, worst view) | High | Medium | Low (phones) |
|---|---|---|---|
| Target device (Q11) | Discrete GPU / Apple M-series, 1440p | **Your Windows 11 14" laptop, Chrome** (GPU read by `?perf=1`) | **Your Galaxy S26 Ultra, Chrome** as the phone reference. It is a flagship, so auto-tier may pick Medium; Low stays the safety net for older phones. |
| Frame time | ≤ 16.7 ms | ≤ 16.7 ms (floor 33 ms) | ≤ 33 ms |
| Render resolution | DPR ≤ 2, scale 1.0 | DPR ≤ 1.5 | DPR ≤ 1, dynamic 0.7–1.0 |
| Visible triangles | ≤ 3.0 M | ≤ 1.2 M | ≤ 0.4 M |
| Draw calls | ≤ 600 | ≤ 300 | ≤ 150 |
| GPU texture memory | ≤ 768 MB | ≤ 384 MB | ≤ 160 MB |
| Shadows | 1 × 4096 around the focus (±45 m) + GTAO | 1 × 2048 (±40 m) | 1 × 1024 (±30 m) |
| Post | MSAA4, GTAO, bloom, haze | SMAA, bloom, haze | Haze only |
| Download to first view | ≤ 60 MB | ≤ 35 MB | ≤ 20 MB |
| Total download (all modes) | ≤ 250 MB | ≤ 150 MB | ≤ 90 MB |

Per-mode sub-budgets are fixed in Phase 1 (for example, the cab interior on High: ≤ 800 k triangles).

**Measurement:** `renderer.info` gives triangles and draw calls. A texture registry gives exact texture memory. Frame time comes from `EXT_disjoint_timer_query_webgl2` where available, otherwise CPU frame timing.

**Honesty note:** this server has no GPU. Headless Chromium renders with SwiftShader (software), so its frame times are relative only, as on the kart project. Real numbers come from a `?perf=1` overlay you open on your actual phone and computer (Q11).

## 8. Verification harness (built in Phase 1, grows each phase)

| Check | How |
|---|---|
| Fixed cameras | Named views in `tools/views.json`, e.g. `loco-right-elev` (orthographic), `loco-left-elev`, `front-34-l`, `rear-34-r`, `front-end`, `plan`, `motion-r`, `motion-l`, `cab-driver`, `cab-fireman`, `backhead`, `cutaway`, `coach-ext`, `coach-aisle`, `viaduct-classic`, `viaduct-deck` |
| Screenshots | Playwright (Docker) loads `?shot=<view>&fixed=1&t=<sec>`, waits for `GX.ready`, captures. Every phase writes `shots/pN/*.png`, a **contact sheet** and `NOTES.md`. |
| Scripted walkthroughs | Recorded input scripts (walk to cab, board coach, walk the aisle). They assert position and collision checkpoints and capture frames. |
| Reference comparison | Side-by-side composites (reference \| render) for every view that has a matching photo, with differences listed honestly |
| Silhouette overlay | Orthographic side and end elevations rendered as flat black on white, scaled with the same pixel/metre as the rectified photo or GA drawing. Reports the overlay image, IoU and the worst edge deviation in cm. |
| Kinematics test (vitest) | Over 360 steps of a full wheel turn, at full forward, mid and back gear, every rod's pin-to-pin length stays constant (≤ 0.1 mm). Every joint stays coincident with its partner. No rod passes through wheel bosses, crankpins or the slidebars (swept-volume clearance ≥ 5 mm). Sides stay at 90°. Valve-event plot exported. |
| Human scale | A 1.70 m avatar (eye 1.60 m, capsule radius 0.25 m). Automated clearance checks for cab entry, cab roof, coach doorways, vestibules, aisle and seats. Head-height and step-rise margins are written to the report. |
| Performance | Each tier at 1280×720 (desktop) and 844×390 (phone): triangles, draw calls, texture MB, frame ms → `shots/pN/perf.json` |
| Spec integrity | A test lists every value still `estimate` / `UNVERIFIED`. The list goes into each phase report. |

### Debug hooks (`window.GX`, enabled with `?debug=1`)

- **Time:** `fixed` time step and `step(n)`, `setTime(sec)`, `setWheelAngle(deg)`, `setCutoff(%)`.
- **Camera and capture:** `view(name)`, `capture(w, h)` (returns a PNG), `freeCam(on)`.
- **Tuning panel:** hidden; opened with the backtick key. `exportParams()` / `importParams(json)`.
- **Inspection:** `stats()` (triangles, calls, texture MB, ms), `hotspots()`, `specs.unverified()`.

## 9. Phases and acceptance criteria

Every phase ends the same way:

1. Commits (small steps along the way).
2. An updated PLAN.md.
3. Fixed-view screenshots and a contact sheet.
4. A pass/fail checklist, plus a list of what is unverified or compromised.
5. Questions for you.
6. **STOP** until you reply "approved, continue to Phase N".

### Phase 0: Plan and research (this delivery)

- [x] PLAN.md (architecture, pipeline, budgets, verification, phases)
- [x] REFERENCE.md: specs with sources and confidence, open questions, reference photo list
- [x] LiDAR coverage checked against the portal (finding: none at Glenfinnan yet; evidence in `docs/research/`)
- [x] Captions template for your photos (`docs/captions-template.md`)
- [x] GitHub repo created by you; pushed (`main`)
- [x] Your answers recorded (REFERENCE §11); defaults stated for the rest
- [x] 35 openly licensed reference photos collected (`docs/reference-sources.md`, fetch tools in `tools/refs/`). Two findings: tender emblem settled (early emblem, Oct 2025 photo); 2025 headboard and numberplate are blue.

### Phase 1: Foundations

- **Project:** Vite + TS + three r186.1 pinned. Docker scripts for dev, build, test, shoot and deploy. First deploy to `/glenfinnan/` with noindex.
- **Rendering:** renderer, sun and sky with correct solar position, PBR test materials, tone mapping comparison, sun shadows, bloom, haze.
- **Controls:** orbit, first-person walk (capsule, steps, collision), touch controls.
- **Shell:** loading screen with progress and the unofficial note; quality tiers with auto-detect.
- **Harness:** all of §8 working on simple scenes; debug hooks; tuning panel with JSON export.
- **Blockout:** proportion-accurate loco and tender built from `specs/`, using verified and photo-measured values (sources: the near-broadside Oct 2025 and York 2023 photos, L13/L16-type views, and D01 if one turns up). Wheels at the correct spacing and diameters. Simple placeholder rods driven by the real solver.

**Accept when:**

- the silhouette overlay against L01/L02 (or D01) shows ≤ 3 cm deviation on wheel centres, buffer faces, chimney and cab roof, or every exceedance is explained;
- the kinematics test passes for the placeholder rods;
- the avatar test runs;
- the perf report is produced for all tiers at both viewports;
- the live URL returns 200 with `X-Robots-Tag`.

**Result (2026-10-05).** Details are in `shots/p1/NOTES.md`.

- [x] **Silhouette vs S33 (right side):**
  - buffer face 1.2 cm (one pixel), chimney +0.1 cm, dome 0, cab roof +0.2 cm;
  - wheel centres line up visually within about ±3–5 cm;
  - the tender coal heap and water filler exceed the measuring windows, explained in NOTES.
  - **Caveat:** most values come from that same photo. The independent checks are published height (0.15 %), the 8 ft coupled spacing (0.4 %) and the estimated axles landing on the photo's wheels.
- [x] **Kinematics:** 720 steps per revolution. Rod length drift 1.3e-15 m; worst scene-node gap 2.0e-15 m; sides at 90°.
- [x] **Avatar:**
  - headroom 2.05 m; doorway 0.89 m;
  - platform → step → footplate climbable (0.235 / 0.45 m rises); the scripted walk ends on the footplate;
  - lineside boarding is impossible, as in reality.
- [x] **Perf report:** 3 tiers × 2 viewports. Software rendering only, so relative; real numbers need `?perf=1` on your devices.
- [x] **Live:** 200 + `X-Robots-Tag`, 308, 403 for bots.
- [x] **Sound:** ambience plus an engine standing in steam. Peaks −16 to −25 dBFS, mute silent.
- [x] **Unit tests:** 15/15.
- **Changed from plan:**
  - single camera-following sun shadow instead of CSM (CSM breaks metal reflections in r186);
  - Playwright 1.49.1 image reused;
  - LODs generated parametrically (11.5k / 6.2k / 3.2k triangles) instead of mesh-simplified.

### Phase 2: Locomotive exterior

- **Bodywork:** boiler, smokebox, chimney, dome, top feed, safety valves, firebox, cab exterior, running plates, steps and handrails, pipework, lubricators, sandboxes.
- **Running gear:** wheels with correct spokes and balance weights, the bogie, the full Walschaerts gear with real kinematics in forward and back gear.
- **Tender, buffers and couplings, lamps, modern fittings.**
- **Livery and lettering** as verified.
- **PBR materials and procedural weathering**, with no visible repetition.

**Accept when:**

- the kinematics test passes at all cut-offs;
- the overlays are within tolerance;
- the side-by-side composites show no unexplained major difference;
- the budgets are met per tier;
- every info hotspot has a label.

### Phase 3: Cab interior

- **Footplate:** enterable, with steps and handrails at the right height.
- **Controls:** every control from REFERENCE §4 that the photos confirm, each named, operable and moving through its correct range.
- **Gauges** respond: pressure, vacuum and air needles, water-glass level.
- **Firehole doors** open, with fire glow.
- **Lighting:** believable mixed daylight and firelight.

**Accept when:**

- every control matches C01–C12 in position and form, or each difference is listed;
- the avatar fits and the head clears the roof;
- cab views compare side by side with the photos.

### Phase 4: Carriages

- **Exterior:** Mk2 exterior in the exact subtype(s) and livery confirmed in Q4. B4 bogies, gangways, buckeyes, buffers, doors with CDL lights, opening windows.
- **Interior:** enterable, with seats, tables, luggage racks, lights, vestibules and toilet doors.
- **Boarding** via the steps or platform (Q12).
- **LOD** and interior streaming.

**Accept when:**

- the coach overlays match D04 or photos;
- the avatar fits the doorways, aisle and seats;
- the interior compares side by side with T07–T11;
- budgets are met with the full rake.

### Phase 5: Environment

- **Viaduct:** 21 arches, 50 ft spans, 241 m curve and thicker centre piers, from REFERENCE §7 and photos.
- **Terrain:** per Q3 (OS Terrain 50 + shaped near-field now, LiDAR when it is released), with tiles and LOD.
- **Landscape:** Loch Shiel water, vegetation, monument and station as approved.
- **Lighting:** time-of-day and weather presets.
- **Train placement:** the train sits on the viaduct track.

**Accept when:**

- the V01/V07 views match the skyline and the viaduct geometry;
- the attribution is in the app;
- budgets are met.

### Phase 6: Motion and effects

- **Movement:** the train runs along the track at realistic speed with correct acceleration. Wheel rotation is tied to distance.
- **Exhaust:** steam and smoke (volume-like particles), with **4 exhaust beats per wheel revolution** tied to the crank angle.
- **Sound:** cylinder drain cocks, safety valve, whistle, rail joints and flange noise, wind, and spatial audio inside the cab and coach.

**Accept when:**

- the beats stay in phase with the wheels at any speed (automated check);
- the crossing time matches the chosen speed;
- audio levels stay without clipping.

### Phase 7: Polish

- **Performance and mobile:** a performance pass on real devices; full mobile controls.
- **Accessibility:** keyboard-only use, reduced motion, captions for sounds, contrast, text size.
- **Release:** loading polish, deploy, and a final review with a full contact sheet, side-by-side comparisons and an honest shortfall list.

## 10. The ceiling (stated now, re-assessed every phase)

- **Not a scan.** The model is built from published figures, photos and (hopefully) drawings. Without a GA drawing, dimensions are photo-measured and good to perhaps ±2–5 cm. Hidden details (between the frames, inside the boiler for the cutaway) are representative, not exact.
- **Valve gear** dimensions are not public online. Without D02 the motion is correct as a mechanism but only *plausible* in its exact proportions and valve events.
- **Terrain at Glenfinnan** currently has **no LiDAR**. Until it is published, the hills come from 50 m data and the gorge around the viaduct is shaped by hand from photos. That is the biggest realism gap, and it will be labelled in the app.
- **The coach set and 45407's fittings change over time.** The model is a snapshot of the date we fix in Q5.
- **Sound** is procedural or CC0, not recordings of 45407.
- **Performance** measured here is software-rendered. Real-device numbers depend on you (Q11).

## 11. Open questions

Decided or defaulted: see REFERENCE.md §11. **Nothing blocks Phase 1.** Still open, but not blocking: the exact 2026 coach set, and photos of 45407's own cab.

## 12. Change log

- 2026-10-04: Phase 0 written. Research snapshot in REFERENCE.md.
- 2026-10-05: Phase 1 built, verified and deployed (see Phase 1 Result). Domain-wide bot blocking added to Caddy. Sound plan added (§6a).
- 2026-10-05: Your answers applied: repo live; folders inside the project; terrain = OS Terrain 50 + shaped near-field; first coach = standard-class TSO; no basic auth; test devices = Galaxy S26 Ultra + Windows 11 laptop (Chrome). Reference photos collected from Wikimedia Commons; REFERENCE §2/§6/§9 updated from dated 2025 photos.
