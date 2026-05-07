import { useEffect, useState } from 'react';
import type { BattleEngine, EntitySummary, ShopSlotSummary } from '../game/ecs/engine';
import { REROLL_COST, UNIT_COST } from '../game/ecs/engine';
import { listRelicNames } from '../game/relicCatalog';
import { useGameStore } from '../store/useGameStore';
import { AtlasIcon } from './AtlasIcon';

type AutoChessPanelProps = {
  engine: BattleEngine;
};

export function AutoChessPanel({ engine }: AutoChessPanelProps) {
  useGameStore((state) => state.battleVersion);
  useUiTicker();
  const phase = useGameStore((state) => state.phase);
  const startCombatPhase = useGameStore((state) => state.startCombatPhase);
  const completeBattle = useGameStore((state) => state.completeBattle);
  const state = engine.getAutoChessState();
  const battleEnded = state.battleEnded;

  const startCombat = () => {
    if (engine.startCombatRound()) startCombatPhase();
  };

  return (
    <aside className="panel autochess-panel">
      <div className="hud-header">
        <div>
          <p className="eyebrow">Auto-Chess Prep</p>
          <h2>{battleEnded ? 'Round Complete' : state.combatStarted || phase === 'battle' ? 'Auto-Battle' : 'Shop & Formation'}</h2>
        </div>
        {battleEnded ? <button className="ghost" onClick={() => completeBattle(engine.getBattleReport())}>Return to Map</button> : null}
      </div>
      <EconomyStrip engine={engine} />
      <Shop engine={engine} disabled={state.combatStarted || battleEnded} />
      <FormationSummary title="Active Board" units={engine.getBoardUnits()} emptyLabel="Drag birds here to fight." />
      <FormationSummary title="Bench" units={engine.getBenchUnits()} emptyLabel="Bought birds wait here." compact />
      <div className="autochess-actions">
        <button onClick={startCombat} disabled={!state.canStartCombat || battleEnded}>Start Combat</button>
        <button className="ghost" onClick={() => engine.rerollShop()} disabled={state.combatStarted || battleEnded || state.playerGold < REROLL_COST}>Reroll {REROLL_COST}g</button>
        <button className={state.shopLocked ? 'active-action' : 'ghost'} onClick={() => engine.toggleShopLock()} disabled={state.combatStarted || battleEnded}>{state.shopLocked ? 'Locked' : 'Lock Shop'}</button>
      </div>
      <p className="hint">Buy three matching birds to auto-merge. Drag birds between the bench and four active slots before combat starts.</p>
    </aside>
  );
}

function EconomyStrip({ engine }: { engine: BattleEngine }) {
  const state = engine.getAutoChessState();
  return (
    <div className="economy-strip">
      <span><strong>{state.playerHp}</strong><small>HP</small></span>
      <span><strong>{state.playerGold}</strong><small>Gold</small></span>
      <span><strong>{state.roundNumber}</strong><small>Round</small></span>
    </div>
  );
}

function Shop({ engine, disabled }: { engine: BattleEngine; disabled: boolean }) {
  return (
    <section className="shop-card">
      <div className="shop-title-row">
        <strong>Flock Shop</strong>
        <span>{UNIT_COST}g each</span>
      </div>
      <div className="shop-grid">
        {engine.getShopSlots().map((slot) => <ShopCard key={slot.index} slot={slot} disabled={disabled || slot.empty || engine.world.playerGold < UNIT_COST} onBuy={() => engine.buyFromShop(slot.index)} />)}
      </div>
    </section>
  );
}

function ShopCard({ slot, disabled, onBuy }: { slot: ShopSlotSummary; disabled: boolean; onBuy: () => void }) {
  return (
    <button type="button" className={`shop-unit-card ${slot.empty ? 'sold' : ''}`} onClick={onBuy} disabled={disabled}>
      {slot.empty ? <span className="shop-sold">Sold</span> : <AtlasIcon spriteKey={slot.spriteKey} size={54} />}
      <strong>{slot.empty ? 'Sold' : slot.name}</strong>
      {!slot.empty ? <small>{slot.cost} gold</small> : null}
    </button>
  );
}

function FormationSummary({ title, units, emptyLabel, compact = false }: { title: string; units: EntitySummary[]; emptyLabel: string; compact?: boolean }) {
  return (
    <section className={`formation-summary ${compact ? 'compact' : ''}`}>
      <div className="shop-title-row">
        <strong>{title}</strong>
        <span>{units.length}</span>
      </div>
      {units.length === 0 ? <p className="muted mini-copy">{emptyLabel}</p> : <div className="formation-list">{units.map((unit) => <UnitChip key={unit.id} unit={unit} />)}</div>}
    </section>
  );
}

function UnitChip({ unit }: { unit: EntitySummary }) {
  const relics = listRelicNames(unit.relicMask);
  return (
    <div className="unit-chip">
      <AtlasIcon spriteKey={unit.spriteKey} size={38} />
      <div>
        <strong>{unit.name} <span>{'★'.repeat(Math.max(1, unit.starTier))}</span></strong>
        <small>HP {unit.hp}/{unit.maxHp} · ATK {unit.attack} · SPD {unit.speed}</small>
        {relics.length > 0 ? <small className="relics">{relics.join(', ')}</small> : null}
      </div>
    </div>
  );
}

function useUiTicker(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 120);
    return () => window.clearInterval(id);
  }, []);
}
