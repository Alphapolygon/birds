import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CanvasTexture, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace } from 'three';
import { MAX_ENTITIES, TILE_SIZE } from '../game/constants';
import { isBenchSlot } from '../game/formationSlots';
import type { BattleEngine } from '../game/ecs/engine';
import { EntityKind } from '../game/types';
import { entityStagePosition } from './sceneMath';

export function UnitShadows({ engine }: { engine: BattleEngine }) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(TILE_SIZE * 0.92, TILE_SIZE * 0.32), []);
  const texture = useMemo(() => makeShadowTexture(), []);
  const material = useMemo(() => new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.42, depthWrite: false }), [texture]);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(() => syncShadows(engine, meshRef.current, dummy));
  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_ENTITIES]} frustumCulled={false} renderOrder={1} />;
}

function syncShadows(engine: BattleEngine, mesh: InstancedMesh | null, dummy: Object3D): void {
  if (!mesh) return;
  let count = 0;
  for (let entity = 0; entity < engine.world.nextEntity; entity += 1) {
    if (!shouldShadow(engine.world, entity)) continue;
    const position = entityStagePosition(engine.world, entity, -0.02);
    dummy.position.set(position[0], position[1] - 0.45, position[2] - 0.18);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(count, dummy.matrix);
    count += 1;
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}

function shouldShadow(world: BattleEngine['world'], entity: number): boolean {
  if (world.active[entity] !== 1 || world.kind[entity] !== EntityKind.Unit || world.hp[entity] <= 0) return false;
  return !isBenchSlot(world.formationSlot[entity]) || world.draggedEntity === entity;
}

function makeShadowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 32, 0, 64, 32, 62);
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
    gradient.addColorStop(0.58, 'rgba(0,0,0,0.22)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 64);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
