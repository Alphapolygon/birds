import atlasData from '../assets/sprites/bird_atlas.json';
import atlasImage from '../assets/sprites/INGAME_BIRDS_1.png';
import { atlasFrameKey } from '../game/spriteAtlas';

type AtlasFrame = { x: number; y: number; w: number; h: number };
const TEX_WIDTH = 1048;
const TEX_HEIGHT = 968;
const DATA = atlasData as Record<string, AtlasFrame>;

type UnitPortraitProps = {
  spriteKey: string;
  size?: number;
  state?: 'idle' | 'attack' | 'hit' | 'shield';
  className?: string;
};

export function UnitPortrait({ spriteKey, size = 48, state = 'idle', className = '' }: UnitPortraitProps) {
  const frameKey = atlasFrameKey(spriteKey || 'red', state);
  const frame = DATA[frameKey] ?? DATA.BIRD_RED;
  const scale = size / Math.max(frame.w, frame.h);
  const width = TEX_WIDTH * scale;
  const height = TEX_HEIGHT * scale;
  return (
    <span className={`unit-portrait ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <img
        src={atlasImage}
        alt=""
        draggable={false}
        style={{ width, height, transform: `translate(${-frame.x * scale}px, ${-frame.y * scale}px)` }}
      />
    </span>
  );
}
