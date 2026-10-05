// Quality tiers and automatic detection. Override with ?q=high|medium|low or the settings menu.
import type * as THREE from 'three';

export type Tier = 'high' | 'medium' | 'low';

export interface TierSpec {
  name: Tier;
  dprCap: number;
  shadowSize: number;
  shadowExtent: number; // half-size of the shadowed square around the focus (m)
  msaa: number;
  ao: boolean;
  bloom: boolean;
  smaa: boolean;
  post: boolean;
  anisotropy: number;
  hrtf: boolean;
  envSize: number;
}

export const TIERS: Record<Tier, TierSpec> = {
  high: { name: 'high', dprCap: 2, shadowSize: 4096, shadowExtent: 45, msaa: 4, ao: true, bloom: true, smaa: false, post: true, anisotropy: 16, hrtf: true, envSize: 256 },
  medium: { name: 'medium', dprCap: 1.5, shadowSize: 2048, shadowExtent: 40, msaa: 0, ao: false, bloom: true, smaa: true, post: true, anisotropy: 8, hrtf: true, envSize: 128 },
  low: { name: 'low', dprCap: 1, shadowSize: 1024, shadowExtent: 30, msaa: 0, ao: false, bloom: false, smaa: false, post: false, anisotropy: 4, hrtf: false, envSize: 64 },
};

export interface GpuInfo { renderer: string; vendor: string; mobile: boolean; software: boolean }

export function gpuInfo(gl: WebGL2RenderingContext | WebGLRenderingContext): GpuInfo {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const vendor = String(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
  const software = /SwiftShader|llvmpipe|softpipe|Software/i.test(renderer);
  return { renderer, vendor, mobile, software };
}

export function detectTier(renderer: THREE.WebGLRenderer): { tier: Tier; reason: string; gpu: GpuInfo } {
  const gpu = gpuInfo(renderer.getContext());
  const r = gpu.renderer;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (gpu.software) return { tier: 'low', reason: 'software renderer', gpu };
  if (gpu.mobile) {
    if (/Adreno.*(7[3-9]\d|8\d\d)|Apple GPU|Immortalis|Mali-G7[1-9]|Mali-G[89]\d\d|Xclipse/i.test(r) && mem >= 6) return { tier: 'medium', reason: 'recent mobile GPU', gpu };
    return { tier: 'low', reason: 'mobile GPU', gpu };
  }
  if (/NVIDIA|GeForce|RTX|Quadro|Radeon (RX|Pro)|Arc\(TM\) A\d|Apple M\d (Pro|Max|Ultra)/i.test(r)) return { tier: 'high', reason: 'discrete-class GPU', gpu };
  return { tier: 'medium', reason: 'integrated or unknown GPU', gpu };
}
