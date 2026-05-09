export const GRID_ROWS = 4;
export const GRID_COLS = 10;
export const TILE_COUNT = GRID_ROWS * GRID_COLS;
export const MAX_ENTITIES = 2000;
export const TILE_SIZE = 1;
export const X_OFFSET = (GRID_COLS - 1) * TILE_SIZE * 0.5;
export const Y_OFFSET = (GRID_ROWS - 1) * TILE_SIZE * 0.5;
export const PLAYER_DEPLOY_COLS = 2;
export const ENEMY_DEPLOY_COLS = 2;
export const GRID_TILT_X = -Math.PI / 4;
export const GRID_GROUP_POSITION: [number, number, number] = [0, -1.05, 0];
export const EGG_MIN_X = 3;
export const EGG_MAX_X = 6;
export const DEFAULT_STAR_MAX = 10;
export const EVENT_LOG_LIMIT = 9;

export const MAP_BATTLE_ROUNDS = 8;
export const BOSS_ROUND_NUMBER = MAP_BATTLE_ROUNDS + 1;
