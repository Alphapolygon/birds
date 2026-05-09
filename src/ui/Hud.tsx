import { useEffect, useState } from 'react';
import type { EntitySummary, BattleEngine } from '../game/ecs/engine';
import { ACTION_GAUGE_MAX, MANA_MAX } from '../game/ecs/engine';
import { listRelicNames } from '../game/relicCatalog';
import { BossRule } from '../game/types';
import { useGameStore } from '../store/useGameStore';

type HudProps = {
  engine: BattleEngine;
};

export function Hud({ engine }: HudProps) {
  useGameStore((state) => state.battleVersion);
  useUiTicker();
  const completeBattle = useGameStore((state) => state.completeBattle);
  const selected = engine.getSelectedSummary();
  const awaiting = engine.isAwaitingPlayerCommand();
  const battleEnded = engine.world.battleEnded === 1;
  const target = engine.getEntitySummary(engine.world.activeTarget);
  return (
    <aside className="panel hud">
      <div className="hud-header">
        <div>
          <p className="eyebrow">Timeline Combat</p>
          <h2>{battleEnded ? 'Battle Ended' : awaiting ? 'Choose Command' : 'Action Gauges Filling'}</h2>
        </div>
        {battleEnded ? <button className="ghost" onClick={() => completeBattle(engine.getBattleReport())}>Return to Map</button> : null}
      </div>
      <ComboMeter engine={engine} />
      <BossRulePanel engine={engine} />
      <SelectedUnit selected={selected} target={target} awaiting={awaiting} />
      <div className="hud-actions timing-actions">
        <button onClick={engine.attackSelected} disabled={!awaiting || battleEnded}>Attack</button>
        <button onClick={engine.chargedAttackSelected} disabled={!awaiting || battleEnded}>Charged Attack</button>
        <button onClick={engine.shieldSelected} disabled={!awaiting || battleEnded}>Shield</button>
        <button onClick={engine.waitSelected} disabled={!awaiting || battleEnded}>Wait</button>
        <button className={engine.canUseDuoAttack() ? 'active-action' : ''} onClick={engine.duoAttackSelected} disabled={!engine.canUseDuoAttack() || battleEnded}>Duo Attack</button>
      </div>
      <p className="hint">When the prompt appears, press Space or click the battlefield. Perfect hits double damage and ignore defense. Perfect blocks reduce damage to 1.</p>
    </aside>
  );
}

function ComboMeter({ engine }: { engine: BattleEngine }) {
  const active = engine.getEntitySummary(engine.world.activeEntity);
  const mana = active?.mana ?? 0;
  const ratio = Math.max(0, Math.min(100, (mana / MANA_MAX) * 100));
  return (
    <div className="combo-card">
      <div className="combo-topline"><strong>Active Mana</strong><span>{Math.round(mana)}/{MANA_MAX}</span></div>
      <div className="combo-track"><div className="combo-fill" style={{ width: `${ratio}%` }} /></div>
    </div>
  );
}

function BossRulePanel({ engine }: { engine: BattleEngine }) {
  const copy = bossRuleCopy(engine.world.bossRule, engine.world.timeWarpMultiplier);
  if (!copy) return null;
  return <p className="boss-rule-pill">{copy}</p>;
}

function SelectedUnit({ selected, target, awaiting }: { selected: EntitySummary | null; target: EntitySummary | null; awaiting: boolean }) {
  if (!selected) return <div className="selected-card empty">Waiting for the next Action Gauge to fill.</div>;
  const relics = listRelicNames(selected.relicMask);
  return (
    <div className="selected-card">
      <div className="selected-title-row">
        <h3>{selected.name}</h3>
        <StatusPills unit={selected} />
      </div>
      <HealthMeter unit={selected} />
      <GaugeMeter unit={selected} />
      <p>ATK {selected.attack} · DEF {selected.defense} · SPD {selected.speed}</p>
      <p>Target: {target ? target.name : 'none'} {awaiting ? '(click a pig badge to change)' : ''}</p>
      <p className="relics">Relics: {relics.length > 0 ? relics.join(', ') : 'none'}</p>
    </div>
  );
}

function HealthMeter({ unit }: { unit: EntitySummary }) {
  const ratio = Math.max(0, Math.min(100, (unit.hp / Math.max(1, unit.maxHp)) * 100));
  return (
    <div className="hud-health-line">
      <span>HP {unit.hp}/{unit.maxHp}</span>
      <div className="hud-health-track"><div className="hud-health-fill" style={{ width: `${ratio}%` }} /></div>
    </div>
  );
}

function GaugeMeter({ unit }: { unit: EntitySummary }) {
  const ratio = Math.max(0, Math.min(100, (unit.actionGauge / ACTION_GAUGE_MAX) * 100));
  return (
    <div className="hud-health-line">
      <span>Action Gauge {Math.round(unit.actionGauge)}%</span>
      <div className="gauge-track large"><div className="gauge-fill" style={{ width: `${ratio}%` }} /></div>
    </div>
  );
}

function StatusPills({ unit }: { unit: EntitySummary }) {
  const pills = unitStatusLabels(unit);
  if (pills.length === 0) return null;
  return (
    <div className="status-pills">
      {pills.map((pill) => <span key={pill}>{pill}</span>)}
    </div>
  );
}

function unitStatusLabels(unit: EntitySummary): string[] {
  const labels: string[] = [];
  if (unit.isReady) labels.push('Ready');
  if (unit.shielded) labels.push('Shield');
  if (unit.restingNextRound) labels.push('Recover');
  if (unit.carriesRelic > 0) labels.push(`Egg ${unit.gaugeFillCount}/3`);
  return labels;
}

function bossRuleCopy(rule: BossRule, warp: number): string | null {
  if (rule === BossRule.HiddenPrompts || rule === BossRule.BouncyGrid) return 'Illusionist Rule: timing prompts are hidden. Watch the animation.';
  if (rule === BossRule.TimeWarp || rule === BossRule.ShiftingLanes) return `Chronomancer Rule: animation timing is warped (${warp.toFixed(2)}x).`;
  if (rule === BossRule.ComboDrain || rule === BossRule.GravityVacuum) return 'Duke Rule: Combo drains every second. Keep scoring Perfects.';
  return null;
}

function useUiTicker(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 120);
    return () => window.clearInterval(id);
  }, []);
}
