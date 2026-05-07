import { useMemo } from 'react';
import { MeshBasicMaterial, RingGeometry } from 'three';
import { ACTIVE_BOARD_SLOTS, BENCH_SLOTS, slotPosition } from '../game/formationSlots';
import type { BattleEngine } from '../game/ecs/engine';

export function SlotGuides({ engine }: { engine: BattleEngine }) {
  const activeMaterial = useMemo(() => new MeshBasicMaterial({ color: '#76ff9b', transparent: true, opacity: 0.34, depthWrite: false }), []);
  const benchMaterial = useMemo(() => new MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.28, depthWrite: false }), []);
  const geometry = useMemo(() => new RingGeometry(0.31, 0.38, 40), []);
  if (engine.world.combatStarted === 1 || engine.world.battleEnded === 1) return null;
  return (
    <group renderOrder={2}>
      {ACTIVE_BOARD_SLOTS.map((slot) => <SlotRing key={slot} slot={slot} geometry={geometry} material={activeMaterial} />)}
      {BENCH_SLOTS.map((slot) => <SlotRing key={slot} slot={slot} geometry={geometry} material={benchMaterial} bench />)}
    </group>
  );
}

function SlotRing({ slot, geometry, material, bench = false }: { slot: number; geometry: RingGeometry; material: MeshBasicMaterial; bench?: boolean }) {
  const [x, y, z] = slotPosition(slot, -0.08);
  const scaleY = bench ? 0.32 : 0.42;
  return <mesh geometry={geometry} material={material} position={[x, y - (bench ? 0.34 : 0.36), z - 0.08]} scale={[1, scaleY, 1]} rotation={[0, 0, 0]} />;
}
