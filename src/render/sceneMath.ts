import { isEnemyBoardSlot, slotPosition } from '../game/formationSlots';
import { GRID_COLS, GRID_ROWS } from '../game/constants';


// Exact Perspective Mapping derived from coordinates (650,860) to (2788,1515)
export const HORIZON_Y = 7.095;
export const D_TOP = 8.015;
export const D_BOTTOM = 14.565;
export const TOP_WIDTH = 15.15;

export function perspectiveMap(col: number, row: number): { x: number; y: number; scale: number } {
  const u = col / GRID_COLS;
  const v = row / GRID_ROWS;

  // Set this back to 0 so the lines are perfectly straight again!
  const lensDistortion = 0; 
  const slideX = 0; 

  const adjusted_u = u + lensDistortion + slideX;

  const d_v = 1 / ((1 - v) / D_TOP + v / D_BOTTOM);
  const y = HORIZON_Y - d_v;
  const width_v = (d_v / D_TOP) * TOP_WIDTH;
  
  const x = (adjusted_u - 0.5) * width_v;
  const scale = d_v / D_TOP;
  
  return { x, y, scale };
}
export function tileStagePosition(col: number, row: number, localZ = 0): [number, number, number] {
  const center = perspectiveMap(col + 0.5, row + 0.5);
  return [center.x, center.y + localZ * center.scale, -row * 0.01];
}

export function entityStagePosition(world: any, entity: number, lift = 0): [number, number, number] {
  if (world.draggedEntity === entity && world.dragX !== undefined) {
    return [world.dragX, world.dragY, world.dragZ + lift];
  }
  if (world.posX && world.posY) {
    return [world.posX[entity], world.posY[entity], world.posZ[entity] + lift];
  }
  return slotPosition(world.formationSlot[entity], lift);
}

export function approachTargetPosition(attackerSlot: number, targetSlot: number, lift = 0): [number, number, number] {
  const targetBase = slotPosition(targetSlot, lift + 0.08);
  const direction = isEnemyBoardSlot(attackerSlot) ? 1 : -1;
  return [targetBase[0] + direction * 0.72, targetBase[1], targetBase[2] + 0.15];
}

export function lerpPosition(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * clamped, a[1] + (b[1] - a[1]) * clamped, a[2] + (b[2] - a[2]) * clamped];
}