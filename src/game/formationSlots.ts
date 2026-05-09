import {
  ENEMY_DEPLOY_COLS,
  GRID_COLS,
  GRID_GROUP_POSITION,
  GRID_TILT_X,
  PLAYER_DEPLOY_COLS,
  TILE_SIZE,
  X_OFFSET,
  Y_OFFSET,
} from './constants';

export const ACTIVE_BOARD_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const ENEMY_BOARD_SLOTS = [20, 21, 22, 23, 24, 25, 26, 27] as const;
export const BENCH_SLOTS = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49] as const;
export const PLAYER_FORMATION_SLOTS = [...ACTIVE_BOARD_SLOTS, ...BENCH_SLOTS] as const;

const UNIT_GRID_LIFT = 0.38;
const BENCH_X = [-4.15, -3.25, -2.35, -1.45, -0.55, 0.35, 1.25, 2.15, 3.05, 3.95] as const;
const DROP_RADIUS_SQUARED = 0.72 * 0.72;

export type GridSlotPoint = { x: number; y: number };

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
  const base = SLOT_POSITIONS[slot] ?? [0, 0, UNIT_GRID_LIFT];
  return [base[0], base[1], base[2] + lift];
}

export function slotGridPoint(slot: number): GridSlotPoint | null {
  if (isActiveBoardSlot(slot)) {
    const index = ACTIVE_BOARD_SLOTS.indexOf(slot as (typeof ACTIVE_BOARD_SLOTS)[number]);
    return { x: index % PLAYER_DEPLOY_COLS, y: Math.floor(index / PLAYER_DEPLOY_COLS) };
  }
  if (isEnemyBoardSlot(slot)) {
    const index = ENEMY_BOARD_SLOTS.indexOf(slot as (typeof ENEMY_BOARD_SLOTS)[number]);
    return { x: GRID_COLS - ENEMY_DEPLOY_COLS + (index % ENEMY_DEPLOY_COLS), y: Math.floor(index / ENEMY_DEPLOY_COLS) };
  }
  return null;
}

export function gridStagePosition(x: number, y: number, lift = UNIT_GRID_LIFT): [number, number, number] {
  const localX = x * TILE_SIZE - X_OFFSET;
  const localY = Y_OFFSET - y * TILE_SIZE;
  const localZ = lift;
  const tiltedY = localY * Math.cos(GRID_TILT_X) - localZ * Math.sin(GRID_TILT_X);
  const tiltedZ = localY * Math.sin(GRID_TILT_X) + localZ * Math.cos(GRID_TILT_X);
  return [localX + GRID_GROUP_POSITION[0], tiltedY + GRID_GROUP_POSITION[1], tiltedZ + GRID_GROUP_POSITION[2]];
}

export function closestPlayerSlot(x: number, y: number): number {
  return closestSlotFromList(x, y, PLAYER_FORMATION_SLOTS as readonly number[]) ?? ACTIVE_BOARD_SLOTS[0];
}

export function closestActiveBoardSlot(x: number, y: number): number | null {
  const slot = closestSlotFromList(x, y, ACTIVE_BOARD_SLOTS as readonly number[]);
  if (slot === null) return null;
  const [sx, sy] = slotPosition(slot);
  const distanceSquared = (sx - x) * (sx - x) + (sy - y) * (sy - y);
  return distanceSquared <= DROP_RADIUS_SQUARED ? slot : null;
}

function closestSlotFromList(x: number, y: number, slots: readonly number[]): number | null {
  let bestSlot: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    const [sx, sy] = slotPosition(slot);
    const distance = (sx - x) * (sx - x) + (sy - y) * (sy - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

function buildSlotPositions(): Record<number, [number, number, number]> {
  const positions: Record<number, [number, number, number]> = {};
  ACTIVE_BOARD_SLOTS.forEach((slot) => {
    const point = slotGridPoint(slot);
    if (point) positions[slot] = gridStagePosition(point.x, point.y);
  });
  ENEMY_BOARD_SLOTS.forEach((slot) => {
    const point = slotGridPoint(slot);
    if (point) positions[slot] = gridStagePosition(point.x, point.y);
  });
  BENCH_SLOTS.forEach((slot, index) => {
    positions[slot] = [BENCH_X[index], -2.95, 0.2];
  });
  return positions;
}
