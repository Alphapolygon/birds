import { useMemo } from 'react';
import { MeshBasicMaterial, PlaneGeometry } from 'three';
import { BENCH_SLOTS, slotPosition } from '../game/formationSlots';
import { GRID_TILT_X } from './sceneMath';
import type { BattleEngine } from '../game/ecs/engine';

export function SlotGuides({ engine }: { engine: BattleEngine }) {
  const benchMaterial = useMemo(() => new MeshBasicMaterial({ color: '#263149', transparent: true, opacity: 0.6, depthWrite: false, depthTest: false }), []);
  const geometry = useMemo(() => new PlaneGeometry(0.9, 0.9), []);

  if (engine.world.combatStarted === 1 || engine.world.battleEnded === 1) return null;

  return (
    <group>
      {BENCH_SLOTS.map((slot) => {
        const [x, y, z] = slotPosition(slot, -0.04);
        return <mesh key={slot} geometry={geometry} material={benchMaterial} position={[x, y - 0.45, z]} rotation={[GRID_TILT_X, 0, 0]} renderOrder={1} />;
      })}
    </group>
  );
}