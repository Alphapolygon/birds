import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, texture as tslTexture, uv } from 'three/tsl';
import { MAX_ENTITIES, TILE_SIZE } from '../game/constants';
import { EFFECT_CATALOG } from '../game/effectCatalog';
import type { BattleEngine } from '../game/ecs/engine';
import { EntityKind } from '../game/types';
import atlasImage from '../assets/sprites/INGAME_BIRDS_1.png';

type VfxLayerProps = { engine: BattleEngine };

export function VfxLayer({ engine }: VfxLayerProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => makeGeometry(), []);
  const texture = useMemo(() => loadTexture(), []);
  const material = useMemo(() => makeMaterial(texture), [texture]);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(() => syncEffects(engine, meshRef.current, geometry, dummy));
  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_ENTITIES]} frustumCulled={false} renderOrder={8} />;
}

function loadTexture(): Texture {
  const texture = new TextureLoader().load(atlasImage);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  return texture;
}

function makeGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(TILE_SIZE, TILE_SIZE);
  const offset = new InstancedBufferAttribute(new Float32Array(MAX_ENTITIES * 2), 2);
  const scale = new InstancedBufferAttribute(new Float32Array(MAX_ENTITIES * 2), 2);
  offset.setUsage(DynamicDrawUsage);
  scale.setUsage(DynamicDrawUsage);
  geometry.setAttribute('instanceUvOffset', offset);
  geometry.setAttribute('instanceUvScale', scale);
  return geometry;
}

function makeMaterial(map: Texture): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ transparent: true, alphaTest: 0.04, opacity: 0.82, depthWrite: false, blending: AdditiveBlending });
  const instanceUvOffset = attribute('instanceUvOffset', 'vec2') as any;
  const instanceUvScale = attribute('instanceUvScale', 'vec2') as any;
  const customUv = (uv() as any).mul(instanceUvScale).add(instanceUvOffset);
  material.colorNode = tslTexture(map, customUv);
  return material;
}

function syncEffects(engine: BattleEngine, mesh: InstancedMesh | null, geometry: PlaneGeometry, dummy: Object3D): void {
  if (!mesh) return;
  const offset = geometry.getAttribute('instanceUvOffset') as InstancedBufferAttribute;
  const scale = geometry.getAttribute('instanceUvScale') as InstancedBufferAttribute;
  const offsetArray = offset.array as Float32Array;
  const scaleArray = scale.array as Float32Array;
  let count = 0;
  for (let entity = 0; entity < engine.world.nextEntity; entity += 1) {
    if (!isEffect(engine.world, entity)) continue;
    writeEffectMatrix(engine, entity, dummy);
    writeEffectUvs(engine.world, entity, count, offsetArray, scaleArray);
    mesh.setMatrixAt(count, dummy.matrix);
    count += 1;
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  offset.needsUpdate = true;
  scale.needsUpdate = true;
}

function isEffect(world: BattleEngine['world'], entity: number): boolean {
  return world.active[entity] === 1 && world.kind[entity] === EntityKind.Projectile && world.fxLife[entity] > 0;
}

function writeEffectUvs(world: BattleEngine['world'], entity: number, instance: number, offsetArray: Float32Array, scaleArray: Float32Array): void {
  offsetArray[instance * 2] = world.uvOffsetX[entity];
  offsetArray[instance * 2 + 1] = world.uvOffsetY[entity];
  scaleArray[instance * 2] = world.uvScaleX[entity];
  scaleArray[instance * 2 + 1] = world.uvScaleY[entity];
}

function writeEffectMatrix(engine: BattleEngine, entity: number, dummy: Object3D): void {
  const world = engine.world;
  const phase = effectPhase(world, entity);
  const scale = effectScale(world.fxKind[entity], phase);
  dummy.position.set(world.posX[entity], world.posY[entity] + 0.08, world.posZ[entity] + 0.24);
  dummy.rotation.set(0, 0, entity * 0.43 + phase * Math.PI);
  dummy.scale.set(scale, scale, 1);
  dummy.updateMatrix();
}

function effectPhase(world: BattleEngine['world'], entity: number): number {
  const max = Math.max(0.01, world.fxMaxLife[entity]);
  return 1 - Math.max(0, Math.min(1, world.fxLife[entity] / max));
}

function effectScale(kind: number, phase: number): number {
  const base = EFFECT_CATALOG[kind]?.scale ?? 0.6;
  return base * (0.55 + Math.sin(phase * Math.PI) * 0.75 + phase * 0.2);
}
