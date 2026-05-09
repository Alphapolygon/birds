import type { BattleEngine } from './engine';

export function attachTimingInput(engine: BattleEngine, canvas: HTMLCanvasElement | null): () => void {
  void engine;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Space') event.preventDefault();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    void canvas;
  };
}
