import { GRID_GROUP_POSITION, GRID_TILT_X, TILE_SIZE, X_OFFSET, Y_OFFSET } from '../game/constants';
import { gridStagePosition, slotPosition } from '../game/formationSlots';

export { GRID_GROUP_POSITION, GRID_TILT_X } from '../game/constants';
export const GRID_OPACITY = 0.2;

export function worldX(logicalX: number): number {
  return logicalX * TILE_SIZE - X_OFFSET;
}

export function worldY(logicalY: number): number {
  return Y_OFFSET - logicalY * TILE_SIZE;
}

export function tileGridPosition(x: number, y: number, localZ = 0): [number, number, number] {
  return [worldX(x), worldY(y), localZ];
}

export function tileWorldPosition(x: number, y: number, localZ = 0): [number, number, number] {
  return applyGridTilt(tileGridPosition(x, y, localZ));
}

export function spriteWorldPosition(x: number, y: number, localZ = 0.38): [number, number, number] {
  return gridStagePosition(x, y, localZ);
}

export function slotWorldPosition(slot: number, lift = 0): [number, number, number] {
  return slotPosition(slot, lift);
}

export function slotStagePosition(slot: number, lift = 0): [number, number, number] {
  return slotWorldPosition(slot, lift);
}

export function entityStagePosition(world: any, entity: number, lift = 0): [number, number, number] {
  if (world.draggedEntity === entity && world.dragX !== undefined) {
    return [world.dragX, world.dragY, world.dragZ + lift];
  }
  if (world.posX && world.posY) return [world.posX[entity], world.posY[entity], world.posZ[entity] + lift];
  return slotWorldPosition(world.formationSlot[entity], lift);
}

export function approachTargetPosition(attackerSlot: number, targetSlot: number, lift = 0): [number, number, number] {
  const targetBase = slotWorldPosition(targetSlot, lift + 0.08);
  const direction = attackerSlot >= 20 ? 1 : -1;
  return [targetBase[0] + direction * 0.72, targetBase[1], targetBase[2] + 0.15];
}

export function lerpPosition(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * clamped, a[1] + (b[1] - a[1]) * clamped, a[2] + (b[2] - a[2]) * clamped];
}

function applyGridTilt([x, y, z]: [number, number, number]): [number, number, number] {
  const tiltedY = y * Math.cos(GRID_TILT_X) - z * Math.sin(GRID_TILT_X);
  const tiltedZ = y * Math.sin(GRID_TILT_X) + z * Math.cos(GRID_TILT_X);
  return [x + GRID_GROUP_POSITION[0], tiltedY + GRID_GROUP_POSITION[1], tiltedZ + GRID_GROUP_POSITION[2]];
}
