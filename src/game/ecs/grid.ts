import { GRID_COLS, GRID_ROWS, TILE_COUNT } from '../constants';
import { EntityKind, Faction, TerrainType } from '../types';
import type { World } from './world';

export type GridPoint = { x: number; y: number };

export function tileIndex(x: number, y: number): number {
  return y * GRID_COLS + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function tileCenterX(world: World, entity: number): number {
  return world.x[entity] + Math.floor(world.sizeW[entity] / 2);
}

export function tileCenterY(world: World, entity: number): number {
  return world.y[entity] + Math.floor(world.sizeH[entity] / 2);
}

export function getOccupant(world: World, x: number, y: number): number {
  if (!inBounds(x, y)) return -1;
  return world.gridOccupant[tileIndex(x, y)];
}

export function setOccupant(world: World, x: number, y: number, entity: number): void {
  if (inBounds(x, y)) {
    world.gridOccupant[tileIndex(x, y)] = entity;
  }
}

export function getTerrain(world: World, x: number, y: number): TerrainType {
  if (!inBounds(x, y)) return TerrainType.Plains;
  return world.gridTerrain[tileIndex(x, y)] as TerrainType;
}

export function setTerrain(world: World, x: number, y: number, terrain: TerrainType): void {
  if (inBounds(x, y)) {
    world.gridTerrain[tileIndex(x, y)] = terrain;
    if (terrain !== TerrainType.MedicTent) {
      world.gridOwner[tileIndex(x, y)] = Faction.None;
      world.gridCapture[tileIndex(x, y)] = 0;
    }
  }
}

export function getTileOwner(world: World, x: number, y: number): Faction {
  if (!inBounds(x, y)) return Faction.None;
  return world.gridOwner[tileIndex(x, y)] as Faction;
}

export function setTileOwner(world: World, x: number, y: number, owner: Faction): void {
  if (inBounds(x, y)) world.gridOwner[tileIndex(x, y)] = owner;
}

export function clearFootprint(world: World, entity: number): void {
  forEachFootprintTile(world, entity, world.x[entity], world.y[entity], (x, y) => {
    if (getOccupant(world, x, y) === entity) setOccupant(world, x, y, -1);
  });
}

export function placeFootprint(world: World, entity: number, x: number, y: number): void {
  world.x[entity] = x;
  world.y[entity] = y;
  forEachFootprintTile(world, entity, x, y, (tileX, tileY) => setOccupant(world, tileX, tileY, entity));
}

export function footprintFits(world: World, entity: number, x: number, y: number): boolean {
  let fits = true;
  forEachFootprintTile(world, entity, x, y, (tileX, tileY) => {
    fits = fits && isEnterableTile(world, entity, tileX, tileY);
  });
  return fits;
}

export function forEachFootprintTile(
  world: World,
  entity: number,
  x: number,
  y: number,
  visit: (tileX: number, tileY: number) => void,
): void {
  const width = Math.max(1, world.sizeW[entity]);
  const height = Math.max(1, world.sizeH[entity]);
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      visit(x + dx, y + dy);
    }
  }
}

export function isEnterableTile(world: World, entity: number, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  if (getTerrain(world, x, y) === TerrainType.Barricade) return false;
  const occupant = getOccupant(world, x, y);
  return occupant === -1 || occupant === entity;
}

export function isTraversableTile(world: World, entity: number, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  if (getTerrain(world, x, y) === TerrainType.Barricade) return false;
  const occupant = getOccupant(world, x, y);
  return occupant === -1 || occupant === entity || canPassThrough(world, entity, occupant);
}

export function terrainDefenseStars(world: World, entity: number): number {
  let best = 0;
  forEachFootprintTile(world, entity, world.x[entity], world.y[entity], (x, y) => {
    best = Math.max(best, terrainDefense(getTerrain(world, x, y)));
  });
  return best;
}

export function terrainMoveCost(world: World, entity: number, x: number, y: number): number {
  if (world.unitId[entity] === 'chuck') return 1;
  if (world.unitId[entity] === 'matilda') return 1;
  return getTerrain(world, x, y) === TerrainType.Trench ? 2 : 1;
}

export function blocksLineOfSight(world: World, x: number, y: number, attacker: number, target: number): boolean {
  const occupant = getOccupant(world, x, y);
  if (occupant === -1 || occupant === attacker || occupant === target) return false;
  if (world.airborne[occupant] > 0) return false;
  return world.kind[occupant] !== EntityKind.Projectile;
}

export function lineOfSightClear(world: World, attacker: number, target: number): boolean {
  const ax = tileCenterX(world, attacker);
  const ay = tileCenterY(world, attacker);
  const tx = tileCenterX(world, target);
  const ty = tileCenterY(world, target);
  if (ax !== tx && ay !== ty) return false;
  const stepX = Math.sign(tx - ax);
  const stepY = Math.sign(ty - ay);
  let x = ax + stepX;
  let y = ay + stepY;
  while (x !== tx || y !== ty) {
    if (blocksLineOfSight(world, x, y, attacker, target)) return false;
    x += stepX;
    y += stepY;
  }
  return true;
}

export function adjacentEnemies(world: World, entity: number): number[] {
  const result: number[] = [];
  forEachNeighbor(world.x[entity], world.y[entity], (x, y) => {
    const occupant = getOccupant(world, x, y);
    if (isEnemy(world, entity, occupant)) result.push(occupant);
  });
  return Array.from(new Set(result));
}

export function isEnemy(world: World, source: number, target: number): boolean {
  if (target < 0 || world.active[target] !== 1) return false;
  const sourceFaction = world.faction[source] as Faction;
  const targetFaction = world.faction[target] as Faction;
  if (targetFaction === Faction.Prop) return true;
  return sourceFaction !== targetFaction && targetFaction !== Faction.None;
}

export function forEachNeighbor(x: number, y: number, visit: (x: number, y: number) => void): void {
  visit(x + 1, y);
  visit(x - 1, y);
  visit(x, y + 1);
  visit(x, y - 1);
}

export function allTileIndexes(): number[] {
  return Array.from({ length: TILE_COUNT }, (_, index) => index);
}

export function tilePoint(index: number): GridPoint {
  return { x: index % GRID_COLS, y: Math.floor(index / GRID_COLS) };
}

function terrainDefense(terrain: TerrainType): number {
  if (terrain === TerrainType.Trench) return 3;
  if (terrain === TerrainType.Watchtower) return 0;
  if (terrain === TerrainType.Barricade) return 4;
  if (terrain === TerrainType.MedicTent) return 1;
  return 0;
}

function canPassThrough(world: World, entity: number, occupant: number): boolean {
  if (occupant < 0) return true;
  if (world.unitId[entity] !== 'hal') return false;
  return world.faction[occupant] === Faction.Pig;
}

export function footprintEdgeDistance(world: World, a: number, b: number): number {
  const dx = Math.max(0, Math.abs(world.posX[a] - world.posX[b]) - footprintHalfWidth(world, a) - footprintHalfWidth(world, b));
  const dy = Math.max(0, Math.abs(world.posY[a] - world.posY[b]) - footprintHalfHeight(world, a) - footprintHalfHeight(world, b));
  return Math.hypot(dx, dy);
}

function footprintHalfWidth(world: World, entity: number): number {
  return 0.26 * Math.max(1, world.sizeW[entity]) * (1 + Math.max(0, world.starTier[entity] - 1) * 0.18);
}

function footprintHalfHeight(world: World, entity: number): number {
  return 0.2 * Math.max(1, world.sizeH[entity]) * (1 + Math.max(0, world.starTier[entity] - 1) * 0.18);
}
