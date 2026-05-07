import { useEffect, useState } from 'react';
import type { EntitySummary, BattleEngine } from '../game/ecs/engine';
import { Faction } from '../game/types';
import { useGameStore } from '../store/useGameStore';
import { AtlasIcon } from './AtlasIcon';

type BattleHudOverlayProps = {
  engine: BattleEngine;
};

export function BattleHudOverlay({ engine }: BattleHudOverlayProps) {
  useGameStore((state) => state.battleVersion);
  useOverlayTicker();
  const birds = engine.getBoardUnits();
  const pigs = engine.getEnemyUnits();
  
  return (
    <div className="battle-hud-overlay" aria-label="Battle health HUD">
      <div className="battle-hud-row enemy-row">
        {pigs.map((unit) => <CombatantBadge key={unit.id} unit={unit} />)}
      </div>
      <div style={{ flex: 1 }} /> {/* Spacer to push player row to bottom */}
      <div className="battle-hud-row player-row">
        {birds.map((unit) => <CombatantBadge key={unit.id} unit={unit} />)}
      </div>
    </div>
  );
}

function useOverlayTicker(): void {
  const [, setFrame] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setFrame((frame) => (frame + 1) % 100000);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, []);
}

function CombatantBadge({ unit }: { unit: EntitySummary }) {
  const hpRatio = Math.max(0, Math.min(100, (unit.hp / Math.max(1, unit.maxHp)) * 100));
  
  return (
    <div className={`combatant-badge ${unit.faction === Faction.Player ? 'bird-badge' : 'pig-badge'}`}>
      <AtlasIcon spriteKey={unit.spriteKey} size={38} className="combatant-avatar atlas-combatant-avatar" />
      <div className="combatant-info">
        <div className="combatant-topline">
          <strong>{unit.name} {starLabel(unit.starTier)}</strong>
          <span>{unit.hp}/{unit.maxHp}</span>
        </div>
        <div className="combatant-health-track"><div className="combatant-health-fill" style={{ width: `${hpRatio}%` }} /></div>
        <ManaMeter unit={unit} />
      </div>
    </div>
  );
}

function ManaMeter({ unit }: { unit: EntitySummary }) {
  if (unit.starMax <= 0) return null;
  const ratio = Math.max(0, Math.min(100, (unit.star / unit.starMax) * 100));
  return (
    <div className="star-track gauge-track">
      <div className="star-fill" style={{ width: `${ratio}%`, background: ratio >= 100 ? '#ffd166' : 'linear-gradient(90deg, #55c6ff, #ffffff)' }} />
    </div>
  );
}

function starLabel(tier: number): string {
  return tier > 1 ? '★'.repeat(tier) : '';
}