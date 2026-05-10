import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { GRID_COLS, PLAYER_DEPLOY_COLS, ENEMY_DEPLOY_COLS, TILE_COUNT, TILE_SIZE } from '../game/constants';
import { GRID_GROUP_POSITION, GRID_TILT_X, tileGridPosition } from './sceneMath';

export function Board() {
  const meshRef = useRef<InstancedMesh>(null);
  const wireRef = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => new PlaneGeometry(TILE_SIZE * 0.96, TILE_SIZE * 0.96), []);
  const wireGeom = useMemo(() => new PlaneGeometry(TILE_SIZE, TILE_SIZE), []);

  // NEW: depthTest is false so the board stays perfectly in the background
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.3, vertexColors: true, depthWrite: false, depthTest: false }), []);
  const wireMaterial = useMemo(() => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, wireframe: false, depthWrite: false, depthTest: false }), []);

  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    const wire = wireRef.current;
    if (!mesh || !wire) return;

    for (let index = 0; index < TILE_COUNT; index += 1) {
      const x = index % GRID_COLS;
      const y = Math.floor(index / GRID_COLS);

      dummy.position.set(...tileGridPosition(x, y, -0.05));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      mesh.setMatrixAt(index, dummy.matrix);
      wire.setMatrixAt(index, dummy.matrix);

      let hexColor = '#ffffff';
      let opacity = 0.0;

      if (x < PLAYER_DEPLOY_COLS) {
        hexColor = '#3b82f6';
        opacity = 0.5;
      } else if (x >= GRID_COLS - ENEMY_DEPLOY_COLS) {
        hexColor = '#ec4899';
        opacity = 0.5;
      }

      mesh.setColorAt(index, color.set(hexColor).multiplyScalar(opacity));
    }

    mesh.count = TILE_COUNT;
    wire.count = TILE_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    wire.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [color, dummy]);

  return (
    <group position={GRID_GROUP_POSITION} rotation={[GRID_TILT_X, 0, 0]}>
      {/* NEW: renderOrder is applied directly to the meshes! */}
      <instancedMesh ref={meshRef} args={[geometry, material, TILE_COUNT]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={wireRef} args={[wireGeom, wireMaterial, TILE_COUNT]} frustumCulled={false} position={[0, 0, 0.01]} renderOrder={2} />
    </group>
  );
}