import type { RelicId, TimingRelicId } from './types';

export const TIMING_RELIC_IDS: TimingRelicId[] = ['greased_feathers', 'hourglass_shard', 'mirror_shield', 'combo_battery', 'cursed_weights'];

export const RELIC_BITS: Record<RelicId, number> = {
  greased_feathers: 1 << 0,
  hourglass_shard: 1 << 1,
  mirror_shield: 1 << 2,
  combo_battery: 1 << 3,
  cursed_weights: 1 << 4,

  // Legacy tactical relic ids are kept so older source files still type-check while the active battle flow uses the timing relics above.
  brimstone_feather: 1 << 8,
  rubberized_yolk: 1 << 9,
  cluster_core: 1 << 10,
  cursed_crown: 1 << 11,
  orbiting_fly: 1 << 12,
  spectral_talons: 1 << 13,
  leech_seed: 1 << 14,
  seismic_stomp: 1 << 15,
  golden_magnet: 1 << 16,
};

export const RELIC_NAMES: Record<RelicId, string> = {
  greased_feathers: 'Greased Feathers',
  hourglass_shard: 'Hourglass Shard',
  mirror_shield: 'Mirror Shield',
  combo_battery: 'Combo Battery',
  cursed_weights: 'Cursed Weights',
  brimstone_feather: 'Brimstone Feather',
  rubberized_yolk: 'Rubberized Yolk',
  cluster_core: 'Cluster Core',
  cursed_crown: 'Cursed Crown',
  orbiting_fly: 'Orbiting Fly',
  spectral_talons: 'Spectral Talons',
  leech_seed: 'Leech Seed',
  seismic_stomp: 'Seismic Stomp',
  golden_magnet: 'Golden Magnet',
};

export const RELIC_DESCRIPTIONS: Record<RelicId, string> = {
  greased_feathers: 'Widens timed-hit and timed-block windows by 50%.',
  hourglass_shard: 'Perfect hits refund 40% Action Gauge after the attack resolves.',
  mirror_shield: 'Perfect blocks reflect 50% of incoming damage back to the attacker.',
  combo_battery: 'Perfect hits and blocks generate +2 Party Combo instead of +1.',
  cursed_weights: '+50% base attack, but this bird cannot trigger Perfect Blocks.',
  brimstone_feather: 'Legacy tactical relic: row raycast attack.',
  rubberized_yolk: 'Legacy tactical relic: push on hit.',
  cluster_core: 'Legacy tactical relic: extra explosion projectiles.',
  cursed_crown: 'Legacy tactical relic: +4 attack, cannot heal.',
  orbiting_fly: 'Legacy tactical relic: chance to negate indirect attacks.',
  spectral_talons: 'Legacy tactical relic: melee ignores props.',
  leech_seed: 'Legacy tactical relic: heal from damage dealt.',
  seismic_stomp: 'Legacy tactical relic: moving flattens terrain.',
  golden_magnet: 'Legacy tactical relic: Golden Eggs drift toward player.',
};

export const RELIC_IDS = TIMING_RELIC_IDS;

export function relicNameFromBit(bit: number): string {
  const id = (Object.keys(RELIC_BITS) as RelicId[]).find((relicId) => RELIC_BITS[relicId] === bit);
  return id ? RELIC_NAMES[id] : 'Unknown Relic';
}

export function listRelicNames(mask: number): string[] {
  return (Object.keys(RELIC_BITS) as RelicId[]).filter((id) => (mask & RELIC_BITS[id]) !== 0).map((id) => RELIC_NAMES[id]);
}

export function randomTimingRelicBit(mask = 0): number {
  const missing = TIMING_RELIC_IDS.map((id) => RELIC_BITS[id]).filter((bit) => (mask & bit) === 0);
  const pool = missing.length > 0 ? missing : TIMING_RELIC_IDS.map((id) => RELIC_BITS[id]);
  return pool[Math.floor(Math.random() * pool.length)] ?? RELIC_BITS.greased_feathers;
}
