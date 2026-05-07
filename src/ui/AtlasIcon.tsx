import atlasImage from '../assets/sprites/INGAME_BIRDS_1.png';
import { ATLAS_FRAMES, TEX_HEIGHT, TEX_WIDTH, atlasFrameKey } from '../game/spriteAtlas';

export function AtlasIcon({ spriteKey, size = 44, className = '' }: { spriteKey: string; size?: number; className?: string }) {
  const frameKey = atlasFrameKey(spriteKey || 'red', 'idle');
  const frame = ATLAS_FRAMES[frameKey] ?? ATLAS_FRAMES.BIRD_RED;
  const scale = size / Math.max(frame.w, frame.h);
  return (
    <span
      className={`atlas-icon ${className}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${atlasImage})`,
        backgroundSize: `${TEX_WIDTH * scale}px ${TEX_HEIGHT * scale}px`,
        backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
      }}
    />
  );
}
