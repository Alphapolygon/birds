import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { GRID_COLS, PLAYER_DEPLOY_COLS, ENEMY_DEPLOY_COLS, TILE_COUNT, TILE_SIZE } from '../game/constants';
import { GRID_GROUP_POSITION, GRID_TILT_X, tileGridPosition } from './sceneMath';

export function Board() {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(TILE_SIZE * 0.94, TILE_SIZE * 0.94), []);
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.8, vertexColors: true, depthWrite: false }), []);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let index = 0; index < TILE_COUNT; index += 1) {
      const x = index % GRID_COLS;
      const y = Math.floor(index / GRID_COLS);
      dummy.position.set(...tileGridPosition(x, y, -0.05));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      let hexColor = '#ffffff';
      let opacity = 0.05;

      if (x < PLAYER_DEPLOY_COLS) {
        hexColor = '#3b82f6';
        opacity = 0.2;
      } else if (x >= GRID_COLS - ENEMY_DEPLOY_COLS) {
        hexColor = '#ec4899';
        opacity = 0.2;
      }

      mesh.setColorAt(index, color.set(hexColor).multiplyScalar(opacity));
    }

    mesh.count = TILE_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [color, dummy]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, TILE_COUNT]}
      frustumCulled={false}
      position={GRID_GROUP_POSITION}
      renderOrder={1}
      rotation={[GRID_TILT_X, 0, 0]}
    />
  );
}
