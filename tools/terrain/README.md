# Landscape data (Phase 5)

`build.py` turns OS OpenData into `public/terrain/`. The raw downloads stay in `data/os/` (git-ignored):

| Download | URL (OS Data Hub downloads API, no key needed) | Unpack to |
|---|---|---|
| OS Terrain 50, ASCII grid, GB (162 MB) | https://api.os.uk/downloads/v1/products/Terrain50/downloads?area=GB&format=ASCII+Grid+and+GML+%28Grid%29&redirect | `data/os/t50/nm{77..99}.asc` (the nine 10 km tiles around Glenfinnan, from the nested zips) |
| OS OpenMap - Local, shapefile, square NM (25 MB) | https://api.os.uk/downloads/v1/products/OpenMapLocal/downloads?area=NM&format=ESRI%C2%AE+Shapefile&redirect | `data/os/oml/NM_*.{shp,shx,dbf,prj}` |

Both are Open Government Licence v3.0: "Contains OS data © Crown copyright and database right 2026".

Then `tools/terrain/run.sh` (Docker, Python 3.12 with numpy, pyshp and pillow). It writes:
- `far.bin` and `near.bin`, the height grids;
- `cover_*.png`, the land cover;
- `trees.bin`, the tree instances;
- `world.json`: the track, rail levels, water, roads, buildings and landmarks.

It also writes a check image to `data/os/preview_near.png`.

The constants at the top of `build.py` are estimates and are flagged in REFERENCE §7/§8:
- the loch level;
- the rail-profile smoothing and grade cap;
- the grid extents.
