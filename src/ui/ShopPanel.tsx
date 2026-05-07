import type { BattleEngine } from '../game/ecs/engine';
import { AutoChessPanel } from './AutoChessPanel';

export function ShopPanel({ engine }: { engine: BattleEngine }) {
  return <AutoChessPanel engine={engine} />;
}
