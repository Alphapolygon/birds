import { useEffect, useState } from 'react';
import type { BattleEngine, EntitySummary, ShopSlotSummary } from '../game/ecs/engine';
import { REROLL_COST, UNIT_COST } from '../game/ecs/engine';
import { useGameStore } from '../store/useGameStore';
import { AtlasIcon } from './AtlasIcon';

type AutoChessOverlayProps = { engine: BattleEngine };

export function AutoChessOverlay({ engine }: AutoChessOverlayProps) {
  useGameStore((state) => state.battleVersion);
  useUiTicker();
  const phase = useGameStore((state) => state.phase);
  const battleId = useGameStore((state) => state.battleId);
  const startCombatPhase = useGameStore((state) => state.startCombatPhase);
  const completeBattle = useGameStore((state) => state.completeBattle);
  const returnToPrepPhase = useGameStore((state) => state.returnToPrepPhase);
  const [shopOpen, setShopOpen] = useState(false);
  const state = engine.getAutoChessState();
  const isPrep = phase === 'prep' && !state.combatStarted && !state.battleEnded;

  useEffect(() => setShopOpen(false), [battleId, state.roundNumber]);
  useEffect(() => { if (state.combatStarted || state.battleEnded) setShopOpen(false); }, [state.combatStarted, state.battleEnded]);

  const startCombat = () => {
    if (engine.startCombatRound()) {
      setShopOpen(false);
      startCombatPhase();
    }
  };

  const continueRound = () => {
    engine.prepareNextRound();
    returnToPrepPhase();
  };

  return (
    <div className="autochess-overlay" aria-label="Auto-chess controls">
      <div className="top-command-bar">
        <EconomyPills engine={engine} />
        <div className="top-command-actions">
          <button type="button" className="ghost light-ghost" onClick={() => setShopOpen(true)} disabled={!isPrep}>Shop</button>
          <button type="button" className="primary compact-primary" onClick={startCombat} disabled={!state.canStartCombat || !isPrep}>{state.isBossRound ? 'Start Boss' : 'Start Combat'}</button>
        </div>
      </div>
      {isPrep ? <BenchDock engine={engine} /> : <CombatStatus engine={engine} />}
      <FloatingBattleFeed />
      {shopOpen && isPrep ? <ShopPopup engine={engine} onClose={() => setShopOpen(false)} /> : null}
      {state.battleEnded ? <RoundResultModal engine={engine} onContinue={continueRound} onReturn={() => completeBattle(engine.getBattleReport())} /> : null}
    </div>
  );
}

function EconomyPills({ engine }: { engine: BattleEngine }) {
  const state = engine.getAutoChessState();
  return (
    <div className="economy-pills floating-pills">
      <span><strong>{state.playerHp}</strong> HP</span>
      <span><strong>{state.playerGold}</strong> Gold</span>
      <span>{state.isBossRound ? 'Boss' : 'Round'} <strong>{state.isBossRound ? state.bossRoundNumber : `${state.roundNumber}/${state.mapBattleRounds}`}</strong></span>
    </div>
  );
}

function BenchDock({ engine }: { engine: BattleEngine }) {
  const bench = engine.getBenchUnits();
  return (
    <section className="bench-dock glass-dock" aria-label="Bench units">
      <div className="bench-dock-title">
        <strong>Bench</strong>
        <span>Bought birds idle here. Drag them to any left-side board circle to fight.</span>
      </div>
      <div className="bench-card-row">
        {bench.length === 0 ? <p className="muted bench-empty">Buy birds from the shop to fill the bench.</p> : bench.map((unit) => <BenchCard key={unit.id} unit={unit} />)}
      </div>
    </section>
  );
}

function BenchCard({ unit }: { unit: EntitySummary }) {
  return (
    <div className="bench-card" title={`${unit.name} ${unit.starTier}-Star`}>
      <AtlasIcon spriteKey={unit.spriteKey} size={44} />
      <strong>{unit.name}</strong>
      <span>{'★'.repeat(Math.max(1, unit.starTier))}</span>
    </div>
  );
}

function CombatStatus({ engine }: { engine: BattleEngine }) {
  const state = engine.getAutoChessState();
  return (
    <div className="combat-status-pill glass-dock">
      <strong>{state.battleEnded ? 'Round complete' : state.isBossRound ? 'Boss battle running' : 'Auto-battle running'}</strong>
      <span>{state.battleEnded ? 'Check the result.' : 'Units move, attack, counter, and cast star powers automatically.'}</span>
    </div>
  );
}

function ShopPopup({ engine, onClose }: { engine: BattleEngine; onClose: () => void }) {
  useGameStore((state) => state.battleVersion);
  const state = engine.getAutoChessState();
  const canReroll = state.playerGold >= REROLL_COST;
  const slots = engine.getShopSlots();
  return (
    <div className="shop-popup-backdrop" role="presentation">
      <section className="shop-popup panel playing-card-shop" role="dialog" aria-modal="false" aria-label="Flock shop">
        <div className="shop-popup-header">
          <div>
            <p className="eyebrow">Flock Shop</p>
            <h2>Buy cards, bench, merge</h2>
          </div>
          <button type="button" className="round-close" aria-label="Close shop" onClick={onClose}>×</button>
        </div>
        <div className="shop-popup-meta">
          <span>{UNIT_COST}g each</span>
          <span>3 matching cards auto-merge</span>
          <span>2-Star and 3-Star units scale up in battle</span>
        </div>
        <div className="shop-popup-grid card-shop-grid">
          {slots.map((slot) => <ShopCard key={slot.index} slot={slot} disabled={slot.empty || state.playerGold < UNIT_COST} onBuy={() => engine.buyFromShop(slot.index)} />)}
        </div>
        <div className="shop-popup-actions">
          <button type="button" onClick={() => engine.rerollShop()} disabled={!canReroll}>Reroll {REROLL_COST}g</button>
          <button type="button" className={state.shopLocked ? 'active-action' : 'ghost'} onClick={() => engine.toggleShopLock()}>{state.shopLocked ? 'Shop Locked' : 'Lock Shop'}</button>
          <button type="button" className="ghost" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
}

function ShopCard({ slot, disabled, onBuy }: { slot: ShopSlotSummary; disabled: boolean; onBuy: () => void }) {
  return (
    <button type="button" className={`shop-popup-card playing-card ${slot.empty ? 'sold' : ''}`} onClick={onBuy} disabled={disabled}>
      <span className="card-cost">{slot.empty ? '-' : slot.cost}</span>
      <span className="card-corner top">★</span>
      <span className="card-corner bottom">★</span>
      <span className="card-art">{slot.empty ? <span className="shop-sold">Sold</span> : <AtlasIcon spriteKey={slot.spriteKey} size={88} />}</span>
      <strong>{slot.empty ? 'Sold' : slot.name}</strong>
      {!slot.empty ? <small>Buy to bench</small> : null}
    </button>
  );
}

function FloatingBattleFeed() {
  const events = useGameStore((state) => state.events);
  const recent = events.slice(0, 5);
  return (
    <section className="floating-battle-feed" aria-label="Battle feed">
      <p className="eyebrow">Battle Feed</p>
      {recent.length === 0 ? <p className="muted">No events yet.</p> : recent.map((event, index) => <p key={`${event.type}-${index}`}>{event.message}</p>)}
    </section>
  );
}

function RoundResultModal({ engine, onContinue, onReturn }: { engine: BattleEngine; onContinue: () => void; onReturn: () => void }) {
  const report = engine.getBattleReport();
  const canContinue = report.victory && !report.mapBattleComplete;
  const title = report.victory ? report.mapBattleComplete ? 'Territory Won!' : 'Round Won!' : 'Defeat';
  return (
    <div className="round-result-backdrop">
      <section className={`round-result-modal panel ${report.victory ? 'victory' : 'defeat'}`} role="dialog" aria-modal="true" aria-label="Round result">
        <p className="eyebrow">{report.bossRound ? 'Boss Result' : 'Round Result'}</p>
        <h1>{title}</h1>
        <p>{canContinue ? `Prepare for ${report.roundNumber >= 9 ? 'the boss' : `round ${report.roundNumber}`}.` : report.victory ? 'The Pig territory is conquered.' : 'The Pig Empire held the field.'}</p>
        <div className="result-stat-grid">
          <span><strong>{report.playerHp}</strong><small>Commander HP</small></span>
          <span><strong>{report.playerGold}</strong><small>Gold</small></span>
          <span><strong>{report.roundNumber > 9 ? 9 : report.roundNumber}</strong><small>Next Round</small></span>
        </div>
        <button type="button" className="result-primary" onClick={canContinue ? onContinue : onReturn}>{canContinue ? 'Prepare Next Round' : 'Return to Map'}</button>
      </section>
    </div>
  );
}

function useUiTicker(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => (value + 1) % 100000), 160);
    return () => window.clearInterval(id);
  }, []);
}
