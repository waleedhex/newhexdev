/**
 * ============================================
 * Game Engine - Win Logic
 * ============================================
 * 
 * هذا الملف يحتوي على جميع منطق الفوز في اللعبة:
 * - حساب الجيران في شبكة Hex
 * - البحث عن مسار الفوز باستخدام BFS
 * - فحص شروط الفوز لكلا الفريقين
 * 
 * يُستخدم من:
 * - useBoardState (للقراءة)
 * - HexGrid (للتحقق المحلي)
 * ============================================
 */

import { Coordinate, GridCell } from '@/components/HexBoard/types';

// ====== ثوابت الشبكة ======
export const GRID_SIZE = 7;

// ====== أنواع البيانات ======
export interface WinResult {
  team: 'red' | 'green';
  path: [number, number][];
}

/**
 * حساب الجيران في شبكة Hex مع offset rows
 * 
 * في شبكة Hex سداسية:
 * - كل خلية لها 6 جيران (وليس 4 كما في الشبكة المربعة)
 * - الصفوف الزوجية والفردية لها اتجاهات مختلفة للجيران القطريين
 * 
 * الاتجاهات للصف الزوجي (0, 2, 4, 6):
 *   أعلى: [-1, 0] و [-1, 1]
 *   جانبي: [0, -1] و [0, 1]
 *   أسفل: [1, 0] و [1, 1]
 * 
 * الاتجاهات للصف الفردي (1, 3, 5):
 *   أعلى: [-1, 0] و [-1, -1]
 *   جانبي: [0, -1] و [0, 1]
 *   أسفل: [1, 0] و [1, -1]
 */
export function getNeighbors(r: number, c: number, gridSize: number = GRID_SIZE): Coordinate[] {
  // اتجاهات الجيران للصفوف الزوجية (r % 2 === 0)
  const dirsEven: [number, number][] = [
    [-1, 0],   // أعلى
    [-1, 1],   // أعلى قطري
    [0, -1],   // جار جانبي
    [0, 1],    // جار جانبي
    [1, 0],    // أسفل
    [1, 1]     // أسفل قطري
  ];

  // اتجاهات الجيران للصفوف الفردية (r % 2 === 1)
  const dirsOdd: [number, number][] = [
    [-1, 0],   // أعلى
    [-1, -1],  // أعلى قطري
    [0, -1],   // جار جانبي
    [0, 1],    // جار جانبي
    [1, 0],    // أسفل
    [1, -1]    // أسفل قطري
  ];
  
  const dirs = r % 2 === 0 ? dirsEven : dirsOdd;
  
  const neighbors: Coordinate[] = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
      neighbors.push({ r: nr, c: nc });
    }
  }
  
  return neighbors;
}

/**
 * البحث عن مسار فائز باستخدام BFS
 * 
 * الأحمر: يفوز بالاتصال من الصف 0 (أعلى) إلى الصف 6 (أسفل)
 * الأخضر: يفوز بالاتصال من العمود 0 (يمين) إلى العمود 6 (يسار)
 * 
 * الخوارزمية:
 * 1. نبدأ من جميع خلايا اللون على الحافة الأولى
 * 2. نستخدم BFS للوصول لأي خلية على الحافة المقابلة
 * 3. نعيد بناء المسار من النهاية للبداية
 */
export function findWinningPath(
  grid: GridCell[][],
  color: 'red' | 'green'
): [number, number][] | null {
  const size = GRID_SIZE;
  const queue: Coordinate[] = [];
  const parent = new Map<string, Coordinate | null>();

  // إضافة جميع خلايا البداية للطابور
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r]?.[c]?.color !== color) continue;
      
      // تحديد خلايا البداية:
      // - الأحمر: الصف الأول (r === 0)
      // - الأخضر: العمود الأول (c === 0)
      const isStart = color === 'red' ? r === 0 : c === 0;
      
      if (isStart) {
        const key = `${r},${c}`;
        queue.push({ r, c });
        parent.set(key, null);
      }
    }
  }

  // BFS للبحث عن مسار
  let endPosition: Coordinate | null = null;
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    // التحقق من الوصول للنهاية:
    // - الأحمر: الصف الأخير (r === 6)
    // - الأخضر: العمود الأخير (c === 6)
    if ((color === 'red' && current.r === size - 1) || 
        (color === 'green' && current.c === size - 1)) {
      endPosition = current;
      break;
    }

    // استكشاف الجيران
    for (const neighbor of getNeighbors(current.r, current.c, size)) {
      const nKey = `${neighbor.r},${neighbor.c}`;
      if (grid[neighbor.r]?.[neighbor.c]?.color === color && !parent.has(nKey)) {
        parent.set(nKey, current);
        queue.push(neighbor);
      }
    }
  }

  // إذا لم نجد مسار
  if (!endPosition) return null;

  // إعادة بناء المسار من النهاية إلى البداية
  const path: [number, number][] = [];
  let p: Coordinate | null = endPosition;
  while (p) {
    path.push([p.r, p.c]);
    const key = `${p.r},${p.c}`;
    p = parent.get(key) ?? null;
  }
  
  // عكس المسار ليكون من البداية للنهاية
  path.reverse();
  
  return path;
}

/**
 * فحص شروط الفوز لكلا الفريقين
 * يُرجع معلومات الفريق الفائز والمسار، أو null إذا لم يفز أحد
 */
export function checkWinConditions(grid: GridCell[][]): WinResult | null {
  // فحص الأحمر أولاً
  const redPath = findWinningPath(grid, 'red');
  if (redPath) {
    return { team: 'red', path: redPath };
  }
  
  // فحص الأخضر
  const greenPath = findWinningPath(grid, 'green');
  if (greenPath) {
    return { team: 'green', path: greenPath };
  }
  
  return null;
}

/**
 * مقارنة مسارين للتحقق من تطابقهما
 * (بغض النظر عن الترتيب)
 */
export function pathsMatch(
  pathA: [number, number][],
  pathB: [number, number][]
): boolean {
  if (pathA.length !== pathB.length) return false;
  
  const setA = new Set(pathA.map(([r, c]) => `${r},${c}`));
  return pathB.every(([r, c]) => setA.has(`${r},${c}`));
}
