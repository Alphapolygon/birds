import { GRID_COLS, GRID_ROWS } from '../constants';
import { EntityKind, Faction, TerrainType } from '../types';
import { allocateEntity, emitEvent, isAlive, type World } from './world';
import { playSpecialEffect } from './animation';
import { dealDirectDamage } from './combat';
import { applyAirborne, applyStasis } from './status';
import { clearFootprint, footprintFits, getOccupant, inBounds, placeFootprint, setTerrain } from './grid';
import { shoveEntity } from './movement';

const enum DelayedStarKind {
  None = 0,
  SilverCrash = 1,
  BubblesReset = 2,
}

// Helper: Accurately calculates distance between the closest edges of giant multi-tile units
export function footprintDistance(world: World, a: number, b: number): number {
  const aL = world.x[a], aR = world.x[a] + Math.max(1, world.sizeW[a]) - 1;
  const aT = world.y[a], aB = world.y[a] + Math.max(1, world.sizeH[a]) - 1;
  const bL = world.x[b], bR = world.x[b] + Math.max(1, world.sizeW[b]) - 1;
  const bT = world.y[b], bB = world.y[b] + Math.max(1, world.sizeH[b]) - 1;
  const dx = aR < bL ? bL - aR : aL > bR ? aL - bR : 0;
  const dy = aB < bT ? bT - aB : aT > bB ? aT - bB : 0;
  return dx + dy;
}

export function useStarPower(world: World, entity: number): boolean {
  if (!canUseStarPower(world, entity)) return invalid(world, 'Star Meter is not ready.');
  const target = nearestEnemy(world, entity);
  playSpecialEffect(world, entity);
  resolveStarPower(world, entity, target);
  
  // Spend the mana
  world.star[entity] = 0;
  
  emitEvent(world, { type: 'star_power', entity, message: `${world.displayName[entity]} used a Star Power.` });
  return true;
}

export function tickStarPowerDelays(world: World): void {
  detonateDelayedBombs(world);
  resolveSilverCrashes(world);
  resetExpandedBubbles(world);
}

function resolveStarPower(world: World, entity: number, target: number): void {
  const id = world.unitId[entity];
  if (id === 'red') redBattleCry(world, entity);
  else if (id === 'chuck') chuckOverdrive(world, entity);
  else if (id === 'terence') terenceBulldozer(world, entity);
  else if (id === 'silver') silverLoop(world, entity, target);
  else if (id === 'bomb') plantDelayedNuke(world, entity, target);
  else if (id === 'matilda') matildaDropRetreat(world, entity, target);
  else if (id === 'hal') halSnatch(world, entity);
  else if (id === 'stella') stellaBubble(world, target);
  else if (id === 'blues') bluesScatter(world, entity, target);
  else if (id === 'bubbles') bubblesExpansion(world, entity);
  else if (id === 'melody') melodyDebrisBarrage(world, entity);
}

function redBattleCry(world: World, entity: number): void {
  forEachEnemyInBox(world, world.x[entity], world.y[entity], 1, (target) => {
    dealDirectDamage(world, entity, target, 4);
    shoveEntity(world, target, 1, 0);
  });
}

function chuckOverdrive(world: World, entity: number): void {
  let hits = 0;
  let lastHitX = world.x[entity];
  for (let x = world.x[entity] + 1; x < GRID_COLS && hits < 3; x += 1) {
    const target = getOccupant(world, x, world.y[entity]);
    if (target >= 0 && world.faction[target] === Faction.Pig) {
      dealDirectDamage(world, entity, target, 6);
      hits += 1;
      lastHitX = x;
    }
  }
  teleportIfPossible(world, entity, Math.min(GRID_COLS - 1, lastHitX + 1), world.y[entity]);
}

function terenceBulldozer(world: World, entity: number): void {
  for (let step = 0; step < 3; step += 1) {
    const nextX = world.x[entity] + 1;
    crushBlockingTiles(world, entity, nextX, world.y[entity]);
    if (!footprintFits(world, entity, nextX, world.y[entity])) break;
    teleportIfPossible(world, entity, nextX, world.y[entity]);
  }
}

function silverLoop(world: World, entity: number, target: number): void {
  if (target < 0) return;
  world.delayedKind[entity] = DelayedStarKind.SilverCrash;
  world.pendingX[entity] = world.x[target];
  world.pendingY[entity] = world.y[target];
  clearFootprint(world, entity);
  applyAirborne(world, entity, 1);
  emitEvent(world, { type: 'star_power', entity, message: `${world.displayName[entity]} looped into the sky and will crash down soon.` });
}

function plantDelayedNuke(world: World, entity: number, target: number): void {
  if (target < 0) return;
  const point = delayedBombPoint(world, world.x[target], world.y[target]);
  if (!point) return;
  const bomb = allocateEntity(world);
  world.kind[bomb] = EntityKind.DelayedBomb;
  world.faction[bomb] = Faction.Player;
  world.displayName[bomb] = 'Delayed Nuke';
  world.spriteKey[bomb] = 'projectile';
  world.maxHp[bomb] = 4;
  world.hp[bomb] = 4;
  world.defense[bomb] = 0;
  world.delayedOwner[bomb] = entity;
  placeFootprint(world, bomb, point.x, point.y);
  emitEvent(world, { type: 'star_power', entity: bomb, message: `${world.displayName[entity]} planted a delayed nuke.` });
}

function matildaDropRetreat(world: World, entity: number, target: number): void {
  if (target < 0) return;
  world.defense[target] = 0;
  dealDirectDamage(world, entity, target, 6);
  teleportIfPossible(world, entity, Math.max(0, world.x[entity] - 2), world.y[entity]);
}

function halSnatch(world: World, entity: number): void {
  const target = furthestEnemyInRow(world, entity);
  if (target < 0) return;
  const frontX = world.x[entity] + 1;
  if (!footprintFits(world, target, frontX, world.y[entity])) return;
  clearFootprint(world, target);
  placeFootprint(world, target, frontX, world.y[entity]);
  dealDirectDamage(world, entity, target, 5);
}

function stellaBubble(world: World, target: number): void {
  if (target >= 0) applyStasis(world, target, 2);
}

function bluesScatter(world: World, entity: number, target: number): void {
  if (target < 0) return;
  const x = world.x[target];
  const y = world.y[target];
  damageTile(world, entity, x, y, 5);
  damageTile(world, entity, x, y - 1, 3);
  damageTile(world, entity, x, y + 1, 3);
}

function bubblesExpansion(world: World, entity: number): void {
  const originalX = world.x[entity];
  const originalY = world.y[entity];
  const originY = Math.max(0, Math.min(GRID_ROWS - 3, originalY - 1));
  clearFootprint(world, entity);
  world.sizeH[entity] = 3;
  if (!footprintFits(world, entity, originalX, originY)) {
    world.sizeH[entity] = 1;
    placeFootprint(world, entity, originalX, originalY);
    emitEvent(world, { type: 'invalid_action', entity, message: 'Bubbles has no room to expand.' });
    return;
  }
  placeFootprint(world, entity, originalX, originY);
  world.guard[entity] = 1;
  world.expanded[entity] = 1;
  world.delayedKind[entity] = DelayedStarKind.BubblesReset;
  world.pendingX[entity] = originalX;
  world.pendingY[entity] = originalY;
  emitEvent(world, { type: 'terrain_changed', entity, message: 'Bubbles inflated into a 1x3 wall!' });
}

function melodyDebrisBarrage(world: World, entity: number): void {
  const barricade = nearestKind(world, entity, EntityKind.Barricade);
  if (barricade >= 0) dealDirectDamage(world, entity, barricade, 99);
  const shots = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < shots; i += 1) {
    const target = randomPig(world);
    if (target >= 0) dealDirectDamage(world, entity, target, 3);
  }
}

function detonateDelayedBombs(world: World): void {
  for (let bomb = 0; bomb < world.nextEntity; bomb += 1) {
    if (!isAlive(world, bomb) || world.kind[bomb] !== EntityKind.DelayedBomb) continue;
    detonateDelayedBomb(world, bomb);
  }
}

function detonateDelayedBomb(world: World, bomb: number): void {
  const owner = world.delayedOwner[bomb];
  const x = world.x[bomb];
  const y = world.y[bomb];
  playSpecialEffect(world, bomb);
  damagePlusPattern(world, owner >= 0 ? owner : bomb, x, y, 8);
  clearTerrainPlusPattern(world, x, y);
  clearFootprint(world, bomb);
  world.active[bomb] = 0;
  emitEvent(world, { type: 'star_power', entity: bomb, message: 'Delayed Nuke detonated!' });
}

function resolveSilverCrashes(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity) || world.delayedKind[entity] !== DelayedStarKind.SilverCrash) continue;
    resolveSilverCrash(world, entity);
  }
}

function resolveSilverCrash(world: World, entity: number): void {
  const x = world.pendingX[entity];
  const y = world.pendingY[entity];
  damageTile(world, entity, x, y, 10);
  landNearTile(world, entity, x, y);
  world.airborne[entity] = 0;
  world.delayedKind[entity] = DelayedStarKind.None;
  playSpecialEffect(world, entity);
  emitEvent(world, { type: 'star_power', entity, message: `${world.displayName[entity]} crashed down!` });
}

function resetExpandedBubbles(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity) || world.delayedKind[entity] !== DelayedStarKind.BubblesReset) continue;
    resetBubbles(world, entity);
  }
}

function resetBubbles(world: World, entity: number): void {
  const x = world.pendingX[entity];
  const y = world.pendingY[entity];
  clearFootprint(world, entity);
  world.sizeH[entity] = 1;
  world.expanded[entity] = 0;
  world.delayedKind[entity] = DelayedStarKind.None;
  placeEntityAtPreferredTile(world, entity, x, y);
  emitEvent(world, { type: 'terrain_changed', entity, message: 'Bubbles deflated back to normal size.' });
}

function damagePlusPattern(world: World, entity: number, x: number, y: number, damage: number): void {
  damageTile(world, entity, x, y, damage);
  damageTile(world, entity, x + 1, y, damage);
  damageTile(world, entity, x - 1, y, damage);
  damageTile(world, entity, x, y + 1, damage);
  damageTile(world, entity, x, y - 1, damage);
}

function clearTerrainPlusPattern(world: World, x: number, y: number): void {
  setPlusTerrain(world, x, y, TerrainType.Plains);
  setPlusTerrain(world, x + 1, y, TerrainType.Plains);
  setPlusTerrain(world, x - 1, y, TerrainType.Plains);
  setPlusTerrain(world, x, y + 1, TerrainType.Plains);
  setPlusTerrain(world, x, y - 1, TerrainType.Plains);
}

function setPlusTerrain(world: World, x: number, y: number, terrain: TerrainType): void {
  if (inBounds(x, y)) setTerrain(world, x, y, terrain);
}

function damageTile(world: World, entity: number, x: number, y: number, damage: number): void {
  if (!inBounds(x, y)) return;
  const target = getOccupant(world, x, y);
  if (target >= 0 && world.faction[target] !== world.faction[entity]) dealDirectDamage(world, entity, target, damage);
}

function crushBlockingTiles(world: World, entity: number, x: number, y: number): void {
  const target = getOccupant(world, x, y);
  if (target < 0 || target === entity) return;
  if (world.kind[target] === EntityKind.Barricade) dealDirectDamage(world, entity, target, 99);
  if (world.faction[target] === Faction.Pig) {
    shoveEntity(world, target, 1, 0);
    applyStasis(world, target, 1);
  }
}

function teleportIfPossible(world: World, entity: number, x: number, y: number): void {
  if (!footprintFits(world, entity, x, y)) return;
  clearFootprint(world, entity);
  placeFootprint(world, entity, x, y);
}

function landNearTile(world: World, entity: number, x: number, y: number): void {
  clearFootprint(world, entity);
  placeEntityAtPreferredTile(world, entity, x, y);
}

function placeEntityAtPreferredTile(world: World, entity: number, x: number, y: number): void {
  if (footprintFits(world, entity, x, y)) {
    placeFootprint(world, entity, x, y);
    return;
  }
  const point = nearestFreePoint(world, entity, x, y);
  if (point) placeFootprint(world, entity, point.x, point.y);
}

function delayedBombPoint(world: World, x: number, y: number): { x: number; y: number } | null {
  const probe = allocateEntity(world);
  world.kind[probe] = EntityKind.DelayedBomb;
  const point = nearestFreePoint(world, probe, x, y);
  world.active[probe] = 0;
  return point;
}

function nearestFreePoint(world: World, entity: number, x: number, y: number): { x: number; y: number } | null {
  const candidates = [
    { x, y },
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
    { x: x - 1, y: y - 1 },
    { x: x - 1, y: y + 1 },
  ];
  return candidates.find((point) => footprintFits(world, entity, point.x, point.y)) ?? null;
}

function forEachEnemyInBox(world: World, x: number, y: number, radius: number, visit: (target: number) => void): void {
  const visited = new Set<number>();
  for (let tileY = y - radius; tileY <= y + radius; tileY += 1) {
    for (let tileX = x - radius; tileX <= x + radius; tileX += 1) {
      const target = inBounds(tileX, tileY) ? getOccupant(world, tileX, tileY) : -1;
      if (target >= 0 && !visited.has(target) && world.faction[target] === Faction.Pig) {
        visited.add(target);
        visit(target);
      }
    }
  }
}

function nearestEnemy(world: World, entity: number): number {
  let best = -1;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  for (let target = 0; target < world.nextEntity; target += 1) {
    if (!isAlive(world, target) || world.faction[target] === world.faction[entity] || world.faction[target] === Faction.Prop) continue;
    const distance = footprintDistance(world, entity, target);
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

function nearestKind(world: World, entity: number, kind: EntityKind): number {
  let best = -1;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  for (let target = 0; target < world.nextEntity; target += 1) {
    if (!isAlive(world, target) || world.kind[target] !== kind) continue;
    const distance = footprintDistance(world, entity, target);
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

function furthestEnemyInRow(world: World, entity: number): number {
  for (let x = GRID_COLS - 1; x > world.x[entity]; x -= 1) {
    const target = getOccupant(world, x, world.y[entity]);
    if (target >= 0 && world.faction[target] === Faction.Pig) return target;
  }
  return -1;
}

function randomPig(world: World): number {
  const pigs: number[] = [];
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (isAlive(world, entity) && world.faction[entity] === Faction.Pig) pigs.push(entity);
  }
  return pigs[Math.floor(Math.random() * pigs.length)] ?? -1;
}

// THE FIX: Star Powers can be cast freely in Auto-Chess without waiting for Mario RPG turns to end!
function canUseStarPower(world: World, entity: number): boolean {
  return isAlive(world, entity) && world.starMax[entity] > 0 && world.star[entity] >= world.starMax[entity] && world.stasis[entity] === 0 && world.airborne[entity] === 0;
}

function invalid(world: World, message: string): false {
  emitEvent(world, { type: 'invalid_action', message });
  return false;
}