import { BOSS_ROUND_NUMBER, MAP_BATTLE_ROUNDS } from '../constants';
import { randomAutoRelicBit } from '../relicCatalog';
import { syncEntityAtlasFrame } from '../spriteAtlas';
import { STAR_MAX_BY_UNIT, UNIT_CATALOG } from '../unitCatalog';
import {
  ACTIVE_BOARD_SLOTS,
  BENCH_SLOTS,
  ENEMY_BOARD_SLOTS,
  isActiveBoardSlot,
  isBenchSlot,
  isEnemyBoardSlot,
  slotGridPoint,
  slotPosition,
} from '../formationSlots';
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
  seedEnemyBoard(world, world.bossRule, true);
  emitEvent(world, { type: 'battle_started', message: 'The flock squares up for auto-battle.' });
  emitBossRuleEvent(world, seed.bossRule);
}

export function prepareAutoChessRound(world: World, seed: { bossRule: BossRule; territoryId?: string; battleId?: number }): void {
  const battleId = seed.battleId ?? world.currentBattleId;
  const sameRound = world.currentBattleId === battleId && world.territoryId === (seed.territoryId ?? '') && world.nextEntity > 0;
  if (sameRound) return;
  world.currentBattleId = battleId;
  world.territoryId = seed.territoryId ?? '';
  world.bossRule = normalizeBossRule(seed.bossRule);
  world.roundNumber = 1;
  setupPreparationRound(world, seed.bossRule);
}

export function prepareNextAutoChessRound(world: World): void {
  setupPreparationRound(world, world.bossRule);
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
  const slots = UNIT_CATALOG[unitId].faction === Faction.Player ? ACTIVE_BOARD_SLOTS : ENEMY_BOARD_SLOTS;
  const entity = spawnUnitInSlot(world, unitId, slots[Math.max(0, Math.min(slots.length - 1, y))] ?? slots[0]);
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
  world.sizeW[entity] = Math.max(1, def.sizeW ?? 1);
  world.sizeH[entity] = Math.max(1, def.sizeH ?? 1);
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
  snapEntityToSlot(world, entity, slot);
  syncEntityAtlasFrame(world, entity);
  return entity;
}

export function snapEntityToSlot(world: World, entity: number, slot = world.formationSlot[entity]): void {
  const [x, y, z] = slotPosition(slot);
  world.homeX[entity] = x;
  world.homeY[entity] = y;
  world.homeZ[entity] = z;
  world.posX[entity] = x;
  world.posY[entity] = y;
  world.posZ[entity] = z;
  setLegacyCoordinateFromSlot(world, entity, slot);
  world.pendingX[entity] = world.x[entity];
  world.pendingY[entity] = world.y[entity];
}

export function seedEnemyBoard(world: World, bossRule: BossRule, bossRound = false): void {
  removeEnemyBoard(world);
  const round = Math.max(1, world.roundNumber);
  if (bossRound) {
    seedBossRound(world, bossRule);
    return;
  }
  const spawnCount = Math.min(ENEMY_BOARD_SLOTS.length - 1, 3 + Math.floor((round - 1) / 2));
  const pool: UnitId[] = round >= 6 ? ['pig_bruiser', 'pig_archer', 'pig_grunt', 'pig_thief'] : round >= 3 ? ['pig_archer', 'pig_grunt', 'pig_bruiser'] : ['pig_grunt', 'pig_archer', 'pig_grunt'];
  for (let index = 0; index < spawnCount; index += 1) spawnUnitInSlot(world, pool[index % pool.length], ENEMY_BOARD_SLOTS[index]);
  if (round >= 2) {
    const thiefSlot = ENEMY_BOARD_SLOTS[Math.min(spawnCount, ENEMY_BOARD_SLOTS.length - 2)];
    const thief = spawnUnitInSlot(world, 'pig_thief', thiefSlot);
    world.carriesRelic[thief] = randomAutoRelicBit();
    emitEvent(world, { type: 'relic_gained', entity: thief, message: `${world.displayName[thief]} is carrying a Golden Egg relic. Defeat it before 3 attacks.` });
  }
}

export function removeEnemyBoard(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1) continue;
    if (world.faction[entity] !== Faction.Pig && world.kind[entity] !== EntityKind.Projectile) continue;
    world.active[entity] = 0;
    world.formationSlot[entity] = -1;
    world.faction[entity] = Faction.None;
    world.actionState[entity] = 0;
    world.actionClock[entity] = 0;
    world.attackCooldown[entity] = 0;
    world.mana[entity] = 0;
  }
  world.bossEntity = -1;
}

export function removeNonPlayerEntities(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1) continue;
    if (world.faction[entity] === Faction.Player) continue;
    world.active[entity] = 0;
    world.formationSlot[entity] = -1;
    world.faction[entity] = Faction.None;
  }
  world.bossEntity = -1;
}

export function revivePlayerRoster(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.faction[entity] !== Faction.Player || world.kind[entity] !== EntityKind.Unit) continue;
    if (world.formationSlot[entity] < 0) continue;
    world.active[entity] = 1;
    world.hp[entity] = world.maxHp[entity];
    world.actionGauge[entity] = 0;
    world.actionState[entity] = 0;
    world.actionClock[entity] = 0;
    world.actionKind[entity] = 0;
    world.actionResolved[entity] = 0;
    world.attackCooldown[entity] = 0;
    world.mana[entity] = 0;
    snapEntityToSlot(world, entity, world.formationSlot[entity]);
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
  if (world.roundNumber < BOSS_ROUND_NUMBER) return;
  if (normalized === BossRule.HiddenPrompts) emitEvent(world, { type: 'boss_rule', message: 'Boss Round: Illusionist Pig creates chaotic target priorities.' });
  if (normalized === BossRule.TimeWarp) emitEvent(world, { type: 'boss_rule', message: 'Boss Round: Chronomancer Pig warps auto-battle speed.' });
  if (normalized === BossRule.ComboDrain) emitEvent(world, { type: 'boss_rule', message: 'Boss Round: Gluttonous Duke drains Mana during combat.' });
}

export function isBossRound(world: World): boolean {
  return world.roundNumber >= BOSS_ROUND_NUMBER;
}

export function mapBattleIsComplete(world: World): boolean {
  return world.roundNumber > BOSS_ROUND_NUMBER;
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
  world.activeRelics[entity] = randomAutoRelicBit();
  placeFootprint(world, entity, x, y);
  syncEntityAtlasFrame(world, entity);
  return entity;
}

function setupPreparationRound(world: World, originalBossRule: BossRule): void {
  world.battleEnded = 0;
  world.combatStarted = 0;
  resetTimeline(world);
  removeNonPlayerEntities(world);
  revivePlayerRoster(world);
  const bossRound = isBossRound(world);
  seedEnemyBoard(world, world.bossRule === BossRule.None && bossRound ? BossRule.ComboDrain : world.bossRule, bossRound);
  if (world.shopRoster.every((entry) => entry === '') || world.shopLocked === 0) refreshShopRoster(world);
  emitEvent(world, { type: 'round_started', message: bossRound ? `Boss preparation. Survive Round ${BOSS_ROUND_NUMBER} to conquer the territory.` : `Round ${world.roundNumber}/${MAP_BATTLE_ROUNDS}. Buy, merge, drag, then start combat.` });
  emitBossRuleEvent(world, originalBossRule);
}

function seedBossRound(world: World, bossRule: BossRule): void {
  spawnUnitInSlot(world, 'pig_bruiser', ENEMY_BOARD_SLOTS[0]);
  spawnUnitInSlot(world, 'pig_archer', ENEMY_BOARD_SLOTS[1]);
  spawnUnitInSlot(world, 'pig_grunt', ENEMY_BOARD_SLOTS[3]);
  spawnBoss(world, bossRule === BossRule.None ? BossRule.ComboDrain : bossRule);
}

function spawnBoss(world: World, bossRule: BossRule): void {
  const boss = spawnUnitInSlot(world, 'pig_boss', ENEMY_BOARD_SLOTS[ENEMY_BOARD_SLOTS.length - 1]);
  world.bossEntity = boss;
  world.hp[boss] = bossRule === BossRule.ComboDrain ? 52 : 42;
  world.maxHp[boss] = world.hp[boss];
  world.attack[boss] = bossRule === BossRule.ComboDrain ? 9 : 7;
  world.defense[boss] = 3;
  world.speed[boss] = bossRule === BossRule.TimeWarp ? 16 : 12;
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
  if (isActiveBoardSlot(slot)) return Math.max(0, ACTIVE_BOARD_SLOTS.indexOf(slot as (typeof ACTIVE_BOARD_SLOTS)[number])) * 4;
  if (isEnemyBoardSlot(slot)) return Math.max(0, ENEMY_BOARD_SLOTS.indexOf(slot as (typeof ENEMY_BOARD_SLOTS)[number])) * 4;
  return 0;
}

function setLegacyCoordinateFromSlot(world: World, entity: number, slot: number): void {
  const gridPoint = slotGridPoint(slot);
  if (gridPoint) {
    world.x[entity] = gridPoint.x;
    world.y[entity] = gridPoint.y;
    return;
  }
  if (isBenchSlot(slot)) {
    const index = BENCH_SLOTS.indexOf(slot as (typeof BENCH_SLOTS)[number]);
    world.x[entity] = index;
    world.y[entity] = 5;
  }
}

function randomShopBird(roundNumber: number): BirdId {
  const common: BirdId[] = ['red', 'chuck', 'bomb', 'matilda', 'blues'];
  const uncommon: BirdId[] = ['hal', 'stella', 'bubbles', 'melody'];
  const rare: BirdId[] = ['terence', 'silver'];
  const roll = Math.random();
  const rareChance = Math.min(0.32, 0.08 + roundNumber * 0.026);
  const uncommonChance = Math.min(0.48, 0.22 + roundNumber * 0.02);
  if (roll < rareChance) return sample(rare);
  if (roll < rareChance + uncommonChance) return sample(uncommon);
  return sample(common);
}

function sample<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}
