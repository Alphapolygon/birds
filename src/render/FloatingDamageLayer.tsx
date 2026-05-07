import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { FLOATING_TEXT_SECONDS, FloatingTextKind } from '../game/ecs/animation';
import type { BattleEngine } from '../game/ecs/engine';
import { EntityKind } from '../game/types';

export function FloatingDamageLayer({ engine }: { engine: BattleEngine }) {
  useRenderTicker();
  const geometry = useMemo(() => new PlaneGeometry(0.72, 0.32), []);
  const floats = activeFloatEntities(engine);
  return (
    <group renderOrder={12}>
      {floats.map((entity) => <FloatingNumber key={entity} engine={engine} entity={entity} geometry={geometry} />)}
    </group>
  );
}

function FloatingNumber({ engine, entity, geometry }: { engine: BattleEngine; entity: number; geometry: PlaneGeometry }) {
  const world = engine.world;
  const value = world.floatValue[entity];
  const kind = world.floatKind[entity] as FloatingTextKind;
  const phase = 1 - Math.max(0, Math.min(1, world.floatLife[entity] / Math.max(0.01, world.floatMaxLife[entity] || FLOATING_TEXT_SECONDS)));
  const text = `${kind === FloatingTextKind.Heal ? '+' : '-'}${value}`;
  const material = useMemo(() => makeTextMaterial(text, textColor(kind)), [text, kind]);
  const scale = 1 + phase * 0.18;
  return <mesh geometry={geometry} material={material} position={[world.floatX[entity], world.floatY[entity] + phase * 0.42, world.floatZ[entity] + 0.15]} scale={[scale, scale, 1]} />;
}

function activeFloatEntities(engine: BattleEngine): number[] {
  const result: number[] = [];
  const { world } = engine;
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (world.active[entity] !== 1 || world.kind[entity] !== EntityKind.Projectile || world.floatLife[entity] <= 0) continue;
    result.push(entity);
  }
  return result;
}

function makeTextMaterial(text: string, color: string): MeshBasicMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '900 58px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(text, 128, 56);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 56);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
}

function textColor(kind: FloatingTextKind): string {
  if (kind === FloatingTextKind.Heal) return '#65ff76';
  if (kind === FloatingTextKind.Counter) return '#ff9a3d';
  if (kind === FloatingTextKind.Mana) return '#fff36d';
  return '#ff4d45';
}

function useRenderTicker(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => (value + 1) % 100000), 60);
    return () => window.clearInterval(id);
  }, []);
}
