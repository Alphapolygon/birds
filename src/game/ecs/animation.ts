import { EFFECT_CATALOG, EFFECT_IDS, effectFrameForKind, specialEffectKind } from '../effectCatalog';
import { writeAtlasUvs } from '../spriteAtlas';
import { EntityKind, Faction, type UnitId } from '../types';
import { allocateEntity, isAlive, type World } from './world';

export const ATTACK_ANIM_SECONDS = 0.32;
export const HIT_ANIM_SECONDS = 0.26;
export const SHIELD_ANIM_SECONDS = 0.4;
export const FX_DEFAULT_SECONDS = 0.34;
export const FLOATING_TEXT_SECONDS = 0.82;

export const enum FxKind {
  None = 0,
  Hit = 1,
  Charged = 2,
  Shield = 3,
  Special = 4,
}

export const enum FloatingTextKind {
  Damage = 0,
  Heal = 1,
  Mana = 2,
  Counter = 3,
}

export function playAttackAnimation(world: World, attacker: number, target: number, charged: boolean): void {
  if (!isAlive(world, attacker)) return;
  world.animAttack[attacker] = ATTACK_ANIM_SECONDS;
  world.animDir[attacker] = attackDirection(world, attacker, target);
  spawnEffectAtEntity(world, charged ? FxKind.Charged : FxKind.Hit, target, FX_DEFAULT_SECONDS);
}

export function playHitAnimation(world: World, target: number): void {
  if (!isAlive(world, target)) return;
  world.animHit[target] = HIT_ANIM_SECONDS;
}

export function playShieldAnimation(world: World, entity: number): void {
  if (!isAlive(world, entity)) return;
  world.animShield[entity] = SHIELD_ANIM_SECONDS;
  spawnEffectAtEntity(world, FxKind.Shield, entity, SHIELD_ANIM_SECONDS);
}

export function playSpecialEffect(world: World, entity: number): void {
  if (!isAlive(world, entity)) return;
  const kind = specialEffectKind(world.unitId[entity] as UnitId | '') as FxKind;
  spawnEffectAtEntity(world, kind, entity, EFFECT_CATALOG[kind]?.duration ?? 0.55);
}

export function spawnEffectAtEntity(world: World, kind: FxKind, entity: number, seconds = FX_DEFAULT_SECONDS): void {
  spawnEffectAtPosition(world, kind, world.posX[entity], world.posY[entity], world.posZ[entity] + 0.55, seconds);
}

export function spawnEffectAtPosition(world: World, kind: FxKind, x: number, y: number, z: number, seconds = FX_DEFAULT_SECONDS): void {
  const effect = allocateEntity(world);
  world.kind[effect] = EntityKind.Projectile;
  world.faction[effect] = Faction.None;
  world.displayName[effect] = 'Combat Effect';
  world.spriteKey[effect] = `fx-${kind}`;
  world.x[effect] = Math.round(x);
  world.y[effect] = Math.round(y);
  world.posX[effect] = x;
  world.posY[effect] = y;
  world.posZ[effect] = z;
  world.hp[effect] = 1;
  world.maxHp[effect] = 1;
  world.fxKind[effect] = kind;
  world.fxLife[effect] = seconds;
  world.fxMaxLife[effect] = seconds;
  writeAtlasUvs(world, effect, effectFrameForKind(kind, 0));
}

export function spawnFloatingText(world: World, value: number, sourceEntity: number, kind = FloatingTextKind.Damage): void {
  const entity = allocateEntity(world);
  world.kind[entity] = EntityKind.Projectile;
  world.faction[entity] = Faction.None;
  world.displayName[entity] = 'Floating Number';
  world.spriteKey[entity] = 'floating-number';
  world.hp[entity] = 1;
  world.maxHp[entity] = 1;
  world.floatValue[entity] = value;
  world.floatKind[entity] = kind;
  world.floatLife[entity] = FLOATING_TEXT_SECONDS;
  world.floatMaxLife[entity] = FLOATING_TEXT_SECONDS;
  world.floatX[entity] = world.posX[sourceEntity];
  world.floatY[entity] = world.posY[sourceEntity] + 0.05;
  world.floatZ[entity] = world.posZ[sourceEntity] + 1.08;
}

export function tickAnimations(world: World, delta: number): void {
  const step = Math.min(0.05, Math.max(0, delta));
  for (let entity = 0; entity < world.nextEntity; entity += 1) tickEntityAnimation(world, entity, step);
}

function tickEntityAnimation(world: World, entity: number, delta: number): void {
  if (world.active[entity] !== 1) return;
  world.animClock[entity] += delta;
  tickTimer(world.animAttack, entity, delta);
  tickTimer(world.animHit, entity, delta);
  tickTimer(world.animShield, entity, delta);
  if (world.kind[entity] === EntityKind.Projectile) {
    tickEffect(world, entity, delta);
    tickFloatingText(world, entity, delta);
  }
}

function tickEffect(world: World, entity: number, delta: number): void {
  if (world.fxLife[entity] <= 0) return;
  tickTimer(world.fxLife, entity, delta);
  const phase = effectPhase(world, entity);
  writeAtlasUvs(world, entity, effectFrameForKind(world.fxKind[entity], phase));
  if (world.fxLife[entity] <= 0 && world.floatLife[entity] <= 0) world.active[entity] = 0;
}

function tickFloatingText(world: World, entity: number, delta: number): void {
  if (world.floatLife[entity] <= 0) return;
  tickTimer(world.floatLife, entity, delta);
  if (world.floatLife[entity] <= 0 && world.fxLife[entity] <= 0) world.active[entity] = 0;
}

function effectPhase(world: World, entity: number): number {
  const max = Math.max(0.01, world.fxMaxLife[entity]);
  return 1 - Math.max(0, Math.min(1, world.fxLife[entity] / max));
}

function attackDirection(world: World, attacker: number, target: number): -1 | 1 {
  const byTarget = Math.sign(world.posX[target] - world.posX[attacker]);
  if (byTarget < 0) return -1;
  if (byTarget > 0) return 1;
  return world.faction[attacker] === Faction.Pig ? -1 : 1;
}

function tickTimer(buffer: Float32Array, entity: number, delta: number): void {
  if (buffer[entity] > 0) buffer[entity] = Math.max(0, buffer[entity] - delta);
}

export { EFFECT_IDS };
