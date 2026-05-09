import { useMemo } from 'react';
import { MeshBasicMaterial } from 'three';
import type { BattleEngine } from '../game/ecs/engine';
import { ACTIVE_BOARD_SLOTS } from '../game/formationSlots';
import { slotWorldPosition } from './sceneMath';

export function SlotRings({ engine }: { engine: BattleEngine }) {
  const boardMaterial = useMemo(() => new MeshBasicMaterial({ color: '#68ff99', transparent: true, opacity: 0.42, depthWrite: false }), []);
  return (
    <group renderOrder={2}>
      {ACTIVE_BOARD_SLOTS.map((slot) => <SlotRing key={slot} slot={slot} material={boardMaterial} occupied={slotOccupied(engine, slot)} />)}
    </group>
  );
}

function SlotRing({ slot, material, occupied }: { slot: number; material: MeshBasicMaterial; occupied: boolean }) {
  const position = slotWorldPosition(slot, 0.02);
  const scale = occupied ? 0.62 : 0.78;
  return (
    <mesh position={[position[0], position[1] - 0.46, position[2] - 0.18]} scale={[scale, scale * 0.35, 1]} renderOrder={2}>
      <ringGeometry args={[0.42, 0.5, 48]} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}

function slotOccupied(engine: BattleEngine, slot: number): boolean {
  for (let entity = 0; entity < engine.world.nextEntity; entity += 1) {
    if (engine.world.active[entity] === 1 && engine.world.formationSlot[entity] === slot) return true;
  }
  return false;
}
