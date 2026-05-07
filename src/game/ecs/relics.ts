import { RELIC_BITS, RELIC_IDS, relicNameFromBit } from '../relicCatalog';
import type { RelicId } from '../types';
import { emitEvent, isAlive, type World } from './world';

export function hasRelic(world: World, entity: number, relic: RelicId): boolean {
  return (world.activeRelics[entity] & RELIC_BITS[relic]) !== 0;
}

export function applyRelicMask(world: World, entity: number, mask: number): void {
  if (mask <= 0) return;
  world.activeRelics[entity] |= mask;
  for (const relic of RELIC_IDS) {
    const bit = RELIC_BITS[relic];
    if ((mask & bit) !== 0) applyGrantSideEffects(world, entity, bit);
  }
}

export function grantRelicBit(world: World, entity: number, bit: number): void {
  if (!isAlive(world, entity) || bit <= 0) return;
  const alreadyHadRelic = (world.activeRelics[entity] & bit) !== 0;
  world.activeRelics[entity] |= bit;
  applyGrantSideEffects(world, entity, bit);
  if (alreadyHadRelic) return;
  emitEvent(world, {
    type: 'relic_gained',
    entity,
    message: `${world.displayName[entity]} gained ${relicNameFromBit(bit)}.`,
  });
}

export function attackBonusFromRelics(world: World, entity: number): number {
  return hasRelic(world, entity, 'cursed_crown') ? 4 : 0;
}

export function preventIndirectDamage(world: World, target: number, isIndirect: boolean): boolean {
  if (!isIndirect || !hasRelic(world, target, 'orbiting_fly')) return false;
  return Math.random() > 0.5;
}

export function healFromLeech(world: World, attacker: number, damage: number): void {
  if (!hasRelic(world, attacker, 'leech_seed')) return;
  healEntity(world, attacker, Math.floor(damage * 0.2));
}

export function healEntity(world: World, entity: number, amount: number): void {
  if (!isAlive(world, entity) || amount <= 0) return;
  if (world.canBeHealed[entity] === 0) return;
  const before = world.hp[entity];
  world.hp[entity] = Math.min(world.maxHp[entity], world.hp[entity] + amount);
  if (world.hp[entity] > before) {
    emitEvent(world, { type: 'unit_healed', entity, message: `${world.displayName[entity]} healed ${world.hp[entity] - before}.` });
  }
}

function applyGrantSideEffects(world: World, entity: number, bit: number): void {
  if (bit === RELIC_BITS.cursed_crown) {
    world.canBeHealed[entity] = 0;
  }
}
