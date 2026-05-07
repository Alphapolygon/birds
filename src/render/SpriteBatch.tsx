import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Texture,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { texture as tslTexture, attribute, uv, vec2, min, step } from 'three/tsl';

import { MAX_ENTITIES, TILE_SIZE } from '../game/constants';
import { ATTACK_ANIM_SECONDS, HIT_ANIM_SECONDS, SHIELD_ANIM_SECONDS } from '../game/ecs/animation';

import { ActionTimingState, TimelineActionKind } from '../game/types';

import { approachTargetPosition, lerpPosition } from './sceneMath';


import type { BattleEngine } from '../game/ecs/engine';
import { EntityKind } from '../game/types';
import atlasImage from '../assets/sprites/INGAME_BIRDS_1.webp';
import { spriteWorldPosition, slotWorldPosition } from './sceneMath';

type SpriteBatchProps = {
  engine: BattleEngine;
};

export function SpriteBatch({ engine }: SpriteBatchProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const instanceToEntity = useRef(new Int32Array(MAX_ENTITIES).fill(-1));
  const texture = useMemo(() => loadAtlasTexture(), []);
  const geometry = useMemo(() => makeAtlasGeometry(), []);
  const material = useMemo(() => makeAtlasMaterial(texture), [texture]);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(({ clock }) => updateInstances(engine, meshRef.current, geometry, dummy, instanceToEntity.current, clock.elapsedTime));

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_ENTITIES]}
      frustumCulled={false}
      renderOrder={3}
      onPointerDown={(event) => {
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

function loadAtlasTexture() {
  const texture = new TextureLoader().load(atlasImage);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false; // <-- CRITICAL: Stops edge blurring!
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
  const material = new MeshBasicNodeMaterial({ 
    transparent: true, 
    alphaTest: 0.5, 
    depthWrite: false 
  });
  
  const instanceUvOffset = vec2(attribute('instanceUvOffset', 'vec2'));
  const instanceUvScale = vec2(attribute('instanceUvScale', 'vec2'));
  const customUv = uv().mul(instanceUvScale).add(instanceUvOffset);

  const texColor = tslTexture(map, customUv);

  // THE MAGIC MATH: 
  // magentaNess = min(Red, Blue) - Green
  const magentaNess = min(texColor.r, texColor.b).sub(texColor.g);

  // If the pixel is more than 10% magenta, make it invisible (alpha = 0).
  // Otherwise, it is a solid bird pixel (alpha = 1).
  const alpha = step(magentaNess, 0.1);

  material.colorNode = texColor;
  material.opacityNode = alpha;

  return material;
}
function updateInstances(
  engine: BattleEngine,
  mesh: InstancedMesh | null,
  geometry: PlaneGeometry,
  dummy: Object3D,
  instanceToEntity: Int32Array,
  elapsed: number,
): void {
  if (!mesh) return;
  const offset = geometry.getAttribute('instanceUvOffset') as InstancedBufferAttribute;
  const scale = geometry.getAttribute('instanceUvScale') as InstancedBufferAttribute;
  const offsetArray = offset.array as Float32Array;
  const scaleArray = scale.array as Float32Array;
  const { world } = engine;
  let count = 0;

  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!shouldRender(world, entity)) continue;
    writeEntityMatrix(world, entity, dummy, elapsed);
    writeEntityUvs(world, entity, count, offsetArray, scaleArray);
    mesh.setMatrixAt(count, dummy.matrix);
    instanceToEntity[count] = entity;
    count += 1;
  }

  for (let index = count; index < instanceToEntity.length; index += 1) instanceToEntity[index] = -1;
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  offset.needsUpdate = true;
  scale.needsUpdate = true;
}

function shouldRender(world: BattleEngine['world'], entity: number): boolean {
  if (world.active[entity] !== 1) return false;
  if (world.kind[entity] === EntityKind.Projectile) return false;
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
  const base = spriteScale(world, entity) * anim.scale;
  const aspect = Math.max(0.25, world.uvAspectRatio[entity] || 1);
  dummy.position.set(position[0] + anim.x, position[1] + anim.y, position[2]);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(base * aspect, base, 1);
  dummy.updateMatrix();
  return dummy.matrix;
}

function spriteScale(world: BattleEngine['world'], entity: number): number {
  const tierScale = world.kind[entity] === EntityKind.Unit ? 1 + (Math.max(1, world.starTier[entity]) - 1) * 0.35 : 1;
  const slot = world.formationSlot[entity];
  const benchScale = slot >= 10 && slot <= 15 ? 0.72 : 1;
  if (world.unitId[entity] === 'terence') return 1.18 * tierScale * benchScale;
  if (world.kind[entity] === EntityKind.GoldenEgg) return 0.72;
  if (world.kind[entity] === EntityKind.Barricade) return 0.88;
  return tierScale * benchScale;
}

function entityWorldPosition(world: BattleEngine['world'], entity: number): [number, number, number] {
  // If we are dragging it, follow the mouse!
  if (world.draggedEntity === entity) return [world.dragX, world.dragY, world.dragZ || 0.8];
  
  const lift = entityLift(world, entity);
  const slot = world.formationSlot[entity];
  
  // If the game hasn't started and it's on the bench, lock it to the bench slot position
  if (world.combatStarted === 0 && slot >= 10 && slot <= 15) {
    return slotWorldPosition(slot, lift);
  }
  
  // Otherwise, strictly render it at its true physical X/Y grid coordinate
  return spriteWorldPosition(world.x[entity], world.y[entity], lift + 0.35);
}



function entityLift(world: BattleEngine['world'], entity: number): number {
  if (world.kind[entity] !== EntityKind.Unit) return 0;
  const slot = world.formationSlot[entity];
  return slot >= 10 && slot <= 15 ? 0.04 : 0.12;
}

function animationPose(world: BattleEngine['world'], entity: number, elapsed: number): { x: number; y: number; scale: number } {
  const isLivingUnit = world.kind[entity] === EntityKind.Unit && world.hp[entity] > 0;
  const idle = isLivingUnit && world.draggedEntity !== entity ? idleBounce(entity, elapsed) : 0;
  const attack = attackLunge(world, entity);
  const hit = hitShake(world, entity);
  const shield = shieldPulse(world, entity);
  return { x: attack.x + hit.x, y: idle + hit.y, scale: 1 + attack.scale + shield };
}

function idleBounce(entity: number, elapsed: number): number {
  return Math.sin(elapsed * 4.2 + entity * 0.61) * 0.035;
}

function attackLunge(world: BattleEngine['world'], entity: number): { x: number; scale: number } {
  const timer = world.animAttack[entity];
  if (timer <= 0) return { x: 0, scale: 0 };
  const phase = 1 - timer / ATTACK_ANIM_SECONDS;
  const pulse = Math.sin(phase * Math.PI);
  return { x: pulse * 0.18 * (world.animDir[entity] || 1), scale: pulse * 0.08 };
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

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeIn(t: number): number {
  return t * t;
}
