import { COLOR_SETS, CREAM_COLOR } from './constants';

// ====== إعادة تصدير منطق الفوز من gameEngine للتوافقية الخلفية ======
export { getNeighbors, findWinningPath } from '@/gameEngine';

export function rgbToHex(rgb: string): string {
  if (!rgb || rgb.startsWith('#')) return (rgb || CREAM_COLOR).toLowerCase();
  const m = rgb.match(/\d+/g);
  return m
    ? '#' + m.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
    : CREAM_COLOR;
}

export function getLogicalColor(
  bgColor: string,
  currentColorSetIndex: number,
  isSwapped: boolean
): 'red' | 'green' | 'neutral' {
  const c = rgbToHex(bgColor).toLowerCase();
  const set = COLOR_SETS[currentColorSetIndex];
  const redColor = (isSwapped ? set.green : set.red).toLowerCase();
  const greenColor = (isSwapped ? set.red : set.green).toLowerCase();
  
  if (c === redColor) return 'red';
  if (c === greenColor) return 'green';
  return 'neutral';
}

export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getColorCycle(currentColorSetIndex: number, isSwapped: boolean = false): string[] {
  const set = COLOR_SETS[currentColorSetIndex];
  const redColor = isSwapped ? set.green : set.red;
  const greenColor = isSwapped ? set.red : set.green;
  return [
    CREAM_COLOR,
    '#ffa500',
    redColor,
    greenColor,
    CREAM_COLOR
  ];
}

/**
 * تحويل اللون من أي مجموعة ألوان إلى المجموعة الحالية
 * إذا كان اللون أحمر من أي مجموعة -> يصبح أحمر المجموعة الحالية
 * إذا كان اللون أخضر من أي مجموعة -> يصبح أخضر المجموعة الحالية
 */
export function convertToCurrentColorSet(
  color: string,
  targetColorSetIndex: number
): string {
  const c = rgbToHex(color).toLowerCase();
  
  // تحقق إذا كان اللون من أي مجموعة ألوان
  for (const set of COLOR_SETS) {
    if (c === set.red.toLowerCase()) {
      // اللون أحمر - أعده باللون الأحمر من المجموعة الحالية
      return COLOR_SETS[targetColorSetIndex].red;
    }
    if (c === set.green.toLowerCase()) {
      // اللون أخضر - أعده باللون الأخضر من المجموعة الحالية
      return COLOR_SETS[targetColorSetIndex].green;
    }
  }
  
  // باقي الألوان (كريمي، برتقالي) لا تتغير
  return color;
}

/**
 * عكس لون الخلية الداخلية عند تفعيل isSwapped
 * إذا كان اللون أحمر -> يصبح أخضر والعكس
 * يجب استدعاء هذه الدالة بعد convertToCurrentColorSet
 */
export function getSwappedColor(
  color: string,
  currentColorSetIndex: number,
  isSwapped: boolean
): string {
  if (!isSwapped) return color;
  
  const c = rgbToHex(color).toLowerCase();
  const set = COLOR_SETS[currentColorSetIndex];
  const redColor = set.red.toLowerCase();
  const greenColor = set.green.toLowerCase();
  
  // عكس الألوان: أحمر ↔ أخضر
  if (c === redColor) return set.green;
  if (c === greenColor) return set.red;
  
  // باقي الألوان (كريمي، برتقالي) لا تتغير
  return color;
}
