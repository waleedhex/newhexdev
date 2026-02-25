/**
 * Admin Panel Types
 * أنواع مشتركة لمكونات لوحة الإدارة
 */

export const LETTERS = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];

export const ENGLISH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

export const ALL_VALID_LETTERS = [...LETTERS, ...ENGLISH_LETTERS];

// Protected codes that cannot be deleted, duplicated, or generated
export const PROTECTED_CODES = ['IMWRA143'];

export interface Question {
  id: number;
  letter: string;
  question: string;
  answer: string;
}

export interface SessionQuestion {
  id: number;
  session_code: string;
  letter: string;
  question: string;
  answer: string;
}

export interface GameSession {
  id: string;
  session_code: string;
  host_name: string | null;
  created_at: string | null;
}

export interface Announcement {
  id: number;
  title: string | null;
  content: string | null;
  link: string | null;
  button_text: string | null;
  is_active: boolean | null;
}

// Check if a code is protected
export const isProtectedCode = (code: string): boolean => {
  return PROTECTED_CODES.includes(code.toUpperCase());
};

// Generate random code (excluding protected codes)
export const generateRandomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  do {
    result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (isProtectedCode(result));
  return result;
};

// Generate special code (starts with X, excluding protected codes)
export const generateSpecialCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  do {
    result = 'X';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (isProtectedCode(result));
  return result;
};
