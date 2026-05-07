import { useMemo } from 'react';
import { createBattleEngine } from './game/ecs/engine';
import { BattleCanvas } from './render/BattleCanvas';
import { useGameStore } from './store/useGameStore';
import { AutoChessPanel } from './ui/AutoChessPanel';
import { BattleHudOverlay } from './ui/BattleHudOverlay';
import { EventLog } from './ui/EventLog';
import { WorldMapPanel } from './ui/WorldMapPanel';

export function App() {
  const phase = useGameStore((state) => state.phase);
  const engine = useMemo(() => createBattleEngine((event) => useGameStore.getState().pushEvent(event)), []);

  if (phase === 'map' || phase === 'run_over') {
    return (
      <main className="app shell-centered">
        <WorldMapPanel />
      </main>
    );
  }

  return (
    <main className="app battle-layout autochess-layout">
      <div className="battle-stage">
        <BattleCanvas engine={engine} />
        <BattleHudOverlay engine={engine} />
      </div>
      <div className="side-stack">
        <AutoChessPanel engine={engine} />
        <EventLog />
      </div>
    </main>
  );
}
