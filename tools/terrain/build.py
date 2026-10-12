"""Build the Glenfinnan landscape data (Phase 5) from OS OpenData (OGL v3.0).

Inputs (git-ignored, downloaded by hand from the OS Data Hub, see tools/terrain/README.md):
  data/os/t50/nm{77..99}.asc     OS Terrain 50 ASCII grid (50 m posts)
  data/os/oml/NM_*.shp          OS OpenMap Local (vector)
Outputs (public/terrain/):
  far.bin, near.bin             heights, Uint16 LE, h = v / 50 - 20 (metres above OS datum), row 0 = north
  cover_far.png, cover_near.png land cover RGBA: R woodland, G water, B road / built, A 255
  trees.bin                     10 bytes per tree (see the tree section), nearest first
  world.json                    frame, grids, track centreline and rail levels, water, roads, buildings, landmarks
Scene frame: x = E - E0 (east), z = N0 - N (south), y = height above OS datum (metres).

Hand shaping (flagged in the app): the 50 m grid cannot show the railway formation, river channel,
loch bed, road benches or building plots, so these are cut into the 5 m near grid here.
Run: tools/terrain/run.sh   (Docker; numpy, pyshp, pillow)
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from geo import T50, layer

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'terrain')
os.makedirs(OUT, exist_ok=True)
E0, N0 = 191000.0, 781300.0
FAR = dict(n=513, step=25.0, e0=E0 - 6400, n1=N0 + 6400)        # west edge, north edge
NEAR = dict(n=513, step=5.0, e0=189200.0, n1=782160.0)
LOCH_LEVEL = 2.5            # OS Terrain 50 water surface of Loch Shiel at its head
GRADE_MAX = 1 / 40          # ruling grade cap for the fitted rail profile (the line has 1 in 48-50 banks); estimate

t50 = T50()
rng = np.random.default_rng(1897)

def grid(g):
    j = np.arange(g['n']); E = g['e0'] + j * g['step']; N = g['n1'] - j * g['step']
    return np.meshgrid(E, N)          # [row (north->south), col (west->east)]

def enc(h):
    return np.clip(np.round((h + 20) * 50), 0, 65535).astype('<u2')

def to_scene(E, N):
    return np.asarray(E) - E0, N0 - np.asarray(N)

# ------------------------------------------------------------------------------------------ track
def chain_track():
    segs = [[tuple(map(float, p)) for p in s.points] for s, r in layer('RailwayTrack')
            if any(186000 < x < 194500 and 778500 < y < 783000 for x, y in s.points)]
    west = min((p for s in segs for p in (s[0], s[-1])), key=lambda p: p[0])
    used, chain, cur = set(), [west], np.array(west)
    while True:
        best = None
        for i, s in enumerate(segs):
            if i in used: continue
            for e, p in ((0, s[0]), (1, s[-1])):
                d = math.hypot(p[0] - cur[0], p[1] - cur[1])
                if d < 35 and (best is None or d < best[0]): best = (d, i, e)
        if not best: break
        d, i, e = best; used.add(i); pts = segs[i] if e == 0 else segs[i][::-1]
        chain += pts if d > 0.5 else pts[1:]; cur = np.array(pts[-1])
    return np.array(chain)

def resample(c, step):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(c, axis=0).T))]
    s = np.arange(0, d[-1], step)
    return np.c_[np.interp(s, d, c[:, 0]), np.interp(s, d, c[:, 1])], s

def smooth_line(p, win):
    k = np.ones(win) / win
    pad = np.r_[np.repeat(p[:1], win, 0), p, np.repeat(p[-1:], win, 0)]
    return np.c_[np.convolve(pad[:, 0], k, 'same'), np.convolve(pad[:, 1], k, 'same')][win:-win]

raw = chain_track()
pts, _ = resample(raw, 2.0)
for _ in range(3): pts = smooth_line(pts, 9)      # remove the polyline's kinks (±9 m), keep the curves
pts, s = resample(pts, 2.0)
# viaduct ends: OS track vertices at the abutments (190841.3, 781308.0) and (191174.4, 781239.0)
def nearest_s(e, n): return float(s[np.argmin(np.hypot(pts[:, 0] - e, pts[:, 1] - n))])
sW, sE = nearest_s(190841.3, 781308.0), nearest_s(191174.4, 781239.0)
sMid = (sW + sE) / 2
# rail level: the 50 m ground along the line, robustly smoothed (median ±60 m, then a 100 m Gaussian),
# bridged straight across the gorge, then held to a 1 in 40 ruling grade; an estimate (no survey data)
g = t50.sample(pts[:, 0], pts[:, 1])
gap = (s > sW - 40) & (s < sE + 40)
med = np.array([np.median(g[(np.abs(s - si) < 60) & ~gap]) if np.any((np.abs(s - si) < 60) & ~gap) else np.nan for si in s])
ok = ~np.isnan(med); med = np.interp(s, s[ok], med[ok])
med[gap] = np.interp(s[gap], [sW - 40, sE + 40], [np.interp(sW - 40, s, med), np.interp(sE + 40, s, med)])
sig = 50; kk = np.exp(-0.5 * (np.arange(-3 * sig, 3 * sig + 1) / sig) ** 2); kk /= kk.sum()
rail = np.convolve(np.pad(med, 3 * sig, mode='edge'), kk, 'valid')
for _ in range(4):
    for k in range(1, len(rail)): rail[k] = np.clip(rail[k], rail[k - 1] - 2 * GRADE_MAX, rail[k - 1] + 2 * GRADE_MAX)
    for k in range(len(rail) - 2, -1, -1): rail[k] = np.clip(rail[k], rail[k + 1] - 2 * GRADE_MAX, rail[k + 1] + 2 * GRADE_MAX)
print(f'track {s[-1]:.0f} m, viaduct s {sW:.0f}..{sE:.0f} ({sE - sW:.0f} m), rail W {np.interp(sW, s, rail):.1f} E {np.interp(sE, s, rail):.1f}, mid {np.interp(sMid, s, rail):.1f}')
station = nearest_s(189878.6, 780980.4)
print(f'station s {station:.0f}, rail {np.interp(station, s, rail):.1f}, ground {float(t50.sample(189878.6, 780980.4)):.1f}')

# ------------------------------------------------------------------------------------------ heights
Ef, Nf = grid(FAR); far = t50.sample(Ef, Nf)
En, Nn = grid(NEAR); near = t50.sample(En, Nn)
ground_near = near.copy()

def raster_mask(polys, g, W=None):
    """Rasterise BNG polygons (list of point lists, holes as separate rings with even-odd) into grid g."""
    n = g['n'] if W is None else W; scale = (g['n'] - 1) * g['step'] / (n - 1) if W else g['step']
    img = Image.new('L', (n, n), 0); d = ImageDraw.Draw(img)
    for ring in polys:
        xy = [((x - g['e0']) / scale, (g['n1'] - y) / scale) for x, y in ring]
        if len(xy) >= 3: d.polygon(xy, fill=255)
    return np.asarray(img, np.float32) / 255

def shape_rings(shp):
    pts, parts = shp.points, list(shp.parts) + [len(shp.points)]
    return [pts[parts[i]:parts[i + 1]] for i in range(len(parts) - 1)]

def box_of(g):
    size = (g['n'] - 1) * g['step']
    return (g['e0'], g['n1'] - size, g['e0'] + size, g['n1'])

def overlaps(bb, box):
    return not (bb[2] < box[0] or bb[0] > box[2] or bb[3] < box[1] or bb[1] > box[3])

# water: Loch Shiel and the River Finnan (OpenMap Local surface water areas)
water_shapes = [sh for sh, r in layer('SurfaceWater_Area') if overlaps(sh.bbox, box_of(FAR))]
loch = max(water_shapes, key=lambda sh: len(sh.points))
def even_odd(shapes, g, W=None):
    m = np.zeros(((g['n'] if W is None else W),) * 2, np.float32)
    for sh in shapes:
        for ring in shape_rings(sh):
            m = np.abs(m - raster_mask([ring], g, W))      # even-odd: islands are holes
    return m
loch_far = even_odd([loch], FAR); loch_near = even_odd([loch], NEAR)
rivers = [sh for sh in water_shapes if sh is not loch]
river_near = even_odd([sh for sh in rivers if overlaps(sh.bbox, box_of(NEAR))], NEAR)

def dist_inside(mask, step):
    """Approximate distance (m) from the edge for cells inside mask (chamfer passes)."""
    inside = mask > 0.5; d = np.where(inside, 1e6, 0.0)
    for _ in range(2):
        for i in range(1, d.shape[0]): d[i] = np.minimum(d[i], d[i - 1] + step)
        for i in range(d.shape[0] - 2, -1, -1): d[i] = np.minimum(d[i], d[i + 1] + step)
        for j in range(1, d.shape[1]): d[:, j] = np.minimum(d[:, j], d[:, j - 1] + step)
        for j in range(d.shape[1] - 2, -1, -1): d[:, j] = np.minimum(d[:, j], d[:, j + 1] + step)
    return np.where(inside, d, 0)

for h, m, g in ((far, loch_far, FAR), (near, loch_near, NEAR)):
    dd = dist_inside(m, g['step'])
    h[:] = np.where(m > 0.5, LOCH_LEVEL - np.minimum(12, 0.6 + dd * 0.12), h)   # shelving loch bed

# river surface: the 50 m ground smoothed and lowered, never below the loch; channel 0.8 m deep
def blur(a, r):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    a = np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), 0, a)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), 1, a)
river_level = np.maximum(LOCH_LEVEL + 0.05, blur(np.where(river_near > 0.5, ground_near, np.nan_to_num(ground_near)), 6) - 1.2)
# keep the river surface monotonic towards the loch: the minimum of a wide window
river_level = np.minimum(river_level, blur(river_level, 12) + 0.3)
near = np.where(river_near > 0.5, np.minimum(near, river_level - 0.8), near)
# banks: lower a 6 m fringe so the water meets the ground
bank = (blur(river_near, 2) > 0.02) & (river_near < 0.5)
near = np.where(bank, np.minimum(near, river_level + 0.4 + 0.25 * blur(river_near, 2)), near)

# railway formation: cut and fill the near grid along the line (not under the viaduct span)
def dist_to_line(E, N, P, S, rail_s):
    """Distance from every grid cell to the polyline P, with the rail level at the nearest point."""
    best = np.full(E.shape, 1e9); lvl = np.zeros(E.shape); sat = np.zeros(E.shape)
    for k in range(len(P) - 1):
        a, b = P[k], P[k + 1]
        lo = (min(a[0], b[0]) - 40, min(a[1], b[1]) - 40, max(a[0], b[0]) + 40, max(a[1], b[1]) + 40)
        if lo[2] < E[0, 0] or lo[0] > E[0, -1] or lo[3] < N[-1, 0] or lo[1] > N[0, 0]: continue
        j0 = max(0, int((lo[0] - E[0, 0]) / NEAR['step'])); j1 = min(E.shape[1], int((lo[2] - E[0, 0]) / NEAR['step']) + 2)
        i0 = max(0, int((N[0, 0] - lo[3]) / NEAR['step'])); i1 = min(E.shape[0], int((N[0, 0] - lo[1]) / NEAR['step']) + 2)
        e = E[i0:i1, j0:j1]; n = N[i0:i1, j0:j1]
        ab = b - a; L2 = ab @ ab
        t = np.clip(((e - a[0]) * ab[0] + (n - a[1]) * ab[1]) / L2, 0, 1)
        d = np.hypot(e - (a[0] + t * ab[0]), n - (a[1] + t * ab[1]))
        sub = best[i0:i1, j0:j1]; better = d < sub
        sub[better] = d[better]
        lvl[i0:i1, j0:j1][better] = (rail_s[k] + t * (rail_s[k + 1] - rail_s[k]))[better]
        sat[i0:i1, j0:j1][better] = (S[k] + t * (S[k + 1] - S[k]))[better]
    return best, lvl, sat

dline, rlvl, sline = dist_to_line(En, Nn, pts, s, rail)
form = rlvl - 0.75                       # formation (top of ballast shoulder) below rail top
onv = (sline > sW + 2) & (sline < sE - 2)
cut = np.clip(near - form, -np.maximum(0, (dline - 3.4) / 1.5), np.maximum(0, (dline - 3.4) / 1.5))   # 1:1.5 side slopes
near = np.where((dline < 45) & ~onv, form + cut, near)

# roads and their benches (OpenMap Local Road: A830, minor roads, private roads)
ROAD_W = {'Primary Road': 7.0, 'A Road': 6.5, 'B Road': 5.5, 'Minor Road': 4.5, 'Local Road': 4.2, 'Local Access Road': 3.5, 'Restricted Local Access Road': 3.2}
roads = []
for sh, r in layer('Road'):
    if not overlaps(sh.bbox, box_of(FAR)): continue
    w = ROAD_W.get(str(r[3]))
    if w is None: continue
    p, _ = resample(np.array(sh.points, float), 4.0) if len(sh.points) > 1 else (np.array(sh.points, float), None)
    if len(p) < 2: continue
    roads.append({'w': w, 'num': str(r[2]), 'pts': p})
road_mask_near = np.zeros_like(near)
for rd in roads:
    p = rd['pts']
    if not any(NEAR['e0'] - 50 < x < NEAR['e0'] + 2610 and NEAR['n1'] - 2610 < y < NEAR['n1'] + 50 for x, y in p): continue
    hp = blur(t50.sample(p[:, 0], p[:, 1])[None, :], 0)[0]
    hp = np.convolve(np.pad(hp, 6, mode='edge'), np.ones(13) / 13, 'valid')          # smooth vertical alignment
    d, lv, _ = dist_to_line(En, Nn, p, np.arange(len(p), dtype=float), hp)
    half = rd['w'] / 2 + 0.6
    near = np.where(d < half, lv - 0.05, np.where(d < half + 8, lv + np.clip(near - lv, -(d - half) / 1.5, (d - half) / 1.5), near))
    road_mask_near = np.maximum(road_mask_near, np.clip((half + 0.4 - d) / 0.8, 0, 1))
    rd['h'] = hp

# buildings (footprints) near the station, the visitor centre, the church and the houses; plots levelled
buildings = []
for sh, r in layer('Building'):
    if not overlaps(sh.bbox, box_of(NEAR)): continue
    ring = np.array(shape_rings(sh)[0], float)
    c = ring.mean(axis=0); base = float(t50.sample(c[0], c[1]))
    i = int((NEAR['n1'] - c[1]) / NEAR['step']); j = int((c[0] - NEAR['e0']) / NEAR['step'])
    if 0 <= i < NEAR['n'] and 0 <= j < NEAR['n']: base = float(near[i, j])
    area = 0.5 * abs(np.dot(ring[:-1, 0], ring[1:, 1]) - np.dot(ring[1:, 0], ring[:-1, 1]))
    buildings.append({'ring': ring, 'base': base, 'area': area})
for b in buildings:
    m = raster_mask([b['ring'].tolist()], NEAR) > 0
    mm = blur(m.astype(np.float32), 2) > 0.01
    near = np.where(mm, b['base'], near)

# blend the near grid into the far grid at its edge (60 m) so the two meshes meet
edge = np.minimum.reduce([np.arange(NEAR['n'])[None, :].repeat(NEAR['n'], 0), np.arange(NEAR['n'])[::-1][None, :].repeat(NEAR['n'], 0),
                          np.arange(NEAR['n'])[:, None].repeat(NEAR['n'], 1), np.arange(NEAR['n'])[::-1][:, None].repeat(NEAR['n'], 1)]) * NEAR['step']
wgt = np.clip(edge / 60, 0, 1)
near = wgt * near + (1 - wgt) * t50.sample(En, Nn) * (loch_near < 0.5) + (1 - wgt) * np.where(loch_near > 0.5, near, 0)

enc(far).tofile(os.path.join(OUT, 'far.bin')); enc(near).tofile(os.path.join(OUT, 'near.bin'))

# ------------------------------------------------------------------------------------------ land cover
woods = [sh for sh, r in layer('Woodland') if overlaps(sh.bbox, box_of(FAR))]
def cover(g, W, road_m=None, river_m=None):
    wood = even_odd(woods, g, W); water = np.maximum(even_odd([loch], g, W), even_odd(rivers, g, W))
    built = np.zeros_like(wood)
    if road_m is not None:
        img = Image.fromarray((road_m * 255).astype(np.uint8)).resize((W, W), Image.BILINEAR)
        built = np.asarray(img, np.float32) / 255
    a = np.stack([wood, water, built, np.ones_like(wood)], -1)
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'RGBA'), wood
img_far, wood_far = cover(FAR, 1024)
img_near, wood_near = cover(NEAR, 1280, road_mask_near)
img_far.save(os.path.join(OUT, 'cover_far.png'), optimize=True)
img_near.save(os.path.join(OUT, 'cover_near.png'), optimize=True)

# ------------------------------------------------------------------------------------------ trees
def sample_h(E, N):
    """Height from the shaped near grid where available, else the far grid."""
    out = t50.sample(E, N)
    j = (E - NEAR['e0']) / NEAR['step']; i = (NEAR['n1'] - N) / NEAR['step']
    ok = (i >= 0) & (j >= 0) & (i < NEAR['n'] - 1) & (j < NEAR['n'] - 1)
    ii = np.clip(i.astype(int), 0, NEAR['n'] - 2); jj = np.clip(j.astype(int), 0, NEAR['n'] - 2); fi = i - ii; fj = j - jj
    v = near[ii, jj] * (1 - fi) * (1 - fj) + near[ii, jj + 1] * (1 - fi) * fj + near[ii + 1, jj] * fi * (1 - fj) + near[ii + 1, jj + 1] * fi * fj
    return np.where(ok, v, out)

def mask_at(m, g, W, E, N):
    size = (g['n'] - 1) * g['step']; j = ((E - g['e0']) / size * (W - 1)).astype(int); i = ((g['n1'] - N) / size * (W - 1)).astype(int)
    ok = (i >= 0) & (j >= 0) & (i < W) & (j < W)
    return np.where(ok, m[np.clip(i, 0, W - 1), np.clip(j, 0, W - 1)], 0)

trees = []
def scatter(box, spacing, keep):
    e = np.arange(box[0], box[2], spacing); n = np.arange(box[1], box[3], spacing)
    E, N = np.meshgrid(e, n); E = E.ravel() + rng.uniform(-0.45, 0.45, E.size) * spacing; N = N.ravel() + rng.uniform(-0.45, 0.45, N.size) * spacing
    k = keep(E, N); return E[k], N[k]
water_near_img = np.asarray(img_near, np.float32)[..., 1] / 255; water_far_img = np.asarray(img_far, np.float32)[..., 1] / 255
built_near_img = np.asarray(img_near, np.float32)[..., 2] / 255
nb = box_of(NEAR)
def dist_to_line_pts(E, N):
    best = np.full(E.shape, 1e9); sl = np.zeros(E.shape)
    for k in range(0, len(pts) - 1):
        a, b = pts[k], pts[k + 1]; ab = b - a
        t = np.clip(((E - a[0]) * ab[0] + (N - a[1]) * ab[1]) / (ab @ ab), 0, 1)
        d = np.hypot(E - (a[0] + t * ab[0]), N - (a[1] + t * ab[1])); m = d < best
        best[m] = d[m]; sl[m] = s[k]
    return best, None, sl
# near: woodland at ~5.5 m, plus scattered trees and scrub in the glen bottom and along the river
E1, N1 = scatter(nb, 6.5, lambda E, N: (mask_at(np.asarray(img_near)[..., 0] / 255, NEAR, 1280, E, N) > 0.5) & (mask_at(water_near_img, NEAR, 1280, E, N) < 0.5) & (mask_at(built_near_img, NEAR, 1280, E, N) < 0.2))
E2, N2 = scatter(nb, 16.0, lambda E, N: (rng.uniform(0, 1, E.size) < np.clip((90 - sample_h(E, N)) / 90, 0, 1) * 0.35) & (mask_at(water_near_img, NEAR, 1280, E, N) < 0.5) & (mask_at(built_near_img, NEAR, 1280, E, N) < 0.2))
E = np.r_[E1, E2]; N = np.r_[N1, N2]
# keep the railway, the roads and the viaduct's footprint clear
d, _, sl = dist_to_line_pts(E, N)
keep = (d > 7) | ((sl > sW) & (sl < sE) & (d > 5) & (sample_h(E, N) < np.interp(sl, s, rail) - 14))
E, N = E[keep], N[keep]
kind_near = (rng.uniform(0, 1, E.size) < 0.22).astype(float)          # 0 broadleaf (birch, oak, alder), 1 conifer
far_box = box_of(FAR)
E3, N3 = scatter(far_box, 19.0, lambda E, N: (mask_at(np.asarray(img_far)[..., 0] / 255, FAR, 1024, E, N) > 0.5) & (mask_at(water_far_img, FAR, 1024, E, N) < 0.5)
                 & ~((E > nb[0]) & (E < nb[2]) & (N > nb[1]) & (N < nb[3])))
kind_far = (rng.uniform(0, 1, E3.size) < 0.35).astype(float)
AE = np.r_[E, E3]; AN = np.r_[N, N3]; kind = np.r_[kind_near, kind_far]
Y = sample_h(AE, AN)
scale = np.where(kind > 0.5, rng.uniform(9, 17, AE.size), rng.uniform(6, 13, AE.size))
scale *= np.clip(1.15 - (Y - 40) / 600, 0.55, 1.15)                    # smaller higher up
X, Z = to_scene(AE, AN)
rot = rng.uniform(0, 2 * math.pi, AE.size)
near_flag = np.r_[np.ones(E.size), np.zeros(E3.size)]
order = np.argsort(np.hypot(X, Z))                                     # nearest first (lower tiers take a prefix)
# 10 bytes per tree: x, z (0.2 m), y (0.02 m) as Uint16; scale (0.1 m), kind + 2*near, rotation (1/40 rad) as Uint8
rec = np.zeros(AE.size, dtype=[('x', '<u2'), ('z', '<u2'), ('y', '<u2'), ('s', 'u1'), ('k', 'u1'), ('r', 'u1'), ('pad', 'u1')])
rec['x'] = np.round((X + 6400) * 5); rec['z'] = np.round((Z + 6400) * 5); rec['y'] = np.round((Y + 20) * 50)
rec['s'] = np.clip(np.round(scale * 10), 0, 255); rec['k'] = (kind + 2 * near_flag).astype(np.uint8); rec['r'] = np.round(rot * 40) % 252
rec[order].tofile(os.path.join(OUT, 'trees.bin'))
print(f'trees: near {E.size}, far {E3.size}')

# ------------------------------------------------------------------------------------------ vectors
def dp(points, tol):
    """Douglas-Peucker simplification (closed rings are split at their farthest point first)."""
    pts_ = np.asarray(points, float)
    if len(pts_) < 3: return pts_
    if np.allclose(pts_[0], pts_[-1]) and len(pts_) > 4:
        k = int(np.argmax(np.hypot(*(pts_ - pts_[0]).T)))
        a, b = dp(pts_[:k + 1], tol), dp(pts_[k:], tol)
        return np.r_[a, b[1:]]
    keep = np.zeros(len(pts_), bool); keep[0] = keep[-1] = True; stack = [(0, len(pts_) - 1)]
    while stack:
        a, b = stack.pop(); seg = pts_[b] - pts_[a]; L = np.hypot(*seg) or 1e-9
        rel = pts_[a + 1:b] - pts_[a]; d = np.abs(seg[0] * rel[:, 1] - seg[1] * rel[:, 0]) / L if b > a + 1 else np.array([])
        if len(d) and d.max() > tol:
            k = a + 1 + int(np.argmax(d)); keep[k] = True; stack += [(a, k), (k, b)]
    return pts_[keep]

def clip_box(ring, box, margin=200):
    return [p for p in ring if box[0] - margin <= p[0] <= box[2] + margin and box[1] - margin <= p[1] <= box[3] + margin]

def scene_ring(ring):
    x, z = to_scene(ring[:, 0], ring[:, 1]); return np.round(np.c_[x, z], 2).tolist()

water_out = []
for sh in [loch] + rivers:
    for k, ring in enumerate(shape_rings(sh)):
        r = np.array(ring, float)
        if sh is loch:
            r = dp(r, 6.0)
            if not overlaps((r[:, 0].min(), r[:, 1].min(), r[:, 0].max(), r[:, 1].max()), far_box): continue
        else:
            if not overlaps(sh.bbox, nb): continue
            r = dp(r, 0.8)
        lvl = [LOCH_LEVEL] * len(r)
        if sh is not loch:
            j = np.clip(((r[:, 0] - NEAR['e0']) / NEAR['step']).astype(int), 0, NEAR['n'] - 1); i = np.clip(((NEAR['n1'] - r[:, 1]) / NEAR['step']).astype(int), 0, NEAR['n'] - 1)
            lvl = np.round(river_level[i, j], 2).tolist()
        water_out.append({'kind': 'loch' if sh is loch else 'river', 'hole': k > 0, 'ring': scene_ring(r), 'y': lvl})

roads_out = []
for rd in roads:
    p = rd['pts']; x, z = to_scene(p[:, 0], p[:, 1])
    if 'h' not in rd: continue
    roads_out.append({'w': rd['w'], 'pts': np.round(np.c_[x, rd['h'], z], 2).tolist()})

bld_out = []
for b in buildings:
    r = dp(b['ring'], 0.3)
    big = b['area'] > 250
    bld_out.append({'ring': scene_ring(r), 'base': round(b['base'], 2), 'eaves': 6.0 if big else 4.8, 'ridge': 9.5 if big else 7.2})

tx, tz = to_scene(pts[:, 0], pts[:, 1])
named = {}
for sh, r in layer('ImportantBuilding'):
    if overlaps(sh.bbox, nb): named[str(r[1])] = [round(v, 1) for v in to_scene((sh.bbox[0] + sh.bbox[2]) / 2, (sh.bbox[1] + sh.bbox[3]) / 2)]
mon = to_scene(190624, 780572)
world = {
    'source': 'Contains OS data © Crown copyright and database right 2026 (OS Terrain 50, OS OpenMap - Local; Open Government Licence v3.0)',
    'frame': {'E0': E0, 'N0': N0, 'note': 'x = E - E0, z = N0 - N, y = metres above OS datum'},
    'far': {'n': FAR['n'], 'step': FAR['step'], 'x0': FAR['e0'] - E0, 'z0': N0 - FAR['n1']},
    'near': {'n': NEAR['n'], 'step': NEAR['step'], 'x0': NEAR['e0'] - E0, 'z0': N0 - NEAR['n1']},
    'lochLevel': LOCH_LEVEL,
    'track': {'step': 2.0, 'x': np.round(tx, 2).tolist(), 'z': np.round(tz, 2).tolist(), 'rail': np.round(rail, 3).tolist(),
              'viaduct': [round(sW, 1), round(sE, 1)], 'station': round(station, 1)},
    'water': water_out, 'roads': roads_out, 'buildings': bld_out,
    'landmarks': {'monument': [round(mon[0], 1), round(float(sample_h(np.array([190624.0]), np.array([780572.0]))[0]), 2), round(mon[1], 1)],
                  'named': named},
    'estimates': ['rail level (smoothed 50 m ground, grade-capped)', 'river channel depth and banks', 'loch bed slope',
                  'road vertical alignment', 'building heights', 'tree positions, sizes and species mix'],
}
with open(os.path.join(OUT, 'world.json'), 'w') as f: json.dump(world, f, separators=(',', ':'))

# preview for checking by eye: hillshade of the near grid with water, woods, roads and the track
gy, gx = np.gradient(near, NEAR['step']); shade = np.clip(0.55 + (-gx * 0.6 + gy * 0.6) / np.sqrt(1 + gx * gx + gy * gy), 0, 1)
rgb = np.stack([shade * 200, shade * 205, shade * 190], -1)
cn = np.asarray(img_near.resize((NEAR['n'], NEAR['n'])), np.float32) / 255
rgb = rgb * (1 - 0.45 * cn[..., :1] * np.array([1, 0.4, 1])) ; rgb = np.where(cn[..., 1:2] > 0.5, [60, 90, 140], rgb); rgb = np.where(cn[..., 2:3] > 0.5, [230, 230, 230], rgb)
im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
d.line([((x - NEAR['e0']) / NEAR['step'], (NEAR['n1'] - y) / NEAR['step']) for x, y in pts], fill=(200, 30, 30), width=2)
im.save(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'os', 'preview_near.png'))
print('done', OUT)
