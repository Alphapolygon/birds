import type { BattleEngine } from '../game/ecs/engine';
import { SpriteBatch } from './SpriteBatch';

type EntityBatchesProps = {
  engine: BattleEngine;
};

export function EntityBatches({ engine }: EntityBatchesProps) {
  return <SpriteBatch engine={engine} />;
}
