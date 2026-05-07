import type { UnitId } from './types';

export type AnimDef = {
  frames: string[];
  duration: number;
  loop: boolean;
};

export const ANIM_IDS = {
  NONE: 0,
  RED_IDLE: 1,
  RED_ATTACK: 2,
  RED_HIT: 3,
  CHUCK_IDLE: 4,
  CHUCK_ATTACK: 5,
  CHUCK_HIT: 6,
  BOMB_IDLE: 7,
  BOMB_ATTACK: 8,
  BOMB_HIT: 9,
  BLUES_IDLE: 10,
  BLUES_ATTACK: 11,
  BLUES_HIT: 12,
  TERENCE_IDLE: 13,
  TERENCE_ATTACK: 14,
  TERENCE_HIT: 15,
  HAL_IDLE: 16,
  HAL_ATTACK: 17,
  HAL_HIT: 18,
  AL_IDLE: 19,
  AL_ATTACK: 20,
  AL_HIT: 21,
  PIG_GRUNT_IDLE: 22,
  PIG_GRUNT_ATTACK: 23,
  PIG_GRUNT_HIT: 24,
  PIG_BRUISER_IDLE: 25,
  PIG_BRUISER_ATTACK: 26,
  PIG_BRUISER_HIT: 27,
  PIG_BOSS_IDLE: 28,
  PIG_BOSS_ATTACK: 29,
  PIG_BOSS_HIT: 30,
  PIG_ARCHER_IDLE: 31,
  PIG_ARCHER_ATTACK: 32,
  PIG_ARCHER_HIT: 33,
  PIG_THIEF_IDLE: 34,
  PIG_THIEF_ATTACK: 35,
  PIG_THIEF_HIT: 36,
} as const;

export const ANIM_CATALOG: Record<number, AnimDef> = {
  [ANIM_IDS.NONE]: { frames: ['BIRD_RED'], duration: 1, loop: true },
  [ANIM_IDS.RED_IDLE]: { frames: ['BIRD_RED', 'BIRD_RED', 'BIRD_RED', 'BIRD_RED', 'BIRD_RED_BLINK'], duration: 0.6, loop: true },
  [ANIM_IDS.RED_ATTACK]: { frames: ['BIRD_RED_YELL', 'BIRD_RED_FLYING'], duration: 0.18, loop: false },
  [ANIM_IDS.RED_HIT]: { frames: ['BIRD_RED_COLLISION'], duration: 0.5, loop: false },
  [ANIM_IDS.CHUCK_IDLE]: { frames: ['BIRD_YELLOW', 'BIRD_YELLOW', 'BIRD_YELLOW', 'BIRD_YELLOW', 'BIRD_YELLOW_BLINK'], duration: 0.5, loop: true },
  [ANIM_IDS.CHUCK_ATTACK]: { frames: ['BIRD_YELLOW_YELL', 'BIRD_YELLOW_FLYING', 'BIRD_YELLOW_SPECIAL'], duration: 0.13, loop: false },
  [ANIM_IDS.CHUCK_HIT]: { frames: ['BIRD_YELLOW_COLLISION'], duration: 0.5, loop: false },
  [ANIM_IDS.BOMB_IDLE]: { frames: ['BIRD_GREY', 'BIRD_GREY', 'BIRD_GREY', 'BIRD_GREY', 'BIRD_GREY_BLINK'], duration: 0.7, loop: true },
  [ANIM_IDS.BOMB_ATTACK]: { frames: ['BIRD_GREY_YELL', 'BIRD_GREY_FLYING'], duration: 0.2, loop: false },
  [ANIM_IDS.BOMB_HIT]: { frames: ['BIRD_GREY_1', 'BIRD_GREY_2', 'BIRD_GREY_3'], duration: 0.13, loop: false },
  [ANIM_IDS.BLUES_IDLE]: { frames: ['BIRD_BLUE', 'BIRD_BLUE', 'BIRD_BLUE', 'BIRD_BLUE_BLINK'], duration: 0.42, loop: true },
  [ANIM_IDS.BLUES_ATTACK]: { frames: ['BIRD_BLUE_YELL'], duration: 0.25, loop: false },
  [ANIM_IDS.BLUES_HIT]: { frames: ['BIRD_BLUE_COLLISION'], duration: 0.5, loop: false },
  [ANIM_IDS.TERENCE_IDLE]: { frames: ['BIRD_BIG_BROTHER', 'BIRD_BIG_BROTHER', 'BIRD_BIG_BROTHER', 'BIRD_BIG_BROTHER_BLINK'], duration: 0.9, loop: true },
  [ANIM_IDS.TERENCE_ATTACK]: { frames: ['BIRD_BIG_BROTHER_YELL'], duration: 0.34, loop: false },
  [ANIM_IDS.TERENCE_HIT]: { frames: ['BIRD_BIG_BROTHER_BLINK'], duration: 0.5, loop: false },
  [ANIM_IDS.HAL_IDLE]: { frames: ['BIRD_BOOMERANG_STILL', 'BIRD_BOOMERANG_STILL', 'BIRD_BOOMERANG_BLINK'], duration: 0.6, loop: true },
  [ANIM_IDS.HAL_ATTACK]: { frames: ['BIRD_BOOMERANG_YELL', 'BIRD_BOOMERANG_SPECIAL', 'BIRD_BOOMERANG'], duration: 0.17, loop: false },
  [ANIM_IDS.HAL_HIT]: { frames: ['BIRD_BOOMERANG_COLLISION'], duration: 0.5, loop: false },
  [ANIM_IDS.AL_IDLE]: { frames: ['BIRD_GREEN', 'BIRD_GREEN', 'BIRD_GREEN', 'BIRD_GREEN_BLINK'], duration: 0.6, loop: true },
  [ANIM_IDS.AL_ATTACK]: { frames: ['BIRD_GREEN_YELL', 'BIRD_GREEN_FLYING', 'BIRD_GREEN_SPECIAL'], duration: 0.18, loop: false },
  [ANIM_IDS.AL_HIT]: { frames: ['BIRD_GREEN_COLLISION'], duration: 0.5, loop: false },
  [ANIM_IDS.PIG_GRUNT_IDLE]: { frames: ['PIGLETTE_SMALL_01', 'PIGLETTE_SMALL_01', 'PIGLETTE_SMALL_01', 'PIGLETTE_SMALL_01_BLINK'], duration: 0.8, loop: true },
  [ANIM_IDS.PIG_GRUNT_ATTACK]: { frames: ['PIGLETTE_SMALL_01_SMILE'], duration: 0.3, loop: false },
  [ANIM_IDS.PIG_GRUNT_HIT]: { frames: ['PIGLETTE_SMALL_02', 'PIGLETTE_SMALL_03'], duration: 0.22, loop: false },
  [ANIM_IDS.PIG_BRUISER_IDLE]: { frames: ['PIGLETTE_HELMET_01', 'PIGLETTE_HELMET_01', 'PIGLETTE_HELMET_01_BLINK'], duration: 0.8, loop: true },
  [ANIM_IDS.PIG_BRUISER_ATTACK]: { frames: ['PIGLETTE_HELMET_01_SMILE'], duration: 0.3, loop: false },
  [ANIM_IDS.PIG_BRUISER_HIT]: { frames: ['PIGLETTE_HELMET_02', 'PIGLETTE_HELMET_03'], duration: 0.22, loop: false },
  [ANIM_IDS.PIG_BOSS_IDLE]: { frames: ['PIGLETTE_KING_01', 'PIGLETTE_KING_01', 'PIGLETTE_KING_01_BLINK'], duration: 1.0, loop: true },
  [ANIM_IDS.PIG_BOSS_ATTACK]: { frames: ['PIGLETTE_KING_07_SMILE', 'PIGLETTE_KING_08_SMILE'], duration: 0.22, loop: false },
  [ANIM_IDS.PIG_BOSS_HIT]: { frames: ['PIGLETTE_KING_02', 'PIGLETTE_KING_03'], duration: 0.25, loop: false },
  [ANIM_IDS.PIG_ARCHER_IDLE]: { frames: ['PIGLETTE_MEDIUM_01', 'PIGLETTE_MEDIUM_01', 'PIGLETTE_MEDIUM_01_BLINK'], duration: 0.75, loop: true },
  [ANIM_IDS.PIG_ARCHER_ATTACK]: { frames: ['PIGLETTE_MEDIUM_01_SMILE'], duration: 0.28, loop: false },
  [ANIM_IDS.PIG_ARCHER_HIT]: { frames: ['PIGLETTE_MEDIUM_02', 'PIGLETTE_MEDIUM_03'], duration: 0.22, loop: false },
  [ANIM_IDS.PIG_THIEF_IDLE]: { frames: ['PIGLETTE_GRANDPA_01', 'PIGLETTE_GRANDPA_01', 'PIGLETTE_GRANDPA_01_BLINK'], duration: 0.75, loop: true },
  [ANIM_IDS.PIG_THIEF_ATTACK]: { frames: ['PIGLETTE_GRANDPA_04_SMILE'], duration: 0.28, loop: false },
  [ANIM_IDS.PIG_THIEF_HIT]: { frames: ['PIGLETTE_GRANDPA_02', 'PIGLETTE_GRANDPA_03'], duration: 0.22, loop: false },
};

export function getUnitAnimation(unitId: UnitId | '', state: 'idle' | 'attack' | 'hit'): number {
  switch (unitId) {
    case 'red': return state === 'idle' ? ANIM_IDS.RED_IDLE : state === 'attack' ? ANIM_IDS.RED_ATTACK : ANIM_IDS.RED_HIT;
    case 'chuck': return state === 'idle' ? ANIM_IDS.CHUCK_IDLE : state === 'attack' ? ANIM_IDS.CHUCK_ATTACK : ANIM_IDS.CHUCK_HIT;
    case 'bomb': return state === 'idle' ? ANIM_IDS.BOMB_IDLE : state === 'attack' ? ANIM_IDS.BOMB_ATTACK : ANIM_IDS.BOMB_HIT;
    case 'blues': return state === 'idle' ? ANIM_IDS.BLUES_IDLE : state === 'attack' ? ANIM_IDS.BLUES_ATTACK : ANIM_IDS.BLUES_HIT;
    case 'terence': return state === 'idle' ? ANIM_IDS.TERENCE_IDLE : state === 'attack' ? ANIM_IDS.TERENCE_ATTACK : ANIM_IDS.TERENCE_HIT;
    case 'hal': return state === 'idle' ? ANIM_IDS.HAL_IDLE : state === 'attack' ? ANIM_IDS.HAL_ATTACK : ANIM_IDS.HAL_HIT;
    case 'silver':
    case 'matilda':
    case 'stella':
    case 'bubbles':
    case 'melody': return state === 'idle' ? ANIM_IDS.AL_IDLE : state === 'attack' ? ANIM_IDS.AL_ATTACK : ANIM_IDS.AL_HIT;
    case 'pig_grunt': return state === 'idle' ? ANIM_IDS.PIG_GRUNT_IDLE : state === 'attack' ? ANIM_IDS.PIG_GRUNT_ATTACK : ANIM_IDS.PIG_GRUNT_HIT;
    case 'pig_archer': return state === 'idle' ? ANIM_IDS.PIG_ARCHER_IDLE : state === 'attack' ? ANIM_IDS.PIG_ARCHER_ATTACK : ANIM_IDS.PIG_ARCHER_HIT;
    case 'pig_bruiser': return state === 'idle' ? ANIM_IDS.PIG_BRUISER_IDLE : state === 'attack' ? ANIM_IDS.PIG_BRUISER_ATTACK : ANIM_IDS.PIG_BRUISER_HIT;
    case 'pig_thief': return state === 'idle' ? ANIM_IDS.PIG_THIEF_IDLE : state === 'attack' ? ANIM_IDS.PIG_THIEF_ATTACK : ANIM_IDS.PIG_THIEF_HIT;
    case 'pig_boss': return state === 'idle' ? ANIM_IDS.PIG_BOSS_IDLE : state === 'attack' ? ANIM_IDS.PIG_BOSS_ATTACK : ANIM_IDS.PIG_BOSS_HIT;
    default: return state === 'idle' ? ANIM_IDS.RED_IDLE : state === 'attack' ? ANIM_IDS.RED_ATTACK : ANIM_IDS.RED_HIT;
  }
}
