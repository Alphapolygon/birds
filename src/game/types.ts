export const enum Faction {
  None = 0,
  Player = 1,
  Pig = 2,
  Prop = 3,
}

export const enum TerrainType {
  Plains = 0,
  Trench = 1,
  Watchtower = 2,
  Barricade = 3,
  MedicTent = 4,
}

export const enum EntityKind {
  Empty = 0,
  Unit = 1,
  GoldenEgg = 2,
  Barricade = 3,
  Projectile = 4,
  DelayedBomb = 5,
}

export const enum TurnSide {
  Player = 1,
  Pig = 2,
}

export const enum BossRule {
  None = 0,
  ShiftingLanes = 1,
  GravityVacuum = 2,
  BouncyGrid = 3,
  HiddenPrompts = 4,
  TimeWarp = 5,
  ComboDrain = 6,
}

export const enum ActionTimingState {
  Idle = 0,
  Windup = 1,
  ActionWindow = 2,
  Recovery = 3,
}

export const enum CommandResult {
  Unresolved = 0,
  Fail = 1,
  Good = 2,
  Perfect = 3,
}

export const enum TimelineActionKind {
  None = 0,
  BasicAttack = 1,
  ChargedAttack = 2,
  EnemyAttack = 3,
  DuoAttack = 4,
}

export type BirdId =
  | 'red'
  | 'chuck'
  | 'terence'
  | 'silver'
  | 'bomb'
  | 'matilda'
  | 'hal'
  | 'stella'
  | 'blues'
  | 'bubbles'
  | 'melody';

export type UnitId = BirdId | 'pig_grunt' | 'pig_archer' | 'pig_bruiser' | 'pig_thief' | 'pig_boss';

export type TimingRelicId = 'greased_feathers' | 'hourglass_shard' | 'mirror_shield' | 'combo_battery' | 'cursed_weights';

export type LegacyRelicId =
  | 'brimstone_feather'
  | 'rubberized_yolk'
  | 'cluster_core'
  | 'cursed_crown'
  | 'orbiting_fly'
  | 'spectral_talons'
  | 'leech_seed'
  | 'seismic_stomp'
  | 'golden_magnet';

export type RelicId = TimingRelicId | LegacyRelicId;

export type CombatRole = 'melee' | 'indirect' | 'specialist';

export type UnitDefinition = {
  id: UnitId;
  displayName: string;
  spriteKey: string;
  faction: Faction;
  role: CombatRole;
  maxHp: number;
  attack: number;
  defense: number;
  move: number;
  rangeMin: number;
  rangeMax: number;
  sizeW?: number;
  sizeH?: number;
  starPower: string;
  passive: string;
};

export type ActionType = 'move' | 'attack' | 'charged_attack' | 'shield' | 'capture' | 'wait' | 'star' | 'duo_attack';

export type PlayerActionMode = 'walk' | 'attack' | 'charged_attack';

export type PendingAction = {
  type: ActionType;
  actor: number;
  target?: number;
  x?: number;
  y?: number;
};

export type GameEventType =
  | 'battle_started'
  | 'unit_selected'
  | 'unit_moved'
  | 'unit_damaged'
  | 'unit_healed'
  | 'unit_shielded'
  | 'charged_attack'
  | 'unit_destroyed'
  | 'relic_gained'
  | 'turn_started'
  | 'battle_won'
  | 'battle_lost'
  | 'invalid_action'
  | 'star_power'
  | 'terrain_changed'
  | 'structure_captured'
  | 'exp_gained'
  | 'level_up'
  | 'territory_conquered'
  | 'timeline_ready'
  | 'timing_perfect'
  | 'timing_fail'
  | 'combo_changed'
  | 'boss_rule'
  | 'shop_refreshed'
  | 'unit_bought'
  | 'unit_merged'
  | 'unit_deployed'
  | 'unit_dragged'
  | 'round_started'
  | 'gold_changed';

export type GameEvent = {
  type: GameEventType;
  message: string;
  entity?: number;
};

export type DraftChoice = {
  left: BirdId;
  right: BirdId;
};

export type BattleSeed = {
  birds: BirdId[];
  bossRule: BossRule;
  birdRelics?: Partial<Record<BirdId, number>>;
  territoryId?: string;
  battleId?: number;
};

export type PrepSeed = {
  bossRule: BossRule;
  territoryId?: string;
  battleId?: number;
};
