import { listRelicNames } from '../game/relicCatalog';
import { UNIT_CATALOG } from '../game/unitCatalog';
import { BossRule, type BirdId } from '../game/types';
import { availableBirdIds, territoryIsSelectable, useGameStore, type BirdProgress, type Territory } from '../store/useGameStore';

export function WorldMapPanel() {
  const phase = useGameStore((state) => state.phase);
  const territories = useGameStore((state) => state.territories);
  const progress = useGameStore((state) => state.birdProgress);
  const message = useGameStore((state) => state.campaignMessage);
  const selectTerritory = useGameStore((state) => state.selectTerritory);
  const startRun = useGameStore((state) => state.startRun);
  const available = availableBirdIds(progress);
  return (
    <section className="panel world-panel">
      <div className="world-header">
        <div>
          <p className="eyebrow">Auto-Chess Campaign</p>
          <h1>Avian Auto-Chess</h1>
          <p className="copy">{message}</p>
        </div>
        <button className="ghost" onClick={startRun}>{phase === 'run_over' ? 'Start New Run' : 'Reset Run'}</button>
      </div>
      <div className="campaign-grid">
        <TerritoryMap territories={territories} onPick={selectTerritory} />
        <FlockProgress progress={progress} availableCount={available.length} />
      </div>
    </section>
  );
}

function TerritoryMap({ territories, onPick }: { territories: Territory[]; onPick: (id: string) => void }) {
  return (
    <div className="territory-map" aria-label="World map territory selection">
      {territories.map((territory) => (
        <TerritoryButton key={territory.id} territory={territory} territories={territories} onPick={onPick} />
      ))}
    </div>
  );
}

function TerritoryButton({ territory, territories, onPick }: { territory: Territory; territories: Territory[]; onPick: (id: string) => void }) {
  const selectable = territoryIsSelectable(territory, territories);
  return (
    <button
      className={`territory-node ${territory.owner} ${selectable ? 'selectable' : ''}`}
      disabled={!selectable}
      onClick={() => onPick(territory.id)}
      style={{ gridRow: territory.row + 1, gridColumn: territory.col + 1 }}
    >
      <strong>{territory.name}</strong>
      <span>{territory.owner === 'bird' ? 'Liberated' : selectable ? 'Attackable' : 'Pig-held'}</span>
      <small>{bossRuleLabel(territory.bossRule)}</small>
    </button>
  );
}

function FlockProgress({ progress, availableCount }: { progress: Record<BirdId, BirdProgress>; availableCount: number }) {
  return (
    <aside className="flock-progress">
      <div className="flock-summary">
        <p className="eyebrow">Flock Status</p>
        <h2>{availableCount}/11 Ready</h2>
        <p className="muted">Captured birds are locked out of the shop pool for 3 battles.</p>
      </div>
      <div className="flock-list">
        {(Object.keys(progress) as BirdId[]).map((bird) => <BirdProgressRow key={bird} bird={bird} progress={progress[bird]} />)}
      </div>
    </aside>
  );
}

function BirdProgressRow({ bird, progress }: { bird: BirdId; progress: BirdProgress }) {
  const relics = listRelicNames(progress.relicMask);
  return (
    <div className={`bird-progress-row ${progress.powBattles > 0 ? 'pow' : ''}`}>
      <div>
        <strong>{UNIT_CATALOG[bird].displayName}</strong>
        <span>Lv {progress.level} · EXP {progress.exp}/{progress.level * 10}</span>
      </div>
      <small>{progress.powBattles > 0 ? `POW: ${progress.powBattles} battles` : relics.length > 0 ? relics.join(', ') : 'No relics'}</small>
    </div>
  );
}

function bossRuleLabel(rule: BossRule): string {
  if (rule === BossRule.BouncyGrid) return 'Royal Alchemist: Bouncy Grid';
  if (rule === BossRule.ShiftingLanes) return 'Architect Pig: Shifting Lanes';
  if (rule === BossRule.GravityVacuum) return 'Gluttonous Duke: Gravity Vacuum';
  return 'Standard Skirmish';
}
