import { ColorSet } from './types';

export const LETTERS: string[] = [
  'أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س',
  'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م',
  'ن', 'ه', 'و', 'ي'
];

export const ENGLISH_LETTERS: string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

export const COLOR_SETS: ColorSet[] = [
  // المجموعات الأصلية
  { red: '#ff4081', green: '#81c784' },
  { red: '#f8bbd0', green: '#4dd0e1' },
  { red: '#d32f2f', green: '#0288d1' },
  { red: '#ff5722', green: '#388e3c' },
  // مجموعات جديدة وجذابة
  { red: '#e91e63', green: '#00bcd4' },    // وردي زاهي + تركواز
  { red: '#9c27b0', green: '#4caf50' },    // بنفسجي + أخضر زمردي
  { red: '#ff6b6b', green: '#48dbfb' },    // أحمر مرجاني + أزرق سماوي
  { red: '#fd79a8', green: '#00cec9' },    // وردي فاتح + تيفاني
  { red: '#e17055', green: '#74b9ff' },    // برتقالي محروق + أزرق فاتح
  { red: '#d63031', green: '#00b894' },    // أحمر قوي + أخضر نعناعي
  { red: '#6c5ce7', green: '#ffeaa7' },    // بنفسجي غامق + أصفر ذهبي
  { red: '#fab1a0', green: '#55efc4' },    // خوخي + أخضر فاتح
  { red: '#ff7675', green: '#81ecec' },    // سلموني + سيان فاتح
  { red: '#a29bfe', green: '#fdcb6e' },    // لافندر + أصفر عسلي
];

export const DEFAULT_COLOR: string = '#ffffe0';

export const LAYOUT: string[][] = [
  ['', '', '', '', '', '', ''],
  ['', 'أ', 'ب', 'ت', 'ث', 'ج', ''],
  ['', 'ح', 'خ', 'د', 'ذ', 'ر', ''],
  ['', 'ز', 'س', 'ش', 'ص', 'ض', ''],
  ['', 'ط', 'ظ', 'ع', 'غ', 'ف', ''],
  ['', 'ق', 'ك', 'ل', 'م', 'ن', ''],
  ['', '', '', '', '', 'ه', '']
];

export const CREAM_COLOR = '#ffffe0';
export const ORANGE_COLOR = '#ffa500';
export const GOLD_COLOR = '#ffd700';

export const PARTY_MODE_DURATION: number = 5000;
export const PARTY_MODE_INTERVAL: number = 300;
export const FLASH_DURATION: number = 1000;
export const FLASH_COUNT: number = 5;
export const FLASH_COLORS: string[] = ['#ffd700', '#ff4500', '#00ff00'];
