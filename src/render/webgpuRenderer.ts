import { WebGPURenderer } from 'three/webgpu';

export async function createWebGpuRenderer(props: Record<string, unknown>) {
  const renderer = new WebGPURenderer({ ...props, alpha: true, antialias: true } as any);
  await renderer.init();
  (renderer as any).setClearAlpha?.(0);
  return renderer;
}
