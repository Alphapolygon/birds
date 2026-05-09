import { GRID_COLS, GRID_ROWS, PLAYER_DEPLOY_COLS, TILE_SIZE, X_OFFSET, Y_OFFSET } from './constants';

const ENEMY_DEPLOY_COLS = 2;
const GRID_TILT_X = -Math.PI / 4;
const GRID_GROUP_POSITION: [number, number, number] = [0, -1.05, 0];

export const ACTIVE_BOARD_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const ENEMY_BOARD_SLOTS = [20, 21, 22, 23, 24, 25, 26, 27] as const;
export const BENCH_SLOTS = [40, 41, 42, 43, 44, 45] as const;
export const PLAYER_FORMATION_SLOTS = [...ACTIVE_BOARD_SLOTS, ...BENCH_SLOTS] as const;

const BENCH_X = [-3.1, -1.86, -0.62, 0.62, 1.86, 3.1] as const;

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
    positions[slot] = [BENCH_X[index], -2.28, 0.2];
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
