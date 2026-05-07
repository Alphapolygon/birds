import atlasData from '../assets/sprites/bird_atlas.json';
import { ActionTimingState } from './types';

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

type SpriteState = 'idle' | 'attack' | 'hit' | 'shield';

type SpriteUvBuffers = {
  uvOffsetX: Float32Array;
  uvOffsetY: Float32Array;
  uvScaleX: Float32Array;
  uvScaleY: Float32Array;
  uvAspectRatio: Float32Array;
};

type AtlasFrameWorld = SpriteUvBuffers & {
  spriteKey: string[];
  timingState: Uint8Array;
  animAttack: Float32Array;
  animHit: Float32Array;
  animShield: Float32Array;
};

export const ATLAS_FRAMES: Record<string, AtlasFrame> = atlasData as Record<string, AtlasFrame>;

// Pre-calculate all UVs at boot time so the render loop never has to normalize pixels.
export const ATLAS_UVS: Record<string, SpriteUV> = {};

for (const [key, data] of Object.entries(ATLAS_FRAMES)) {
  ATLAS_UVS[key] = {
    offsetX: data.x / TEX_WIDTH,
    scaleX: data.w / TEX_WIDTH,
    offsetY: 1.0 - (data.y + data.h) / TEX_HEIGHT,
    scaleY: data.h / TEX_HEIGHT,
    aspectRatio: data.w / data.h,
  };
}

export function atlasFrameKey(spriteKey: string, state: SpriteState): string {
  // Translate the engine's generic keys into the exact original Rovio Atlas keys
  const keyMap: Record<string, Record<SpriteState, string>> = {
    'red': { idle: 'BIRD_RED', attack: 'BIRD_RED_YELL', hit: 'BIRD_RED_COLLISION', shield: 'BIRD_RED' },
    'chuck': { idle: 'BIRD_YELLOW', attack: 'BIRD_YELLOW_YELL', hit: 'BIRD_YELLOW_COLLISION', shield: 'BIRD_YELLOW' },
    'terence': { idle: 'BIRD_BIG_BROTHER', attack: 'BIRD_BIG_BROTHER_YELL', hit: 'BIRD_BIG_BROTHER_BLINK', shield: 'BIRD_BIG_BROTHER' },
    'bomb': { idle: 'BIRD_GREY', attack: 'BIRD_GREY_YELL', hit: 'BIRD_GREY_1', shield: 'BIRD_GREY' },
    'blues': { idle: 'BIRD_BLUE', attack: 'BIRD_BLUE_YELL', hit: 'BIRD_BLUE_COLLISION', shield: 'BIRD_BLUE' },
    'hal': { idle: 'BIRD_BOOMERANG_STILL', attack: 'BIRD_BOOMERANG_YELL', hit: 'BIRD_BOOMERANG_COLLISION', shield: 'BIRD_BOOMERANG_STILL' },
    // Fallbacks for birds that weren't in the original INGAME_BIRDS_1 atlas
    'silver': { idle: 'BIRD_GREY', attack: 'BIRD_GREY_YELL', hit: 'BIRD_GREY_1', shield: 'BIRD_GREY' },
    'matilda': { idle: 'BIRD_GREEN', attack: 'BIRD_GREEN_YELL', hit: 'BIRD_GREEN_COLLISION', shield: 'BIRD_GREEN' },
    'stella': { idle: 'BIRD_BLUE', attack: 'BIRD_BLUE_YELL', hit: 'BIRD_BLUE_COLLISION', shield: 'BIRD_BLUE' },
    'bubbles': { idle: 'BIRD_YELLOW', attack: 'BIRD_YELLOW_YELL', hit: 'BIRD_YELLOW_COLLISION', shield: 'BIRD_YELLOW' },
    'melody': { idle: 'BIRD_RED', attack: 'BIRD_RED_YELL', hit: 'BIRD_RED_COLLISION', shield: 'BIRD_RED' },

    'pig-grunt': { idle: 'PIGLETTE_SMALL_01', attack: 'PIGLETTE_SMALL_01_SMILE', hit: 'PIGLETTE_SMALL_03', shield: 'PIGLETTE_SMALL_01' },
    'pig-archer': { idle: 'PIGLETTE_MEDIUM_01', attack: 'PIGLETTE_MEDIUM_01_SMILE', hit: 'PIGLETTE_MEDIUM_03', shield: 'PIGLETTE_MEDIUM_01' },
    'pig-bruiser': { idle: 'PIGLETTE_HELMET_01', attack: 'PIGLETTE_HELMET_01_SMILE', hit: 'PIGLETTE_HELMET_03', shield: 'PIGLETTE_HELMET_01' },
    'pig-thief': { idle: 'PIGLETTE_GRANDPA_01', attack: 'PIGLETTE_GRANDPA_04_SMILE', hit: 'PIGLETTE_GRANDPA_03', shield: 'PIGLETTE_GRANDPA_01' },
    'pig-boss': { idle: 'PIGLETTE_KING_01', attack: 'PIGLETTE_KING_08_SMILE', hit: 'PIGLETTE_KING_03', shield: 'PIGLETTE_KING_01' },

    'golden-egg': { idle: 'DROPPABLE_EGG', attack: 'DROPPABLE_EGG', hit: 'DROPPABLE_EGG', shield: 'DROPPABLE_EGG' },
    'barricade': { idle: 'HELMET_BIG', attack: 'HELMET_BIG', hit: 'HELMET_BIG', shield: 'HELMET_BIG' },
    'projectile': { idle: 'ROCK_PARTICLE_3', attack: 'ROCK_PARTICLE_3', hit: 'ROCK_PARTICLE_3', shield: 'ROCK_PARTICLE_3' }
  };

  const mapped = keyMap[spriteKey];
  if (mapped && mapped[state]) return mapped[state];
  return 'BIRD_RED'; // Ultimate safe fallback
}

export function writeAtlasUvs(world: SpriteUvBuffers, entity: number, frameKey: string): void {
  // If a frame is missing, safely default to the red bird so it never crashes
  const frame = ATLAS_UVS[frameKey] ?? ATLAS_UVS['BIRD_RED'];
  
  world.uvOffsetX[entity] = frame.offsetX;
  world.uvOffsetY[entity] = frame.offsetY;
  world.uvScaleX[entity] = frame.scaleX;
  world.uvScaleY[entity] = frame.scaleY;
  world.uvAspectRatio[entity] = frame.aspectRatio;
}

export function writeSpriteStateUvs(world: SpriteUvBuffers, entity: number, spriteKey: string, state: SpriteState): void {
  writeAtlasUvs(world, entity, atlasFrameKey(spriteKey, state));
}

export function syncEntityAtlasFrame(world: AtlasFrameWorld, entity: number): void {
  const key = world.spriteKey[entity] || 'red';
  writeSpriteStateUvs(world, entity, key, spriteStateForEntity(world, entity));
}

function spriteStateForEntity(world: AtlasFrameWorld, entity: number): SpriteState {
  if (world.animShield[entity] > 0) return 'shield';
  if (world.animHit[entity] > 0) return 'hit';
  if (world.animAttack[entity] > 0) return 'attack';
  
  const timing = world.timingState[entity] as ActionTimingState;
  if (timing === ActionTimingState.Windup || timing === ActionTimingState.ActionWindow) return 'attack';
  
  return 'idle';
}