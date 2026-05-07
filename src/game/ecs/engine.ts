import { ACTIVE_BOARD_SLOTS, BENCH_SLOTS, ENEMY_BOARD_SLOTS, closestPlayerSlot, isActiveBoardSlot, isBenchSlot, isEnemyBoardSlot, isPlayerFormationSlot, slotPosition } from '../formationSlots';
import { syncEntityAtlasFrame } from '../spriteAtlas';
import { UNIT_CATALOG } from '../unitCatalog';
import {
  ActionTimingState,
  BossRule,
  CommandResult,
  EntityKind,
  Faction,
  TimelineActionKind,
  TurnSide,
  type BattleSeed,
  type BirdId,
  type GameEvent,
  type PlayerActionMode,
  type PrepSeed,
  type UnitId,
} from '../types';
import { playAttackAnimation, playHitAnimation, playShieldAnimation, playSpecialEffect, tickAnimations } from './animation';
import { firstOpenBenchSlot, initializeBattle, prepareAutoChessRound, refreshShopRoster, slotOccupant, spawnUnitInSlot } from './spawn';
import { clearDrag, createWorld, drainEvents, emitEvent, isAlive as worldEntityIsAlive, isUnit, resetTimeline, type World } from './world';
import { cleanupDeadEntities, dealDirectDamage } from './combat';
import { tickStarPowerDelays, useStarPower, footprintDistance } from './starPowers';
import { clearFootprint, footprintFits, placeFootprint } from './grid';
import { tickStatuses } from './status';

export const ACTION_GAUGE_MAX = 100;
export const UNIT_COST = 3;
export const REROLL_COST = 2;
export const ROUND_WIN_GOLD = 5;
export const ROUND_LOSS_HP = 12;

export type EntitySummary = {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  move: number;
  rangeMin: number;
  rangeMax: number;
  star: number;
  starMax: number;
  relicMask: number;
  faction: Faction;
  spriteKey: string;
  unitId: UnitId | '';
  specialName: string;
  actionSpent: boolean;
  shielded: boolean;
  restingNextRound: boolean;
  stasis: number;
  slowed: number;
  airborne: number;
  expanded: boolean;
  canCapture: boolean;
  tileActionLabel: string;
  actionGauge: number;
  speed: number;
  timingState: ActionTimingState;
  commandResult: CommandResult;
  formationSlot: number;
  carriesRelic: number;
  gaugeFillCount: number;
  isReady: boolean;
  starTier: number;
  cost: number;
};

export type ShopSlotSummary = {
  index: number;
  unitId: BirdId | '';
  name: string;
  spriteKey: string;
  cost: number;
  empty: boolean;
};

export type AutoChessState = {
  playerHp: number;
  playerGold: number;
  shopLocked: boolean;
  combatStarted: boolean;
  battleEnded: boolean;
  roundNumber: number;
  benchSlots: readonly number[];
  activeSlots: readonly number[];
  enemySlots: readonly number[];
  canStartCombat: boolean;
};

export type BirdBattleResult = {
  bird: BirdId;
  survived: boolean;
  hp: number;
  maxHp: number;
  relicMask: number;
};

export type BattleReport = {
  victory: boolean;
  territoryId: string;
  birds: BirdBattleResult[];
  playerHp: number;
  playerGold: number;
  roundNumber: number;
};

export type TimingPrompt = {
  visible: boolean;
  label: string;
  entity: number;
  windowProgress: number;
  result: CommandResult;
};

export type BattleEngine = ReturnType<typeof createBattleEngine>;

const BIRD_SET = new Set<string>(['red', 'chuck', 'terence', 'silver', 'bomb', 'matilda', 'hal', 'stella', 'blues', 'bubbles', 'melody']);

export function createBattleEngine(onEvent: (event: GameEvent) => void) {
  const world = createWorld();

  function start(seed: BattleSeed): void {
    initializeBattle(world, seed);
    flushEvents();
  }

  function prepareRound(seed: PrepSeed): void {
    prepareAutoChessRound(world, seed);
    flushEvents();
  }

  function tick(delta: number): void {
    tickAnimations(world, delta);
    
    // We use the old BossTimer variable as a universal 1-second clock to trigger real-time stasis and delayed bombs!
    world.bossTimer += delta;
    if (world.bossTimer >= 1.0) {
      tickStatuses(world);
      tickStarPowerDelays(world);
      world.bossTimer -= 1.0;
    }

    if (world.battleEnded === 1) {
      flushEvents();
      return;
    }

    if (world.combatStarted === 1) {
      tickAutoCombat(Math.min(0.05, Math.max(0, delta)));
      checkBattleEnd();
    }
    flushEvents();
  }

  // --- THE CORE AUTO-CHESS AI ---
  function tickAutoCombat(delta: number): void {
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isCombatParticipant(entity)) continue;
      if (world.stasis[entity] > 0 || world.airborne[entity] > 0) continue;

      // Fill the Attack Cooldown (Speed governs how fast they attack)
      world.actionGauge[entity] += world.speed[entity] * delta * 5;

      if (world.actionGauge[entity] >= ACTION_GAUGE_MAX) {
        processAutoTurn(entity);
      }
    }
    cleanupDeadEntities(world);
  }

  function processAutoTurn(entity: number): void {
    // 1. Validate Target
    let target = world.targetEntity[entity];
    if (!isValidTarget(entity, target)) {
      target = findNearestEnemy(entity);
      world.targetEntity[entity] = target;
    }

    if (target < 0) return; // No enemies left to fight!

    // THE FIX: Use Footprint Distance instead of Manhattan so birds correctly target the Big Boss!
    const dist = footprintDistance(world, entity, target);

    // 2. Cast Star Power (If Mana is Full)
    if (world.starMax[entity] > 0 && world.star[entity] >= world.starMax[entity]) {
      useStarPower(world, entity);
      world.actionGauge[entity] = 0;
      return;
    }

    // 3. Attack or Move
    if (dist >= world.rangeMin[entity] && dist <= world.rangeMax[entity]) {
      // IN RANGE: Basic Attack
      playAttackAnimation(world, entity, target, false);
      
      const damage = Math.max(1, world.attack[entity] - world.defense[target]);
      dealDirectDamage(world, entity, target, damage);
      
      // Generate Mana (+2 for hitting, +1 for getting hit)
      world.star[entity] = Math.min(world.starMax[entity], world.star[entity] + 2);
      world.star[target] = Math.min(world.starMax[target], world.star[target] + 1);
      
      world.actionGauge[entity] = 0;
    } else {
      // OUT OF RANGE: Move closer
      stepTowards(entity, target);
      world.actionGauge[entity] -= 30; // Spend some gauge to move
    }
  }

  function stepTowards(entity: number, target: number): void {
    const dx = Math.sign(world.x[target] - world.x[entity]);
    const dy = Math.sign(world.y[target] - world.y[entity]);

    // Try walking directly toward the target
    if (dx !== 0 && footprintFits(world, entity, world.x[entity] + dx, world.y[entity])) {
      clearFootprint(world, entity);
      placeFootprint(world, entity, world.x[entity] + dx, world.y[entity]);
      return;
    }
    if (dy !== 0 && footprintFits(world, entity, world.x[entity], world.y[entity] + dy)) {
      clearFootprint(world, entity);
      placeFootprint(world, entity, world.x[entity], world.y[entity] + dy);
      return;
    }

    // THE FIX: "Sliding Pathfinding". If straight path is blocked, try stepping sideways to slide past the blockade!
    const altDx = dx === 0 ? 1 : 0;
    const altDy = dy === 0 ? 1 : 0;
    
    if (altDx !== 0 && footprintFits(world, entity, world.x[entity] + altDx, world.y[entity])) {
      clearFootprint(world, entity);
      placeFootprint(world, entity, world.x[entity] + altDx, world.y[entity]);
      return;
    }
    if (altDx !== 0 && footprintFits(world, entity, world.x[entity] - altDx, world.y[entity])) {
      clearFootprint(world, entity);
      placeFootprint(world, entity, world.x[entity] - altDx, world.y[entity]);
      return;
    }
    if (altDy !== 0 && footprintFits(world, entity, world.x[entity], world.y[entity] + altDy)) {
      clearFootprint(world, entity);
      placeFootprint(world, entity, world.x[entity], world.y[entity] + altDy);
      return;
    }
    if (altDy !== 0 && footprintFits(world, entity, world.x[entity], world.y[entity] - altDy)) {
      clearFootprint(world, entity);
      placeFootprint(world, entity, world.x[entity], world.y[entity] - altDy);
      return;
    }
    
    // If completely blocked on all sides, the bird stays still and waits.
  }

  function isValidTarget(entity: number, target: number): boolean {
    if (target < 0 || !isAlive(target)) return false;
    return world.faction[entity] !== world.faction[target];
  }

  function findNearestEnemy(entity: number): number {
    let best = -1;
    let minDistance = Number.MAX_SAFE_INTEGER;
    for (let t = 0; t < world.nextEntity; t += 1) {
      if (t === entity || !isAlive(t)) continue;
      if (world.faction[t] === Faction.Prop || world.faction[t] === Faction.None) continue;
      if (world.faction[entity] === world.faction[t]) continue;

      const dist = footprintDistance(world, entity, t);
      if (dist < minDistance) {
        minDistance = dist;
        best = t;
      }
    }
    return best;
  }

  // --- SHOP & ECONOMY ---
  function buyFromShop(shopIndex: number): boolean {
    if (world.combatStarted === 1 || world.battleEnded === 1) return invalidResult('You can only buy during preparation.');
    const unitId = world.shopRoster[shopIndex];
    if (!unitId) return invalidResult('That shop slot is empty.');
    if (world.playerGold < UNIT_COST) return invalidResult(`Need ${UNIT_COST} gold to buy ${UNIT_CATALOG[unitId].displayName}.`);
    
    const benchSlot = firstOpenBenchSlot(world);
    if (benchSlot === null) return invalidResult('Bench is full. Drag a bird to the active board or wait for a merge.');
    
    world.playerGold -= UNIT_COST;
    const entity = spawnUnitInSlot(world, unitId, benchSlot);
    world.shopRoster[shopIndex] = '';
    
    emitEvent(world, { type: 'unit_bought', entity, message: `Bought ${world.displayName[entity]} for ${UNIT_COST} gold.` });
    emitEvent(world, { type: 'gold_changed', message: `Gold: ${world.playerGold}.` });
    
    evaluateMerges();
    flushEvents();
    return true;
  }

  function rerollShop(): boolean {
    if (world.combatStarted === 1 || world.battleEnded === 1) return invalidResult('You can only reroll during preparation.');
    if (world.playerGold < REROLL_COST) return invalidResult(`Need ${REROLL_COST} gold to reroll.`);
    world.playerGold -= REROLL_COST;
    refreshShopRoster(world);
    emitEvent(world, { type: 'gold_changed', message: `Rerolled shop. Gold: ${world.playerGold}.` });
    flushEvents();
    return true;
  }

  function toggleShopLock(): void {
    world.shopLocked = world.shopLocked === 1 ? 0 : 1;
    emitEvent(world, { type: 'shop_refreshed', message: world.shopLocked === 1 ? 'Shop locked for the next round.' : 'Shop unlocked.' });
    flushEvents();
  }

  function startCombatRound(): boolean {
    if (world.combatStarted === 1) return false;
    if (activeBoardCount() === 0) return invalidResult('Deploy at least one bird into the four active board slots before starting combat.');
    
    world.combatStarted = 1;
    world.battleEnded = 0;
    
    // Give everyone full mana/gauge resets at the start
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isCombatParticipant(entity)) continue;
      world.actionGauge[entity] = 0;
      world.star[entity] = 0; 
      world.targetEntity[entity] = -1;
    }

    emitEvent(world, { type: 'battle_started', message: 'Auto-battle started. Let the chaos unfold!' });
    flushEvents();
    return true;
  }

  function moveUnitToSlot(entity: number, targetSlot: number): boolean {
    if (world.combatStarted === 1) return invalidResult('You cannot rearrange formation after combat starts.');
    if (!canDragUnit(entity)) return invalidResult('Only living birds on the board or bench can be moved.');
    if (!isPlayerFormationSlot(targetSlot)) return invalidResult('Drop birds on active board or bench slots only.');
    
    const sourceSlot = world.formationSlot[entity];
    const occupant = slotOccupant(world, targetSlot);
    
    if (occupant >= 0 && occupant !== entity) setUnitSlot(occupant, sourceSlot);
    setUnitSlot(entity, targetSlot);
    
    emitEvent(world, { type: 'unit_deployed', entity, message: `${world.displayName[entity]} moved to ${isActiveBoardSlot(targetSlot) ? 'the active board' : 'the bench'}.` });
    flushEvents();
    return true;
  }

  function beginDragUnit(entity: number): void {
    if (!canDragUnit(entity)) return;
    world.draggedEntity = entity;
    const [x, y, z] = slotPosition(world.formationSlot[entity], 0.2);
    updateDragPosition(x, y, z);
  }

  function updateDragPosition(x: number, y: number, z = 0.65): void {
    if (world.draggedEntity < 0) return;
    world.dragX = x;
    world.dragY = y;
    world.dragZ = z;
  }

  function dropDraggedUnit(x: number, y: number): void {
    const entity = world.draggedEntity;
    if (entity < 0) return;
    const slot = closestPlayerSlot(x, y);
    clearDrag(world);
    moveUnitToSlot(entity, slot);
  }

  function cancelDrag(): void {
    clearDrag(world);
  }

  function canDragUnit(entity: number): boolean {
    return world.combatStarted === 0 && isPlayerRosterUnit(entity) && isPlayerFormationSlot(world.formationSlot[entity]);
  }

  // --- STATE ACCESSORS ---
  function getSelectedSummary(): EntitySummary | null { return entitySummary(world.selectedEntity); }
  function getEntitySummary(entity: number): EntitySummary | null { return entitySummary(entity); }

  function getCombatants(faction?: Faction): EntitySummary[] {
    const summaries: EntitySummary[] = [];
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isAlive(entity) || world.kind[entity] !== EntityKind.Unit) continue;
      if (faction !== undefined && world.faction[entity] !== faction) continue;
      const summary = entitySummary(entity);
      if (summary) summaries.push(summary);
    }
    return sortSummaries(summaries);
  }

  function getBoardUnits(): EntitySummary[] { return sortSummaries(getPlayerRosterUnits().filter((unit) => isActiveBoardSlot(unit.formationSlot))); }
  function getBenchUnits(): EntitySummary[] { return sortSummaries(getPlayerRosterUnits().filter((unit) => isBenchSlot(unit.formationSlot))); }
  function getEnemyUnits(): EntitySummary[] { return sortSummaries(getCombatants(Faction.Pig).filter((unit) => isEnemyBoardSlot(unit.formationSlot))); }
  
  function getPlayerRosterUnits(): EntitySummary[] {
    return getCombatants(Faction.Player).filter((unit) => isPlayerFormationSlot(unit.formationSlot));
  }

  function getShopSlots(): ShopSlotSummary[] {
    return world.shopRoster.map((unitId, index) => {
      if (!unitId) return { index, unitId: '', name: 'Sold', spriteKey: '', cost: UNIT_COST, empty: true };
      const def = UNIT_CATALOG[unitId];
      return { index, unitId, name: def.displayName, spriteKey: def.spriteKey, cost: UNIT_COST, empty: false };
    });
  }

  function getAutoChessState(): AutoChessState {
    return {
      playerHp: world.playerHp,
      playerGold: world.playerGold,
      shopLocked: world.shopLocked === 1,
      combatStarted: world.combatStarted === 1,
      battleEnded: world.battleEnded === 1,
      roundNumber: world.roundNumber,
      benchSlots: BENCH_SLOTS,
      activeSlots: ACTIVE_BOARD_SLOTS,
      enemySlots: ENEMY_BOARD_SLOTS,
      canStartCombat: world.combatStarted === 0 && world.battleEnded === 0 && activeBoardCount() > 0,
    };
  }

  function getBattleReport(): BattleReport {
    return {
      victory: world.battleEnded === 1 && pigUnitsAlive() === 0,
      territoryId: world.territoryId,
      birds: birdBattleResults(),
      playerHp: world.playerHp,
      playerGold: world.playerGold,
      roundNumber: world.roundNumber,
    };
  }

  // --- DUMMY FUNCTIONS TO PREVENT REACT FROM CRASHING DURING PIVOT ---
  function getTimingPrompt(): TimingPrompt { return { visible: false, label: '', entity: -1, windowProgress: 0, result: CommandResult.Unresolved }; }
  function receiveTimingInput() {}
  function submitTimingInput() {}
  function isAwaitingPlayerCommand() { return false; }
  function canUseDuoAttack() { return false; }
  function selectTarget() {}
  function attackSelected() {}
  function chargedAttackSelected() {}
  function shieldSelected() {}
  function waitSelected() {}
  function duoAttackSelected() {}
  function clickTile() {}
  function endPlayerTurn() {}
  function activateStarPower() {}
  function captureSelected() {}
  function getReachableMask() { return new Uint8Array(40); }
  function getActionMask() { return new Uint8Array(40); }

  return {
    world,
    start,
    prepareRound,
    tick,
    buyFromShop,
    rerollShop,
    toggleShopLock,
    startCombatRound,
    moveUnitToSlot,
    beginDragUnit,
    updateDragPosition,
    dropDraggedUnit,
    cancelDrag,
    canDragUnit,
    selectTarget,
    attackSelected,
    chargedAttackSelected,
    shieldSelected,
    waitSelected,
    duoAttackSelected,
    receiveTimingInput,
    submitTimingInput,
    isAwaitingPlayerCommand,
    canUseDuoAttack,
    getTimingPrompt,
    getSelectedSummary,
    getEntitySummary,
    getCombatants,
    getBoardUnits,
    getBenchUnits,
    getEnemyUnits,
    getShopSlots,
    getAutoChessState,
    getBattleReport,
    clickTile,
    endPlayerTurn,
    activateStarPower,
    captureSelected,
    getReachableMask,
    getActionMask,
  };

  // --- INTERNAL ENGINE HELPERS ---

  function entitySummary(entity: number): EntitySummary | null {
    if (entity < 0 || world.active[entity] !== 1) return null;
    const unitId = world.unitId[entity];
    return {
      id: entity,
      name: world.displayName[entity],
      hp: world.hp[entity],
      maxHp: world.maxHp[entity],
      attack: world.attack[entity],
      defense: world.defense[entity],
      move: world.move[entity],
      rangeMin: world.rangeMin[entity],
      rangeMax: world.rangeMax[entity],
      star: world.star[entity],
      starMax: world.starMax[entity],
      relicMask: world.activeRelics[entity],
      faction: world.faction[entity] as Faction,
      spriteKey: world.spriteKey[entity],
      unitId,
      specialName: UNIT_CATALOG[unitId || 'red']?.starPower ?? 'None',
      actionSpent: false,
      shielded: world.guard[entity] > 0,
      restingNextRound: false,
      stasis: world.stasis[entity],
      slowed: world.slowed[entity],
      airborne: world.airborne[entity],
      expanded: world.expanded[entity] > 0,
      canCapture: false,
      tileActionLabel: '',
      actionGauge: world.actionGauge[entity],
      speed: world.speed[entity],
      timingState: ActionTimingState.Idle,
      commandResult: CommandResult.Unresolved,
      formationSlot: world.formationSlot[entity],
      carriesRelic: world.carriesRelic[entity],
      gaugeFillCount: world.gaugeFillCount[entity],
      isReady: world.actionGauge[entity] >= ACTION_GAUGE_MAX,
      starTier: world.starTier[entity],
      cost: UNIT_COST,
    };
  }

  function sortSummaries(summaries: EntitySummary[]): EntitySummary[] {
    return summaries.sort((a, b) => a.faction - b.faction || a.formationSlot - b.formationSlot || a.id - b.id);
  }

  function evaluateMerges(): void {
    let merged = false;
    const groups = groupMergeCandidates();
    for (const group of groups.values()) {
      if (group.length < 3) continue;
      mergeGroup(group.slice(0, 3));
      merged = true;
      break;
    }
    if (merged) evaluateMerges();
  }

  function groupMergeCandidates(): Map<string, number[]> {
    const groups = new Map<string, number[]>();
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isPlayerRosterUnit(entity)) continue;
      const tier = world.starTier[entity];
      if (tier <= 0 || tier >= 3) continue;
      const key = `${world.unitId[entity]}:${tier}`;
      const group = groups.get(key) ?? [];
      group.push(entity);
      groups.set(key, group);
    }
    for (const group of groups.values()) group.sort(mergePriority);
    return groups;
  }

  function mergePriority(a: number, b: number): number {
    const boardA = isActiveBoardSlot(world.formationSlot[a]) ? 0 : 1;
    const boardB = isActiveBoardSlot(world.formationSlot[b]) ? 0 : 1;
    return boardA - boardB || a - b;
  }

  function mergeGroup(group: number[]): void {
    const [survivor, consumedA, consumedB] = group;
    const nextTier = Math.min(3, world.starTier[survivor] + 1);
    
    world.starTier[survivor] = nextTier;
    world.maxHp[survivor] = Math.ceil(world.maxHp[survivor] * 1.8);
    world.attack[survivor] = Math.ceil(world.attack[survivor] * 1.8);
    world.hp[survivor] = world.maxHp[survivor];
    world.activeRelics[survivor] |= world.activeRelics[consumedA] | world.activeRelics[consumedB];
    
    consumeMergedUnit(consumedA);
    consumeMergedUnit(consumedB);
    playSpecialEffect(world, survivor);
    emitEvent(world, { type: 'unit_merged', entity: survivor, message: `${world.displayName[survivor]} merged into a ${nextTier}-Star unit!` });
  }

  function consumeMergedUnit(entity: number): void {
    world.active[entity] = 0;
    world.formationSlot[entity] = -1;
    world.actionGauge[entity] = 0;
    syncEntityAtlasFrame(world, entity);
  }

  function setUnitSlot(entity: number, slot: number): void {
    world.formationSlot[entity] = slot;
    if (slot >= 0 && slot <= 3) {
      world.x[entity] = 1;
      world.y[entity] = slot;
    } else if (slot >= 10 && slot <= 15) {
      world.x[entity] = slot - 8;
      world.y[entity] = 3;
    }
    syncEntityAtlasFrame(world, entity);
  }

  function activeBoardCount(): number {
    let count = 0;
    for (let entity = 0; entity < world.nextEntity; entity += 1) if (isPlayerCombatUnit(entity)) count += 1;
    return count;
  }

  function birdBattleResults(): BirdBattleResult[] {
    const results: BirdBattleResult[] = [];
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isBirdEntity(entity)) continue;
      results.push({
        bird: world.unitId[entity] as BirdId,
        survived: isAlive(entity),
        hp: world.hp[entity],
        maxHp: world.maxHp[entity],
        relicMask: world.activeRelics[entity],
      });
    }
    return results;
  }

  function isAlive(entity: number): boolean { return worldEntityIsAlive(world, entity); }
  function isBirdEntity(entity: number): boolean { return world.faction[entity] === Faction.Player && world.kind[entity] === EntityKind.Unit && BIRD_SET.has(world.unitId[entity] || ''); }
  function isPlayerRosterUnit(entity: number): boolean { return isAlive(entity) && world.faction[entity] === Faction.Player && world.kind[entity] === EntityKind.Unit; }
  function isPlayerCombatUnit(entity: number): boolean { return isPlayerRosterUnit(entity) && isActiveBoardSlot(world.formationSlot[entity]); }

  function isCombatParticipant(entity: number): boolean {
    if (!isAlive(entity) || world.kind[entity] !== EntityKind.Unit) return false;
    if (world.faction[entity] === Faction.Player) return isActiveBoardSlot(world.formationSlot[entity]);
    if (world.faction[entity] === Faction.Pig) return isEnemyBoardSlot(world.formationSlot[entity]);
    return false;
  }

  function pigUnitsAlive(): number { return countActiveByFaction(Faction.Pig); }
  function playerUnitsAlive(): number {
    let count = 0;
    for (let entity = 0; entity < world.nextEntity; entity += 1) if (isPlayerCombatUnit(entity)) count += 1;
    return count;
  }

  function countActiveByFaction(faction: Faction): number {
    let count = 0;
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isAlive(entity) || world.faction[entity] !== faction || world.kind[entity] !== EntityKind.Unit) continue;
      if (faction === Faction.Pig && !isEnemyBoardSlot(world.formationSlot[entity])) continue;
      count += 1;
    }
    return count;
  }

  function checkBattleEnd(): void {
    if (world.battleEnded === 1 || world.combatStarted === 0) return;
    if (pigUnitsAlive() === 0) endBattle('battle_won', `Round won. +${ROUND_WIN_GOLD + world.roundNumber} gold.`);
    if (playerUnitsAlive() === 0) endBattle('battle_lost', `Round lost. Commander HP -${ROUND_LOSS_HP}.`);
  }

  function endBattle(type: 'battle_won' | 'battle_lost', message: string): void {
    world.battleEnded = 1;
    world.combatStarted = 0;
    if (type === 'battle_won') {
      world.playerGold += ROUND_WIN_GOLD + world.roundNumber;
      world.roundNumber += 1;
      world.shopLocked = 0;
    } else {
      world.playerHp = Math.max(0, world.playerHp - ROUND_LOSS_HP);
    }
    emitEvent(world, { type, message });
  }

  function invalidResult(message: string): false {
    emitEvent(world, { type: 'invalid_action', message });
    flushEvents();
    return false;
  }

  function flushEvents(): void {
    drainEvents(world).forEach(onEvent);
  }
}