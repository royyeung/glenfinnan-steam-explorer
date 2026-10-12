"""Shared loaders for the terrain build: OS Terrain 50 mosaic (bicubic sampling) and OS OpenMap Local layers.
Both are Open Government Licence v3.0: "Contains OS data © Crown copyright and database right 2026"."""
import os, numpy as np, shapefile

DATA = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'os')

class T50:
    """Mosaic of 10 km ASCII tiles; value at post (E, N); bicubic between posts."""
    def __init__(self, tiles=((7, 7), (9, 9))):
        (x0, y0), (x1, y1) = tiles
        self.E0, self.N0, self.step = 100000 + x0 * 10000, 700000 + y0 * 10000, 50.0
        nx, ny = (x1 - x0 + 1) * 200, (y1 - y0 + 1) * 200
        self.h = np.zeros((ny, nx), np.float64)        # row 0 = southern edge
        for tx in range(x0, x1 + 1):
            for ty in range(y0, y1 + 1):
                p = os.path.join(DATA, 't50', f'nm{tx}{ty}.asc')
                with open(p) as f:
                    hdr = {}
                    for _ in range(5):
                        k, v = f.readline().split(); hdr[k.lower()] = float(v)
                    a = np.loadtxt(f)
                a = a[::-1]                                  # file row 0 is the northern edge
                ox, oy = int((hdr['xllcorner'] - self.E0) / 50), int((hdr['yllcorner'] - self.N0) / 50)
                self.h[oy:oy + 200, ox:ox + 200] = a

    def sample(self, E, N):
        """Catmull-Rom bicubic sample at arrays of E, N."""
        E = np.asarray(E, np.float64); N = np.asarray(N, np.float64)
        fx = (E - self.E0) / self.step; fy = (N - self.N0) / self.step
        ix = np.floor(fx).astype(int); iy = np.floor(fy).astype(int); tx = fx - ix; ty = fy - iy
        def w(t):
            return [((-t + 2) * t - 1) * t / 2, (((3 * t - 5) * t) * t + 2) / 2, ((-3 * t + 4) * t + 1) * t / 2, ((t - 1) * t * t) / 2]
        wx, wy = w(tx), w(ty)
        out = np.zeros_like(fx)
        H, W = self.h.shape
        for j in range(4):
            yy = np.clip(iy - 1 + j, 0, H - 1)
            row = np.zeros_like(fx)
            for i in range(4):
                xx = np.clip(ix - 1 + i, 0, W - 1)
                row += wx[i] * self.h[yy, xx]
            out += wy[j] * row
        return out

def layer(name):
    r = shapefile.Reader(os.path.join(DATA, 'oml', f'NM_{name}'), encoding='latin-1')
    return list(zip(r.shapes(), r.records()))

def in_box(pts, box):
    return any(box[0] <= x <= box[2] and box[1] <= y <= box[3] for x, y in pts)
