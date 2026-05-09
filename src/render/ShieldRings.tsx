import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshBasicMaterial, Object3D, RingGeometry } from 'three';
import { MAX_ENTITIES, TILE_SIZE } from '../game/constants';
import { SHIELD_ANIM_SECONDS } from '../game/ecs/animation';
import type { BattleEngine } from '../game/ecs/engine';
import { isBenchSlot } from '../game/formationSlots';
import { EntityKind } from '../game/types';
import { entityStagePosition } from './sceneMath';

type ShieldRingsProps = {
  engine: BattleEngine;
};

export function ShieldRings({ engine }: ShieldRingsProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new RingGeometry(TILE_SIZE * 0.43, TILE_SIZE * 0.52, 32), []);
  const material = useMemo(() => new MeshBasicMaterial({ color: '#9ad7ff', transparent: true, opacity: 0.62, depthWrite: false }), []);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useFrame(({ clock }) => syncShields(engine, meshRef.current, dummy, color, clock.elapsedTime));

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_ENTITIES]} frustumCulled={false} renderOrder={7} />;
}

function syncShields(engine: BattleEngine, mesh: InstancedMesh | null, dummy: Object3D, color: Color, elapsed: number): void {
  if (!mesh) return;
  let count = 0;
  for (let entity = 0; entity < engine.world.nextEntity; entity += 1) {
    if (!shouldRenderShield(engine.world, entity)) continue;
    writeShieldMatrix(engine, entity, dummy, elapsed);
    mesh.setMatrixAt(count, dummy.matrix);
    mesh.setColorAt(count, color.set('#9ad7ff'));
    count += 1;
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function shouldRenderShield(world: BattleEngine['world'], entity: number): boolean {
  if (world.active[entity] !== 1 || world.kind[entity] !== EntityKind.Unit) return false;
  if (isBenchSlot(world.formationSlot[entity]) && world.draggedEntity !== entity) return false;
  return world.guard[entity] > 0 || world.animShield[entity] > 0;
}

function writeShieldMatrix(engine: BattleEngine, entity: number, dummy: Object3D, elapsed: number): void {
  const position = entityStagePosition(engine.world, entity, 0.38);
  const pulse = shieldPulse(engine.world, entity, elapsed);
  dummy.position.set(position[0], position[1], position[2] + 0.2);
  dummy.rotation.set(0, 0, elapsed * 0.65);
  dummy.scale.set(pulse, pulse, 1);
  dummy.updateMatrix();
}

function shieldPulse(world: BattleEngine['world'], entity: number, elapsed: number): number {
  const activePulse = world.guard[entity] > 0 ? Math.sin(elapsed * 5 + entity) * 0.04 : 0;
  const animPulse = world.animShield[entity] > 0 ? Math.sin((1 - world.animShield[entity] / SHIELD_ANIM_SECONDS) * Math.PI) * 0.22 : 0;
  return 1.1 + activePulse + animPulse;
}
