import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Matrix4,
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
import { ATTACK_ANIM_SECONDS, HIT_ANIM_SECONDS, SHIELD_ANIM_SECONDS } from '../game/ecs/animation';
import type { BattleEngine } from '../game/ecs/engine';
import { EntityKind } from '../game/types';
import { isBenchSlot } from '../game/formationSlots';
import { entityStagePosition } from './sceneMath';
import atlasImage from '../assets/sprites/INGAME_BIRDS_1.png';

type SpriteBatchProps = { engine: BattleEngine };

export function SpriteBatch({ engine }: SpriteBatchProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const instanceToEntity = useRef(new Int32Array(MAX_ENTITIES).fill(-1));
  const sortedEntities = useRef(new Int32Array(MAX_ENTITIES).fill(-1));
  const texture = useMemo(() => loadAtlasTexture(), []);
  const geometry = useMemo(() => makeAtlasGeometry(), []);
  const material = useMemo(() => makeAtlasMaterial(texture), [texture]);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(({ clock }) => updateInstances(engine, meshRef.current, geometry, dummy, instanceToEntity.current, sortedEntities.current, clock.elapsedTime));

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_ENTITIES]}
      frustumCulled={false}
      renderOrder={3}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        const instanceId = event.instanceId ?? -1;
        const entity = instanceId >= 0 ? instanceToEntity.current[instanceId] : -1;
        if (entity < 0 || !engine.canDragUnit(entity)) return;
        event.stopPropagation();
        engine.beginDragUnit(entity);
        engine.updateDragPosition(event.point.x, event.point.y, 0.82);
      }}
    />
  );
}

function loadAtlasTexture(): Texture {
  const texture = new TextureLoader().load(atlasImage);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  return texture;
}

function makeAtlasGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(TILE_SIZE * 0.95, TILE_SIZE * 0.95);
  const offset = new InstancedBufferAttribute(new Float32Array(MAX_ENTITIES * 2), 2);
  const scale = new InstancedBufferAttribute(new Float32Array(MAX_ENTITIES * 2), 2);
  offset.setUsage(DynamicDrawUsage);
  scale.setUsage(DynamicDrawUsage);
  geometry.setAttribute('instanceUvOffset', offset);
  geometry.setAttribute('instanceUvScale', scale);
  return geometry;
}

function makeAtlasMaterial(map: Texture): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ transparent: true, alphaTest: 0.05, depthWrite: false });
  const instanceUvOffset = attribute('instanceUvOffset', 'vec2') as any;
  const instanceUvScale = attribute('instanceUvScale', 'vec2') as any;
  const customUv = (uv() as any).mul(instanceUvScale).add(instanceUvOffset);
  material.colorNode = tslTexture(map, customUv);
  return material;
}

function updateInstances(
  engine: BattleEngine,
  mesh: InstancedMesh | null,
  geometry: PlaneGeometry,
  dummy: Object3D,
  instanceToEntity: Int32Array,
  sortedEntities: Int32Array,
  elapsed: number,
): void {
  if (!mesh) return;
  const offset = geometry.getAttribute('instanceUvOffset') as InstancedBufferAttribute;
  const scale = geometry.getAttribute('instanceUvScale') as InstancedBufferAttribute;
  const offsetArray = offset.array as Float32Array;
  const scaleArray = scale.array as Float32Array;
  const count = collectRenderableEntities(engine.world, sortedEntities);

  for (let index = 0; index < count; index += 1) {
    const entity = sortedEntities[index];
    writeEntityMatrix(engine.world, entity, dummy, elapsed);
    writeEntityUvs(engine.world, entity, index, offsetArray, scaleArray);
    mesh.setMatrixAt(index, dummy.matrix);
    instanceToEntity[index] = entity;
  }
  for (let index = count; index < instanceToEntity.length; index += 1) instanceToEntity[index] = -1;
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  offset.needsUpdate = true;
  scale.needsUpdate = true;
}

function collectRenderableEntities(world: BattleEngine['world'], out: Int32Array): number {
  let count = 0;
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!shouldRender(world, entity)) continue;
    out[count] = entity;
    count += 1;
  }
  const slice = Array.from(out.slice(0, count));
  slice.sort((a, b) => renderSort(world, a, b));
  for (let index = 0; index < slice.length; index += 1) out[index] = slice[index];
  return count;
}

function renderSort(world: BattleEngine['world'], a: number, b: number): number {
  const ay = world.draggedEntity === a ? world.dragY : world.posY[a];
  const by = world.draggedEntity === b ? world.dragY : world.posY[b];
  return by - ay || a - b;
}

function shouldRender(world: BattleEngine['world'], entity: number): boolean {
  if (world.active[entity] !== 1) return false;
  if (world.kind[entity] === EntityKind.Projectile) return false;
  if (isBenchSlot(world.formationSlot[entity]) && world.draggedEntity !== entity) return false;
  return world.spriteKey[entity].length > 0;
}

function writeEntityUvs(world: BattleEngine['world'], entity: number, instance: number, offsetArray: Float32Array, scaleArray: Float32Array): void {
  offsetArray[instance * 2] = world.uvOffsetX[entity];
  offsetArray[instance * 2 + 1] = world.uvOffsetY[entity];
  scaleArray[instance * 2] = world.uvScaleX[entity];
  scaleArray[instance * 2 + 1] = world.uvScaleY[entity];
}

function writeEntityMatrix(world: BattleEngine['world'], entity: number, dummy: Object3D, elapsed: number): Matrix4 {
  const position = entityWorldPosition(world, entity);
  const anim = animationPose(world, entity, elapsed);
  const base = spriteScale(world, entity) * perspectiveScale(world, entity) * anim.scale;
  const aspect = Math.max(0.25, world.uvAspectRatio[entity] || 1);
  dummy.position.set(position[0] + anim.x, position[1] + anim.y, position[2]);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(base * aspect, base, 1);
  dummy.updateMatrix();
  return dummy.matrix;
}

function spriteScale(world: BattleEngine['world'], entity: number): number {
  if (world.unitId[entity] === 'terence') return 1.18;
  if (world.kind[entity] === EntityKind.GoldenEgg) return 0.72;
  if (world.kind[entity] === EntityKind.Barricade) return 0.88;
  return 1;
}

function perspectiveScale(world: BattleEngine['world'], entity: number): number {
  if (isBenchSlot(world.formationSlot[entity])) return 1;
  const y = world.draggedEntity === entity ? world.dragY : world.posY[entity];
  return Math.max(0.78, Math.min(1.24, 1.0 + (-y - 0.05) * 0.12));
}

function entityWorldPosition(world: BattleEngine['world'], entity: number): [number, number, number] {
  const position = entityStagePosition(world, entity, entityLift(world, entity));
  return [position[0], position[1], position[2]];
}

function entityLift(world: BattleEngine['world'], entity: number): number {
  if (world.kind[entity] !== EntityKind.Unit) return 0;
  return isBenchSlot(world.formationSlot[entity]) ? 0.04 : 0.12;
}

function animationPose(world: BattleEngine['world'], entity: number, elapsed: number): { x: number; y: number; scale: number } {
  const isLivingUnit = world.kind[entity] === EntityKind.Unit && world.hp[entity] > 0;
  const idle = isLivingUnit && world.draggedEntity !== entity ? idleBounce(entity, elapsed) : 0;
  const attack = attackLunge(world, entity);
  const hit = hitShake(world, entity);
  const shield = shieldPulse(world, entity);
  return { x: attack.x + hit.x, y: idle + hit.y, scale: 1 + attack.scale + shield };
}

function idleBounce(entity: number, elapsed: number): number { return Math.sin(elapsed * 4.2 + entity * 0.61) * 0.035; }

function attackLunge(world: BattleEngine['world'], entity: number): { x: number; scale: number } {
  const timer = world.animAttack[entity];
  if (timer <= 0) return { x: 0, scale: 0 };
  const phase = 1 - timer / ATTACK_ANIM_SECONDS;
  const pulse = Math.sin(phase * Math.PI);
  return { x: pulse * 0.13 * (world.animDir[entity] || 1), scale: pulse * 0.08 };
}

function hitShake(world: BattleEngine['world'], entity: number): { x: number; y: number } {
  const timer = world.animHit[entity];
  if (timer <= 0) return { x: 0, y: 0 };
  const phase = 1 - timer / HIT_ANIM_SECONDS;
  const shake = Math.sin(phase * Math.PI * 5) * 0.055;
  return { x: shake, y: Math.abs(shake) * 0.35 };
}

function shieldPulse(world: BattleEngine['world'], entity: number): number {
  const timer = world.animShield[entity];
  if (timer <= 0) return 0;
  const phase = 1 - timer / SHIELD_ANIM_SECONDS;
  return Math.sin(phase * Math.PI) * 0.1;
}
