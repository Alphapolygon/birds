import { useMemo } from 'react';
import { createBattleEngine } from './game/ecs/engine';
import { BattleCanvas } from './render/BattleCanvas';
import { useGameStore } from './store/useGameStore';
import { AutoChessOverlay } from './ui/AutoChessOverlay';
import { BattleHudOverlay } from './ui/BattleHudOverlay';
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
    <main className="app battle-layout autochess-layout no-side-panel">
      <div className="battle-stage autochess-stage">
        <BattleCanvas engine={engine} />
        <BattleHudOverlay engine={engine} />
        <AutoChessOverlay engine={engine} />
      </div>
    </main>
  );
}
