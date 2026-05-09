import type { BattleEngine } from './engine';

export function attachTimingInput(_engine: BattleEngine, _canvas: HTMLCanvasElement | null): () => void {
  // Legacy timing input is intentionally disabled in the auto-battler build.
  return () => {};
}
