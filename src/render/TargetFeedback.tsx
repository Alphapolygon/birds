import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, InstancedMesh, LineBasicMaterial, LineSegments, MeshBasicMaterial, Object3D, RingGeometry } from 'three';
import { MAX_ENTITIES } from '../game/constants';
import type { BattleEngine } from '../game/ecs/engine';
import { isBenchSlot } from '../game/formationSlots';
import { EntityKind } from '../game/types';
import { entityStagePosition } from './sceneMath';

export function TargetFeedback({ engine }: { engine: BattleEngine }) {
  const lineRef = useRef<LineSegments>(null);
  const reticleRef = useRef<InstancedMesh>(null);
  const linePositions = useMemo(() => new Float32Array(MAX_ENTITIES * 2 * 3), []);
  const lineGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(linePositions, 3));
    return geometry;
  }, [linePositions]);
  const lineMaterial = useMemo(() => new LineBasicMaterial({ color: '#ff334d', transparent: true, opacity: 0.36, depthWrite: false }), []);
  const reticleGeometry = useMemo(() => new RingGeometry(0.34, 0.43, 48), []);
  const reticleMaterial = useMemo(() => new MeshBasicMaterial({ color: '#ff334d', transparent: true, opacity: 0.62, depthWrite: false }), []);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color('#ff334d'), []);

  useFrame(({ clock }) => syncTargetFeedback(engine, lineRef.current, reticleRef.current, linePositions, dummy, color, clock.elapsedTime));

  return (
    <group renderOrder={6}>
      <lineSegments ref={lineRef} geometry={lineGeometry} material={lineMaterial} frustumCulled={false} />
      <instancedMesh ref={reticleRef} args={[reticleGeometry, reticleMaterial, MAX_ENTITIES]} frustumCulled={false} renderOrder={6} />
    </group>
  );
}

function syncTargetFeedback(
  engine: BattleEngine,
  lines: LineSegments | null,
  reticles: InstancedMesh | null,
  linePositions: Float32Array,
  dummy: Object3D,
  color: Color,
  elapsed: number,
): void {
  if (!lines || !reticles) return;
  let lineCount = 0;
  const targets = new Set<number>();
  const { world } = engine;

  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!shouldShowHuntLine(world, entity)) continue;
    const target = world.targetEntity[entity];
    if (!shouldTarget(world, target)) continue;

    const from = entityStagePosition(world, entity, 0.34);
    const to = entityStagePosition(world, target, 0.18);
    const base = lineCount * 6;
    linePositions[base] = from[0];
    linePositions[base + 1] = from[1] + 0.1;
    linePositions[base + 2] = from[2] + 0.05;
    linePositions[base + 3] = to[0];
    linePositions[base + 4] = to[1] + 0.05;
    linePositions[base + 5] = to[2] + 0.05;
    lineCount += 1;
    targets.add(target);
  }

  if (world.activeTarget >= 0 && shouldTarget(world, world.activeTarget)) targets.add(world.activeTarget);

  const attribute = lines.geometry.getAttribute('position') as BufferAttribute;
  attribute.needsUpdate = true;
  lines.geometry.setDrawRange(0, lineCount * 2);

  let reticleCount = 0;
  for (const target of targets) {
    const [x, y, z] = entityStagePosition(world, target, -0.04);
    const pulse = 1 + Math.sin(elapsed * 7 + target) * 0.06;
    dummy.position.set(x, y - 0.42, z + 0.02);
    dummy.rotation.set(0, 0, elapsed * 0.9 + target * 0.12);
    dummy.scale.set(pulse, pulse * 0.34, 1);
    dummy.updateMatrix();
    reticles.setMatrixAt(reticleCount, dummy.matrix);
    reticles.setColorAt(reticleCount, color);
    reticleCount += 1;
  }

  reticles.count = reticleCount;
  reticles.instanceMatrix.needsUpdate = true;
  if (reticles.instanceColor) reticles.instanceColor.needsUpdate = true;
}

function shouldShowHuntLine(world: BattleEngine['world'], entity: number): boolean {
  if (world.combatStarted !== 1) return false;
  if (world.active[entity] !== 1 || world.kind[entity] !== EntityKind.Unit || world.hp[entity] <= 0) return false;
  if (isBenchSlot(world.formationSlot[entity])) return false;
  return world.targetEntity[entity] >= 0;
}

function shouldTarget(world: BattleEngine['world'], target: number): boolean {
  if (target < 0) return false;
  if (world.active[target] !== 1 || world.kind[target] !== EntityKind.Unit || world.hp[target] <= 0) return false;
  return !isBenchSlot(world.formationSlot[target]);
}
