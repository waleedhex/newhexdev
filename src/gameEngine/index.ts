/**
 * ============================================
 * Game Engine - Central Export
 * ============================================
 * 
 * نقطة الدخول المركزية لجميع منطق اللعبة
 */

// Win Logic
export {
  GRID_SIZE,
  getNeighbors,
  findWinningPath,
  checkWinConditions,
  pathsMatch,
  type WinResult,
} from './winLogic';
