type SpriteModule = string | { default: string };

const modules = import.meta.glob<SpriteModule>('./../assets/sprites/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const SPRITE_URLS: Record<string, string> = buildSpriteUrls(modules);

export function getSpriteUrl(spriteKey: string): string | undefined {
  return SPRITE_URLS[normalizeSpriteName(spriteKey)];
}

function buildSpriteUrls(files: Record<string, SpriteModule>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, value]) => [spriteKeyFromPath(path), spriteUrl(value)]),
  );
}

function spriteKeyFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return normalizeSpriteName(file.replace(/\.(png|jpg|jpeg|webp)$/i, ''));
}

function spriteUrl(value: SpriteModule): string {
  return typeof value === 'string' ? value : value.default;
}

function normalizeSpriteName(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-');
}
