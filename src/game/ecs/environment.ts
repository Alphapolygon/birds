import { GRID_COLS, GRID_ROWS, TILE_COUNT } from '../constants';
import { BossRule, EntityKind, TerrainType } from '../types';
import { emitEvent, isAlive, type World } from './world';
import { clearFootprint, footprintFits, getOccupant, placeFootprint, setTerrain, tileIndex } from './grid';
import { hasRelic } from './relics';

export function runEnvironmentalSystem(world: World): void {
  pullEggsByGoldenMagnet(world);
  if (world.bossRule === BossRule.ShiftingLanes) shiftRows(world);
  if (world.bossRule === BossRule.GravityVacuum) applyGravityVacuum(world);
}

function pullEggsByGoldenMagnet(world: World): void {
  for (let carrier = 0; carrier < world.nextEntity; carrier += 1) {
    if (!isAlive(world, carrier) || !hasRelic(world, carrier, 'golden_magnet')) continue;
    pullEggsInRow(world, carrier);
  }
}

function pullEggsInRow(world: World, carrier: number): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1 || world.kind[entity] !== EntityKind.GoldenEgg) continue;
    if (world.y[entity] !== world.y[carrier]) continue;
    moveEggLeft(world, entity);
  }
}

function moveEggLeft(world: World, egg: number): void {
  const nextX = world.x[egg] - 1;
  if (!footprintFits(world, egg, nextX, world.y[egg])) return;
  clearFootprint(world, egg);
  placeFootprint(world, egg, nextX, world.y[egg]);
  emitEvent(world, { type: 'unit_moved', entity: egg, message: 'Golden Magnet pulled an egg left.' });
}

function shiftRows(world: World): void {
  const nextTerrain = new Uint8Array(TILE_COUNT);
  const nextOwner = new Uint8Array(TILE_COUNT);
  const nextCapture = new Uint8Array(TILE_COUNT);
  for (let y = 0; y < GRID_ROWS; y += 1) shiftOneRow(world, y, nextTerrain, nextOwner, nextCapture);
  world.gridTerrain.set(nextTerrain);
  world.gridOwner.set(nextOwner);
  world.gridCapture.set(nextCapture);
  emitEvent(world, { type: 'terrain_changed', message: 'Architect Pig shifted the lanes.' });
}

function shiftOneRow(world: World, y: number, nextTerrain: Uint8Array, nextOwner: Uint8Array, nextCapture: Uint8Array): void {
  const dir = y % 2 === 0 ? 1 : -1;
  for (let x = 0; x < GRID_COLS; x += 1) {
    const nextX = (x + dir + GRID_COLS) % GRID_COLS;
    const from = tileIndex(x, y);
    const to = tileIndex(nextX, y);
    const terrain = world.gridTerrain[from];
    nextTerrain[to] = terrain === TerrainType.Barricade ? TerrainType.Plains : terrain;
    nextOwner[to] = terrain === TerrainType.Barricade ? 0 : world.gridOwner[from];
    nextCapture[to] = terrain === TerrainType.Barricade ? 0 : world.gridCapture[from];
  }
}

function applyGravityVacuum(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity) || world.kind[entity] !== EntityKind.Unit) continue;
    vacuumEntity(world, entity);
  }
  emitEvent(world, { type: 'unit_moved', message: 'Gluttonous Duke pulled everything right.' });
}

function vacuumEntity(world: World, entity: number): void {
  const nextX = world.x[entity] + 1;
  if (nextX >= GRID_COLS) {
    world.hp[entity] = 0;
    return;
  }
  if (!footprintFits(world, entity, nextX, world.y[entity])) return;
  clearFootprint(world, entity);
  placeFootprint(world, entity, nextX, world.y[entity]);
}

export function tryBouncyMiss(world: World, attacker: number, ignoredTarget = -1): number {
  if (world.bossRule !== BossRule.BouncyGrid) return -1;
  const target = bouncedRowTarget(world, attacker, ignoredTarget);
  if (target < 0) return -1;
  emitEvent(world, { type: 'terrain_changed', entity: attacker, message: `Royal Alchemist bounced ${world.displayName[attacker]}'s shot back across the grid.` });
  return target;
}

function bouncedRowTarget(world: World, attacker: number, ignoredTarget: number): number {
  const scanRightToLeft = world.faction[attacker] !== 2;
  const start = scanRightToLeft ? GRID_COLS - 1 : 0;
  const end = scanRightToLeft ? -1 : GRID_COLS;
  const step = scanRightToLeft ? -1 : 1;
  for (let x = start; x !== end; x += step) {
    const occupant = getOccupant(world, x, world.y[attacker]);
    if (isBouncyTarget(world, attacker, occupant, ignoredTarget)) return occupant;
  }
  return -1;
}

function isBouncyTarget(world: World, attacker: number, target: number, ignoredTarget: number): boolean {
  if (target < 0 || target === attacker || target === ignoredTarget) return false;
  if (!isAlive(world, target)) return false;
  return world.faction[target] !== world.faction[attacker];
}
