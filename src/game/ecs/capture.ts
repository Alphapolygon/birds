import { Faction, TerrainType } from '../types';
import { emitEvent, isAlive, type World } from './world';
import { getTerrain, getTileOwner, setTileOwner, tileCenterX, tileCenterY, tileIndex } from './grid';
import { healEntity } from './relics';

const CAPTURE_REQUIRED = 2;
const CAPTURE_HEAL = 4;
const MEDIC_USE_HEAL = 5;

export function captureOrUseTile(world: World, entity: number): boolean {
  if (!canCaptureOrUse(world, entity)) return invalid(world, 'There is no capturable structure under that bird.');
  const x = tileCenterX(world, entity);
  const y = tileCenterY(world, entity);
  const owner = getTileOwner(world, x, y);
  if (owner === Faction.Player) return useOwnedMedicTent(world, entity);
  return captureMedicTent(world, entity, x, y);
}

export function canCaptureOrUse(world: World, entity: number): boolean {
  if (!isAlive(world, entity)) return false;
  if (world.faction[entity] !== Faction.Player) return false;
  if (world.acted[entity] === 1 || world.stasis[entity] > 0 || world.chargeSkip[entity] > 0) return false;
  return terrainUnderEntity(world, entity) === TerrainType.MedicTent;
}

export function tileActionLabel(world: World, entity: number): string {
  if (!canCaptureOrUse(world, entity)) return 'Capture';
  const owner = getTileOwner(world, tileCenterX(world, entity), tileCenterY(world, entity));
  return owner === Faction.Player ? 'Use Medic' : 'Capture Tent';
}

export function healOwnedMedicUnits(world: World, faction: Faction): void {
  for (let entity = 0; entity < world.nextEntity; entity += 1) {
    if (!isAlive(world, entity) || world.faction[entity] !== faction) continue;
    if (terrainUnderEntity(world, entity) !== TerrainType.MedicTent) continue;
    if (getTileOwner(world, tileCenterX(world, entity), tileCenterY(world, entity)) !== faction) continue;
    healEntity(world, entity, 2);
  }
}

function captureMedicTent(world: World, entity: number, x: number, y: number): boolean {
  const index = tileIndex(x, y);
  world.gridCapture[index] += 1;
  spendAction(world, entity);
  if (world.gridCapture[index] < CAPTURE_REQUIRED) {
    emitEvent(world, { type: 'structure_captured', entity, message: `${world.displayName[entity]} started capturing a Medic Tent (${world.gridCapture[index]}/${CAPTURE_REQUIRED}).` });
    return true;
  }
  world.gridCapture[index] = 0;
  setTileOwner(world, x, y, Faction.Player);
  healEntity(world, entity, CAPTURE_HEAL);
  emitEvent(world, { type: 'structure_captured', entity, message: `${world.displayName[entity]} captured a Medic Tent.` });
  return true;
}

function useOwnedMedicTent(world: World, entity: number): boolean {
  spendAction(world, entity);
  healEntity(world, entity, MEDIC_USE_HEAL);
  emitEvent(world, { type: 'unit_healed', entity, message: `${world.displayName[entity]} used the Medic Tent.` });
  return true;
}

function terrainUnderEntity(world: World, entity: number): TerrainType {
  return getTerrain(world, tileCenterX(world, entity), tileCenterY(world, entity));
}

function spendAction(world: World, entity: number): void {
  world.moved[entity] = 1;
  world.acted[entity] = 1;
}

function invalid(world: World, message: string): false {
  emitEvent(world, { type: 'invalid_action', message });
  return false;
}
