import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, CanvasTexture, Color, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace } from 'three';
import { MAX_ENTITIES, TILE_SIZE } from '../game/constants';
import { FxKind } from '../game/ecs/animation';
import type { BattleEngine } from '../game/ecs/engine';
import { EntityKind } from '../game/types';
import { slotWorldPosition, spriteWorldPosition } from './sceneMath';

type VfxLayerProps = {
  engine: BattleEngine;
};

export function VfxLayer({ engine }: VfxLayerProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(TILE_SIZE, TILE_SIZE), []);
  const texture = useMemo(() => makeBurstTexture(), []);
  const material = useMemo(() => makeMaterial(texture), [texture]);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useFrame(() => syncEffects(engine, meshRef.current, dummy, color));

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_ENTITIES]} frustumCulled={false} renderOrder={8} />;
}

function makeMaterial(map: CanvasTexture): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, transparent: true, opacity: 0.72, depthWrite: false, vertexColors: true, blending: AdditiveBlending });
}

function syncEffects(engine: BattleEngine, mesh: InstancedMesh | null, dummy: Object3D, color: Color): void {
  if (!mesh) return;
  let count = 0;
  for (let entity = 0; entity < engine.world.nextEntity; entity += 1) {
    if (!isEffect(engine.world, entity)) continue;
    writeEffectMatrix(engine, entity, dummy);
    mesh.setMatrixAt(count, dummy.matrix);
    mesh.setColorAt(count, color.set(effectColor(engine.world.fxKind[entity] as FxKind)));
    count += 1;
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function isEffect(world: BattleEngine['world'], entity: number): boolean {
  return world.active[entity] === 1 && world.kind[entity] === EntityKind.Projectile && world.fxLife[entity] > 0;
}

function writeEffectMatrix(engine: BattleEngine, entity: number, dummy: Object3D): void {
  const position = effectPosition(engine, entity);
  const phase = effectPhase(engine.world, entity);
  const scale = effectScale(engine.world.fxKind[entity] as FxKind, phase);
  dummy.position.set(position[0], position[1] + 0.08, position[2] + 0.22);
  dummy.rotation.set(0, 0, entity * 0.43 + phase * Math.PI);
  dummy.scale.set(scale, scale, 1);
  dummy.updateMatrix();
}

function effectPosition(engine: BattleEngine, entity: number): [number, number, number] {
  const slot = engine.world.formationSlot[entity];
  if (slot >= 0) return slotWorldPosition(slot, 0.55);
  return spriteWorldPosition(engine.world.x[entity], engine.world.y[entity], 0.6 + engine.world.y[entity] * 0.02);
}

function effectPhase(world: BattleEngine['world'], entity: number): number {
  const max = Math.max(0.01, world.fxMaxLife[entity]);
  return 1 - Math.max(0, Math.min(1, world.fxLife[entity] / max));
}

function effectScale(kind: FxKind, phase: number): number {
  const base = kind === FxKind.Special ? 1.15 : kind === FxKind.Charged ? 0.95 : 0.68;
  return base * (0.45 + phase * 1.15);
}

function effectColor(kind: FxKind): string {
  if (kind === FxKind.Charged) return '#ff7a39';
  if (kind === FxKind.Shield) return '#9ad7ff';
  if (kind === FxKind.Special) return '#ffffff';
  return '#ffe48a';
}

function makeBurstTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) drawBurst(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function drawBurst(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, 128, 128);
  ctx.translate(64, 64);
  drawSlash(ctx, -0.35);
  drawSlash(ctx, 0.55);
  drawCore(ctx);
}

function drawSlash(ctx: CanvasRenderingContext2D, rotation: number): void {
  ctx.save();
  ctx.rotate(rotation);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCore(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
}
