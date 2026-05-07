import atlasData from '../assets/sprites/bird_atlas.json';
import { ANIM_CATALOG, getUnitAnimation } from './animCatalog';
import { ActionAnimState, type UnitId } from './types';

export const TEX_WIDTH = 1048;
export const TEX_HEIGHT = 968;

export type SpriteUV = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  aspectRatio: number;
};

export type AtlasFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type SpriteUvBuffers = {
  uvOffsetX: Float32Array;
  uvOffsetY: Float32Array;
  uvScaleX: Float32Array;
  uvScaleY: Float32Array;
  uvAspectRatio: Float32Array;
};

type AtlasFrameWorld = SpriteUvBuffers & {
  spriteKey: string[];
  unitId: (UnitId | '')[];
  actionState: Uint8Array;
  actionClock: Float32Array;
  animAttack: Float32Array;
  animHit: Float32Array;
  animShield: Float32Array;
  animId: Uint16Array;
  animClock: Float32Array;
};

export const ATLAS_FRAMES: Record<string, AtlasFrame> = atlasData as Record<string, AtlasFrame>;
export const ATLAS_UVS: Record<string, SpriteUV> = {};
export type SpriteState = 'idle' | 'attack' | 'hit' | 'shield';

export function atlasFrameKey(spriteKey: string, state: SpriteState): string {
  if (spriteKey === 'golden-egg') return 'DROPPABLE_EGG';
  if (spriteKey === 'barricade') return 'HELMET_BIG';
  if (spriteKey.startsWith('fx-')) return 'LIGHT_PARTICLE_1';
  const unitId = spriteKey.replace(/-/g, '_') as UnitId;
  const animState = state === 'shield' ? 'idle' : state;
  return frameForAnim(getUnitAnimation(unitId, animState), 0);
}


for (const [key, data] of Object.entries(ATLAS_FRAMES)) {
  ATLAS_UVS[key] = {
    offsetX: data.x / TEX_WIDTH,
    scaleX: data.w / TEX_WIDTH,
    offsetY: 1.0 - (data.y + data.h) / TEX_HEIGHT,
    scaleY: data.h / TEX_HEIGHT,
    aspectRatio: data.w / data.h,
  };
}

export function writeAtlasUvs(world: SpriteUvBuffers, entity: number, frameKey: string): void {
  const frame = ATLAS_UVS[frameKey] ?? ATLAS_UVS.BIRD_RED;
  world.uvOffsetX[entity] = frame.offsetX;
  world.uvOffsetY[entity] = frame.offsetY;
  world.uvScaleX[entity] = frame.scaleX;
  world.uvScaleY[entity] = frame.scaleY;
  world.uvAspectRatio[entity] = frame.aspectRatio;
}

export function syncEntityAtlasFrame(world: AtlasFrameWorld, entity: number): void {
  const animId = currentAnimId(world, entity);
  if (world.animId[entity] !== animId) {
    world.animId[entity] = animId;
    world.animClock[entity] = 0;
  }
  writeAtlasUvs(world, entity, frameForAnim(animId, world.animClock[entity]));
}

export function frameForAnim(animId: number, clock: number): string {
  const anim = ANIM_CATALOG[animId] ?? ANIM_CATALOG[0];
  if (!anim || anim.frames.length === 0) return 'BIRD_RED';
  const rawIndex = Math.floor(clock / Math.max(0.01, anim.duration));
  const index = anim.loop ? rawIndex % anim.frames.length : Math.min(anim.frames.length - 1, rawIndex);
  return anim.frames[index] ?? anim.frames[0] ?? 'BIRD_RED';
}

function currentAnimId(world: AtlasFrameWorld, entity: number): number {
  const unitId = world.unitId[entity];
  if (world.animHit[entity] > 0) return getUnitAnimation(unitId, 'hit');
  if (world.animAttack[entity] > 0 || (world.actionState[entity] as ActionAnimState) === ActionAnimState.Windup) return getUnitAnimation(unitId, 'attack');
  return getUnitAnimation(unitId, 'idle');
}
