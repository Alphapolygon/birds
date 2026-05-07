import { GRID_COLS } from '../constants';
import { EntityKind, Faction, TerrainType } from '../types';
import { RELIC_BITS } from '../relicCatalog';
import { tryBouncyMiss } from './environment';
import { UNIT_CATALOG } from '../unitCatalog';
import { playAttackAnimation, playHitAnimation, playShieldAnimation } from './animation';
import { emitEvent, isAlive, type World } from './world';
import {
  adjacentEnemies,
  clearFootprint,
  getOccupant,
  getTerrain,
  isEnemy,
  lineOfSightClear,
  manhattan,
  setTerrain,
  terrainDefenseStars,
  tileCenterX,
  tileCenterY,
} from './grid';
import { attackBonusFromRelics, grantRelicBit, hasRelic, healFromLeech, preventIndirectDamage } from './relics';
import { shoveEntity } from './movement';

const CHARGED_ATTACK_MULTIPLIER = 2;
const SHIELD_BLOCK_CHANCE = 0.65;
const SHIELD_DAMAGE_REDUCTION = 4;

export function attackEntity(world: World, attacker: number, target: number): boolean {
  return performAttack(world, attacker, target, 1);
}

export function chargedAttackEntity(world: World, attacker: number, target: number): boolean {
  const attacked = performAttack(world, attacker, target, CHARGED_ATTACK_MULTIPLIER);
  if (!attacked) return false;
  world.chargeSkip[attacker] = 1;
  emitEvent(world, { type: 'charged_attack', entity: attacker, message: `${world.displayName[attacker]} will rest next round after charging the attack.` });
  return true;
}

export function shieldEntity(world: World, entity: number): boolean {
  if (!canUseActionNow(world, entity)) return invalid(world, 'That unit cannot shield now.');
  world.guard[entity] = 1;
  world.moved[entity] = 1;
  world.acted[entity] = 1;
  playShieldAnimation(world, entity);
  emitEvent(world, { type: 'unit_shielded', entity, message: `${world.displayName[entity]} raised a shield for the next attack.` });
  return true;
}

export function canAttackTarget(world: World, attacker: number, target: number): boolean {
  if (!isAlive(world, attacker) || !isAlive(world, target)) return false;
  if (!isEnemy(world, attacker, target)) return false;
  if (world.airborne[target] > 0) return false;
  if (!rangeAllowsAttack(world, attacker, target)) return false;
  if (isIndirectAttack(world, attacker, target) && adjacentEnemies(world, attacker).length > 0) return false;
  return lineOfSightClear(world, attacker, target) || spectralMeleeReach(world, attacker, target);
}

export function dealDirectDamage(world: World, attacker: number, target: number, amount: number): void {
  applyDamage(world, attacker, target, amount, false);
  cleanupDeadEntity(world, target, attacker);
}

export function cleanupDeadEntities(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] === 1 && world.hp[entity] <= 0) cleanupDeadEntity(world, entity);
  }
}

export function playerUnitsAlive(world: World): number {
  return countActiveByFaction(world, Faction.Player);
}

export function pigUnitsAlive(world: World): number {
  return countActiveByFaction(world, Faction.Pig);
}

function performAttack(world: World, attacker: number, target: number, powerMultiplier: number): boolean {
  if (!canAttackNow(world, attacker)) return invalid(world, 'That unit cannot attack now.');
  if (!canAttackTarget(world, attacker, target)) return invalid(world, 'Target is not attackable.');
  const isIndirect = isIndirectAttack(world, attacker, target);
  const usedBrimstone = hasRelic(world, attacker, 'brimstone_feather');
  playAttackAnimation(world, attacker, target, powerMultiplier > 1);
  if (usedBrimstone) brimstoneAttack(world, attacker, target, powerMultiplier);
  else resolveSingleHit(world, attacker, target, false, powerMultiplier);
  if (isIndirect && !usedBrimstone) triggerBouncyGrid(world, attacker, target, powerMultiplier);
  world.moved[attacker] = 1;
  world.acted[attacker] = 1;
  afterAttack(world, attacker, target);
  return true;
}

function resolveSingleHit(world: World, attacker: number, target: number, isSplash: boolean, powerMultiplier = 1, forceIndirect = false): number {
  const isIndirect = forceIndirect || isIndirectAttack(world, attacker, target);
  if (preventIndirectDamage(world, target, isIndirect)) {
    emitEvent(world, { type: 'unit_damaged', entity: target, message: `${world.displayName[target]}'s Orbiting Fly blocked the shot.` });
    return 0;
  }
  if (bubblesDodges(world, target, isIndirect)) {
    emitEvent(world, { type: 'unit_damaged', entity: target, message: `${world.displayName[target]} evaded the indirect shot.` });
    return 0;
  }
  const damage = computeDamage(world, attacker, target, isSplash, powerMultiplier);
  const dealt = applyDamage(world, attacker, target, damage, isIndirect);
  handleOnHitEffects(world, attacker, target, dealt, isIndirect);
  cleanupDeadEntity(world, target, attacker);
  counterIfNeeded(world, attacker, target, dealt, isIndirect);
  splashIfNeeded(world, attacker, target, dealt, powerMultiplier);
  return dealt;
}

function bubblesDodges(world: World, target: number, isIndirect: boolean): boolean {
  return isIndirect && world.unitId[target] === 'bubbles' && Math.random() < 0.3;
}

function computeDamage(world: World, attacker: number, target: number, isSplash: boolean, powerMultiplier = 1): number {
  const attack = baseAttack(world, attacker, target, isSplash, powerMultiplier);
  const defense = totalDefense(world, attacker, target);
  return Math.max(1, attack - defense);
}

function baseAttack(world: World, attacker: number, target: number, isSplash: boolean, powerMultiplier: number): number {
  let attack = world.attack[attacker] + attackBonusFromRelics(world, attacker);
  if (world.unitId[attacker] === 'silver' && getTerrain(world, targetX(world, target), targetY(world, target)) === TerrainType.Trench) {
    attack = Math.ceil(attack * 1.5);
  }
  if (world.unitId[attacker] === 'blues' && world.defense[target] === 0) {
    attack = Math.ceil(attack * 1.15);
  }
  attack = Math.ceil(attack * powerMultiplier);
  if (isSplash) attack = Math.max(1, Math.floor(attack * 0.25));
  return attack;
}

function totalDefense(world: World, attacker: number, target: number): number {
  let defense = world.defense[target] + terrainDefenseStars(world, target);
  defense += redAuraDefense(world, target);
  defense += barricadeCover(world, attacker, target);
  return defense;
}

function applyDamage(world: World, attacker: number, target: number, damage: number, isIndirect: boolean): number {
  if (!isAlive(world, target)) return 0;
  const finalDamage = shieldAdjustedDamage(world, target, damage);
  if (finalDamage <= 0) return 0;
  const before = world.hp[target];
  playHitAnimation(world, target);
  world.hp[target] = Math.max(0, world.hp[target] - finalDamage);
  const dealt = before - world.hp[target];
  addStar(world, attacker, dealt);
  addStar(world, target, Math.ceil(dealt / 2));
  emitDamageEvent(world, attacker, target, dealt, isIndirect);
  return dealt;
}

function shieldAdjustedDamage(world: World, target: number, damage: number): number {
  if (world.guard[target] === 0) return damage;
  world.guard[target] = 0;
  playShieldAnimation(world, target);
  if (Math.random() < SHIELD_BLOCK_CHANCE) {
    emitEvent(world, { type: 'unit_shielded', entity: target, message: `${world.displayName[target]} blocked the attack.` });
    return 0;
  }
  emitEvent(world, { type: 'unit_shielded', entity: target, message: `${world.displayName[target]}'s shield softened the hit.` });
  return Math.max(1, damage - SHIELD_DAMAGE_REDUCTION);
}

function handleOnHitEffects(world: World, attacker: number, target: number, damage: number, isIndirect: boolean): void {
  if (damage <= 0) return;
  if (world.unitId[attacker] === 'stella') world.slowed[target] = Math.max(world.slowed[target], 1);
  if (world.unitId[attacker] === 'matilda') world.defense[target] = 0;
  if (hasRelic(world, attacker, 'rubberized_yolk')) pushAway(world, attacker, target);
  healFromLeech(world, attacker, damage);
}

function counterIfNeeded(world: World, attacker: number, target: number, damage: number, isIndirect: boolean): void {
  if (damage <= 0 || isIndirect || !isAlive(world, target) || !isAlive(world, attacker)) return;
  if (!canCounter(world, target, attacker)) return;
  playAttackAnimation(world, target, attacker, false);
  const damageBack = computeDamage(world, target, attacker, false);
  const dealt = applyDamage(world, target, attacker, damageBack, false);
  handleOnHitEffects(world, target, attacker, dealt, false);
  cleanupDeadEntity(world, attacker, target);
}

function splashIfNeeded(world: World, attacker: number, target: number, damage: number, powerMultiplier: number): void {
  if (damage <= 0 || world.unitId[attacker] !== 'bomb') return;
  splashAroundTarget(world, attacker, target, powerMultiplier);
}

function triggerBouncyGrid(world: World, attacker: number, ignoredTarget: number, powerMultiplier: number): void {
  const target = tryBouncyMiss(world, attacker, ignoredTarget);
  if (target < 0) return;
  playAttackAnimation(world, attacker, target, powerMultiplier > 1);
  resolveSingleHit(world, attacker, target, false, powerMultiplier, true);
}

function splashAroundTarget(world: World, attacker: number, target: number, powerMultiplier: number): void {
  const x = targetX(world, target);
  const y = targetY(world, target);
  const candidates = [getOccupant(world, x + 1, y), getOccupant(world, x - 1, y), getOccupant(world, x, y + 1), getOccupant(world, x, y - 1)];
  for (const candidate of Array.from(new Set(candidates))) {
    if (candidate >= 0 && candidate !== target && isEnemy(world, attacker, candidate)) {
      resolveSingleHit(world, attacker, candidate, true, powerMultiplier);
    }
  }
}

function brimstoneAttack(world: World, attacker: number, target: number, powerMultiplier: number): void {
  const dir = Math.sign(targetX(world, target) - world.x[attacker]) || 1;
  const y = world.y[attacker];
  let lastHit = -1;
  for (let x = world.x[attacker] + dir; x >= 0 && x < GRID_COLS; x += dir) {
    const candidate = getOccupant(world, x, y);
    if (candidate >= 0 && isEnemy(world, attacker, candidate)) {
      resolveSingleHit(world, attacker, candidate, false, powerMultiplier, true);
      lastHit = candidate;
    }
  }
  triggerBouncyGrid(world, attacker, lastHit, powerMultiplier);
  world.hp[attacker] = Math.max(1, world.hp[attacker] - 1);
  emitEvent(world, { type: 'unit_damaged', entity: attacker, message: `${world.displayName[attacker]} paid 1 HP for Brimstone Feather.` });
}

function afterAttack(world: World, attacker: number, target: number): void {
  if (world.kind[target] === EntityKind.GoldenEgg && world.active[target] === 0) return;
  if (world.unitId[attacker] === 'bomb') world.moved[attacker] = 1;
}

function cleanupDeadEntity(world: World, entity: number, killer?: number): void {
  if (world.active[entity] !== 1 || world.hp[entity] > 0) return;
  if (world.kind[entity] === EntityKind.GoldenEgg && killer !== undefined) grantEggRelic(world, entity, killer);
  if (world.kind[entity] === EntityKind.Barricade) setTerrain(world, world.x[entity], world.y[entity], TerrainType.Plains);
  clearFootprint(world, entity);
  world.active[entity] = 0;
  emitEvent(world, { type: 'unit_destroyed', entity, message: destroyedMessage(world, entity) });
}

function destroyedMessage(world: World, entity: number): string {
  if (world.faction[entity] === Faction.Player && world.kind[entity] === EntityKind.Unit) return `${world.displayName[entity]} was captured.`;
  return `${world.displayName[entity]} was destroyed.`;
}

function grantEggRelic(world: World, egg: number, killer: number): void {
  if (world.faction[killer] !== Faction.Player) return;
  const bit = world.activeRelics[egg] || RELIC_BITS.leech_seed;
  grantRelicBit(world, killer, bit);
}

function canAttackNow(world: World, attacker: number): boolean {
  if (!canUseActionNow(world, attacker)) return false;
  if (world.unitId[attacker] === 'bomb' && world.moved[attacker] === 1) return false;
  return true;
}

function canUseActionNow(world: World, entity: number): boolean {
  if (!isAlive(world, entity)) return false;
  if (world.acted[entity] === 1 || world.stasis[entity] > 0 || world.airborne[entity] > 0) return false;
  return world.chargeSkip[entity] === 0;
}

function canCounter(world: World, defender: number, attacker: number): boolean {
  if (world.stasis[defender] > 0 || world.airborne[defender] > 0) return false;
  return rangeAllowsAttack(world, defender, attacker) && lineOfSightClear(world, defender, attacker);
}

function rangeAllowsAttack(world: World, attacker: number, target: number): boolean {
  const distance = manhattan(tileCenterX(world, attacker), tileCenterY(world, attacker), tileCenterX(world, target), tileCenterY(world, target));
  const maxRange = world.rangeMax[attacker] + watchtowerRangeBonus(world, attacker);
  return distance >= world.rangeMin[attacker] && distance <= maxRange;
}

function isIndirectAttack(world: World, attacker: number, target: number): boolean {
  const distance = manhattan(tileCenterX(world, attacker), tileCenterY(world, attacker), tileCenterX(world, target), tileCenterY(world, target));
  return distance >= 2 || world.rangeMin[attacker] >= 2;
}

function watchtowerRangeBonus(world: World, entity: number): number {
  const unitId = (world.unitId[entity] || 'pig_grunt') as keyof typeof UNIT_CATALOG;
  if (UNIT_CATALOG[unitId]?.role !== 'indirect') return 0;
  return getTerrain(world, world.x[entity], world.y[entity]) === TerrainType.Watchtower ? 2 : 0;
}

function redAuraDefense(world: World, target: number): number {
  if (world.faction[target] !== Faction.Player) return 0;
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity) || world.unitId[entity] !== 'red' || entity === target) continue;
    if (manhattan(world.x[entity], world.y[entity], world.x[target], world.y[target]) === 1) return 1;
  }
  return 0;
}

function barricadeCover(world: World, attacker: number, target: number): number {
  const tx = targetX(world, target);
  const ty = targetY(world, target);
  const ax = tileCenterX(world, attacker);
  const ay = tileCenterY(world, attacker);
  const coverX = tx + Math.sign(ax - tx);
  const coverY = ty + Math.sign(ay - ty);
  const cover = getOccupant(world, coverX, coverY);
  return cover >= 0 && world.kind[cover] === EntityKind.Barricade ? 4 : 0;
}

function pushAway(world: World, attacker: number, target: number): void {
  const dx = Math.sign(world.x[target] - world.x[attacker]);
  const dy = dx === 0 ? Math.sign(world.y[target] - world.y[attacker]) : 0;
  shoveEntity(world, target, dx, dy);
}

function spectralMeleeReach(world: World, attacker: number, target: number): boolean {
  if (!hasRelic(world, attacker, 'spectral_talons')) return false;
  if (world.rangeMax[attacker] !== 1) return false;
  const ax = world.x[attacker];
  const ay = world.y[attacker];
  const tx = world.x[target];
  const ty = world.y[target];
  if (ax !== tx && ay !== ty) return false;
  return manhattan(ax, ay, tx, ty) === 2;
}

function addStar(world: World, entity: number, amount: number): void {
  if (world.starMax[entity] <= 0 || amount <= 0) return;
  world.star[entity] = Math.min(world.starMax[entity], world.star[entity] + amount);
}

function emitDamageEvent(world: World, attacker: number, target: number, damage: number, isIndirect: boolean): void {
  const style = isIndirect ? 'indirectly hit' : 'hit';
  emitEvent(world, {
    type: 'unit_damaged',
    entity: target,
    message: `${world.displayName[attacker]} ${style} ${world.displayName[target]} for ${damage}.`,
  });
}

function countActiveByFaction(world: World, faction: Faction): number {
  let count = 0;
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (isAlive(world, entity) && world.faction[entity] === faction && world.kind[entity] === EntityKind.Unit) count += 1;
  }
  return count;
}

function targetX(world: World, target: number): number {
  return tileCenterX(world, target);
}

function targetY(world: World, target: number): number {
  return tileCenterY(world, target);
}

function invalid(world: World, message: string): false {
  emitEvent(world, { type: 'invalid_action', message });
  return false;
}
