// Steam and smoke: soft, lit billboard puffs in one instanced draw call. Each exhaust beat throws a
// puff up from the chimney; the puffs keep the speed they were born with only briefly (air drag), so
// on a moving train they stream back into a trailing plume and drift with the wind. Also: the
// blower's light haze at the chimney when standing, the safety valves' white plume, drain-cock
// steam at the cylinders and the whistle's jet. Looks "volume-like" only: each puff is a shaded
// sphere impostor with a noise texture, not a simulated volume.
import * as THREE from 'three';

export interface EmitOpts {
  pos: THREE.Vector3; vel: THREE.Vector3; size: number; grow: number; life: number;
  /** 0 white steam … 1 grey smoke */ smoke: number; alpha: number; rise?: number;
}

function puffTexture() {
  const n = 64, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d')!, img = g.createImageData(n, n);
  // value noise, three octaves, under a soft round falloff
  const rnd = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t: number) => t * t * (3 - 2 * t);
    const a = rnd(xi, yi), b = rnd(xi + 1, yi), cc = rnd(xi, yi + 1), d = rnd(xi + 1, yi + 1);
    return a + (b - a) * s(xf) + (cc - a) * s(yf) + (a - b - cc + d) * s(xf) * s(yf);
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1, r = Math.hypot(u, v);
    const f = noise(x / 8, y / 8) * 0.55 + noise(x / 4, y / 4) * 0.3 + noise(x / 2, y / 2) * 0.15;
    const a = Math.max(0, 1 - r) ** 1.4 * (0.55 + 0.9 * f);
    const o = (y * n + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.min(255, a * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

const VERT = /* glsl */`
attribute vec4 iPos;    // xyz, size
attribute vec4 iLook;   // alpha, smoke, spin, seed
uniform vec3 uSunDir;
varying vec2 vUv; varying float vAlpha; varying float vSmoke; varying vec3 vR; varying vec3 vU; varying vec3 vF;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vAlpha = iLook.x; vSmoke = iLook.y;
  vec4 mvPosition = viewMatrix * vec4(iPos.xyz, 1.0);
  float c = cos(iLook.z), s = sin(iLook.z);
  vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iPos.w;
  mvPosition.xy += q;
  // camera axes in world space, to shade the impostor sphere by the sun
  vR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vF = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform sampler2D uTex; uniform vec3 uSunDir; uniform vec3 uSun; uniform vec3 uSky;
varying vec2 vUv; varying float vAlpha; varying float vSmoke; varying vec3 vR; varying vec3 vU; varying vec3 vF;
#include <fog_pars_fragment>
void main() {
  float a = texture2D(uTex, vUv).a * vAlpha;
  if (a < 0.004) discard;
  vec2 p = vUv * 2.0 - 1.0;
  vec3 n = normalize(vR * p.x + vU * p.y + vF * sqrt(max(0.05, 1.0 - dot(p, p))));
  // wrapped diffuse (light scatters through the edges) and a darker underside
  float sun = clamp((dot(n, uSunDir) + 0.45) / 1.45, 0.0, 1.0);
  float under = 0.6 + 0.4 * clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 albedo = mix(vec3(0.92), vec3(0.34, 0.33, 0.32), vSmoke);
  vec3 col = albedo * (uSun * sun + uSky * under) / 3.14159;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Exhaust {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private n: number;
  private pos: Float32Array; private vel: Float32Array; private age: Float32Array; private life: Float32Array;
  private size: Float32Array; private grow: Float32Array; private smoke: Float32Array; private alpha: Float32Array; private rise: Float32Array; private spin: Float32Array;
  private iPos: THREE.InstancedBufferAttribute; private iLook: THREE.InstancedBufferAttribute;
  private next = 0;
  private live = 0;
  readonly mat: THREE.ShaderMaterial;
  wind = new THREE.Vector3(2.2, 0, -1.2);

  constructor(capacity: number) {
    this.n = capacity;
    const f = (k = 1) => new Float32Array(capacity * k);
    this.pos = f(3); this.vel = f(3); this.age = f(); this.life = f(); this.size = f(); this.grow = f(); this.smoke = f(); this.alpha = f(); this.rise = f(); this.spin = f();
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.setAttribute('uv', quad.getAttribute('uv'));
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.iPos.setUsage(THREE.DynamicDrawUsage);
    this.iLook = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.iLook.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos); geo.setAttribute('iLook', this.iLook);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTex: { value: puffTexture() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSun: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(1, 1, 1) } },
    });
    this.geo = geo; geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.name = 'exhaust'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    this.mesh.castShadow = false; this.mesh.receiveShadow = false;
  }

  /** Light from the scene: sun direction, sun colour x intensity, sky irradiance. */
  setLight(dir: THREE.Vector3, sun: THREE.Color, sky: THREE.Color) {
    const u = this.mat.uniforms; u.uSunDir.value.copy(dir); u.uSun.value.copy(sun); u.uSky.value.copy(sky);
  }

  emit(o: EmitOpts) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos.set([o.pos.x, o.pos.y, o.pos.z], i * 3); this.vel.set([o.vel.x, o.vel.y, o.vel.z], i * 3);
    this.age[i] = 0; this.life[i] = o.life; this.size[i] = o.size; this.grow[i] = o.grow; this.smoke[i] = o.smoke; this.alpha[i] = o.alpha;
    this.rise[i] = o.rise ?? 0.6; this.spin[i] = Math.random() * 6.283;
  }

  /** Advance every puff: drag towards the wind, buoyant rise, growth, fade. */
  update(dt: number) {
    if (dt <= 0) return;
    let k = 0;
    const p = this.iPos.array as Float32Array, l = this.iLook.array as Float32Array, w = this.wind;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const age = (this.age[i] += dt);
      if (age >= this.life[i]) { this.life[i] = 0; continue; }
      const drag = 1 - Math.exp(-dt * 1.2), o = i * 3;
      this.vel[o] += (w.x - this.vel[o]) * drag;
      this.vel[o + 1] += (this.rise[i] - this.vel[o + 1]) * drag;
      this.vel[o + 2] += (w.z - this.vel[o + 2]) * drag;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      const t = age / this.life[i];
      const size = this.size[i] + this.grow[i] * Math.sqrt(age);
      // quick fade-in, long fade-out; thinner as it spreads
      const a = this.alpha[i] * Math.min(1, 0.4 + t * 60) * (1 - t) ** 1.6;
      p[k * 4] = this.pos[o]; p[k * 4 + 1] = this.pos[o + 1]; p[k * 4 + 2] = this.pos[o + 2]; p[k * 4 + 3] = size;
      l[k * 4] = a; l[k * 4 + 1] = this.smoke[i]; l[k * 4 + 2] = this.spin[i] + age * 0.15; l[k * 4 + 3] = 0;
      k++;
    }
    this.live = k;
    this.geo.instanceCount = k; this.mesh.visible = k > 0;
    this.iPos.needsUpdate = true; this.iLook.needsUpdate = true;
    this.iPos.addUpdateRange(0, k * 4); this.iLook.addUpdateRange(0, k * 4);
  }

  get count() { return this.live; }
  clear() { this.life.fill(0); this.geo.instanceCount = 0; this.mesh.visible = false; }
}
