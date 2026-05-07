import { GRID_COLS } from '../constants';
import { EntityKind, Faction } from '../types';
import { attackEntity, canAttackTarget } from './combat';
import { manhattan } from './grid';
import { moveEntity } from './movement';
import { emitEvent, isAlive, type World } from './world';

export function runPigAi(world: World): void {
  for (let pig = 0; pig < world.nextEntity; pig += 1) {
    if (!isActivePig(world, pig)) continue;
    if (world.stasis[pig] > 0) continue;
    runPigTurn(world, pig);
  }
}

function runPigTurn(world: World, pig: number): void {
  if (tryThiefBehavior(world, pig)) return;
  const target = bestAttackTarget(world, pig);
  if (target >= 0 && attackEntity(world, pig, target)) return;
  moveTowardNearestPlayer(world, pig);
}

function tryThiefBehavior(world: World, pig: number): boolean {
  if (world.unitId[pig] !== 'pig_thief') return false;
  if (world.stolenEgg[pig] === 1) return escapeWithEgg(world, pig);
  const egg = nearestEgg(world, pig);
  if (egg < 0) return false;
  if (canAttackTarget(world, pig, egg)) {
    attackEntity(world, pig, egg);
    if (world.active[egg] === 0) {
      world.stolenEgg[pig] = 1;
      emitEvent(world, { type: 'relic_gained', entity: pig, message: 'Thief Pig stole cracked egg fragments.' });
    }
    return true;
  }
  moveToward(world, pig, world.x[egg], world.y[egg]);
  return true;
}

function escapeWithEgg(world: World, pig: number): boolean {
  if (world.x[pig] >= GRID_COLS - 1) {
    world.active[pig] = 0;
    emitEvent(world, { type: 'unit_destroyed', entity: pig, message: 'Thief Pig escaped with loot.' });
    return true;
  }
  moveEntity(world, pig, world.x[pig] + 1, world.y[pig]);
  return true;
}

function moveTowardNearestPlayer(world: World, pig: number): boolean {
  const target = nearestPlayer(world, pig);
  if (target < 0) return false;
  return moveToward(world, pig, world.x[target], world.y[target]);
}

function moveToward(world: World, entity: number, targetX: number, targetY: number): boolean {
  const candidates = stepCandidates(world, entity, targetX, targetY);
  for (const candidate of candidates) {
    if (moveEntity(world, entity, candidate.x, candidate.y)) return true;
  }
  return false;
}

function stepCandidates(world: World, entity: number, targetX: number, targetY: number): { x: number; y: number }[] {
  const currentX = world.x[entity];
  const currentY = world.y[entity];
  const dx = Math.sign(targetX - currentX);
  const dy = Math.sign(targetY - currentY);
  return [
    { x: currentX + dx, y: currentY },
    { x: currentX, y: currentY + dy },
    { x: currentX, y: currentY - dy },
    { x: currentX - dx, y: currentY },
  ].filter((point) => point.x !== currentX || point.y !== currentY);
}

function bestAttackTarget(world: World, pig: number): number {
  let best = -1;
  let bestHp = Number.MAX_SAFE_INTEGER;
  for (let target = 0; target < world.nextEntity; target += 1) {
    if (!isValidPigTarget(world, target)) continue;
    if (!canAttackTarget(world, pig, target)) continue;
    if (world.hp[target] < bestHp) {
      best = target;
      bestHp = world.hp[target];
    }
  }
  return best;
}

function nearestPlayer(world: World, pig: number): number {
  return nearestEntityByFaction(world, pig, Faction.Player, EntityKind.Unit);
}

function nearestEgg(world: World, pig: number): number {
  return nearestEntityByKind(world, pig, EntityKind.GoldenEgg);
}

function nearestEntityByFaction(world: World, source: number, faction: Faction, kind: EntityKind): number {
  let best = -1;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity) || world.faction[entity] !== faction || world.kind[entity] !== kind) continue;
    const distance = manhattan(world.x[source], world.y[source], world.x[entity], world.y[entity]);
    if (distance < bestDistance) {
      best = entity;
      bestDistance = distance;
    }
  }
  return best;
}

function nearestEntityByKind(world: World, source: number, kind: EntityKind): number {
  let best = -1;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity) || world.kind[entity] !== kind) continue;
    const distance = manhattan(world.x[source], world.y[source], world.x[entity], world.y[entity]);
    if (distance < bestDistance) {
      best = entity;
      bestDistance = distance;
    }
  }
  return best;
}

function isActivePig(world: World, entity: number): boolean {
  return isAlive(world, entity) && world.faction[entity] === Faction.Pig && world.kind[entity] === EntityKind.Unit;
}

function isValidPigTarget(world: World, entity: number): boolean {
  if (!isAlive(world, entity)) return false;
  if (world.faction[entity] === Faction.Player) return true;
  return world.kind[entity] === EntityKind.GoldenEgg;
}
