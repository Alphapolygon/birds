import { TILE_SIZE } from '../game/constants';
import type { BattleEngine } from '../game/ecs/engine';
import { useGameStore } from '../store/useGameStore';
import { GRID_TILT_X, tileWorldPosition } from './sceneMath';

type SelectionOverlayProps = {
  engine: BattleEngine;
};

export function SelectionOverlay({ engine }: SelectionOverlayProps) {
  useGameStore((state) => state.battleVersion);
  const selected = engine.world.selectedEntity;
  if (selected < 0 || engine.world.active[selected] !== 1) return null;
  return <SelectionBox engine={engine} entity={selected} />;
}

function SelectionBox({ engine, entity }: { engine: BattleEngine; entity: number }) {
  const x = engine.world.x[entity] + (engine.world.sizeW[entity] - 1) * 0.5;
  const y = engine.world.y[entity] + (engine.world.sizeH[entity] - 1) * 0.5;
  return (
    <mesh position={tileWorldPosition(x, y, 0.08)} renderOrder={4} rotation={[GRID_TILT_X, 0, 0]}>
      <planeGeometry args={[TILE_SIZE * engine.world.sizeW[entity], TILE_SIZE * engine.world.sizeH[entity]]} />
      <meshBasicMaterial color="#ffe66d" wireframe transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}
