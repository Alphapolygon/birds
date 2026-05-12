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
      // X spans exactly 28.16, Y spans exactly 15.36!
      camera={{ position: [0, 0, 10], left: -14.08, right: 14.08, top: 7.68, bottom: -7.68, near: 0.1, far: 100 }}
      gl={createWebGpuRenderer as any}
    >
      <SceneRuntime engine={engine} />
    </Canvas>
  );
}

function SceneRuntime({ engine }: { engine: BattleEngine }) {
  useFrame(({ camera }, delta) => {
    engine.tick(delta);
    
  });
  return (
    <group>
      <DragSurface engine={engine} />
      <Board />
      <UnitShadows engine={engine} />
      <HealthCircles engine={engine} />
      <EntityBatches engine={engine} />
      <ShieldRings engine={engine} />
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
      <planeGeometry args={[10.5, 9.5]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
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
