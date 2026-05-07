import { create } from 'zustand';
import { EVENT_LOG_LIMIT } from '../game/constants';
import { RELIC_BITS, RELIC_IDS, relicNameFromBit } from '../game/relicCatalog';
import { BIRD_IDS, UNIT_CATALOG } from '../game/unitCatalog';
import { BossRule, type BirdId, type DraftChoice, type GameEvent, type PlayerActionMode } from '../game/types';
import type { BattleReport } from '../game/ecs/engine';

export type AppPhase = 'map' | 'prep' | 'battle' | 'run_over';
export type TerritoryOwner = 'bird' | 'pig';

export type Territory = {
  id: string;
  name: string;
  row: number;
  col: number;
  bossRule: BossRule;
  owner: TerritoryOwner;
  rewardExp: number;
};

export type BirdProgress = {
  level: number;
  exp: number;
  relicMask: number;
  powBattles: number;
};

type GameStore = {
  phase: AppPhase;
  draft: BirdId[];
  currentChoice: DraftChoice | null;
  choiceIndex: number;
  bossRule: BossRule;
  events: GameEvent[];
  battleVersion: number;
  battleId: number;
  actionMode: PlayerActionMode;
  territories: Territory[];
  selectedTerritoryId: string | null;
  birdProgress: Record<BirdId, BirdProgress>;
  campaignMessage: string;
  startRun: () => void;
  startDraft: () => void;
  startCombatPhase: () => void;
  returnToPrepPhase: () => void;
  selectTerritory: (territoryId: string) => void;
  chooseBird: (bird: BirdId) => void;
  setBossRule: (rule: BossRule) => void;
  setActionMode: (mode: PlayerActionMode) => void;
  pushEvent: (event: GameEvent) => void;
  completeBattle: (report: BattleReport) => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'map',
  draft: [],
  currentChoice: null,
  choiceIndex: 0,
  bossRule: BossRule.None,
  events: [],
  battleVersion: 0,
  battleId: 0,
  actionMode: 'walk',
  territories: makeInitialTerritories(),
  selectedTerritoryId: null,
  birdProgress: makeInitialBirdProgress(),
  campaignMessage: 'Choose a Pig territory adjacent to the rebellion nest.',
  startRun: () =>
    set({
      phase: 'map',
      draft: [],
      currentChoice: null,
      choiceIndex: 0,
      bossRule: BossRule.None,
      events: [],
      battleVersion: 0,
      battleId: 0,
      actionMode: 'walk',
      territories: makeInitialTerritories(),
      selectedTerritoryId: null,
      birdProgress: makeInitialBirdProgress(),
      campaignMessage: 'New run started. Choose an adjacent Pig territory.',
    }),
  startDraft: () => startPrepForSelectedTerritory(set, get),
  startCombatPhase: () => set({ phase: 'battle', campaignMessage: 'Auto-battle is resolving.' }),
  returnToPrepPhase: () => set((state) => ({ phase: 'prep', campaignMessage: 'Round won. Spend gold, merge units, reposition, then start the next fight.', battleVersion: state.battleVersion + 1 })),
  selectTerritory: (territoryId) => selectTerritory(set, get, territoryId),
  chooseBird: () => undefined,
  setBossRule: (bossRule) => set({ bossRule }),
  setActionMode: (actionMode) => set({ actionMode }),
  pushEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, EVENT_LOG_LIMIT),
      battleVersion: state.battleVersion + 1,
    })),
  completeBattle: (report) => completeBattle(set, get, report),
}));

export function selectedTerritory(state: GameStore): Territory | null {
  return state.territories.find((territory) => territory.id === state.selectedTerritoryId) ?? null;
}

export function territoryIsSelectable(territory: Territory, territories: Territory[]): boolean {
  if (territory.owner !== 'pig') return false;
  return territories.some((candidate) => candidate.owner === 'bird' && areAdjacent(candidate, territory));
}

export function availableBirdIds(progress: Record<BirdId, BirdProgress>): BirdId[] {
  return BIRD_IDS.filter((bird) => progress[bird].powBattles <= 0);
}

function startPrepForSelectedTerritory(set: StoreSet, get: StoreGet): void {
  const state = get();
  if (!state.selectedTerritoryId) return;
  const territory = selectedTerritory(state);
  if (!territory) return;
  set({
    phase: 'prep',
    draft: [],
    currentChoice: null,
    choiceIndex: 0,
    bossRule: territory.bossRule,
    events: [],
    actionMode: 'walk',
    campaignMessage: `Prepare your auto-chess board for ${territory.name}. Buy birds, merge triples, then start combat.`,
  });
}

function selectTerritory(set: StoreSet, get: StoreGet, territoryId: string): void {
  const state = get();
  const territory = state.territories.find((candidate) => candidate.id === territoryId);
  if (!territory || !territoryIsSelectable(territory, state.territories)) return;
  set({
    selectedTerritoryId: territory.id,
    bossRule: territory.bossRule,
    phase: 'prep',
    battleId: state.battleId + 1,
    events: [],
    campaignMessage: `Preparing attack on ${territory.name}.`,
  });
}

function completeBattle(set: StoreSet, get: StoreGet, report: BattleReport): void {
  const state = get();
  if (state.phase !== 'battle' && state.phase !== 'prep') return;
  const territoryId = report.territoryId || state.selectedTerritoryId;
  const territory = state.territories.find((candidate) => candidate.id === territoryId) ?? selectedTerritory(state);
  const meta = applyBattleReport(state.birdProgress, report, territory?.rewardExp ?? 0);
  const victoryConquers = report.victory && report.mapBattleComplete;
  const territories = victoryConquers && territory ? conquerTerritory(state.territories, territory.id) : state.territories;
  const conqueredAll = territories.every((candidate) => candidate.owner === 'bird');
  const stillAlive = report.playerHp > 0;
  const phase = nextCampaignPhase(victoryConquers, conqueredAll, stillAlive);
  const campaignMessage = campaignResultMessage(victoryConquers, conqueredAll, stillAlive, territory?.name ?? 'the territory', report.playerHp, report.playerGold);
  set({
    phase,
    territories,
    birdProgress: meta.progress,
    draft: [],
    currentChoice: null,
    choiceIndex: 0,
    selectedTerritoryId: null,
    actionMode: 'walk',
    campaignMessage,
    events: [...meta.events, ...state.events].slice(0, EVENT_LOG_LIMIT),
    battleVersion: state.battleVersion + 1,
  });
}

function applyBattleReport(progress: Record<BirdId, BirdProgress>, report: BattleReport, rewardExp: number): { progress: Record<BirdId, BirdProgress>; events: GameEvent[] } {
  const next = decayPow(progress);
  const events: GameEvent[] = [];
  if (!report.victory) return { progress: next, events };
  const uniqueBirds = new Set(report.birds.map((result) => result.bird));
  uniqueBirds.forEach((bird) => gainExp(next, bird, 4 + rewardExp, events));
  return { progress: next, events };
}

function gainExp(progress: Record<BirdId, BirdProgress>, bird: BirdId, amount: number, events: GameEvent[]): void {
  progress[bird].exp += amount;
  events.push(metaEvent('exp_gained', `${UNIT_CATALOG[bird].displayName} gained ${amount} EXP from the auto-chess round.`));
  while (progress[bird].exp >= expNeeded(progress[bird].level)) levelUp(progress, bird, events);
}

function levelUp(progress: Record<BirdId, BirdProgress>, bird: BirdId, events: GameEvent[]): void {
  progress[bird].level += 1;
  const relic = levelRelicForBird(progress, bird);
  progress[bird].relicMask |= relic;
  events.push(metaEvent('level_up', `${UNIT_CATALOG[bird].displayName} reached Level ${progress[bird].level} and gained ${relicNameFromBit(relic)}.`));
}

function levelRelicForBird(progress: Record<BirdId, BirdProgress>, bird: BirdId): number {
  const missing = RELIC_IDS.map((id) => RELIC_BITS[id]).filter((bit) => (progress[bird].relicMask & bit) === 0);
  if (missing.length === 0) return 0;
  const birdIndex = BIRD_IDS.indexOf(bird);
  return missing[(birdIndex + progress[bird].level) % missing.length];
}

function expNeeded(level: number): number {
  return level * 10;
}

function decayPow(progress: Record<BirdId, BirdProgress>): Record<BirdId, BirdProgress> {
  const next = cloneProgress(progress);
  for (const bird of BIRD_IDS) next[bird].powBattles = Math.max(0, next[bird].powBattles - 1);
  return next;
}

function conquerTerritory(territories: Territory[], territoryId: string): Territory[] {
  return territories.map((territory) => (territory.id === territoryId ? { ...territory, owner: 'bird' } : territory));
}

function nextCampaignPhase(victory: boolean, conqueredAll: boolean, stillAlive: boolean): AppPhase {
  if (!stillAlive) return 'run_over';
  if (victory && conqueredAll) return 'run_over';
  return 'map';
}

function campaignResultMessage(victory: boolean, conqueredAll: boolean, stillAlive: boolean, territoryName: string, playerHp: number, playerGold: number): string {
  if (!stillAlive) return 'Commander HP hit 0. The Pig Empire ended this run.';
  if (victory && conqueredAll) return 'The Pig Empire has been cleared from the map. Run complete!';
  if (victory) return `${territoryName} conquered. Commander HP ${playerHp}. Gold ${playerGold}. Choose the next adjacent territory.`;
  return `${territoryName} held by the pigs. Commander HP ${playerHp}. Rebuild and choose another attack.`;
}

function makeDraftChoice(available: BirdId[], draft: BirdId[]): DraftChoice {
  const pool = available.filter((bird) => !draft.includes(bird));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return { left: shuffled[0] ?? 'red', right: shuffled[1] ?? shuffled[0] ?? 'chuck' };
}

void makeDraftChoice;

function makeInitialBirdProgress(): Record<BirdId, BirdProgress> {
  return Object.fromEntries(BIRD_IDS.map((bird) => [bird, { level: 1, exp: 0, relicMask: 0, powBattles: 0 }])) as Record<BirdId, BirdProgress>;
}

function cloneProgress(progress: Record<BirdId, BirdProgress>): Record<BirdId, BirdProgress> {
  return Object.fromEntries(BIRD_IDS.map((bird) => [bird, { ...progress[bird] }])) as Record<BirdId, BirdProgress>;
}

function makeInitialTerritories(): Territory[] {
  return [
    { id: 'nest', name: 'Rebellion Nest', row: 1, col: 0, bossRule: BossRule.None, owner: 'bird', rewardExp: 0 },
    { id: 'mud-road', name: 'Mud Road', row: 1, col: 1, bossRule: BossRule.None, owner: 'pig', rewardExp: 1 },
    { id: 'watchyard', name: 'Watchyard', row: 0, col: 1, bossRule: BossRule.None, owner: 'pig', rewardExp: 1 },
    { id: 'scrap-fort', name: 'Scrap Fort', row: 2, col: 1, bossRule: BossRule.None, owner: 'pig', rewardExp: 1 },
    { id: 'alchemist-lab', name: 'Alchemist Lab', row: 0, col: 2, bossRule: BossRule.BouncyGrid, owner: 'pig', rewardExp: 3 },
    { id: 'architect-yard', name: 'Architect Yard', row: 1, col: 2, bossRule: BossRule.ShiftingLanes, owner: 'pig', rewardExp: 3 },
    { id: 'duke-kitchen', name: "Duke's Kitchen", row: 2, col: 2, bossRule: BossRule.GravityVacuum, owner: 'pig', rewardExp: 3 },
    { id: 'capital', name: 'Pig Capital', row: 1, col: 3, bossRule: BossRule.GravityVacuum, owner: 'pig', rewardExp: 5 },
  ];
}

function areAdjacent(a: Territory, b: Territory): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function metaEvent(type: GameEvent['type'], message: string): GameEvent {
  return { type, message };
}

type StoreSet = typeof useGameStore.setState;
type StoreGet = typeof useGameStore.getState;
