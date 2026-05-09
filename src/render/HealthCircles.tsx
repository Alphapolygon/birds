import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, MeshBasicMaterial, RingGeometry } from 'three';
import type { BattleEngine } from '../game/ecs/engine';
import { isBenchSlot } from '../game/formationSlots';
import { EntityKind } from '../game/types';
import { entityStagePosition } from './sceneMath';

export function HealthCircles({ engine }: { engine: BattleEngine }) {
  useRenderTicker();
  const red = useMemo(() => new MeshBasicMaterial({ color: '#b91f2d', transparent: true, opacity: 0.76, depthWrite: false }), []);
  const green = useMemo(() => new MeshBasicMaterial({ color: '#5cff70', transparent: true, opacity: 0.92, depthWrite: false }), []);
  const baseGeometry = useMemo(() => new RingGeometry(0.29, 0.37, 48), []);
  const entities = activeUnitEntities(engine);
  return (
    <group renderOrder={4}>
      {entities.map((entity) => <HealthCircle key={entity} engine={engine} entity={entity} baseGeometry={baseGeometry} red={red} green={green} />)}
    </group>
  );
}

function HealthCircle({ engine, entity, baseGeometry, red, green }: { engine: BattleEngine; entity: number; baseGeometry: RingGeometry; red: MeshBasicMaterial; green: MeshBasicMaterial }) {
  const groupRef = useRef<Group>(null);
  const world = engine.world;
  const ratio = Math.max(0.02, Math.min(1, world.hp[entity] / Math.max(1, world.maxHp[entity])));
  const greenGeometry = useMemo(() => new RingGeometry(0.295, 0.375, 48, 1, Math.PI / 2, Math.PI * 2 * ratio), [ratio]);
  const [x, y, z] = entityStagePosition(world, entity, -0.09);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || world.active[entity] !== 1) return;
    const [x, y, z] = entityStagePosition(world, entity, -0.09);
    group.position.set(x, y - 0.42, z - 0.08);
    group.scale.set(1, 0.34, 1);
  });

  return (
    <group ref={groupRef} position={[x, y - 0.42, z - 0.08]} scale={[1, 0.34, 1]}>
      <mesh geometry={baseGeometry} material={red} />
      <mesh geometry={greenGeometry} material={green} />
    </group>
  );
}

function activeUnitEntities(engine: BattleEngine): number[] {
  const result: number[] = [];
  const { world } = engine;
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1 || world.kind[entity] !== EntityKind.Unit || world.hp[entity] <= 0) continue;
    if (isBenchSlot(world.formationSlot[entity]) && world.draggedEntity !== entity) continue;
    result.push(entity);
  }
  return result;
}

function useRenderTicker(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => (value + 1) % 100000), 100);
    return () => window.clearInterval(id);
  }, []);
}
