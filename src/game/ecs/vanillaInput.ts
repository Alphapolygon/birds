import type { BattleEngine } from './engine';

export function attachTimingInput(engine: BattleEngine, canvas: HTMLCanvasElement | null): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    engine.submitTimingInput();
  };
  const onPointerDown = () => engine.submitTimingInput();
  window.addEventListener('keydown', onKeyDown);
  canvas?.addEventListener('pointerdown', onPointerDown, { passive: true });
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    canvas?.removeEventListener('pointerdown', onPointerDown);
  };
}
