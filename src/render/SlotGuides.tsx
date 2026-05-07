import { useMemo } from 'react';
import { MeshBasicMaterial, RingGeometry } from 'three';
import { ACTIVE_BOARD_SLOTS, BENCH_SLOTS } from '../game/formationSlots';
import { slotWorldPosition } from './sceneMath';
import type { BattleEngine } from '../game/ecs/engine';

export function SlotGuides({ engine }: { engine: BattleEngine }) {
  const activeMaterial = useMemo(() => new MeshBasicMaterial({ color: '#76ff9b', transparent: true, opacity: 0.36, depthWrite: false }), []);
  const benchMaterial = useMemo(() => new MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.45, depthWrite: false }), []);
  
  // Make the rings slightly larger so they look right when tilted
  const geometry = useMemo(() => new RingGeometry(0.55, 0.65, 32), []);
  
  if (engine.world.combatStarted === 1 || engine.world.battleEnded === 1) return null;
  
  return (
    <group renderOrder={2}>
      <BenchPlate />
      {ACTIVE_BOARD_SLOTS.map((slot) => <SlotRing key={slot} slot={slot} geometry={geometry} material={activeMaterial} />)}
      {BENCH_SLOTS.map((slot) => <SlotRing key={slot} slot={slot} geometry={geometry} material={benchMaterial} />)}
    </group>
  );
}

// Renders a dark, semi-transparent rectangle perfectly behind the bench row
function BenchPlate() {
  const [x, y, z] = slotWorldPosition(12, -0.15); 
  return (
    <mesh position={[0.5, y + 0.1, z - 0.05]}>
      <planeGeometry args={[11.5, 2.0]} />
      <meshBasicMaterial color="#0b101a" transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

function SlotRing({ slot, geometry, material }: { slot: number; geometry: RingGeometry; material: MeshBasicMaterial }) {
  const [x, y, z] = slotWorldPosition(slot, -0.05);
  // Using rotation X to tilt the ring down so it physically lays flat on the dirt!
  return <mesh geometry={geometry} material={material} position={[x, y, z]} rotation={[-Math.PI / 2.5, 0, 0]} />;
}