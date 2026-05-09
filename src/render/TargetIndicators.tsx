import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
} from 'three';
import { MAX_ENTITIES } from '../game/constants';
import type { BattleEngine } from '../game/ecs/engine';
import { isActiveBoardSlot, isBenchSlot, isEnemyBoardSlot } from '../game/formationSlots';
import { EntityKind, Faction } from '../game/types';
import { entityStagePosition } from './sceneMath';

export function TargetIndicators({ engine }: { engine: BattleEngine }) {
  const lineRef = useRef<LineSegments>(null);
  const reticleRef = useRef<InstancedMesh>(null);
  const linePositions = useMemo(() => new Float32Array(MAX_ENTITIES * 2 * 3), []);
  const lineGeometry = useMemo(() => makeLineGeometry(linePositions), [linePositions]);
  const lineMaterial = useMemo(() => new LineBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.34, depthWrite: false }), []);
  const reticleGeometry = useMemo(() => new RingGeometry(0.39, 0.47, 48), []);
  const reticleMaterial = useMemo(() => new MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.58, depthWrite: false }), []);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(() => syncTargetIndicators(engine, lineRef.current, reticleRef.current, linePositions, dummy));

  return (
    <group renderOrder={6}>
      <lineSegments ref={lineRef} geometry={lineGeometry} material={lineMaterial} frustumCulled={false} />
      <instancedMesh ref={reticleRef} args={[reticleGeometry, reticleMaterial, MAX_ENTITIES]} frustumCulled={false} />
    </group>
  );
}

function makeLineGeometry(positions: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(positions, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setDrawRange(0, 0);
  return geometry;
}

function syncTargetIndicators(
  engine: BattleEngine,
  lines: LineSegments | null,
  reticles: InstancedMesh | null,
  linePositions: Float32Array,
  dummy: Object3D,
): void {
  if (!lines || !reticles) return;
  if (engine.world.combatStarted !== 1 || engine.world.battleEnded === 1) {
    lines.geometry.setDrawRange(0, 0);
    reticles.count = 0;
    return;
  }

  let vertexCount = 0;
  const targets = new Set<number>();
  for (let actor = 0; actor < engine.world.nextEntity; actor += 1) {
    const target = engine.world.targetEntity[actor];
    if (!shouldDrawTargetLink(engine.world, actor, target)) continue;
    const actorPosition = entityStagePosition(engine.world, actor, 0.24);
    const targetPosition = entityStagePosition(engine.world, target, 0.24);
    writeLineVertex(linePositions, vertexCount, actorPosition[0], actorPosition[1] + 0.16, actorPosition[2]);
    vertexCount += 1;
    writeLineVertex(linePositions, vertexCount, targetPosition[0], targetPosition[1] + 0.16, targetPosition[2]);
    vertexCount += 1;
    targets.add(target);
  }

  if (engine.world.activeTarget >= 0 && shouldDrawReticle(engine.world, engine.world.activeTarget)) targets.add(engine.world.activeTarget);

  const positionAttribute = lines.geometry.getAttribute('position') as BufferAttribute;
  positionAttribute.needsUpdate = true;
  lines.geometry.setDrawRange(0, vertexCount);

  let reticleCount = 0;
  for (const target of targets) {
    const position = entityStagePosition(engine.world, target, 0.08);
    dummy.position.set(position[0], position[1] - 0.38, position[2]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 0.42, 1);
    dummy.updateMatrix();
    reticles.setMatrixAt(reticleCount, dummy.matrix);
    reticleCount += 1;
  }
  reticles.count = reticleCount;
  reticles.instanceMatrix.needsUpdate = true;
}

function writeLineVertex(positions: Float32Array, vertex: number, x: number, y: number, z: number): void {
  const offset = vertex * 3;
  positions[offset] = x;
  positions[offset + 1] = y;
  positions[offset + 2] = z;
}

function shouldDrawTargetLink(world: BattleEngine['world'], actor: number, target: number): boolean {
  if (!isCombatUnit(world, actor) || !shouldDrawReticle(world, target)) return false;
  return world.faction[actor] !== world.faction[target];
}

function shouldDrawReticle(world: BattleEngine['world'], entity: number): boolean {
  if (!isCombatUnit(world, entity)) return false;
  return !isBenchSlot(world.formationSlot[entity]);
}

function isCombatUnit(world: BattleEngine['world'], entity: number): boolean {
  if (entity < 0 || world.active[entity] !== 1 || world.kind[entity] !== EntityKind.Unit || world.hp[entity] <= 0) return false;
  if (world.faction[entity] === Faction.Player) return isActiveBoardSlot(world.formationSlot[entity]);
  if (world.faction[entity] === Faction.Pig) return isEnemyBoardSlot(world.formationSlot[entity]);
  return false;
}
