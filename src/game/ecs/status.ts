import { emitEvent, isAlive, type World } from './world';

export function tickStatuses(world: World): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity)) continue;
    decrementStatus(world.stasis, entity);
    decrementStatus(world.airborne, entity);
    decrementStatus(world.slowed, entity);
    decrementStatus(world.guard, entity);
  }
}

export function applyStasis(world: World, entity: number, turns: number): void {
  if (!isAlive(world, entity)) return;
  world.stasis[entity] = Math.max(world.stasis[entity], turns);
  emitEvent(world, { type: 'unit_damaged', entity, message: `${world.displayName[entity]} is trapped in stasis.` });
}

export function applyAirborne(world: World, entity: number, turns: number): void {
  if (!isAlive(world, entity)) return;
  world.airborne[entity] = Math.max(world.airborne[entity], turns);
  emitEvent(world, { type: 'unit_moved', entity, message: `${world.displayName[entity]} is airborne.` });
}

function decrementStatus(buffer: Uint8Array, entity: number): void {
  if (buffer[entity] > 0) buffer[entity] -= 1;
}
