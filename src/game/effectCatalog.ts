import type { UnitId } from './types';

export type EffectDef = {
  frames: string[];
  duration: number;
  scale: number;
};

export const EFFECT_IDS = {
  NONE: 0,
  HIT: 1,
  CHARGED: 2,
  SHIELD: 3,
  SPECIAL: 4,
} as const;

export const EFFECT_CATALOG: Record<number, EffectDef> = {
  [EFFECT_IDS.NONE]: { frames: ['LIGHT_PARTICLE_1'], duration: 0.2, scale: 0.35 },
  [EFFECT_IDS.HIT]: { frames: ['LIGHT_PARTICLE_2', 'LIGHT_PARTICLE_3', 'ROCK_PARTICLE_1'], duration: 0.28, scale: 0.52 },
  [EFFECT_IDS.CHARGED]: { frames: ['EXPLOSION_CLOUD_1', 'EXPLOSION_CLOUD_3', 'EXPLOSION'], duration: 0.42, scale: 0.8 },
  [EFFECT_IDS.SHIELD]: { frames: ['SMOKE_BUFF_1', 'SMOKE_BUFF_2', 'SMOKE_BUFF_3'], duration: 0.42, scale: 0.68 },
  [EFFECT_IDS.SPECIAL]: { frames: ['LIGHT_PARTICLE_5', 'EXPLOSION_CLOUD_4', 'EXPLOSION_CLOUD_6'], duration: 0.58, scale: 1.0 },
};

export function effectFrameForKind(kind: number, phase: number): string {
  const def = EFFECT_CATALOG[kind] ?? EFFECT_CATALOG[EFFECT_IDS.HIT];
  const index = Math.max(0, Math.min(def.frames.length - 1, Math.floor(phase * def.frames.length)));
  return def.frames[index] ?? def.frames[0] ?? 'LIGHT_PARTICLE_1';
}

export function specialEffectKind(unitId: UnitId | ''): number {
  if (unitId === 'bomb' || unitId === 'terence' || unitId === 'pig_boss') return EFFECT_IDS.CHARGED;
  if (unitId === 'bubbles' || unitId === 'matilda') return EFFECT_IDS.SHIELD;
  return EFFECT_IDS.SPECIAL;
}
