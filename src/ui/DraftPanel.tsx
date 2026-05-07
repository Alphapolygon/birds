import { BossRule, type BirdId } from '../game/types';
import { UNIT_CATALOG } from '../game/unitCatalog';
import { selectedTerritory, useGameStore } from '../store/useGameStore';

export function DraftPanel() {
  const draft = useGameStore((state) => state.draft);
  const choice = useGameStore((state) => state.currentChoice);
  const choiceIndex = useGameStore((state) => state.choiceIndex);
  const chooseBird = useGameStore((state) => state.chooseBird);
  const bossRule = useGameStore((state) => state.bossRule);
  const setBossRule = useGameStore((state) => state.setBossRule);
  const territory = useGameStore(selectedTerritory);

  return (
    <section className="panel draft-panel">
      <p className="eyebrow">The Vanguard Draft</p>
      <h1>{territory ? territory.name : 'Project Avian Advance'}</h1>
      <p className="copy">Pick one bird from each pair. POW birds are removed from this draft. Your four picks deploy into columns 1 and 2.</p>
      <BossRulePicker value={bossRule} onChange={setBossRule} />
      <DraftProgress draft={draft} />
      <p className="muted">Choice {Math.min(choiceIndex + 1, 4)} of 4</p>
      {choice ? <ChoiceRow left={choice.left} right={choice.right} onPick={chooseBird} /> : <p>Squad ready.</p>}
    </section>
  );
}

function BossRulePicker({ value, onChange }: { value: BossRule; onChange: (rule: BossRule) => void }) {
  return (
    <label className="field">
      Boss corruption intel
      <select value={value} onChange={(event) => onChange(Number(event.target.value) as BossRule)}>
        <option value={BossRule.None}>None - standard skirmish</option>
        <option value={BossRule.ShiftingLanes}>Architect Pig - shifting lanes</option>
        <option value={BossRule.GravityVacuum}>Gluttonous Duke - gravity vacuum</option>
        <option value={BossRule.BouncyGrid}>Royal Alchemist - bouncy grid prototype</option>
      </select>
    </label>
  );
}

function DraftProgress({ draft }: { draft: BirdId[] }) {
  return (
    <div className="draft-slots">
      {[0, 1, 2, 3].map((index) => (
        <span key={index} className="draft-slot">
          {draft[index] ? UNIT_CATALOG[draft[index]].displayName : 'Empty'}
        </span>
      ))}
    </div>
  );
}

function ChoiceRow({ left, right, onPick }: { left: BirdId; right: BirdId; onPick: (bird: BirdId) => void }) {
  return (
    <div className="choices">
      <BirdCard bird={left} onPick={onPick} />
      <BirdCard bird={right} onPick={onPick} />
    </div>
  );
}

function BirdCard({ bird, onPick }: { bird: BirdId; onPick: (bird: BirdId) => void }) {
  const unit = UNIT_CATALOG[bird];
  const progress = useGameStore((state) => state.birdProgress[bird]);
  return (
    <button className="bird-card" onClick={() => onPick(bird)} disabled={progress.powBattles > 0}>
      <strong>{unit.displayName}</strong>
      <span>Lv {progress.level} · EXP {progress.exp}/{progress.level * 10}</span>
      <span>HP {unit.maxHp} / ATK {unit.attack} / DEF {unit.defense}</span>
      <small>{progress.powBattles > 0 ? `Captured for ${progress.powBattles} battles` : unit.passive}</small>
      <small>Star: {unit.starPower}</small>
    </button>
  );
}
