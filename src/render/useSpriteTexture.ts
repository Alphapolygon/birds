import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, NearestFilter, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { getSpriteUrl } from '../game/spriteManifest';

export function useSpriteTexture(spriteKey: string): Texture {
  const fallback = useMemo(() => makeFallbackTexture(spriteKey), [spriteKey]);
  const [texture, setTexture] = useState<Texture>(fallback);

  useEffect(() => {
    const url = getSpriteUrl(spriteKey);
    if (!url) {
      setTexture(fallback);
      return;
    }
    const loader = new TextureLoader();
    loader.load(url, (loaded: Texture) => setTexture(configureTexture(loaded)));
  }, [fallback, spriteKey]);

  return texture;
}

function configureTexture(texture: Texture): Texture {
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeFallbackTexture(label: string): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) drawFallback(ctx, label);
  return configureTexture(new CanvasTexture(canvas));
}

function drawFallback(ctx: CanvasRenderingContext2D, label: string): void {
  ctx.fillStyle = '#202633';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f3d36b';
  ctx.beginPath();
  ctx.arc(64, 48, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label.slice(0, 10), 64, 96);
}
