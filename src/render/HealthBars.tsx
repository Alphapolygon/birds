import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { MAX_ENTITIES, TILE_SIZE } from '../game/constants';
import type { BattleEngine } from '../game/ecs/engine';
import { EntityKind, Faction } from '../game/types';
import { entityStagePosition } from './sceneMath';

type HealthBarsProps = {
  engine: BattleEngine;
};

const BAR_WIDTH = TILE_SIZE * 0.76;
const BAR_HEIGHT = TILE_SIZE * 0.085;

export function HealthBars({ engine }: HealthBarsProps) {
  const backRef = useRef<InstancedMesh>(null);
  const fillRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(BAR_WIDTH, BAR_HEIGHT), []);
  const backMaterial = useMemo(() => new MeshBasicMaterial({ color: '#190f0f', transparent: true, opacity: 0.72, depthWrite: false }), []);
  const fillMaterial = useMemo(() => new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }), []);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useFrame(() => syncHealthBars(engine, backRef.current, fillRef.current, dummy, color));

  return (
    <group renderOrder={5}>
      <instancedMesh ref={backRef} args={[geometry, backMaterial, MAX_ENTITIES]} frustumCulled={false} renderOrder={5} />
      <instancedMesh ref={fillRef} args={[geometry, fillMaterial, MAX_ENTITIES]} frustumCulled={false} renderOrder={6} />
    </group>
  );
}

function syncHealthBars(engine: BattleEngine, back: InstancedMesh | null, fill: InstancedMesh | null, dummy: Object3D, color: Color): void {
  if (!back || !fill) return;
  let count = 0;
  for (let entity = 0; entity < engine.world.nextEntity; entity += 1) {
    if (!shouldShowBar(engine.world, entity)) continue;
    writeBackBar(engine, entity, dummy);
    back.setMatrixAt(count, dummy.matrix);
    writeFillBar(engine, entity, dummy);
    fill.setMatrixAt(count, dummy.matrix);
    fill.setColorAt(count, color.set(barColor(engine.world.faction[entity] as Faction)));
    count += 1;
  }
  finishMesh(back, count);
  finishMesh(fill, count);
  if (fill.instanceColor) fill.instanceColor.needsUpdate = true;
}

function shouldShowBar(world: BattleEngine['world'], entity: number): boolean {
  return world.active[entity] === 1 && world.kind[entity] === EntityKind.Unit && world.maxHp[entity] > 0;
}

function writeBackBar(engine: BattleEngine, entity: number, dummy: Object3D): void {
  const position = barPosition(engine, entity);
  dummy.position.set(position[0], position[1], position[2]);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(barWidthScale(engine.world, entity), 1, 1);
  dummy.updateMatrix();
}

function writeFillBar(engine: BattleEngine, entity: number, dummy: Object3D): void {
  const ratio = hpRatio(engine.world, entity);
  const position = barPosition(engine, entity);
  const widthScale = barWidthScale(engine.world, entity);
  position[0] += ((ratio - 1) * BAR_WIDTH * widthScale) / 2;
  position[2] += 0.01;
  dummy.position.set(position[0], position[1], position[2]);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(widthScale * ratio, 1, 1);
  dummy.updateMatrix();
}

function barPosition(engine: BattleEngine, entity: number): [number, number, number] {
  const position = entityStagePosition(engine.world, entity, 0.32);
  const yOffset = engine.world.formationSlot[entity] === 8 ? -0.58 : -0.48;
  return [position[0], position[1] + yOffset, position[2] + 0.08];
}

function hpRatio(world: BattleEngine['world'], entity: number): number {
  return Math.max(0, Math.min(1, world.hp[entity] / Math.max(1, world.maxHp[entity])));
}

function barWidthScale(world: BattleEngine['world'], entity: number): number {
  return world.formationSlot[entity] === 8 ? 1.22 : 1;
}

function barColor(faction: Faction): string {
  return faction === Faction.Player ? '#79e25f' : '#ff5148';
}

function finishMesh(mesh: InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}
