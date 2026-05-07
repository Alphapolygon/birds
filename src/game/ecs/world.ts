import { MAX_ENTITIES, TILE_COUNT } from '../constants';
import {
  ActionTimingState,
  BossRule,
  CommandResult,
  EntityKind,
  Faction,
  TerrainType,
  TimelineActionKind,
  TurnSide,
  type BirdId,
  type GameEvent,
  type PendingAction,
  type UnitId,
} from '../types';

export type World = {
  nextEntity: number;
  selectedEntity: number;
  currentTurn: TurnSide;
  turnNumber: number;
  battleEnded: 0 | 1;
  bossRule: BossRule;
  territoryId: string;
  actionQueue: PendingAction[];
  events: GameEvent[];

  // Auto-chess economy / preparation state.
  playerHp: number;
  playerGold: number;
  shopRoster: (BirdId | '')[];
  shopLocked: 0 | 1;
  combatStarted: 0 | 1;
  roundNumber: number;
  currentBattleId: number;
  draggedEntity: number;
  dragX: number;
  dragY: number;
  dragZ: number;

  // Timeline / timing-combat state.
  activeEntity: number;
  activeTarget: number;
  activeCommandEntity: number;
  activeActionKind: TimelineActionKind;
  activeActionClock: number;
  activeWindowDuration: number;
  activeDamageResolved: 0 | 1;
  waitingForCommand: 0 | 1;
  timelinePaused: 0 | 1;
  partyComboMeter: number;
  partyComboMax: number;
  bossEntity: number;
  bossTimer: number;
  timeWarpMultiplier: number;
  duoActorA: number;
  duoActorB: number;
  duoStep: number;

  active: Uint8Array;
  kind: Uint8Array;
  faction: Uint8Array;
  unitCode: Int16Array;
  x: Int32Array;
  y: Int32Array;
  sizeW: Uint8Array;
  sizeH: Uint8Array;
  hp: Int32Array;
  maxHp: Int32Array;
  attack: Int32Array;
  defense: Int32Array;
  move: Int32Array;
  rangeMin: Int32Array;
  rangeMax: Int32Array;
  star: Int32Array;
  starMax: Int32Array;
  activeRelics: Uint32Array;
  canBeHealed: Uint8Array;
  moved: Uint8Array;
  acted: Uint8Array;
  stasis: Uint8Array;
  slowed: Uint8Array;
  airborne: Uint8Array;
  stolenEgg: Uint8Array;
  guard: Uint8Array;
  chargeSkip: Uint8Array;
  delayedOwner: Int32Array;
  delayedKind: Uint8Array;
  pendingX: Int32Array;
  pendingY: Int32Array;
  expanded: Uint8Array;
  animAttack: Float32Array;
  animHit: Float32Array;
  animShield: Float32Array;
  animDir: Int8Array;
  fxKind: Uint8Array;
  fxLife: Float32Array;
  fxMaxLife: Float32Array;

  // Per-entity sprite atlas UV buffers. The renderer uploads these as instanced attributes.
  uvOffsetX: Float32Array;
  uvOffsetY: Float32Array;
  uvScaleX: Float32Array;
  uvScaleY: Float32Array;
  uvAspectRatio: Float32Array;

  // Static-stage / auto-chess ECS buffers.
  formationSlot: Int8Array;
  starTier: Uint8Array;
  speed: Int32Array;
  actionGauge: Float32Array;
  timingState: Uint8Array;
  timingClock: Float32Array;
  commandResult: Uint8Array;
  targetEntity: Int32Array;
  blockWindowBonus: Uint8Array;
  carriesRelic: Uint32Array;
  gaugeFillCount: Uint8Array;
  lastAttacker: Int32Array;

  displayName: string[];
  spriteKey: string[];
  unitId: (UnitId | '')[];

  // Legacy tactical grid buffers kept for type-safe archived modules.
  gridOccupant: Int32Array;
  gridTerrain: Uint8Array;
  gridOwner: Uint8Array;
  gridCapture: Uint8Array;
};

export function createWorld(): World {
  const world = makeWorld();
  resetWorld(world);
  return world;
}

export function resetWorld(world: World): void {
  world.nextEntity = 0;
  world.selectedEntity = -1;
  world.currentTurn = TurnSide.Player;
  world.turnNumber = 1;
  world.battleEnded = 0;
  world.bossRule = BossRule.None;
  world.territoryId = '';
  world.actionQueue.length = 0;
  world.events.length = 0;
  resetEconomy(world);
  resetTimeline(world);
  clearEntityArrays(world);
  clearGrid(world);
}

export function resetEconomy(world: World): void {
  world.playerHp = 100;
  world.playerGold = 10;
  world.shopRoster = ['', '', '', '', ''];
  world.shopLocked = 0;
  world.combatStarted = 0;
  world.roundNumber = 1;
  world.currentBattleId = 0;
  clearDrag(world);
}

export function resetTimeline(world: World): void {
  world.activeEntity = -1;
  world.activeTarget = -1;
  world.activeCommandEntity = -1;
  world.activeActionKind = TimelineActionKind.None;
  world.activeActionClock = 0;
  world.activeWindowDuration = 0;
  world.activeDamageResolved = 0;
  world.waitingForCommand = 0;
  world.timelinePaused = 0;
  world.partyComboMeter = 0;
  world.partyComboMax = 8;
  world.bossEntity = -1;
  world.bossTimer = 0;
  world.timeWarpMultiplier = 1;
  world.duoActorA = -1;
  world.duoActorB = -1;
  world.duoStep = 0;
}

export function allocateEntity(world: World): number {
  const id = world.nextEntity;
  world.nextEntity += 1;
  if (id >= MAX_ENTITIES) throw new Error(`MAX_ENTITIES exceeded: ${MAX_ENTITIES}`);
  world.active[id] = 1;
  world.canBeHealed[id] = 1;
  world.sizeW[id] = 1;
  world.sizeH[id] = 1;
  world.starTier[id] = 1;
  world.delayedOwner[id] = -1;
  world.targetEntity[id] = -1;
  world.lastAttacker[id] = -1;
  world.uvScaleX[id] = 1;
  world.uvScaleY[id] = 1;
  world.uvAspectRatio[id] = 1;
  return id;
}

export function emitEvent(world: World, event: GameEvent): void {
  world.events.push(event);
}

export function drainEvents(world: World): GameEvent[] {
  const events = world.events.slice();
  world.events.length = 0;
  return events;
}

export function isAlive(world: World, entity: number): boolean {
  return entity >= 0 && world.active[entity] === 1 && world.hp[entity] > 0;
}

export function isUnit(world: World, entity: number): boolean {
  return world.active[entity] === 1 && world.kind[entity] === EntityKind.Unit;
}

export function entityFaction(world: World, entity: number): Faction {
  return world.faction[entity] as Faction;
}

export function clearDrag(world: World): void {
  world.draggedEntity = -1;
  world.dragX = 0;
  world.dragY = 0;
  world.dragZ = 0;
}

function makeWorld(): World {
  return {
    nextEntity: 0,
    selectedEntity: -1,
    currentTurn: TurnSide.Player,
    turnNumber: 1,
    battleEnded: 0,
    bossRule: BossRule.None,
    territoryId: '',
    actionQueue: [],
    events: [],
    playerHp: 100,
    playerGold: 10,
    shopRoster: ['', '', '', '', ''],
    shopLocked: 0,
    combatStarted: 0,
    roundNumber: 1,
    currentBattleId: 0,
    draggedEntity: -1,
    dragX: 0,
    dragY: 0,
    dragZ: 0,
    activeEntity: -1,
    activeTarget: -1,
    activeCommandEntity: -1,
    activeActionKind: TimelineActionKind.None,
    activeActionClock: 0,
    activeWindowDuration: 0,
    activeDamageResolved: 0,
    waitingForCommand: 0,
    timelinePaused: 0,
    partyComboMeter: 0,
    partyComboMax: 8,
    bossEntity: -1,
    bossTimer: 0,
    timeWarpMultiplier: 1,
    duoActorA: -1,
    duoActorB: -1,
    duoStep: 0,
    active: new Uint8Array(MAX_ENTITIES),
    kind: new Uint8Array(MAX_ENTITIES),
    faction: new Uint8Array(MAX_ENTITIES),
    unitCode: new Int16Array(MAX_ENTITIES),
    x: new Int32Array(MAX_ENTITIES),
    y: new Int32Array(MAX_ENTITIES),
    sizeW: new Uint8Array(MAX_ENTITIES),
    sizeH: new Uint8Array(MAX_ENTITIES),
    hp: new Int32Array(MAX_ENTITIES),
    maxHp: new Int32Array(MAX_ENTITIES),
    attack: new Int32Array(MAX_ENTITIES),
    defense: new Int32Array(MAX_ENTITIES),
    move: new Int32Array(MAX_ENTITIES),
    rangeMin: new Int32Array(MAX_ENTITIES),
    rangeMax: new Int32Array(MAX_ENTITIES),
    star: new Int32Array(MAX_ENTITIES),
    starMax: new Int32Array(MAX_ENTITIES),
    activeRelics: new Uint32Array(MAX_ENTITIES),
    canBeHealed: new Uint8Array(MAX_ENTITIES),
    moved: new Uint8Array(MAX_ENTITIES),
    acted: new Uint8Array(MAX_ENTITIES),
    stasis: new Uint8Array(MAX_ENTITIES),
    slowed: new Uint8Array(MAX_ENTITIES),
    airborne: new Uint8Array(MAX_ENTITIES),
    stolenEgg: new Uint8Array(MAX_ENTITIES),
    guard: new Uint8Array(MAX_ENTITIES),
    chargeSkip: new Uint8Array(MAX_ENTITIES),
    delayedOwner: new Int32Array(MAX_ENTITIES),
    delayedKind: new Uint8Array(MAX_ENTITIES),
    pendingX: new Int32Array(MAX_ENTITIES),
    pendingY: new Int32Array(MAX_ENTITIES),
    expanded: new Uint8Array(MAX_ENTITIES),
    animAttack: new Float32Array(MAX_ENTITIES),
    animHit: new Float32Array(MAX_ENTITIES),
    animShield: new Float32Array(MAX_ENTITIES),
    animDir: new Int8Array(MAX_ENTITIES),
    fxKind: new Uint8Array(MAX_ENTITIES),
    fxLife: new Float32Array(MAX_ENTITIES),
    fxMaxLife: new Float32Array(MAX_ENTITIES),
    uvOffsetX: new Float32Array(MAX_ENTITIES),
    uvOffsetY: new Float32Array(MAX_ENTITIES),
    uvScaleX: new Float32Array(MAX_ENTITIES),
    uvScaleY: new Float32Array(MAX_ENTITIES),
    uvAspectRatio: new Float32Array(MAX_ENTITIES),
    formationSlot: new Int8Array(MAX_ENTITIES),
    starTier: new Uint8Array(MAX_ENTITIES),
    speed: new Int32Array(MAX_ENTITIES),
    actionGauge: new Float32Array(MAX_ENTITIES),
    timingState: new Uint8Array(MAX_ENTITIES),
    timingClock: new Float32Array(MAX_ENTITIES),
    commandResult: new Uint8Array(MAX_ENTITIES),
    targetEntity: new Int32Array(MAX_ENTITIES),
    blockWindowBonus: new Uint8Array(MAX_ENTITIES),
    carriesRelic: new Uint32Array(MAX_ENTITIES),
    gaugeFillCount: new Uint8Array(MAX_ENTITIES),
    lastAttacker: new Int32Array(MAX_ENTITIES),
    displayName: Array.from({ length: MAX_ENTITIES }, () => ''),
    spriteKey: Array.from({ length: MAX_ENTITIES }, () => ''),
    unitId: Array.from({ length: MAX_ENTITIES }, () => ''),
    gridOccupant: new Int32Array(TILE_COUNT),
    gridTerrain: new Uint8Array(TILE_COUNT),
    gridOwner: new Uint8Array(TILE_COUNT),
    gridCapture: new Uint8Array(TILE_COUNT),
  };
}

function clearEntityArrays(world: World): void {
  world.active.fill(0);
  world.kind.fill(EntityKind.Empty);
  world.faction.fill(Faction.None);
  world.unitCode.fill(-1);
  world.x.fill(0);
  world.y.fill(0);
  world.sizeW.fill(1);
  world.sizeH.fill(1);
  world.hp.fill(0);
  world.maxHp.fill(0);
  world.attack.fill(0);
  world.defense.fill(0);
  world.move.fill(0);
  world.rangeMin.fill(0);
  world.rangeMax.fill(0);
  world.star.fill(0);
  world.starMax.fill(0);
  world.activeRelics.fill(0);
  world.canBeHealed.fill(1);
  world.moved.fill(0);
  world.acted.fill(0);
  world.stasis.fill(0);
  world.slowed.fill(0);
  world.airborne.fill(0);
  world.stolenEgg.fill(0);
  world.guard.fill(0);
  world.chargeSkip.fill(0);
  world.delayedOwner.fill(-1);
  world.delayedKind.fill(0);
  world.pendingX.fill(0);
  world.pendingY.fill(0);
  world.expanded.fill(0);
  world.animAttack.fill(0);
  world.animHit.fill(0);
  world.animShield.fill(0);
  world.animDir.fill(0);
  world.fxKind.fill(0);
  world.fxLife.fill(0);
  world.fxMaxLife.fill(0);
  world.uvOffsetX.fill(0);
  world.uvOffsetY.fill(0);
  world.uvScaleX.fill(1);
  world.uvScaleY.fill(1);
  world.uvAspectRatio.fill(1);
  world.formationSlot.fill(-1);
  world.starTier.fill(0);
  world.speed.fill(0);
  world.actionGauge.fill(0);
  world.timingState.fill(ActionTimingState.Idle);
  world.timingClock.fill(0);
  world.commandResult.fill(CommandResult.Unresolved);
  world.targetEntity.fill(-1);
  world.blockWindowBonus.fill(0);
  world.carriesRelic.fill(0);
  world.gaugeFillCount.fill(0);
  world.lastAttacker.fill(-1);
  world.displayName.fill('');
  world.spriteKey.fill('');
  world.unitId.fill('');
}

function clearGrid(world: World): void {
  world.gridOccupant.fill(-1);
  world.gridTerrain.fill(TerrainType.Plains);
  world.gridOwner.fill(Faction.None);
  world.gridCapture.fill(0);
}
