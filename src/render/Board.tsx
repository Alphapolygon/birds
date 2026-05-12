import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, LineBasicMaterial, MeshBasicMaterial } from 'three';
import { useGameStore } from '../store/useGameStore';
import { perspectiveMap } from './sceneMath';
import { GRID_COLS, GRID_ROWS } from '../game/constants';

export function Board() {
  const debugGrid = useGameStore((state) =>false);

  const { geometry, material } = useMemo(() => {
    const vertices: number[] = [];
    const colors: number[] = [];
    
    function addQuad(colStart: number, colEnd: number, r: number, g: number, b: number) {
      const tl = perspectiveMap(colStart, 0);
      const tr = perspectiveMap(colEnd, 0);
      const bl = perspectiveMap(colStart, 8);
      const br = perspectiveMap(colEnd, 8);

      vertices.push(
        tl.x, tl.y, 0,  tr.x, tr.y, 0,  bl.x, bl.y, 0,
        tr.x, tr.y, 0,  br.x, br.y, 0,  bl.x, bl.y, 0
      );
      for (let i = 0; i < 6; i++) colors.push(r, g, b);
    }

    // Blue Deploy Zone
    addQuad(0, 2, 0.23, 0.51, 0.96);
    // Pink Deploy Zone
    addQuad(8, 10, 0.92, 0.28, 0.60);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    
    const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false, depthTest: false });
    return { geometry: geo, material: mat };
  }, []);

  // NEW: Generate the 8x8 debug wireframe using the projection map
  const { wireGeo, wireMat } = useMemo(() => {
    const vertices: number[] = [];
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const tl = perspectiveMap(col, row);
        const tr = perspectiveMap(col + 1, row);
        const bl = perspectiveMap(col, row + 1);
        const br = perspectiveMap(col + 1, row + 1);

        // Draw 4 lines per cell
        vertices.push(
          tl.x, tl.y, 0,  tr.x, tr.y, 0,
          tr.x, tr.y, 0,  br.x, br.y, 0,
          br.x, br.y, 0,  bl.x, bl.y, 0,
          bl.x, bl.y, 0,  tl.x, tl.y, 0
        );
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    const mat = new LineBasicMaterial({ color: '#ffeb3b', transparent: true, opacity: 0, depthWrite: false, depthTest: false });
    return { wireGeo: geo, wireMat: mat };
  }, []);

  // Listen to the store and toggle opacity
  useLayoutEffect(() => {
    wireMat.opacity = debugGrid ? 0.7 : 0;
  }, [debugGrid, wireMat]);

  return (
    <group>
      <mesh geometry={geometry} material={material} renderOrder={1} />
      <lineSegments geometry={wireGeo} material={wireMat} renderOrder={2} />
    </group>
  );
}