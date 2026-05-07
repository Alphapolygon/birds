import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { GRID_COLS, TILE_COUNT, TILE_SIZE } from '../game/constants';
import type { BattleEngine } from '../game/ecs/engine';
import { tileIndex } from '../game/ecs/grid';
import { Faction, TerrainType, type PlayerActionMode } from '../game/types';
import { useGameStore } from '../store/useGameStore';
import { GRID_GROUP_POSITION, GRID_TILT_X, tileGridPosition } from './sceneMath';

type BoardProps = {
  engine: BattleEngine;
};

export function Board({ engine }: BoardProps) {
  const battleVersion = useGameStore((state) => state.battleVersion);
  const actionMode = useGameStore((state) => state.actionMode);
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => makeTileGeometry(), []);
  const material = useMemo(() => makeTileMaterial(), []);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  const actionMask = engine.getActionMask(actionMode);

  useLayoutEffect(() => {
    syncTileInstances(engine, actionMask, actionMode, meshRef.current, dummy, color);
  }, [actionMask, actionMode, battleVersion, color, dummy, engine]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, TILE_COUNT]}
      frustumCulled={false}
      onClick={(event) => handleGridClick(event, engine, actionMode)}
      position={GRID_GROUP_POSITION}
      renderOrder={1}
      rotation={[GRID_TILT_X, 0, 0]}
    />
  );
}

function makeTileGeometry(): PlaneGeometry {
  return new PlaneGeometry(TILE_SIZE * 0.92, TILE_SIZE * 0.92);
}

function makeTileMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ transparent: true, opacity: 0.45, vertexColors: true, depthWrite: false });
}

function syncTileInstances(
  engine: BattleEngine,
  actionMask: Uint8Array,
  actionMode: PlayerActionMode,
  mesh: InstancedMesh | null,
  dummy: Object3D,
  color: Color,
): void {
  if (!mesh) return;
  for (let index = 0; index < TILE_COUNT; index += 1) {
    const { x, y } = tileFromIndex(index);
    writeTileMatrix(dummy, x, y);
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, color.set(tileColor(engine, actionMask, actionMode, x, y)));
  }
  mesh.count = TILE_COUNT;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function writeTileMatrix(dummy: Object3D, x: number, y: number): Matrix4 {
  dummy.position.set(...tileGridPosition(x, y, 0));
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  return dummy.matrix;
}

function handleGridClick(event: ThreeEvent<MouseEvent>, engine: BattleEngine, actionMode: PlayerActionMode): void {
  event.stopPropagation();
  const instanceId = event.instanceId;
  if (instanceId === undefined || instanceId < 0 || instanceId >= TILE_COUNT) return;
  const { x, y } = tileFromIndex(instanceId);
  engine.clickTile(x, y, actionMode);
}

function tileFromIndex(index: number): { x: number; y: number } {
  return { x: index % GRID_COLS, y: Math.floor(index / GRID_COLS) };
}

function tileColor(engine: BattleEngine, actionMask: Uint8Array, actionMode: PlayerActionMode, x: number, y: number): string {
  const index = tileIndex(x, y);
  const terrain = engine.world.gridTerrain[index] as TerrainType;

  if (actionMask[index] === 1) return actionMode === 'walk' ? '#55ff88' : targetModeColor(actionMode);

  const isDark = (x + y) % 2 === 0;

  if (terrain === TerrainType.Trench) return isDark ? '#3d2b1f' : '#4a3628';
  if (terrain === TerrainType.Watchtower) return isDark ? '#2a4858' : '#34576b';
  if (terrain === TerrainType.Barricade) return isDark ? '#4a2b22' : '#5a362a';
  if (terrain === TerrainType.MedicTent) return medicTentColor(engine, x, y, isDark);

  if (x <= 1) return isDark ? '#1b3a26' : '#224a31';
  if (x >= 8) return isDark ? '#4a1b1b' : '#5c2222';

  return isDark ? '#1a1f2e' : '#22283a';
}

function medicTentColor(engine: BattleEngine, x: number, y: number, isDark: boolean): string {
  const owner = engine.world.gridOwner[tileIndex(x, y)] as Faction;
  if (owner === Faction.Player) return isDark ? '#1f6842' : '#287d51';
  if (owner === Faction.Pig) return isDark ? '#793232' : '#963b3b';
  return isDark ? '#6d5c25' : '#8a7430';
}

function targetModeColor(actionMode: PlayerActionMode): string {
  return actionMode === 'charged_attack' ? '#ff7a39' : '#ff3333';
}
