// Right-triangulated irregular network (RTIN) mesh from a (2^k + 1)^2 height grid, after
// Mapbox's "martini" (ISC licence, V. Agafonkin): fewer triangles where the ground is smooth,
// with a guaranteed maximum vertical error.

export class Martini {
  readonly size: number;
  private coords: Uint16Array;
  constructor(gridSize = 513) {
    this.size = gridSize;
    const tileSize = gridSize - 1;
    if (tileSize & (tileSize - 1)) throw new Error(`grid size must be 2^n+1, got ${gridSize}`);
    const numTriangles = tileSize * tileSize * 2 - 2, numParentTriangles = numTriangles - tileSize * tileSize;
    this.coords = new Uint16Array(numTriangles * 4);
    for (let i = 0; i < numTriangles; i++) {
      let id = i + 2, ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0;
      if (id & 1) { bx = by = cx = tileSize; } else { ax = ay = cy = tileSize; }
      while ((id >>= 1) > 1) {
        const mx = (ax + bx) >> 1, my = (ay + by) >> 1;
        if (id & 1) { bx = ax; by = ay; ax = cx; ay = cy; } else { ax = bx; ay = by; bx = cx; by = cy; }
        cx = mx; cy = my;
      }
      const k = i * 4; this.coords[k] = ax; this.coords[k + 1] = ay; this.coords[k + 2] = bx; this.coords[k + 3] = by;
    }
    void numParentTriangles;
  }

  /** Error map for one height grid (row-major, size x size). */
  errors(h: Float32Array) {
    const size = this.size, tileSize = size - 1, errors = new Float32Array(h.length);
    const numSmallest = tileSize * tileSize, numTriangles = numSmallest * 2 - 2, lastLevel = numTriangles - numSmallest;
    for (let i = numTriangles - 1; i >= 0; i--) {
      const k = i * 4, ax = this.coords[k], ay = this.coords[k + 1], bx = this.coords[k + 2], by = this.coords[k + 3];
      const mx = (ax + bx) >> 1, my = (ay + by) >> 1, cx = mx + my - ay, cy = my + ax - mx;
      const interp = (h[ay * size + ax] + h[by * size + bx]) / 2, mid = my * size + mx, err = Math.abs(interp - h[mid]);
      errors[mid] = Math.max(errors[mid], err);
      if (i < lastLevel) {
        const lc = ((ay + cy) >> 1) * size + ((ax + cx) >> 1), rc = ((by + cy) >> 1) * size + ((bx + cx) >> 1);
        errors[mid] = Math.max(errors[mid], errors[lc], errors[rc]);
      }
    }
    return errors;
  }

  /** Vertices (grid x, y index pairs) and triangle indices for a maximum error. `keep(x, y)` forces full detail. */
  mesh(errors: Float32Array, maxError: number, keep?: (x: number, y: number) => boolean) {
    const size = this.size, max = size - 1, indices = new Uint32Array(size * size);
    let numVertices = 0, numTriangles = 0;
    const need = (ax: number, ay: number, bx: number, by: number, mx: number, my: number) => {
      const len = Math.abs(ax - bx) + Math.abs(ay - by);
      return len > 2 && (errors[my * size + mx] > maxError || (!!keep && keep(mx, my)));   // len 2 = the smallest triangles
    };
    const count = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
      const mx = (ax + bx) >> 1, my = (ay + by) >> 1;
      if (need(ax, ay, bx, by, mx, my)) { count(cx, cy, ax, ay, mx, my); count(bx, by, cx, cy, mx, my); }
      else {
        for (const [x, y] of [[ax, ay], [bx, by], [cx, cy]]) { const i = y * size + x; if (!indices[i]) indices[i] = ++numVertices; }
        numTriangles++;
      }
    };
    count(0, 0, max, max, max, 0); count(max, max, 0, 0, 0, max);
    const vertices = new Uint16Array(numVertices * 2), triangles = new Uint32Array(numTriangles * 3);
    let t = 0;
    const emit = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
      const mx = (ax + bx) >> 1, my = (ay + by) >> 1;
      if (need(ax, ay, bx, by, mx, my)) { emit(cx, cy, ax, ay, mx, my); emit(bx, by, cx, cy, mx, my); }
      else {
        const a = indices[ay * size + ax] - 1, b = indices[by * size + bx] - 1, c = indices[cy * size + cx] - 1;
        vertices[2 * a] = ax; vertices[2 * a + 1] = ay; vertices[2 * b] = bx; vertices[2 * b + 1] = by; vertices[2 * c] = cx; vertices[2 * c + 1] = cy;
        triangles[t++] = a; triangles[t++] = b; triangles[t++] = c;
      }
    };
    emit(0, 0, max, max, max, 0); emit(max, max, 0, 0, 0, max);
    return { vertices, triangles };
  }
}
