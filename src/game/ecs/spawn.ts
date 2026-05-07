import { randomTimingRelicBit } from '../relicCatalog';
import { syncEntityAtlasFrame } from '../spriteAtlas';
import { STAR_MAX_BY_UNIT, UNIT_CATALOG } from '../unitCatalog';
import { ACTIVE_BOARD_SLOTS, BENCH_SLOTS, ENEMY_BOARD_SLOTS } from '../formationSlots';
import { BossRule, EntityKind, Faction, TerrainType, type BattleSeed, type BirdId, type UnitId } from '../types';
import { allocateEntity, emitEvent, resetWorld, resetTimeline, type World } from './world';
import { applyRelicMask } from './relics';
import { placeFootprint, setTerrain } from './grid';

export const SHOP_SIZE = 5;

export function initializeBattle(world: World, seed: BattleSeed): void {
  resetWorld(world);
  world.bossRule = normalizeBossRule(seed.bossRule);
  world.territoryId = seed.territoryId ?? '';
  world.combatStarted = 1;
  seed.birds.slice(0, 4).forEach((bird, index) => spawnBird(world, bird, index, seed.birdRelics?.[bird] ?? 0));
  seedEnemyBoard(world, world.bossRule);
  if (world.bossRule === BossRule.ComboDrain) world.partyComboMeter = 3;
  emitEvent(world, { type: 'battle_started', message: 'The flock squares up. Time perfect hits and blocks with Space or a click.' });
  emitBossRuleEvent(world, seed.bossRule);
}

export function prepareAutoChessRound(world: World, seed: { bossRule: BossRule; territoryId?: string; battleId?: number }): void {
  const battleId = seed.battleId ?? world.currentBattleId;
  const sameRound = world.currentBattleId === battleId && world.territoryId === (seed.territoryId ?? '') && world.nextEntity > 0;
  if (sameRound) return;
  world.currentBattleId = battleId;
  world.territoryId = seed.territoryId ?? '';
  world.bossRule = normalizeBossRule(seed.bossRule);
  world.battleEnded = 0;
  world.combatStarted = 0;
  resetTimeline(world);
  removeNonPlayerEntities(world);
  revivePlayerRoster(world);
  seedEnemyBoard(world, world.bossRule);
  if (world.shopRoster.every((entry) => entry === '') || world.shopLocked === 0) refreshShopRoster(world);
  emitEvent(world, { type: 'round_started', message: `Preparation phase. Buy birds, drag them to the front line, then start combat.` });
  emitBossRuleEvent(world, seed.bossRule);
}

export function refreshShopRoster(world: World): void {
  world.shopRoster = Array.from({ length: SHOP_SIZE }, () => randomShopBird(world.roundNumber));
  emitEvent(world, { type: 'shop_refreshed', message: 'The shop refreshed with a new flock offer.' });
}

export function spawnBird(world: World, bird: BirdId, spawnIndex: number, relicMask = 0): number {
  const entity = spawnUnitInSlot(world, bird, ACTIVE_BOARD_SLOTS[spawnIndex] ?? ACTIVE_BOARD_SLOTS[0]);
  applyRelicMask(world, entity, relicMask);
  return entity;
}

export function spawnUnit(world: World, unitId: UnitId, x: number, y: number): number {
  const slot = UNIT_CATALOG[unitId].faction === Faction.Player ? ACTIVE_BOARD_SLOTS[Math.max(0, Math.min(3, y))] : ENEMY_BOARD_SLOTS[Math.max(0, Math.min(4, y))];
  const entity = spawnUnitInSlot(world, unitId, slot ?? 0);
  world.x[entity] = x;
  world.y[entity] = y;
  return entity;
}

export function spawnUnitInSlot(world: World, unitId: UnitId, slot: number): number {
  const def = UNIT_CATALOG[unitId];
  const entity = allocateEntity(world);
  world.kind[entity] = EntityKind.Unit;
  world.faction[entity] = def.faction;
  world.unitId[entity] = def.id;
  world.displayName[entity] = def.displayName;
  world.spriteKey[entity] = def.spriteKey;
  world.sizeW[entity] = 1;
  world.sizeH[entity] = 1;
  world.maxHp[entity] = def.maxHp;
  world.hp[entity] = def.maxHp;
  world.attack[entity] = def.attack;
  world.defense[entity] = def.defense;
  world.move[entity] = def.move;
  world.rangeMin[entity] = def.rangeMin;
  world.rangeMax[entity] = def.rangeMax;
  world.starMax[entity] = STAR_MAX_BY_UNIT[unitId] ?? 0;
  world.formationSlot[entity] = slot;
  world.starTier[entity] = 1;
  world.speed[entity] = speedForUnit(unitId);
  world.actionGauge[entity] = initialGaugeForSlot(slot);
  setLegacyCoordinateFromSlot(world, entity, slot);
  syncEntityAtlasFrame(world, entity);
  return entity;
}

export function seedEnemyBoard(world: World, bossRule: BossRule): void {
  removeEnemyBoard(world);
  spawnUnitInSlot(world, 'pig_grunt', ENEMY_BOARD_SLOTS[0]);
  spawnUnitInSlot(world, 'pig_archer', ENEMY_BOARD_SLOTS[1]);
  spawnUnitInSlot(world, 'pig_bruiser', ENEMY_BOARD_SLOTS[2]);
  const thief = spawnUnitInSlot(world, 'pig_thief', ENEMY_BOARD_SLOTS[3]);
  world.carriesRelic[thief] = randomTimingRelicBit();
  emitEvent(world, { type: 'relic_gained', entity: thief, message: `${world.displayName[thief]} is carrying a Golden Egg relic. Defeat it before 3 gauge fills.` });
  if (bossRule !== BossRule.None) spawnBoss(world, bossRule);
}

export function removeEnemyBoard(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1) continue;
    if (world.faction[entity] !== Faction.Pig && world.kind[entity] !== EntityKind.Projectile) continue;
    world.active[entity] = 0;
    world.formationSlot[entity] = -1;
    world.timingState[entity] = 0;
  }
  world.bossEntity = -1;
}

export function removeNonPlayerEntities(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1) continue;
    if (world.faction[entity] === Faction.Player) continue;
    world.active[entity] = 0;
    world.formationSlot[entity] = -1;
  }
  world.bossEntity = -1;
}

export function revivePlayerRoster(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.faction[entity] !== Faction.Player || world.kind[entity] !== EntityKind.Unit) continue;
    if (world.formationSlot[entity] < 0) world.formationSlot[entity] = firstOpenBenchSlot(world) ?? 10;
    world.active[entity] = 1;
    world.hp[entity] = world.maxHp[entity];
    world.actionGauge[entity] = 0;
    world.timingState[entity] = 0;
    world.commandResult[entity] = 0;
    setLegacyCoordinateFromSlot(world, entity, world.formationSlot[entity]);
    syncEntityAtlasFrame(world, entity);
  }
}

export function firstOpenBenchSlot(world: World): number | null {
  return BENCH_SLOTS.find((slot) => slotOccupant(world, slot) < 0) ?? null;
}

export function slotOccupant(world: World, slot: number): number {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] === 1 && world.formationSlot[entity] === slot && world.kind[entity] === EntityKind.Unit) return entity;
  }
  return -1;
}

export function normalizeBossRule(rule: BossRule): BossRule {
  if (rule === BossRule.BouncyGrid) return BossRule.HiddenPrompts;
  if (rule === BossRule.ShiftingLanes) return BossRule.TimeWarp;
  if (rule === BossRule.GravityVacuum) return BossRule.ComboDrain;
  return rule;
}

export function emitBossRuleEvent(world: World, rule: BossRule): void {
  const normalized = normalizeBossRule(rule);
  if (normalized === BossRule.HiddenPrompts) {
    emitEvent(world, { type: 'boss_rule', message: 'Boss Rule: Hidden Prompts. Watch animation cues; the timing UI is hidden.' });
  }
  if (normalized === BossRule.TimeWarp) {
    emitEvent(world, { type: 'boss_rule', message: 'Boss Rule: Time Warp. Animation speed changes every turn.' });
  }
  if (normalized === BossRule.ComboDrain) {
    emitEvent(world, { type: 'boss_rule', message: 'Boss Rule: Combo Drain. Keep the Combo Meter fed or the Duke wipes the party.' });
  }
}

export function spawnBarricade(world: World, x: number, y: number): number {
  const entity = allocateEntity(world);
  world.kind[entity] = EntityKind.Barricade;
  world.faction[entity] = Faction.Prop;
  world.displayName[entity] = 'Archived Barricade';
  world.spriteKey[entity] = 'barricade';
  world.maxHp[entity] = 7;
  world.hp[entity] = 7;
  world.defense[entity] = 4;
  setTerrain(world, x, y, TerrainType.Barricade);
  placeFootprint(world, entity, x, y);
  syncEntityAtlasFrame(world, entity);
  return entity;
}

export function spawnGoldenEgg(world: World, x: number, y: number): number {
  const entity = allocateEntity(world);
  world.kind[entity] = EntityKind.GoldenEgg;
  world.faction[entity] = Faction.Prop;
  world.displayName[entity] = 'Archived Golden Egg';
  world.spriteKey[entity] = 'golden-egg';
  world.maxHp[entity] = 3;
  world.hp[entity] = 3;
  world.defense[entity] = 0;
  world.activeRelics[entity] = randomTimingRelicBit();
  placeFootprint(world, entity, x, y);
  syncEntityAtlasFrame(world, entity);
  return entity;
}

function spawnBoss(world: World, bossRule: BossRule): void {
  const boss = spawnUnitInSlot(world, 'pig_boss', ENEMY_BOARD_SLOTS[4]);
  world.bossEntity = boss;
  world.hp[boss] = bossRule === BossRule.ComboDrain ? 32 : 24;
  world.maxHp[boss] = world.hp[boss];
  world.attack[boss] = bossRule === BossRule.ComboDrain ? 7 : 5;
  world.defense[boss] = 2;
  world.speed[boss] = bossRule === BossRule.TimeWarp ? 14 : 10;
  world.displayName[boss] = bossName(bossRule);
}

function bossName(rule: BossRule): string {
  if (rule === BossRule.HiddenPrompts || rule === BossRule.BouncyGrid) return 'Illusionist Pig';
  if (rule === BossRule.TimeWarp || rule === BossRule.ShiftingLanes) return 'Chronomancer Pig';
  if (rule === BossRule.ComboDrain || rule === BossRule.GravityVacuum) return 'Gluttonous Duke';
  return 'Boss Pig';
}

function speedForUnit(unitId: UnitId): number {
  if (unitId === 'chuck') return 25;
  if (unitId === 'blues') return 23;
  if (unitId === 'matilda' || unitId === 'hal' || unitId === 'stella') return 20;
  if (unitId === 'red' || unitId === 'bomb' || unitId === 'melody') return 18;
  if (unitId === 'silver' || unitId === 'bubbles') return 17;
  if (unitId === 'terence') return 13;
  if (unitId === 'pig_thief') return 20;
  if (unitId === 'pig_archer') return 16;
  if (unitId === 'pig_bruiser') return 12;
  if (unitId === 'pig_boss') return 10;
  return 15;
}

function initialGaugeForSlot(slot: number): number {
  if ((ACTIVE_BOARD_SLOTS as readonly number[]).includes(slot)) return slot * 6;
  if ((ENEMY_BOARD_SLOTS as readonly number[]).includes(slot)) return (slot - 20) * 5;
  return 0;
}

function setLegacyCoordinateFromSlot(world: World, entity: number, slot: number): void {
  if (slot >= 0 && slot <= 3) {
    world.x[entity] = 1;
    world.y[entity] = slot;
    return;
  }
  if (slot >= 10 && slot <= 15) {
    world.x[entity] = slot - 8;
    world.y[entity] = 3;
    return;
  }
  if (slot >= 20) {
    const enemyRows = [0, 1, 2, 3, 1];
    world.x[entity] = slot === 24 ? 9 : 8;
    world.y[entity] = enemyRows[slot - 20] ?? 0;
  }
}

function randomShopBird(roundNumber: number): BirdId {
  const common: BirdId[] = ['red', 'chuck', 'bomb', 'matilda', 'blues'];
  const uncommon: BirdId[] = ['hal', 'stella', 'bubbles', 'melody'];
  const rare: BirdId[] = ['terence', 'silver'];
  const roll = Math.random();
  const rareChance = Math.min(0.28, 0.08 + roundNumber * 0.025);
  const uncommonChance = Math.min(0.45, 0.22 + roundNumber * 0.02);
  if (roll < rareChance) return sample(rare);
  if (roll < rareChance + uncommonChance) return sample(uncommon);
  return sample(common);
}

function sample<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}
