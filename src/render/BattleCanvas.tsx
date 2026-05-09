import { Canvas, type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { OrthographicCamera, type Camera } from 'three';

import type { BattleEngine } from '../game/ecs/engine';
import { useGameStore } from '../store/useGameStore';
import { Board } from './Board';
import { EntityBatches } from './EntityBatches';
import { ShieldRings } from './ShieldRings';
import { SlotGuides } from './SlotGuides';
import { UnitShadows } from './UnitShadows';
import { HealthCircles } from './HealthCircles';
import { FloatingDamageLayer } from './FloatingDamageLayer';
import { VfxLayer } from './VfxLayer';
import { TargetFeedback } from './TargetFeedback';
import { createWebGpuRenderer } from './webgpuRenderer';

type BattleCanvasProps = {
  engine: BattleEngine;
};

export function BattleCanvas({ engine }: BattleCanvasProps) {
  const phase = useGameStore((state) => state.phase);
  const bossRule = useGameStore((state) => state.bossRule);
  const battleId = useGameStore((state) => state.battleId);
  const territoryId = useGameStore((state) => state.selectedTerritoryId ?? '');
  usePrepareRound(engine, phase, bossRule, territoryId, battleId);
  return (
    <Canvas
      className="battle-canvas"
      orthographic
      camera={{ position: [0, 0, 10], zoom: 82, near: 0.1, far: 100 }}
      gl={createWebGpuRenderer as any}
    >
      <SceneRuntime engine={engine} />
    </Canvas>
  );
}

function SceneRuntime({ engine }: { engine: BattleEngine }) {
  useFrame(({ camera }, delta) => {
    engine.tick(delta);
    updateCamera(camera, engine, delta);
  });
  return (
    <group>
      <DragSurface engine={engine} />
      <Board />
      <SlotGuides engine={engine} />
      <UnitShadows engine={engine} />
      <HealthCircles engine={engine} />
      <EntityBatches engine={engine} />
      <ShieldRings engine={engine} />
      <TargetFeedback engine={engine} />
      <VfxLayer engine={engine} />
      <FloatingDamageLayer engine={engine} />
    </group>
  );
}

function DragSurface({ engine }: { engine: BattleEngine }) {
  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (engine.world.draggedEntity < 0) return;
    event.stopPropagation();
    engine.updateDragPosition(event.point.x, event.point.y, 0.72);
  };
  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (engine.world.draggedEntity < 0) return;
    event.stopPropagation();
    engine.dropDraggedUnit(event.point.x, event.point.y);
  };
  return (
    <mesh position={[0, -0.05, -0.35]} onPointerMove={onPointerMove} onPointerUp={onPointerUp} renderOrder={0}>
      <planeGeometry args={[9.6, 6.0]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function updateCamera(camera: Camera, engine: BattleEngine, delta: number): void {
  // Static auto-battler camera: no combat focus panning.
  const targetZoom = engine.world.combatStarted === 1 ? 86 : 80;
  const targetY = engine.world.combatStarted === 1 ? 0 : -0.18;
  const lerp = 1 - Math.pow(0.001, Math.min(0.05, delta));

  camera.position.x += (0 - camera.position.x) * lerp;
  camera.position.y += (targetY - camera.position.y) * lerp;

  if (camera instanceof OrthographicCamera) {
    camera.zoom += (targetZoom - camera.zoom) * lerp;
    camera.updateProjectionMatrix();
  }
}


function usePrepareRound(engine: BattleEngine, phase: string, bossRule: Parameters<BattleEngine['prepareRound']>[0]['bossRule'], territoryId: string, battleId: number): void {
  const lastSeed = useRef('');
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'battle') return;
    const seedKey = `${battleId}:${territoryId}:${bossRule}`;
    if (lastSeed.current === seedKey) return;
    lastSeed.current = seedKey;
    engine.prepareRound({ bossRule, territoryId, battleId });
  }, [battleId, bossRule, engine, phase, territoryId]);
}
