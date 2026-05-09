import { BOSS_ROUND_NUMBER, GRID_COLS, MAP_BATTLE_ROUNDS, TILE_COUNT } from '../constants';
import {
  ACTIVE_BOARD_SLOTS,
  BENCH_SLOTS,
  ENEMY_BOARD_SLOTS,
  closestActiveBoardSlot,
  isActiveBoardSlot,
  isBenchSlot,
  isEnemyBoardSlot,
  gridStagePosition,
  isPlayerFormationSlot,
  slotPosition,
} from '../formationSlots';
import { relicNameFromBit } from '../relicCatalog';
import { syncEntityAtlasFrame } from '../spriteAtlas';
import { BIRD_IDS, UNIT_CATALOG } from '../unitCatalog';
import {
  ActionAnimState,
  AutoActionKind,
  BossRule,
  EntityKind,
  Faction,
  type BattleSeed,
  type BirdId,
  type GameEvent,
  type PlayerActionMode,
  type PrepSeed,
  type UnitId,
} from '../types';
import {
  FloatingTextKind,
  playAttackAnimation,
  playHitAnimation,
  playShieldAnimation,
  playSpecialEffect,
  spawnEffectAtEntity,
  spawnEffectAtPosition,
  spawnFloatingText,
  tickAnimations,
} from './animation';
import { grantRelicBit, hasRelic } from './relics';
import {
  firstOpenBenchSlot,
  initializeBattle,
  isBossRound,
  mapBattleIsComplete,
  prepareAutoChessRound,
  prepareNextAutoChessRound,
  refreshShopRoster,
  snapEntityToSlot,
  slotOccupant,
  spawnUnitInSlot,
} from './spawn';
import { inBounds, manhattan, tileIndex } from './grid';
import { clearDrag, createWorld, drainEvents, emitEvent, isAlive as worldEntityIsAlive, type World } from './world';

export const ACTION_GAUGE_MAX = 100;
export const MANA_MAX = 100;
export const AUTO_ATTACK_IMPACT_SECONDS = 0.24;
export const AUTO_ATTACK_RECOVERY_SECONDS = 0.28;
export const WINDUP_SECONDS = AUTO_ATTACK_IMPACT_SECONDS;
export const RECOVERY_SECONDS = AUTO_ATTACK_RECOVERY_SECONDS;
export const UNIT_COST = 3;
export const REROLL_COST = 2;
export const ROUND_WIN_GOLD = 5;
export const ROUND_LOSS_HP = 12;

const BOARD_MIN_X = -3.95;
const BOARD_MAX_X = 3.65;
const BOARD_MIN_Y = -1.28;
const BOARD_MAX_Y = 1.08;
const COUNTER_CHANCE = 0.22;

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
  attackCooldown: number;
  mana: number;
  speed: number;
  actionState: ActionAnimState;
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
  mapBattleRounds: number;
  bossRoundNumber: number;
  isBossRound: boolean;
  mapBattleComplete: boolean;
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
  mapBattleComplete: boolean;
  bossRound: boolean;
};

export type BattleEngine = ReturnType<typeof createBattleEngine>;

const BIRD_SET = new Set<string>(BIRD_IDS);

export function createBattleEngine(onEvent: (event: GameEvent) => void) {
  const world = createWorld();
  const viewport = { width: 1, height: 1, cameraX: 0, cameraY: 0, zoom: 82 };

  function start(seed: BattleSeed): void {
    initializeBattle(world, seed);
    initializeAutoCombatState();
    flushEvents();
  }

  function prepareRound(seed: PrepSeed): void {
    prepareAutoChessRound(world, seed);
    syncAllRosterFrames();
    flushEvents();
  }

  function prepareNextRound(): void {
    if (world.combatStarted === 1) return;
    prepareNextAutoChessRound(world);
    syncAllRosterFrames();
    flushEvents();
  }

  function tick(delta: number): void {
    const step = Math.min(0.05, Math.max(0, delta));
    tickAnimations(world, step);
    if (world.battleEnded === 1) {
      flushEvents();
      return;
    }
    if (world.combatStarted === 1) {
      tickAutoCombat(step);
      checkBattleEnd();
    } else {
      returnBenchToHomes(step);
    }
    flushEvents();
  }

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
    if (world.combatStarted === 1 || world.battleEnded === 1) return;
    world.shopLocked = world.shopLocked === 1 ? 0 : 1;
    emitEvent(world, { type: 'shop_refreshed', message: world.shopLocked === 1 ? 'Shop locked for the next round.' : 'Shop unlocked.' });
    flushEvents();
  }

  function startCombatRound(): boolean {
    if (world.combatStarted === 1) return false;
    if (activeBoardCount() === 0) return invalidResult('Deploy at least one bird on the left-side board before starting combat.');
    world.combatStarted = 1;
    world.battleEnded = 0;
    world.selectedEntity = -1;
    initializeAutoCombatState();
    emitEvent(world, { type: 'battle_started', message: isBossRound(world) ? 'Boss battle started!' : `Round ${world.roundNumber} auto-battle started.` });
    flushEvents();
    return true;
  }

  function moveUnitToSlot(entity: number, targetSlot: number): boolean {
    if (world.combatStarted === 1) return invalidResult('You cannot rearrange formation after combat starts.');
    if (!canDragUnit(entity)) return invalidResult('Only living birds on the board or bench can be moved.');
    if (!isPlayerFormationSlot(targetSlot)) return invalidResult('Drop birds on the left-side board or bottom bench only.');
    const sourceSlot = world.formationSlot[entity];
    const occupant = slotOccupant(world, targetSlot);
    if (occupant >= 0 && occupant !== entity) setUnitSlot(occupant, sourceSlot);
    setUnitSlot(entity, targetSlot);
    emitEvent(world, { type: 'unit_deployed', entity, message: `${world.displayName[entity]} moved to ${isActiveBoardSlot(targetSlot) ? 'the board' : 'the bench'}.` });
    flushEvents();
    return true;
  }

  function beginDragUnit(entity: number): void {
    if (!canDragUnit(entity)) return;
    world.draggedEntity = entity;
    updateDragPosition(world.posX[entity], world.posY[entity], world.posZ[entity] + 0.42);
  }

  function updateDragPosition(x: number, y: number, z = 0.72): void {
    if (world.draggedEntity < 0) return;
    world.dragX = x;
    world.dragY = y;
    world.dragZ = z;
  }

  function dropDraggedUnit(x: number, y: number): void {
    const entity = world.draggedEntity;
    if (entity < 0) return;
    const slot = closestActiveBoardSlot(x, y);
    clearDrag(world);
    if (slot === null) {
      snapEntityToSlot(world, entity, world.formationSlot[entity]);
      return;
    }
    moveUnitToSlot(entity, slot);
  }

  function setViewport(width: number, height: number, cameraX: number, cameraY: number, zoom: number): void {
    viewport.width = Math.max(1, width);
    viewport.height = Math.max(1, height);
    viewport.cameraX = cameraX;
    viewport.cameraY = cameraY;
    viewport.zoom = Math.max(1, zoom);
  }

  function updateDragFromClient(clientX: number, clientY: number, z = 0.82): void {
    const point = stagePointFromClient(clientX, clientY);
    if (!point) return;
    updateDragPosition(point.x, point.y, z);
  }

  function dropDraggedUnitFromClient(clientX: number, clientY: number): void {
    const point = stagePointFromClient(clientX, clientY);
    if (!point) {
      cancelDrag();
      return;
    }
    dropDraggedUnit(point.x, point.y);
  }

  function cancelDrag(): void {
    clearDrag(world);
  }

  function canDragUnit(entity: number): boolean {
    return world.combatStarted === 0 && isPlayerRosterUnit(entity) && isPlayerFormationSlot(world.formationSlot[entity]);
  }

  function selectTarget(entity: number): void {
    if (!canSelectTarget(entity)) return;
    world.activeTarget = entity;
    emitEvent(world, { type: 'unit_selected', entity, message: `${world.displayName[entity]} marked as a preferred target.` });
    flushEvents();
  }

  function attackSelected(): void { invalid('Manual attacks were removed. Auto-battle controls attacks now.'); }
  function chargedAttackSelected(): void { invalid('Charged attacks were removed. Mana specials auto-cast.'); }
  function shieldSelected(): void { invalid('Manual shield commands were removed. Bubbles and relics create shields automatically.'); }
  function waitSelected(): void { invalid('Manual wait commands were removed. Combat runs continuously.'); }
  function duoAttackSelected(): void { invalid('Duo attacks were removed. Star powers now auto-cast from Mana.'); }

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
  function getPlayerRosterUnits(): EntitySummary[] { return getCombatants(Faction.Player).filter((unit) => isPlayerFormationSlot(unit.formationSlot)); }

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
      mapBattleRounds: MAP_BATTLE_ROUNDS,
      bossRoundNumber: BOSS_ROUND_NUMBER,
      isBossRound: isBossRound(world),
      mapBattleComplete: mapBattleIsComplete(world),
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
      mapBattleComplete: mapBattleIsComplete(world),
      bossRound: isBossRound(world) || world.roundNumber > BOSS_ROUND_NUMBER,
    };
  }

  function isAwaitingPlayerCommand(): boolean { return false; }
  function canUseDuoAttack(): boolean { return false; }
  function clickTile(_x?: number, _y?: number, _mode?: PlayerActionMode): void {}
  function endPlayerTurn(): void { waitSelected(); }
  function activateStarPower(): void { duoAttackSelected(); }
  function captureSelected(): void { invalid('Capture was removed in the auto-battler pivot.'); }
  function getReachableMask(): Uint8Array { return new Uint8Array(40); }
  function getActionMask(_mode: PlayerActionMode): Uint8Array { return new Uint8Array(40); }

  return {
    world,
    start,
    prepareRound,
    prepareNextRound,
    tick,
    buyFromShop,
    rerollShop,
    toggleShopLock,
    startCombatRound,
    moveUnitToSlot,
    beginDragUnit,
    updateDragPosition,
    dropDraggedUnit,
    setViewport,
    updateDragFromClient,
    dropDraggedUnitFromClient,
    cancelDrag,
    canDragUnit,
    selectTarget,
    attackSelected,
    chargedAttackSelected,
    shieldSelected,
    waitSelected,
    duoAttackSelected,
    isAwaitingPlayerCommand,
    canUseDuoAttack,
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

  function tickAutoCombat(delta: number): void {
    tickBossRule(delta);
    tickGridMovement(delta);
    tickUnitActions(delta);
    syncCombatSprites();
  }

  function tickUnitActions(delta: number): void {
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isCombatParticipant(entity)) continue;
      if (world.stasis[entity] > 0) {
        world.stasis[entity] = Math.max(0, world.stasis[entity] - 1);
        continue;
      }
      tickEntityAction(entity, delta);
    }
  }

  function tickEntityAction(entity: number, delta: number): void {
    const state = world.actionState[entity] as ActionAnimState;
    if (state !== ActionAnimState.Idle) {
      advanceAction(entity, delta);
      return;
    }
    const target = nearestEnemyTarget(entity);
    world.targetEntity[entity] = target;
    if (target < 0) return;
    const interval = attackInterval(entity);
    world.attackCooldown[entity] = Math.max(0, world.attackCooldown[entity] - delta * cooldownRate(entity));
    world.actionGauge[entity] = Math.max(0, Math.min(ACTION_GAUGE_MAX, (1 - world.attackCooldown[entity] / interval) * ACTION_GAUGE_MAX));
    if (isGridHopInProgress(entity) || world.attackCooldown[entity] > 0 || !inAttackRange(entity, target)) return;
    if (thiefEscapesIfDone(entity)) return;
    startEntityAction(entity, target);
  }

  function advanceAction(entity: number, delta: number): void {
    const scaled = delta * animationTimeScale();
    world.actionClock[entity] += scaled;
    if (world.activeEntity === entity) world.activeActionClock = world.actionClock[entity];
    const kind = world.actionKind[entity] as AutoActionKind;
    if ((world.actionState[entity] as ActionAnimState) === ActionAnimState.Windup && world.actionResolved[entity] === 0 && world.actionClock[entity] >= AUTO_ATTACK_IMPACT_SECONDS) {
      resolveEntityAction(entity, kind);
      world.actionResolved[entity] = 1;
      if (world.activeEntity === entity) world.activeDamageResolved = 1;
      world.actionState[entity] = ActionAnimState.Recovery;
      world.actionClock[entity] = 0;
      syncEntityAtlasFrame(world, entity);
      return;
    }
    if ((world.actionState[entity] as ActionAnimState) === ActionAnimState.Recovery && world.actionClock[entity] >= AUTO_ATTACK_RECOVERY_SECONDS) finishEntityAction(entity);
  }

  function startEntityAction(actor: number, target: number): void {
    world.selectedEntity = actor;
    world.activeEntity = actor;
    world.activeTarget = target;
    world.activeActionClock = 0;
    world.activeDamageResolved = 0;
    world.actionState[actor] = ActionAnimState.Windup;
    world.actionClock[actor] = 0;
    world.actionResolved[actor] = 0;
    world.actionKind[actor] = world.mana[actor] >= MANA_MAX ? AutoActionKind.Special : AutoActionKind.Attack;
    world.activeActionKind = world.actionKind[actor] as AutoActionKind;
    world.targetEntity[actor] = target;
    maybeRandomizeTimeWarp();
    playAttackAnimation(world, actor, target, world.actionKind[actor] === AutoActionKind.Special);
    syncEntityAtlasFrame(world, actor);
    emitEvent(world, {
      type: world.actionKind[actor] === AutoActionKind.Special ? 'star_power' : 'unit_selected',
      entity: actor,
      message: world.actionKind[actor] === AutoActionKind.Special ? `${world.displayName[actor]} casts ${specialName(world.unitId[actor])}.` : `${world.displayName[actor]} attacks ${world.displayName[target]}.`,
    });
  }

  function resolveEntityAction(attacker: number, kind: AutoActionKind): void {
    const target = world.targetEntity[attacker];
    if (!isAlive(attacker) || !isAlive(target)) return;
    if (kind === AutoActionKind.Special) {
      resolveSpecial(attacker, target);
      world.mana[attacker] = 0;
      world.attackCooldown[attacker] = nextAttackCooldown(attacker) * 0.85;
      return;
    }
    const damage = attackDamage(attacker, target, 1);
    applyDamage(attacker, target, damage, false);
    gainMana(attacker, damage * 7);
    if (isAlive(target)) gainMana(target, damage * 3.5);
    maybeCounterAttack(target, attacker);
  }

  function finishEntityAction(entity: number): void {
    if (world.active[entity] !== 1) return;
    world.actionState[entity] = ActionAnimState.Idle;
    world.actionClock[entity] = 0;
    world.actionResolved[entity] = 0;
    world.actionKind[entity] = AutoActionKind.None;
    world.targetEntity[entity] = -1;
    if (world.activeEntity === entity) {
      world.activeEntity = -1;
      world.activeTarget = -1;
      world.activeActionKind = AutoActionKind.None;
      world.activeActionClock = 0;
      world.activeDamageResolved = 0;
    }
    if (world.attackCooldown[entity] <= 0) world.attackCooldown[entity] = nextAttackCooldown(entity);
    world.actionGauge[entity] = Math.max(0, Math.min(ACTION_GAUGE_MAX, (1 - world.attackCooldown[entity] / attackInterval(entity)) * ACTION_GAUGE_MAX));
    syncEntityAtlasFrame(world, entity);
  }

  function tickGridMovement(delta: number): void {
    syncGridOccupants();
    advanceGridHops(delta);
    const reserved = buildReservedGrid();
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isCombatParticipant(entity)) continue;
      if ((world.actionState[entity] as ActionAnimState) !== ActionAnimState.Idle) continue;
      if (isGridHopInProgress(entity)) continue;
      const target = world.targetEntity[entity] >= 0 && isAlive(world.targetEntity[entity]) ? world.targetEntity[entity] : nearestEnemyTarget(entity);
      world.targetEntity[entity] = target;
      if (target < 0 || inAttackRange(entity, target)) continue;
      const step = nextGridStep(entity, target, reserved);
      if (step) startGridHop(entity, step.x, step.y, reserved);
    }
  }

  function syncGridOccupants(): void {
    world.gridOccupant.fill(-1);
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isCombatParticipant(entity)) continue;
      if (!inBounds(world.x[entity], world.y[entity])) continue;
      world.gridOccupant[tileIndex(world.x[entity], world.y[entity])] = entity;
    }
  }

  function advanceGridHops(delta: number): void {
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isCombatParticipant(entity) || !isGridHopInProgress(entity)) continue;
      advanceGridHop(entity, delta);
    }
  }

  function advanceGridHop(entity: number, delta: number): void {
    const [targetX, targetY, targetZ] = gridStagePosition(world.pendingX[entity], world.pendingY[entity]);
    const dx = targetX - world.posX[entity];
    const dy = targetY - world.posY[entity];
    const distance = Math.hypot(dx, dy);
    const maxStep = gridHopSpeed(entity) * delta;
    if (distance <= Math.max(0.012, maxStep)) {
      world.posX[entity] = targetX;
      world.posY[entity] = targetY;
      world.posZ[entity] = targetZ;
      world.homeX[entity] = targetX;
      world.homeY[entity] = targetY;
      world.homeZ[entity] = targetZ;
      world.x[entity] = world.pendingX[entity];
      world.y[entity] = world.pendingY[entity];
      return;
    }
    const ratio = maxStep / distance;
    world.posX[entity] += dx * ratio;
    world.posY[entity] += dy * ratio;
    world.posZ[entity] += (targetZ + 0.14 - world.posZ[entity]) * Math.min(1, delta * 18);
  }

  function buildReservedGrid(): Int32Array {
    const reserved = new Int32Array(TILE_COUNT);
    reserved.fill(-1);
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isCombatParticipant(entity)) continue;
      reserveTile(reserved, world.x[entity], world.y[entity], entity);
      if (isGridHopInProgress(entity)) reserveTile(reserved, world.pendingX[entity], world.pendingY[entity], entity);
    }
    return reserved;
  }

  function reserveTile(reserved: Int32Array, x: number, y: number, entity: number): void {
    if (inBounds(x, y)) reserved[tileIndex(x, y)] = entity;
  }

  function startGridHop(entity: number, x: number, y: number, reserved: Int32Array): void {
    world.pendingX[entity] = x;
    world.pendingY[entity] = y;
    reserveTile(reserved, x, y, entity);
    const [targetX, targetY, targetZ] = gridStagePosition(x, y);
    world.homeX[entity] = targetX;
    world.homeY[entity] = targetY;
    world.homeZ[entity] = targetZ;
  }

  function nextGridStep(entity: number, target: number, reserved: Int32Array): { x: number; y: number } | null {
    const startX = world.x[entity];
    const startY = world.y[entity];
    if (!inBounds(startX, startY)) return null;

    const startIndex = tileIndex(startX, startY);
    const visited = new Uint8Array(TILE_COUNT);
    const previous = new Int16Array(TILE_COUNT);
    const queue = new Int16Array(TILE_COUNT);
    previous.fill(-1);
    visited[startIndex] = 1;
    queue[0] = startIndex;
    let head = 0;
    let tail = 1;
    let found = -1;

    while (head < tail) {
      const current = queue[head++];
      const cx = current % GRID_COLS;
      const cy = Math.floor(current / GRID_COLS);
      if (current !== startIndex && positionInAttackRange(entity, cx, cy, target)) {
        found = current;
        break;
      }
      for (const [dx, dy] of orderedDirections(entity, target, cx, cy)) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const nextIndex = tileIndex(nx, ny);
        if (visited[nextIndex] === 1 || !canReserveGridTile(entity, nx, ny, reserved)) continue;
        visited[nextIndex] = 1;
        previous[nextIndex] = current;
        queue[tail++] = nextIndex;
      }
    }

    if (found < 0) return fallbackAdjacentStep(entity, target, reserved);
    let step = found;
    while (previous[step] !== startIndex && previous[step] >= 0) step = previous[step];
    return { x: step % GRID_COLS, y: Math.floor(step / GRID_COLS) };
  }

  function fallbackAdjacentStep(entity: number, target: number, reserved: Int32Array): { x: number; y: number } | null {
    const startX = world.x[entity];
    const startY = world.y[entity];
    let best: { x: number; y: number } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const [dx, dy] of orderedDirections(entity, target, startX, startY)) {
      const x = startX + dx;
      const y = startY + dy;
      if (!canReserveGridTile(entity, x, y, reserved)) continue;
      const score = manhattan(x, y, world.x[target], world.y[target]);
      if (score < bestScore) {
        best = { x, y };
        bestScore = score;
      }
    }
    return best;
  }

  function orderedDirections(_entity: number, target: number, fromX: number, fromY: number): ReadonlyArray<readonly [number, number]> {
    const directions: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    directions.sort((a, b) => {
      const scoreA = manhattan(fromX + a[0], fromY + a[1], world.x[target], world.y[target]);
      const scoreB = manhattan(fromX + b[0], fromY + b[1], world.x[target], world.y[target]);
      return scoreA - scoreB;
    });
    return directions;
  }

  function canReserveGridTile(entity: number, x: number, y: number, reserved: Int32Array): boolean {
    if (!inBounds(x, y)) return false;
    const reservedBy = reserved[tileIndex(x, y)];
    return reservedBy === -1 || reservedBy === entity;
  }

  function isGridHopInProgress(entity: number): boolean {
    return world.pendingX[entity] !== world.x[entity] || world.pendingY[entity] !== world.y[entity];
  }

  function gridHopSpeed(entity: number): number {
    return 4.1 + Math.max(1, world.move[entity]) * 0.24;
  }

  function resolveSpecial(attacker: number, target: number): void {
    playSpecialEffect(world, attacker);
    const unitId = world.unitId[attacker];
    switch (unitId) {
      case 'red': resolveRedSpecial(attacker, target); break;
      case 'chuck': resolveChuckSpecial(attacker, target); break;
      case 'terence': resolveTerenceSpecial(attacker, target); break;
      case 'silver': applyDamage(attacker, target, attackDamage(attacker, target, specialMultiplier(attacker) + 0.45), true); break;
      case 'bomb': resolveBombSpecial(attacker, target); break;
      case 'matilda': resolveMatildaSpecial(attacker, target); break;
      case 'hal': resolveHalSpecial(attacker); break;
      case 'stella': resolveStellaSpecial(attacker, target); break;
      case 'blues': resolveBluesSpecial(attacker, target); break;
      case 'bubbles': resolveBubblesSpecial(attacker); break;
      case 'melody': resolveMelodySpecial(attacker); break;
      case 'pig_boss': resolveBossSpecial(attacker); break;
      default: applyDamage(attacker, target, attackDamage(attacker, target, specialMultiplier(attacker)), true);
    }
  }

  function resolveRedSpecial(attacker: number, target: number): void {
    applyDamage(attacker, target, attackDamage(attacker, target, 1.8), true);
    nearbyEnemies(target, 0.95).forEach((enemy) => {
      if (enemy !== target) applyDamage(attacker, enemy, Math.max(1, Math.floor(world.attack[attacker] * 0.75)), true);
    });
    nearbyAllies(attacker, 1.35).forEach((ally) => { world.guard[ally] = 1; playShieldAnimation(world, ally); });
  }

  function resolveChuckSpecial(attacker: number, target: number): void {
    applyDamage(attacker, target, attackDamage(attacker, target, 1.55), true);
    const second = nearestEnemyTarget(attacker, target);
    if (second >= 0) applyDamage(attacker, second, attackDamage(attacker, second, 1.1), true);
  }

  function resolveTerenceSpecial(attacker: number, target: number): void {
    const enemies = nearbyEnemies(target, 1.45);
    if (enemies.length === 0) enemies.push(target);
    enemies.forEach((enemy) => applyDamage(attacker, enemy, attackDamage(attacker, enemy, 1.35), true));
    spawnEffectAtPosition(world, 2, world.posX[attacker] + 0.3, world.posY[attacker], world.posZ[attacker] + 0.55, 0.6);
  }

  function resolveBombSpecial(attacker: number, target: number): void {
    const enemies = nearbyEnemies(target, 1.75);
    if (enemies.length === 0) enemies.push(target);
    enemies.forEach((enemy) => applyDamage(attacker, enemy, attackDamage(attacker, enemy, enemy === target ? 2.0 : 1.15), true));
  }

  function resolveMatildaSpecial(attacker: number, target: number): void {
    applyDamage(attacker, target, attackDamage(attacker, target, 1.25), true);
    const ally = lowestHpAlly(attacker);
    if (ally >= 0) healUnit(attacker, ally, Math.ceil(world.attack[attacker] * 1.6));
  }

  function resolveHalSpecial(attacker: number): void {
    const backline = furthestEnemy(attacker);
    const target = backline >= 0 ? backline : nearestEnemyTarget(attacker);
    if (target >= 0) applyDamage(attacker, target, attackDamage(attacker, target, 1.75), true);
  }

  function resolveStellaSpecial(attacker: number, target: number): void {
    applyDamage(attacker, target, attackDamage(attacker, target, 1.35), true);
    world.attackCooldown[target] += 0.65;
    world.stasis[target] = 1;
    spawnEffectAtEntity(world, 3, target, 0.55);
  }

  function resolveBluesSpecial(attacker: number, target: number): void {
    const enemies = nearestEnemies(attacker, 3);
    if (!enemies.includes(target)) enemies.unshift(target);
    Array.from(new Set(enemies)).slice(0, 3).forEach((enemy) => applyDamage(attacker, enemy, attackDamage(attacker, enemy, 1.15), true));
  }

  function resolveBubblesSpecial(attacker: number): void {
    nearbyAllies(attacker, 99).forEach((ally) => {
      world.guard[ally] = 1;
      playShieldAnimation(world, ally);
      healUnit(attacker, ally, 2);
    });
  }

  function resolveMelodySpecial(attacker: number): void {
    nearestEnemies(attacker, 5).forEach((enemy, index) => {
      const multiplier = index === 0 ? 1.25 : 0.8;
      applyDamage(attacker, enemy, attackDamage(attacker, enemy, multiplier), true);
    });
  }

  function resolveBossSpecial(attacker: number): void {
    const targets = nearestEnemies(attacker, 4);
    targets.forEach((target) => applyDamage(attacker, target, attackDamage(attacker, target, 1.15), true));
  }

  function applyDamage(attacker: number, target: number, damage: number, special: boolean): void {
    if (!isAlive(target)) return;
    const guarded = world.guard[target] > 0;
    const before = world.hp[target];
    const mitigated = guarded ? Math.max(1, Math.ceil(damage * 0.55)) : damage;
    world.guard[target] = 0;
    world.hp[target] = Math.max(0, world.hp[target] - mitigated);
    const dealt = before - world.hp[target];
    world.lastAttacker[target] = attacker;
    playHitAnimation(world, target);
    spawnFloatingText(world, dealt, target, special ? FloatingTextKind.Mana : FloatingTextKind.Damage);
    emitEvent(world, { type: 'unit_damaged', entity: target, message: `${world.displayName[attacker]} hit ${world.displayName[target]} for ${dealt}.` });
    maybeReflectDamage(target, attacker, dealt);
    cleanupDeadEntity(target, attacker);
  }

  function maybeCounterAttack(defender: number, attacker: number): void {
    if (!isAlive(defender) || !isAlive(attacker)) return;
    if (!inAttackRange(defender, attacker)) return;
    if (world.actionState[defender] !== ActionAnimState.Idle || world.attackCooldown[defender] > 0.18) return;
    if (Math.random() > COUNTER_CHANCE) return;
    const damage = Math.max(1, Math.ceil(attackDamage(defender, attacker, 0.55)));
    world.attackCooldown[defender] = attackInterval(defender) * 0.85;
    playAttackAnimation(world, defender, attacker, false);
    applyDamage(defender, attacker, damage, false);
    spawnFloatingText(world, damage, attacker, FloatingTextKind.Counter);
    emitEvent(world, { type: 'unit_damaged', entity: attacker, message: `${world.displayName[defender]} counter-attacked for ${damage}.` });
  }

  function maybeReflectDamage(defender: number, attacker: number, damage: number): void {
    if (!isAlive(defender) || !isAlive(attacker) || !hasRelic(world, defender, 'mirror_shield')) return;
    const reflected = Math.max(1, Math.floor(damage * 0.25));
    world.hp[attacker] = Math.max(0, world.hp[attacker] - reflected);
    playHitAnimation(world, attacker);
    spawnFloatingText(world, reflected, attacker, FloatingTextKind.Counter);
    emitEvent(world, { type: 'unit_damaged', entity: attacker, message: `${world.displayName[defender]}'s Mirror Shield reflected ${reflected}.` });
    cleanupDeadEntity(attacker, defender);
  }

  function healUnit(source: number, target: number, amount: number): void {
    if (!isAlive(target) || amount <= 0) return;
    const before = world.hp[target];
    world.hp[target] = Math.min(world.maxHp[target], world.hp[target] + amount);
    const healed = world.hp[target] - before;
    if (healed <= 0) return;
    spawnFloatingText(world, healed, target, FloatingTextKind.Heal);
    spawnEffectAtEntity(world, 3, target, 0.45);
    emitEvent(world, { type: 'unit_healed', entity: target, message: `${world.displayName[source]} healed ${world.displayName[target]} for ${healed}.` });
  }

  function gainMana(entity: number, amount: number): void {
    if (!isAlive(entity) || amount <= 0) return;
    const bonus = hasRelic(world, entity, 'combo_battery') ? 1.35 : 1;
    world.mana[entity] = Math.min(MANA_MAX, world.mana[entity] + amount * bonus);
  }

  function maybeGrantCarriedRelic(killer: number, target: number): void {
    if (world.hp[target] > 0 || world.carriesRelic[target] === 0 || world.faction[killer] !== Faction.Player) return;
    const bit = world.carriesRelic[target];
    world.carriesRelic[target] = 0;
    grantRelicBit(world, killer, bit);
    emitEvent(world, { type: 'relic_gained', entity: killer, message: `Golden Egg roulette awarded ${world.displayName[killer]} ${relicNameFromBit(bit)}.` });
  }

  function cleanupDeadEntity(entity: number, killer?: number): void {
    if (world.active[entity] !== 1 || world.hp[entity] > 0) return;
    if (killer !== undefined) maybeGrantCarriedRelic(killer, entity);
    world.active[entity] = 0;
    world.actionGauge[entity] = 0;
    world.attackCooldown[entity] = 0;
    world.mana[entity] = 0;
    world.actionState[entity] = ActionAnimState.Idle;
    world.actionClock[entity] = 0;
    world.actionKind[entity] = AutoActionKind.None;
    world.actionResolved[entity] = 0;
    world.targetEntity[entity] = -1;
    world.pendingX[entity] = world.x[entity];
    world.pendingY[entity] = world.y[entity];
    if (world.activeEntity === entity) {
      world.activeEntity = -1;
      world.activeActionKind = AutoActionKind.None;
      world.activeActionClock = 0;
      world.activeDamageResolved = 0;
    }
    if (world.activeTarget === entity) world.activeTarget = -1;
    syncEntityAtlasFrame(world, entity);
    emitEvent(world, { type: 'unit_destroyed', entity, message: destroyedMessage(entity) });
  }

  function thiefEscapesIfDone(entity: number): boolean {
    if (world.unitId[entity] !== 'pig_thief' || world.carriesRelic[entity] === 0) return false;
    world.gaugeFillCount[entity] = Math.min(3, world.gaugeFillCount[entity] + 1);
    if (world.gaugeFillCount[entity] < 3) return false;
    world.active[entity] = 0;
    world.faction[entity] = Faction.None;
    world.actionGauge[entity] = 0;
    world.attackCooldown[entity] = 0;
    world.targetEntity[entity] = -1;
    world.pendingX[entity] = world.x[entity];
    world.pendingY[entity] = world.y[entity];
    if (world.activeEntity === entity) {
      world.activeEntity = -1;
      world.activeActionKind = AutoActionKind.None;
      world.activeActionClock = 0;
      world.activeDamageResolved = 0;
    }
    if (world.activeTarget === entity) world.activeTarget = -1;
    emitEvent(world, { type: 'unit_destroyed', entity, message: `${world.displayName[entity]} escaped with the Golden Egg relic.` });
    return true;
  }

  function tickBossRule(delta: number): void {
    if (!manaDrainBossActive() || !isBossRound(world)) return;
    world.bossTimer += delta;
    if (world.bossTimer < 1.5) return;
    world.bossTimer = 0;
    const drained = drainPlayerMana(7);
    if (drained > 0) {
      emitEvent(world, { type: 'boss_rule', message: 'Gluttonous Duke eats party Mana.' });
      return;
    }
    triggerDukeWipe();
  }

  function drainPlayerMana(amount: number): number {
    let drained = 0;
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isPlayerCombatUnit(entity) || world.mana[entity] <= 0) continue;
      const before = world.mana[entity];
      world.mana[entity] = Math.max(0, world.mana[entity] - amount);
      drained += before - world.mana[entity];
    }
    return drained;
  }

  function triggerDukeWipe(): void {
    const duke = world.bossEntity >= 0 && isAlive(world.bossEntity) ? world.bossEntity : defaultTarget(Faction.Pig);
    if (duke < 0) return;
    emitEvent(world, { type: 'boss_rule', entity: duke, message: 'The Gluttonous Duke is starving and slams the whole flock.' });
    for (let entity = 0; entity < world.nextEntity; entity += 1) if (isPlayerCombatUnit(entity)) applyDamage(duke, entity, 5, true);
  }

  function maybeRandomizeTimeWarp(): void {
    if (!timeWarpActive() || !isBossRound(world)) {
      world.timeWarpMultiplier = 1;
      return;
    }
    if (Math.random() > 0.18) return;
    world.timeWarpMultiplier = 0.65 + Math.random() * 0.7;
    emitEvent(world, { type: 'boss_rule', message: `Chronomancer Pig warps combat speed to ${world.timeWarpMultiplier.toFixed(2)}x.` });
  }

  function animationTimeScale(): number { return timeWarpActive() && isBossRound(world) ? world.timeWarpMultiplier : 1; }

  function attackInterval(entity: number): number {
    const speed = Math.max(1, world.speed[entity]);
    const tierBonus = 1 + Math.max(0, world.starTier[entity] - 1) * 0.15;
    let seconds = Math.max(0.62, 2.2 - speed * 0.043) / tierBonus;
    if (hasRelic(world, entity, 'greased_feathers')) seconds *= 0.88;
    if (hasRelic(world, entity, 'cursed_weights')) seconds *= 1.12;
    return seconds;
  }

  function cooldownRate(entity: number): number { return hasRelic(world, entity, 'hourglass_shard') ? 1.15 : 1; }
  function nextAttackCooldown(entity: number): number { return hasRelic(world, entity, 'hourglass_shard') ? attackInterval(entity) * 0.75 : attackInterval(entity); }

  function initializeAutoCombatState(): void {
    world.activeEntity = -1;
    world.activeTarget = -1;
    world.activeActionKind = AutoActionKind.None;
    world.activeDamageResolved = 0;
    world.activeActionClock = 0;
    world.bossTimer = 0;
    world.timeWarpMultiplier = 1;
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (world.kind[entity] !== EntityKind.Unit || world.active[entity] !== 1) continue;
      world.actionState[entity] = ActionAnimState.Idle;
      world.actionClock[entity] = 0;
      world.actionKind[entity] = AutoActionKind.None;
      world.actionResolved[entity] = 0;
      world.targetEntity[entity] = -1;
      world.mana[entity] = Math.min(MANA_MAX, Math.max(0, world.mana[entity]));
      if (isCombatParticipant(entity)) {
        world.attackCooldown[entity] = initialCooldown(entity);
        world.actionGauge[entity] = Math.max(0, Math.min(ACTION_GAUGE_MAX, (1 - world.attackCooldown[entity] / attackInterval(entity)) * ACTION_GAUGE_MAX));
        snapEntityToSlot(world, entity, world.formationSlot[entity]);
      } else {
        world.attackCooldown[entity] = 0;
        world.actionGauge[entity] = 0;
      }
      syncEntityAtlasFrame(world, entity);
    }
  }

  function initialCooldown(entity: number): number {
    const slot = world.formationSlot[entity];
    const slotIndex = isEnemyBoardSlot(slot) ? ENEMY_BOARD_SLOTS.indexOf(slot as (typeof ENEMY_BOARD_SLOTS)[number]) : ACTIVE_BOARD_SLOTS.indexOf(slot as (typeof ACTIVE_BOARD_SLOTS)[number]);
    return Math.max(0.05, attackInterval(entity) * (0.25 + Math.max(0, slotIndex) * 0.035));
  }

  function nearestEnemyTarget(actor: number, exclude = -1): number {
    const targetFaction = world.faction[actor] === Faction.Player ? Faction.Pig : Faction.Player;
    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (entity === exclude || !isAlive(entity) || world.kind[entity] !== EntityKind.Unit || world.faction[entity] !== targetFaction) continue;
      if (targetFaction === Faction.Player && !isActiveBoardSlot(world.formationSlot[entity])) continue;
      if (targetFaction === Faction.Pig && !isEnemyBoardSlot(world.formationSlot[entity])) continue;
      const distance = gridDistance(actor, entity);
      const injuredBonus = world.hp[entity] / Math.max(1, world.maxHp[entity]);
      const currentTargetBonus = entity === world.targetEntity[actor] ? -0.1 : 0;
      const activeTargetBonus = entity === world.activeTarget ? -0.15 : 0;
      const score = distance + injuredBonus * 0.15 + currentTargetBonus + activeTargetBonus;
      if (score < bestScore) {
        best = entity;
        bestScore = score;
      }
    }
    return best;
  }

  function nearestTargetFromFaction(targetFaction: Faction): number {
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (isAlive(entity) && world.faction[entity] === targetFaction && world.kind[entity] === EntityKind.Unit) {
        if (targetFaction === Faction.Player && !isActiveBoardSlot(world.formationSlot[entity])) continue;
        if (targetFaction === Faction.Pig && !isEnemyBoardSlot(world.formationSlot[entity])) continue;
        return entity;
      }
    }
    return -1;
  }

  function defaultTarget(faction: Faction): number { return nearestTargetFromFaction(faction); }

  function nearestEnemies(actor: number, count: number): number[] {
    const enemies: number[] = [];
    const faction = world.faction[actor] === Faction.Player ? Faction.Pig : Faction.Player;
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isAlive(entity) || world.kind[entity] !== EntityKind.Unit || world.faction[entity] !== faction) continue;
      if (faction === Faction.Player && !isActiveBoardSlot(world.formationSlot[entity])) continue;
      if (faction === Faction.Pig && !isEnemyBoardSlot(world.formationSlot[entity])) continue;
      enemies.push(entity);
    }
    return enemies.sort((a, b) => gridDistance(actor, a) - gridDistance(actor, b)).slice(0, count);
  }

  function nearbyEnemies(anchor: number, radius: number): number[] {
    const faction = world.faction[anchor] === Faction.Player ? Faction.Pig : Faction.Player;
    const result: number[] = [];
    const gridRadius = Math.max(1, Math.ceil(radius));
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isAlive(entity) || world.faction[entity] !== faction || world.kind[entity] !== EntityKind.Unit) continue;
      if (gridDistance(anchor, entity) <= gridRadius) result.push(entity);
    }
    return result;
  }

  function nearbyAllies(anchor: number, radius: number): number[] {
    const result: number[] = [];
    const gridRadius = Math.max(1, Math.ceil(radius));
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isAlive(entity) || world.faction[entity] !== world.faction[anchor] || world.kind[entity] !== EntityKind.Unit) continue;
      if (world.faction[entity] === Faction.Player && !isActiveBoardSlot(world.formationSlot[entity])) continue;
      if (gridDistance(anchor, entity) <= gridRadius) result.push(entity);
    }
    return result;
  }

  function lowestHpAlly(actor: number): number {
    let best = -1;
    let bestRatio = 1;
    for (const ally of nearbyAllies(actor, 99)) {
      const ratio = world.hp[ally] / Math.max(1, world.maxHp[ally]);
      if (ratio < bestRatio) {
        best = ally;
        bestRatio = ratio;
      }
    }
    return best;
  }

  function furthestEnemy(actor: number): number {
    const enemies = nearestEnemies(actor, 99);
    const direction = world.faction[actor] === Faction.Player ? 1 : -1;
    return enemies.sort((a, b) => (world.x[b] - world.x[a]) * direction)[0] ?? -1;
  }

  function inAttackRange(attacker: number, target: number): boolean {
    return positionInAttackRange(attacker, world.x[attacker], world.y[attacker], target);
  }

  function positionInAttackRange(attacker: number, x: number, y: number, target: number): boolean {
    const distance = manhattan(x, y, world.x[target], world.y[target]);
    const min = Math.max(1, world.rangeMin[attacker]);
    const max = Math.max(min, world.rangeMax[attacker]);
    return distance >= min && distance <= max;
  }

  function gridDistance(a: number, b: number): number {
    return manhattan(world.x[a], world.y[a], world.x[b], world.y[b]);
  }

  function attackDamage(attacker: number, target: number, multiplier: number): number { return Math.max(1, Math.ceil(modifiedAttack(attacker) * multiplier) - world.defense[target]); }
  function modifiedAttack(attacker: number): number { return hasRelic(world, attacker, 'cursed_weights') ? Math.ceil(world.attack[attacker] * 1.5) : world.attack[attacker]; }
  function specialMultiplier(attacker: number): number { return 1.65 + Math.max(0, world.starTier[attacker] - 1) * 0.32; }

  function entitySummary(entity: number): EntitySummary | null {
    if (!isAlive(entity) || world.kind[entity] !== EntityKind.Unit) return null;
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
      star: Math.round(world.mana[entity]),
      starMax: MANA_MAX,
      relicMask: world.activeRelics[entity],
      faction: world.faction[entity] as Faction,
      spriteKey: world.spriteKey[entity],
      unitId,
      specialName: specialName(unitId),
      actionSpent: false,
      shielded: world.guard[entity] > 0,
      restingNextRound: world.actionState[entity] === ActionAnimState.Recovery,
      stasis: world.stasis[entity],
      slowed: world.slowed[entity],
      airborne: world.airborne[entity],
      expanded: false,
      canCapture: false,
      tileActionLabel: 'Auto',
      actionGauge: Math.max(0, Math.min(ACTION_GAUGE_MAX, world.actionGauge[entity])),
      attackCooldown: world.attackCooldown[entity],
      mana: Math.max(0, Math.min(MANA_MAX, world.mana[entity])),
      speed: world.speed[entity],
      actionState: world.actionState[entity] as ActionAnimState,
      formationSlot: world.formationSlot[entity],
      carriesRelic: world.carriesRelic[entity],
      gaugeFillCount: world.gaugeFillCount[entity],
      isReady: world.actionGauge[entity] >= ACTION_GAUGE_MAX || world.attackCooldown[entity] <= 0,
      starTier: world.starTier[entity],
      cost: UNIT_COST,
    };
  }

  function specialName(unitId: UnitId | ''): string { return unitId ? UNIT_CATALOG[unitId]?.starPower ?? 'None' : 'None'; }
  function sortSummaries(summaries: EntitySummary[]): EntitySummary[] { return summaries.sort((a, b) => a.faction - b.faction || a.formationSlot - b.formationSlot || a.id - b.id); }

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
    world.mana[survivor] = Math.max(world.mana[survivor], world.mana[consumedA], world.mana[consumedB]);
    consumeMergedUnit(consumedA);
    consumeMergedUnit(consumedB);
    playSpecialEffect(world, survivor);
    emitEvent(world, { type: 'unit_merged', entity: survivor, message: `${world.displayName[survivor]} merged into a ${nextTier}-Star unit!` });
  }

  function consumeMergedUnit(entity: number): void {
    world.active[entity] = 0;
    world.faction[entity] = Faction.None;
    world.formationSlot[entity] = -1;
    world.actionGauge[entity] = 0;
    world.attackCooldown[entity] = 0;
    world.mana[entity] = 0;
    world.actionState[entity] = ActionAnimState.Idle;
    world.actionClock[entity] = 0;
    world.actionKind[entity] = AutoActionKind.None;
    world.actionResolved[entity] = 0;
    world.targetEntity[entity] = -1;
    world.pendingX[entity] = world.x[entity];
    world.pendingY[entity] = world.y[entity];
    syncEntityAtlasFrame(world, entity);
  }

  function setUnitSlot(entity: number, slot: number): void {
    world.formationSlot[entity] = slot;
    snapEntityToSlot(world, entity, slot);
    syncEntityAtlasFrame(world, entity);
  }

  function activeBoardCount(): number { let count = 0; for (let entity = 0; entity < world.nextEntity; entity += 1) if (isPlayerCombatUnit(entity)) count += 1; return count; }

  function birdBattleResults(): BirdBattleResult[] {
    const results: BirdBattleResult[] = [];
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isBirdEntity(entity)) continue;
      results.push({ bird: world.unitId[entity] as BirdId, survived: isAlive(entity), hp: world.hp[entity], maxHp: world.maxHp[entity], relicMask: world.activeRelics[entity] });
    }
    return results;
  }

  function isAlive(entity: number): boolean { return worldEntityIsAlive(world, entity); }
  function isBirdEntity(entity: number): boolean { return world.faction[entity] === Faction.Player && world.kind[entity] === EntityKind.Unit && BIRD_SET.has(world.unitId[entity]); }
  function isPlayerRosterUnit(entity: number): boolean { return isAlive(entity) && world.faction[entity] === Faction.Player && world.kind[entity] === EntityKind.Unit; }
  function isPlayerCombatUnit(entity: number): boolean { return isPlayerRosterUnit(entity) && isActiveBoardSlot(world.formationSlot[entity]); }
  function isCombatParticipant(entity: number): boolean {
    if (!isAlive(entity) || world.kind[entity] !== EntityKind.Unit) return false;
    if (world.faction[entity] === Faction.Player) return isActiveBoardSlot(world.formationSlot[entity]);
    if (world.faction[entity] === Faction.Pig) return isEnemyBoardSlot(world.formationSlot[entity]);
    return false;
  }

  function pigUnitsAlive(): number { return countActiveByFaction(Faction.Pig); }
  function playerUnitsAlive(): number { return countActiveByFaction(Faction.Player); }
  function countActiveByFaction(faction: Faction): number {
    let count = 0;
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isAlive(entity) || world.faction[entity] !== faction || world.kind[entity] !== EntityKind.Unit) continue;
      if (faction === Faction.Pig && !isEnemyBoardSlot(world.formationSlot[entity])) continue;
      if (faction === Faction.Player && !isActiveBoardSlot(world.formationSlot[entity])) continue;
      count += 1;
    }
    return count;
  }

  function checkBattleEnd(): void {
    if (world.battleEnded === 1 || world.combatStarted === 0) return;
    if (pigUnitsAlive() === 0) endBattle('battle_won', isBossRound(world) ? 'Boss defeated. Territory conquered!' : `Round ${world.roundNumber} won. +${ROUND_WIN_GOLD + world.roundNumber} gold.`);
    if (playerUnitsAlive() === 0) endBattle('battle_lost', `Round lost. Commander HP -${ROUND_LOSS_HP}.`);
  }

  function endBattle(type: 'battle_won' | 'battle_lost', message: string): void {
    world.battleEnded = 1;
    world.combatStarted = 0;
    world.selectedEntity = -1;
    world.activeEntity = -1;
    world.activeTarget = -1;
    world.activeActionKind = AutoActionKind.None;
    if (type === 'battle_won') {
      world.playerGold += ROUND_WIN_GOLD + world.roundNumber;
      world.roundNumber += 1;
      world.shopLocked = 0;
    } else {
      world.playerHp = Math.max(0, world.playerHp - ROUND_LOSS_HP);
    }
    emitEvent(world, { type, message });
  }

  function destroyedMessage(entity: number): string { return world.faction[entity] === Faction.Player ? `${world.displayName[entity]} was knocked out for this round.` : `${world.displayName[entity]} was defeated.`; }
  function timeWarpActive(): boolean { return world.bossRule === BossRule.TimeWarp || world.bossRule === BossRule.ShiftingLanes; }
  function manaDrainBossActive(): boolean { return world.bossRule === BossRule.ComboDrain || world.bossRule === BossRule.GravityVacuum; }
  function canSelectTarget(entity: number): boolean { return isAlive(entity) && world.faction[entity] === Faction.Pig && world.kind[entity] === EntityKind.Unit && isEnemyBoardSlot(world.formationSlot[entity]); }

  function syncCombatSprites(): void { for (let entity = 0; entity < world.nextEntity; entity += 1) if (world.active[entity] === 1 && world.kind[entity] === EntityKind.Unit) syncEntityAtlasFrame(world, entity); }
  function syncAllRosterFrames(): void { for (let entity = 0; entity < world.nextEntity; entity += 1) if (world.active[entity] === 1) syncEntityAtlasFrame(world, entity); }
  function returnBenchToHomes(delta: number): void {
    for (let entity = 0; entity < world.nextEntity; entity += 1) {
      if (!isPlayerRosterUnit(entity)) continue;
      if (!isPlayerFormationSlot(world.formationSlot[entity])) continue;
      const [x, y, z] = slotPosition(world.formationSlot[entity]);
      world.homeX[entity] = x; world.homeY[entity] = y; world.homeZ[entity] = z;
      world.posX[entity] += (x - world.posX[entity]) * Math.min(1, delta * 12);
      world.posY[entity] += (y - world.posY[entity]) * Math.min(1, delta * 12);
      world.posZ[entity] += (z - world.posZ[entity]) * Math.min(1, delta * 12);
      syncEntityAtlasFrame(world, entity);
    }
  }

  function stagePointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.querySelector<HTMLCanvasElement>('.battle-stage canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const normalizedX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const normalizedY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    return {
      x: viewport.cameraX + normalizedX * (viewport.width / viewport.zoom) * 0.5,
      y: viewport.cameraY + normalizedY * (viewport.height / viewport.zoom) * 0.5,
    };
  }

  function invalid(message: string): void { emitEvent(world, { type: 'invalid_action', message }); flushEvents(); }
  function invalidResult(message: string): false { emitEvent(world, { type: 'invalid_action', message }); flushEvents(); return false; }
  function flushEvents(): void { drainEvents(world).forEach(onEvent); }
  function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
}
