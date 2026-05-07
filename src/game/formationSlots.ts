export const ACTIVE_BOARD_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const ENEMY_BOARD_SLOTS = [20, 21, 22, 23, 24, 25, 26, 27, 28] as const;
export const BENCH_SLOTS = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49] as const;
export const PLAYER_FORMATION_SLOTS = [...ACTIVE_BOARD_SLOTS, ...BENCH_SLOTS] as const;

const ACTIVE_X = [-3.55, -2.65, -1.75] as const;
const ACTIVE_Y = [-1.1, -0.42, 0.24, 0.86] as const;
const ENEMY_X = [1.28, 2.18, 3.08] as const;
const ENEMY_Y = [-1.02, -0.27, 0.48] as const;
const BENCH_X = [-4.15, -3.25, -2.35, -1.45, -0.55, 0.35, 1.25, 2.15, 3.05, 3.95] as const;

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

function buildSlotPositions(): Record<number, [number, number, number]> {
  const positions: Record<number, [number, number, number]> = {};
  ACTIVE_BOARD_SLOTS.forEach((slot, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    positions[slot] = [ACTIVE_X[col], ACTIVE_Y[row], 0.3 + row * 0.04];
  });
  ENEMY_BOARD_SLOTS.forEach((slot, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const bossOffset = slot === 28 ? 0.34 : 0;
    positions[slot] = [ENEMY_X[col] + bossOffset, ENEMY_Y[row], 0.32 + row * 0.04];
  });
  BENCH_SLOTS.forEach((slot, index) => {
    positions[slot] = [BENCH_X[index], -2.18, 0.2];
  });
  return positions;
}
