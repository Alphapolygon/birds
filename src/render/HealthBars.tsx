import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { MAX_ENTITIES, TILE_SIZE } from '../game/constants';
import type { BattleEngine } from '../game/ecs/engine';
import { isBenchSlot } from '../game/formationSlots';
import { EntityKind, Faction } from '../game/types';
import { entityStagePosition } from './sceneMath';

const BAR_WIDTH = TILE_SIZE * 0.65;
const HP_HEIGHT = 0.07;
const MANA_HEIGHT = 0.04;
const SPACING = 0.02;

export function HealthBars({ engine }: { engine: BattleEngine }) {
  const meshRef = useRef<InstancedMesh>(null);
  const hpGeom = useMemo(() => new PlaneGeometry(BAR_WIDTH, HP_HEIGHT), []);
  const manaGeom = useMemo(() => new PlaneGeometry(BAR_WIDTH, MANA_HEIGHT), []);
  
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  // We use standard Basic materials for efficiency in WebGPU
  const mat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }), []);

  useFrame(() => {
    if (!meshRef.current) return;
    let count = 0;
    const world = engine.world;

    for (let i = 0; i < world.nextEntity; i++) {
      if (world.active[i] !== 1 || world.kind[i] !== EntityKind.Unit || world.hp[i] <= 0) continue;
      if (isBenchSlot(world.formationSlot[i]) && world.draggedEntity !== i) continue;

      const pos = entityStagePosition(world, i, 0);
      const hpPct = world.hp[i] / world.maxHp[i];
      const manaPct = world.starMax[i] > 0 ? world.mana[i] / world.starMax[i] : 0;
      
      const yAnchor = pos[1] - 0.45;

      // 1. HP Bar Fill
      dummy.position.set(pos[0] + (hpPct - 1) * (BAR_WIDTH * 0.5), yAnchor, pos[2] + 0.1);
      dummy.scale.set(hpPct, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(count, dummy.matrix);
      meshRef.current.setColorAt(count, color.set(world.faction[i] === Faction.Player ? '#4ade80' : '#ff4d4d'));
      count++;

      // 2. Mana Bar Fill (Star Meter)
      if (world.starMax[i] > 0) {
        dummy.position.set(pos[0] + (manaPct - 1) * (BAR_WIDTH * 0.5), yAnchor - HP_HEIGHT - SPACING, pos[2] + 0.1);
        dummy.scale.set(manaPct, 1, 1);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(count, dummy.matrix);
        meshRef.current.setColorAt(count, color.set(manaPct >= 1 ? '#ffd166' : '#60a5fa'));
        count++;
      }
    }
    meshRef.current.count = count;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  // Doubling MAX_ENTITIES to account for both HP and Mana bars per unit
  return <instancedMesh ref={meshRef} args={[hpGeom, mat, MAX_ENTITIES * 2]} frustumCulled={false} renderOrder={10} />;
}