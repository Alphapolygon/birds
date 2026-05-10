import { GRID_COLS, GRID_ROWS, PLAYER_DEPLOY_COLS, ENEMY_DEPLOY_COLS, TILE_SIZE, X_OFFSET, Y_OFFSET } from './constants';

const GRID_TILT_X = -Math.PI / 2.6;
const GRID_GROUP_POSITION: [number, number, number] = [0, -0.2, 0];

export const ACTIVE_BOARD_SLOTS = Array.from({ length: PLAYER_DEPLOY_COLS * GRID_ROWS }, (_, i) => i) as unknown as readonly number[];
export const ENEMY_BOARD_SLOTS = Array.from({ length: ENEMY_DEPLOY_COLS * GRID_ROWS }, (_, i) => 100 + i) as unknown as readonly number[];
export const BENCH_SLOTS = [200, 201, 202, 203, 204, 205, 206, 207] as const;
export const PLAYER_FORMATION_SLOTS = [...ACTIVE_BOARD_SLOTS, ...BENCH_SLOTS] as const;

const BENCH_X = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5] as const;

export const SLOT_POSITIONS: Record<number, [number, number, number]> = buildSlotPositions();

export function isActiveBoardSlot(slot: number): boolean {
  return (ACTIVE_BOARD_SLOTS as readonly number[]).includes(slot);
}

export function isBenchSlot(slot: number): boolean {
  return (BENCH_SLOTS as readonly number[]).includes(slot);
}

export function isEnemyBoardSlot(slot: number): boolean {
  return (ENEMY_BOARD_SLOTS as readonly number[]).includes(slot);
}

export function isPlayerFormationSlot(slot: number): boolean {
  return isActiveBoardSlot(slot) || isBenchSlot(slot);
}

export function slotPosition(slot: number, lift = 0): [number, number, number] {
  const base = SLOT_POSITIONS[slot] ?? [0, 0, 0.28];
  return [base[0], base[1], base[2] + lift];
}

export function closestPlayerSlot(x: number, y: number): number {
  let bestSlot: number = ACTIVE_BOARD_SLOTS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of PLAYER_FORMATION_SLOTS) {
    const [sx, sy] = slotPosition(slot);
    const distance = (sx - x) * (sx - x) + (sy - y) * (sy - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

export function closestActiveBoardSlot(x: number, y: number, maxDistance = 0.9): number | null {
  let bestSlot: number | null = null;
  let bestDistance = maxDistance * maxDistance;
  for (const slot of ACTIVE_BOARD_SLOTS) {
    const [sx, sy] = slotPosition(slot);
    const distance = (sx - x) * (sx - x) + (sy - y) * (sy - y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

function buildSlotPositions(): Record<number, [number, number, number]> {
  const positions: Record<number, [number, number, number]> = {};
  ACTIVE_BOARD_SLOTS.forEach((slot, index) => {
    const col = index % PLAYER_DEPLOY_COLS;
    const row = Math.floor(index / PLAYER_DEPLOY_COLS);
    positions[slot] = tileStagePosition(col, row, 0.3 + row * 0.015);
  });
  ENEMY_BOARD_SLOTS.forEach((slot, index) => {
    const col = GRID_COLS - ENEMY_DEPLOY_COLS + (index % ENEMY_DEPLOY_COLS);
    const row = Math.floor(index / ENEMY_DEPLOY_COLS) % GRID_ROWS;
    positions[slot] = tileStagePosition(col, row, 0.32 + row * 0.015);
  });
  BENCH_SLOTS.forEach((slot, index) => {
    positions[slot] = [BENCH_X[index], -5.5, 0.2];
  });
  return positions;
}

function tileStagePosition(x: number, y: number, localZ = 0): [number, number, number] {
  const localX = x * TILE_SIZE - X_OFFSET;
  const localY = Y_OFFSET - y * TILE_SIZE;
  const tiltedY = localY * Math.cos(GRID_TILT_X) - localZ * Math.sin(GRID_TILT_X);
  const tiltedZ = localY * Math.sin(GRID_TILT_X) + localZ * Math.cos(GRID_TILT_X);
  return [localX + GRID_GROUP_POSITION[0], tiltedY + GRID_GROUP_POSITION[1], tiltedZ + GRID_GROUP_POSITION[2]];
}
