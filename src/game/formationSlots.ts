export const ACTIVE_BOARD_SLOTS = [0, 1, 2, 3] as const;
export const BENCH_SLOTS = [10, 11, 12, 13, 14, 15] as const;
export const ENEMY_BOARD_SLOTS = [20, 21, 22, 23, 24] as const;
export const PLAYER_FORMATION_SLOTS = [...ACTIVE_BOARD_SLOTS, ...BENCH_SLOTS] as const;

// Logical 2D grid coordinates: [X, Y]
// Center is 0,0. Left is Player (-x), Right is Enemy (+x).
export const SLOT_LOGICAL: Record<number, [number, number]> = {
  // Player Active Board (2x2 Grid)
  0: [-0.8, 0.8],  // Front Top
  1: [-0.8, -0.6], // Front Bot
  2: [-2.0, 0.8],  // Back Top
  3: [-2.0, -0.6], // Back Bot
  
  // Bench (Straight row at the bottom)
  10: [-3.0, -2.4],
  11: [-1.8, -2.4],
  12: [-0.6, -2.4],
  13: [0.6, -2.4],
  14: [1.8, -2.4],
  15: [3.0, -2.4],
  
  // Enemy Active Board (2x3 staggered)
  20: [0.8, 0.8],
  21: [0.8, -0.6],
  22: [1.8, 0.1],
  23: [2.8, 1.0],
  24: [2.8, -0.8],
};

export function isActiveBoardSlot(slot: number): boolean { return ACTIVE_BOARD_SLOTS.includes(slot as any); }
export function isBenchSlot(slot: number): boolean { return BENCH_SLOTS.includes(slot as any); }
export function isEnemyBoardSlot(slot: number): boolean { return ENEMY_BOARD_SLOTS.includes(slot as any); }
export function isPlayerFormationSlot(slot: number): boolean { return isActiveBoardSlot(slot) || isBenchSlot(slot); }

// The Magic Perspective Math
export function slotPosition(slot: number, lift = 0): [number, number, number] {
  const logical = SLOT_LOGICAL[slot];
  if (!logical) return [0, 0, 0];

  // Scale out the grid so birds aren't touching each other
  const x = logical[0] * 1.35;
  const y = logical[1] * 1.45;
  
  // Tilt the Y axis to create a 3D isometric floor perspective
  const tiltX = -Math.PI / 3.2; 
  const tiltedY = y * Math.cos(tiltX);
  
  // Z-Sorting: As Y gets lower on the screen, push the Z axis closer to the camera!
  const zSort = -y * 0.2; 
  
  // Shift the Bench significantly further down the screen to separate it from combat
  const yOffset = isBenchSlot(slot) ? -0.8 : 0.2;

  return [x, tiltedY + yOffset, zSort + lift];
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