import { GRID_COLS, GRID_ROWS } from '../constants';
import { TerrainType, TurnSide } from '../types';
import { emitEvent, isAlive, type World } from './world';
import { clearFootprint, footprintFits, getTerrain, isTraversableTile, placeFootprint, setTerrain, terrainMoveCost, tileIndex, tilePoint } from './grid';
import { hasRelic } from './relics';

export function moveEntity(world: World, entity: number, x: number, y: number): boolean {
  if (!canMoveNow(world, entity)) return invalid(world, 'That unit cannot move now.');
  if (!canReach(world, entity, x, y)) return invalid(world, 'Destination is out of movement range.');
  const fromX = world.x[entity];
  const fromY = world.y[entity];
  clearFootprint(world, entity);
  placeFootprint(world, entity, x, y);
  world.moved[entity] = 1;
  world.acted[entity] = 1;
  flattenOldTileIfNeeded(world, entity, fromX, fromY);
  rewardMelodyForDebris(world, entity, x, y);
  emitEvent(world, { type: 'unit_moved', entity, message: `${world.displayName[entity]} moved.` });
  return true;
}

export function canReach(world: World, entity: number, x: number, y: number): boolean {
  if (!footprintFits(world, entity, x, y)) return false;
  const costs = movementCosts(world, entity);
  return costs[tileIndex(x, y)] <= effectiveMove(world, entity);
}

export function movementCosts(world: World, entity: number): Int32Array {
  const costs = new Int32Array(GRID_COLS * GRID_ROWS);
  costs.fill(999);
  floodMove(world, entity, costs);
  return costs;
}

export function resetMovementFlags(world: World, side?: TurnSide): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity)) continue;
    if (side !== undefined && world.faction[entity] !== side) continue;
    resetEntityAction(world, entity);
    applyChargedRestIfNeeded(world, entity, side);
  }
}

export function effectiveMove(world: World, entity: number): number {
  return Math.max(0, world.move[entity] - world.slowed[entity]);
}

export function shoveEntity(world: World, entity: number, dx: number, dy: number): boolean {
  const x = world.x[entity] + dx;
  const y = world.y[entity] + dy;
  if (!isAlive(world, entity) || !footprintFits(world, entity, x, y)) {
    collisionDamage(world, entity);
    return false;
  }
  clearFootprint(world, entity);
  placeFootprint(world, entity, x, y);
  emitEvent(world, { type: 'unit_moved', entity, message: `${world.displayName[entity]} was shoved.` });
  return true;
}

function canMoveNow(world: World, entity: number): boolean {
  return isAlive(world, entity) && world.acted[entity] === 0 && world.stasis[entity] === 0;
}

function resetEntityAction(world: World, entity: number): void {
  world.moved[entity] = 0;
  world.acted[entity] = 0;
}

function applyChargedRestIfNeeded(world: World, entity: number, side?: TurnSide): void {
  if (side === undefined || world.chargeSkip[entity] === 0) return;
  world.chargeSkip[entity] = 0;
  world.moved[entity] = 1;
  world.acted[entity] = 1;
  emitEvent(world, { type: 'charged_attack', entity, message: `${world.displayName[entity]} is recovering from a charged attack.` });
}

function floodMove(world: World, entity: number, costs: Int32Array): void {
  const start = tileIndex(world.x[entity], world.y[entity]);
  const queue = [start];
  costs[start] = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) return;
    expandMoveNode(world, entity, current, costs, queue);
  }
}

function expandMoveNode(world: World, entity: number, index: number, costs: Int32Array, queue: number[]): void {
  const from = tilePoint(index);
  visitMoveNeighbor(world, entity, from.x + 1, from.y, costs[index], costs, queue);
  visitMoveNeighbor(world, entity, from.x - 1, from.y, costs[index], costs, queue);
  visitMoveNeighbor(world, entity, from.x, from.y + 1, costs[index], costs, queue);
  visitMoveNeighbor(world, entity, from.x, from.y - 1, costs[index], costs, queue);
}

function visitMoveNeighbor(
  world: World,
  entity: number,
  x: number,
  y: number,
  baseCost: number,
  costs: Int32Array,
  queue: number[],
): void {
  if (!footprintTraversable(world, entity, x, y)) return;
  const nextCost = baseCost + terrainMoveCost(world, entity, x, y);
  const index = tileIndex(x, y);
  if (nextCost > effectiveMove(world, entity) || nextCost >= costs[index]) return;
  costs[index] = nextCost;
  queue.push(index);
}

function footprintTraversable(world: World, entity: number, x: number, y: number): boolean {
  const width = Math.max(1, world.sizeW[entity]);
  const height = Math.max(1, world.sizeH[entity]);
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      if (!isTraversableTile(world, entity, x + dx, y + dy)) return false;
    }
  }
  return true;
}

function flattenOldTileIfNeeded(world: World, entity: number, x: number, y: number): void {
  if (!hasRelic(world, entity, 'seismic_stomp')) return;
  if (getTerrain(world, x, y) === TerrainType.Plains) return;
  setTerrain(world, x, y, TerrainType.Plains);
  emitEvent(world, { type: 'terrain_changed', message: `${world.displayName[entity]} flattened terrain.` });
}

function rewardMelodyForDebris(world: World, entity: number, x: number, y: number): void {
  if (world.unitId[entity] !== 'melody') return;
  if (getTerrain(world, x, y) !== TerrainType.Plains) return;
  world.star[entity] = Math.min(world.starMax[entity], world.star[entity] + 2);
}

function collisionDamage(world: World, entity: number): void {
  world.hp[entity] = Math.max(0, world.hp[entity] - 2);
  emitEvent(world, { type: 'unit_damaged', entity, message: `${world.displayName[entity]} slammed into an obstacle.` });
}

function invalid(world: World, message: string): false {
  emitEvent(world, { type: 'invalid_action', message });
  return false;
}
