import { BIRD_IDS, UNIT_CATALOG } from '../unitCatalog';
import { EntityKind, Faction, type BirdId, type UnitId } from '../types';
import { playSpecialEffect } from './animation';
import { emitEvent, isAlive, type World } from './world';

export const ACTIVE_BOARD_SLOTS = [0, 1, 2, 3] as const;
export const BENCH_SLOTS = [10, 11, 12, 13, 14, 15] as const;
export const ENEMY_BOARD_SLOTS = [20, 21, 22, 23, 24] as const;
export const SHOP_SIZE = 5;
export const BUY_COST = 3;
export const REROLL_COST = 2;
export const ROUND_WIN_GOLD = 5;
export const ROUND_LOSS_GOLD = 3;

const PLAYER_SLOT_SET = new Set<number>([...ACTIVE_BOARD_SLOTS, ...BENCH_SLOTS]);
const BOARD_SLOT_SET = new Set<number>(ACTIVE_BOARD_SLOTS);
const BENCH_SLOT_SET = new Set<number>(BENCH_SLOTS);
const ENEMY_SLOT_SET = new Set<number>(ENEMY_BOARD_SLOTS);

export function isPlayerFormationSlot(slot: number): boolean {
  return PLAYER_SLOT_SET.has(slot);
}

export function isActiveBoardSlot(slot: number): boolean {
  return BOARD_SLOT_SET.has(slot);
}

export function isBenchSlot(slot: number): boolean {
  return BENCH_SLOT_SET.has(slot);
}

export function isEnemyBoardSlot(slot: number): boolean {
  return ENEMY_SLOT_SET.has(slot);
}

export function isAutoChessCombatant(world: World, entity: number): boolean {
  if (!isAlive(world, entity) || world.kind[entity] !== EntityKind.Unit) return false;
  const slot = world.formationSlot[entity];
  if (world.faction[entity] === Faction.Player) return isActiveBoardSlot(slot);
  return world.faction[entity] === Faction.Pig && isEnemyBoardSlot(slot);
}

export function findEmptySlot(world: World, slots: readonly number[]): number {
  for (const slot of slots) if (slotOccupant(world, slot) < 0) return slot;
  return -1;
}

export function slotOccupant(world: World, slot: number): number {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1 || world.kind[entity] !== EntityKind.Unit) continue;
    if (world.formationSlot[entity] === slot) return entity;
  }
  return -1;
}

export function moveOrSwapEntity(world: World, entity: number, targetSlot: number): boolean {
  if (!canMovePlayerEntity(world, entity) || !isPlayerFormationSlot(targetSlot)) return false;
  const oldSlot = world.formationSlot[entity];
  if (oldSlot === targetSlot) return true;
  const other = slotOccupant(world, targetSlot);
  if (other >= 0 && other !== entity) {
    world.formationSlot[other] = oldSlot;
    setLegacyCoordinateFromAutoSlot(world, other, oldSlot);
  }
  world.formationSlot[entity] = targetSlot;
  setLegacyCoordinateFromAutoSlot(world, entity, targetSlot);
  emitEvent(world, { type: 'unit_deployed', entity, message: `${world.displayName[entity]} moved to ${slotLabel(targetSlot)}.` });
  return true;
}

export function canMovePlayerEntity(world: World, entity: number): boolean {
  return world.combatStarted === 0 && isAlive(world, entity) && world.kind[entity] === EntityKind.Unit && world.faction[entity] === Faction.Player && isPlayerFormationSlot(world.formationSlot[entity]);
}

export function populateShopRoster(world: World): void {
  world.shopRoster = Array.from({ length: SHOP_SIZE }, () => randomBirdForRound(world.roundNumber));
}

export function clearEnemyBoard(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.faction[entity] === Faction.Pig) world.active[entity] = 0;
  }
  world.bossEntity = -1;
}

export function healPlayerRoster(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1 || world.faction[entity] !== Faction.Player) continue;
    world.hp[entity] = world.maxHp[entity];
    world.actionGauge[entity] = 0;
  }
}

export function activeBoardCount(world: World): number {
  let count = 0;
  for (const slot of ACTIVE_BOARD_SLOTS) if (slotOccupant(world, slot) >= 0) count += 1;
  return count;
}

export function evaluateMerges(world: World): void {
  let merged = false;
  const groups = groupMergeCandidates(world);
  for (const entities of groups.values()) {
    if (entities.length < 3) continue;
    mergeFirstThree(world, entities);
    merged = true;
    break;
  }
  if (merged) evaluateMerges(world);
}

function groupMergeCandidates(world: World): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isPlayerMergeCandidate(world, entity)) continue;
    const key = `${world.unitId[entity]}:${world.starTier[entity]}`;
    const list = groups.get(key) ?? [];
    list.push(entity);
    groups.set(key, list);
  }
  return groups;
}

function isPlayerMergeCandidate(world: World, entity: number): boolean {
  return (
    world.active[entity] === 1 &&
    world.kind[entity] === EntityKind.Unit &&
    world.faction[entity] === Faction.Player &&
    isPlayerFormationSlot(world.formationSlot[entity]) &&
    world.starTier[entity] > 0 &&
    world.starTier[entity] < 3 &&
    Boolean(world.unitId[entity])
  );
}

function mergeFirstThree(world: World, entities: number[]): void {
  entities.sort(mergePriority(world));
  const [survivor, consumedA, consumedB] = entities;
  const oldTier = world.starTier[survivor];
  world.starTier[survivor] = Math.min(3, oldTier + 1);
  world.maxHp[survivor] = Math.ceil(world.maxHp[survivor] * 1.8);
  world.attack[survivor] = Math.ceil(world.attack[survivor] * 1.8);
  world.defense[survivor] = Math.ceil(world.defense[survivor] * 1.25);
  world.hp[survivor] = world.maxHp[survivor];
  consumeMergedEntity(world, consumedA);
  consumeMergedEntity(world, consumedB);
  playSpecialEffect(world, survivor);
  emitEvent(world, {
    type: 'unit_merged',
    entity: survivor,
    message: `${world.displayName[survivor]} merged into a ${world.starTier[survivor]}-Star unit!`,
  });
}

function mergePriority(world: World): (a: number, b: number) => number {
  return (a, b) => {
    const boardA = isActiveBoardSlot(world.formationSlot[a]) ? 0 : 1;
    const boardB = isActiveBoardSlot(world.formationSlot[b]) ? 0 : 1;
    if (boardA !== boardB) return boardA - boardB;
    return world.formationSlot[a] - world.formationSlot[b] || a - b;
  };
}

function consumeMergedEntity(world: World, entity: number): void {
  world.active[entity] = 0;
  world.formationSlot[entity] = -1;
  world.hp[entity] = 0;
  world.activeRelics[entity] = 0;
}

function randomBirdForRound(round: number): BirdId {
  const pool = weightedBirdPool(round);
  return pool[Math.floor(Math.random() * pool.length)];
}

function weightedBirdPool(round: number): BirdId[] {
  const common: BirdId[] = ['red', 'chuck', 'bomb', 'blues', 'matilda'];
  const uncommon: BirdId[] = ['hal', 'stella', 'bubbles', 'melody'];
  const rare: BirdId[] = ['terence', 'silver'];
  if (round <= 2) return [...common, ...common, ...uncommon.slice(0, 2)];
  if (round <= 5) return [...common, ...uncommon, ...uncommon, ...rare];
  return [...BIRD_IDS, ...uncommon, ...rare, ...rare];
}

export function setLegacyCoordinateFromAutoSlot(world: World, entity: number, slot: number): void {
  if (slot >= 20) {
    world.x[entity] = 8;
    world.y[entity] = slot - 20;
    return;
  }
  if (slot >= 10) {
    world.x[entity] = slot - 10;
    world.y[entity] = 5;
    return;
  }
  world.x[entity] = 1;
  world.y[entity] = slot;
}

function slotLabel(slot: number): string {
  if (isActiveBoardSlot(slot)) return `frontline slot ${slot + 1}`;
  if (isBenchSlot(slot)) return `bench slot ${slot - 9}`;
  return `slot ${slot}`;
}

export function unitCost(unitId: UnitId | ''): number {
  if (!unitId || UNIT_CATALOG[unitId].faction !== Faction.Player) return BUY_COST;
  if (unitId === 'terence' || unitId === 'silver') return 4;
  return BUY_COST;
}
