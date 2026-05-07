import { syncEntityAtlasFrame } from '../spriteAtlas';
import { EntityKind, Faction } from '../types';
import { allocateEntity, isAlive, type World } from './world';

export const ATTACK_ANIM_SECONDS = 0.28;
export const HIT_ANIM_SECONDS = 0.22;
export const SHIELD_ANIM_SECONDS = 0.36;
export const FX_DEFAULT_SECONDS = 0.34;

export const enum FxKind {
  None = 0,
  Hit = 1,
  Charged = 2,
  Shield = 3,
  Special = 4,
}

export function playAttackAnimation(world: World, attacker: number, target: number, charged: boolean): void {
  if (!isAlive(world, attacker)) return;
  world.animAttack[attacker] = ATTACK_ANIM_SECONDS;
  world.animDir[attacker] = attackDirection(world, attacker, target);
  syncEntityAtlasFrame(world, attacker);
  spawnEffect(world, charged ? FxKind.Charged : FxKind.Hit, world.x[target], world.y[target], FX_DEFAULT_SECONDS, world.formationSlot[target]);
}

export function playHitAnimation(world: World, target: number): void {
  if (!isAlive(world, target)) return;
  world.animHit[target] = HIT_ANIM_SECONDS;
  syncEntityAtlasFrame(world, target);
}

export function playShieldAnimation(world: World, entity: number): void {
  if (!isAlive(world, entity)) return;
  world.animShield[entity] = SHIELD_ANIM_SECONDS;
  syncEntityAtlasFrame(world, entity);
  spawnEffect(world, FxKind.Shield, world.x[entity], world.y[entity], SHIELD_ANIM_SECONDS, world.formationSlot[entity]);
}

export function playSpecialEffect(world: World, entity: number): void {
  if (!isAlive(world, entity)) return;
  syncEntityAtlasFrame(world, entity);
  spawnEffect(world, FxKind.Special, world.x[entity], world.y[entity], 0.55, world.formationSlot[entity]);
}

export function tickAnimations(world: World, delta: number): void {
  const step = Math.min(0.05, Math.max(0, delta));
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    tickEntityAnimation(world, entity, step);
  }
}

function tickEntityAnimation(world: World, entity: number, delta: number): void {
  tickTimer(world.animAttack, entity, delta);
  tickTimer(world.animHit, entity, delta);
  tickTimer(world.animShield, entity, delta);
  if (world.active[entity] === 1 && world.kind[entity] !== EntityKind.Projectile) syncEntityAtlasFrame(world, entity);
  if (world.active[entity] === 1 && world.kind[entity] === EntityKind.Projectile) tickEffect(world, entity, delta);
}

function tickEffect(world: World, entity: number, delta: number): void {
  tickTimer(world.fxLife, entity, delta);
  if (world.fxLife[entity] > 0) return;
  world.active[entity] = 0;
  world.fxKind[entity] = FxKind.None;
}

function spawnEffect(world: World, kind: FxKind, x: number, y: number, seconds = FX_DEFAULT_SECONDS, slot = -1): void {
  const effect = allocateEntity(world);
  world.kind[effect] = EntityKind.Projectile;
  world.faction[effect] = Faction.None;
  world.displayName[effect] = 'Combat Effect';
  world.spriteKey[effect] = `fx-${kind}`;
  world.x[effect] = x;
  world.y[effect] = y;
  world.hp[effect] = 1;
  world.maxHp[effect] = 1;
  world.fxKind[effect] = kind;
  world.fxLife[effect] = seconds;
  world.fxMaxLife[effect] = seconds;
  world.formationSlot[effect] = slot;
}

function attackDirection(world: World, attacker: number, target: number): -1 | 1 {
  const byTarget = Math.sign(world.x[target] - world.x[attacker]);
  if (byTarget < 0) return -1;
  if (byTarget > 0) return 1;
  return world.faction[attacker] === Faction.Pig ? -1 : 1;
}

function tickTimer(buffer: Float32Array, entity: number, delta: number): void {
  if (buffer[entity] > 0) buffer[entity] = Math.max(0, buffer[entity] - delta);
}
