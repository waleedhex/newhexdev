/**
 * transport/validation.ts
 * التحقق من صحة الأحداث وأمانها
 * 
 * القاعدة: كل حدث يجب التحقق منه قبل المعالجة
 * 
 * يحتوي على:
 * 1. assertTransient: منع إرسال DB-state عبر RTC
 * 2. validateEvent: التحقق من بنية الحدث
 */

import { TransientEvent, TransientEventType } from './types';

// ============= قواعد الأحداث =============

/**
 * من يمكنه إرسال كل نوع من الأحداث
 */
export const EVENT_SENDER_RULES: Record<TransientEventType, 'host' | 'contestant' | 'any'> = {
  buzzer_pressed: 'contestant',
  buzzer_timeout: 'contestant',
  buzzer_reset: 'host',
  party_mode: 'host',
  golden_celebration: 'host',
  flash: 'host',
};

/**
 * الحقول المطلوبة لكل نوع حدث
 */
export const REQUIRED_FIELDS: Record<TransientEventType, string[]> = {
  buzzer_pressed: ['player', 'team'],
  buzzer_timeout: [],
  buzzer_reset: [],
  party_mode: ['active', 'winningTeam', 'winningPath'],
  golden_celebration: ['letter'],
  flash: ['team'],
};

/**
 * الحقول المسموحة لكل نوع حدث عابر
 * أي حقل إضافي سيؤدي لفشل التحقق
 */
export const ALLOWED_FIELDS: Record<TransientEventType, readonly string[]> = {
  buzzer_pressed: ['type', 'event_id', 'timestamp', 'player', 'team'],
  buzzer_timeout: ['type', 'event_id', 'timestamp'],
  buzzer_reset: ['type', 'event_id', 'timestamp'],
  party_mode: ['type', 'event_id', 'timestamp', 'active', 'winningTeam', 'winningPath'],
  golden_celebration: ['type', 'event_id', 'timestamp', 'letter'],
  flash: ['type', 'event_id', 'timestamp', 'team'],
} as const;

/**
 * الحقول المحظورة التي تشير لـ DB-state
 * وجود أي منها يعني محاولة إرسال حالة دائمة
 */
export const FORBIDDEN_FIELDS = [
  // حالة اللوحة
  'hexagons',
  'letters_order',
  'color_set_index',
  
  // حالة الفرق
  'teams',
  'players',
  'redPlayers',
  'greenPlayers',
  
  // حالة الجلسة
  'session_id',
  'session_code',
  'is_active',
  'host_name',
  
  // حالة DB
  'id',
  'created_at',
  'updated_at',
  'last_activity',
] as const;

// ============= Transient Guard =============

/**
 * خطأ عند محاولة إرسال حالة دائمة
 */
export class TransientViolationError extends Error {
  constructor(
    public readonly field: string,
    public readonly eventType: string
  ) {
    super(
      `🚫 Transient Violation: Field "${field}" is not allowed in "${eventType}" event. ` +
      `DB-state must NOT be sent via Transport. See INVARIANTS.md for details.`
    );
    this.name = 'TransientViolationError';
  }
}

/**
 * التحقق من أن الحدث عابر فقط (لا يحتوي DB-state)
 * 
 * استخدام:
 * assertTransient(event); // يرمي خطأ إذا كان الحدث يحتوي حالة دائمة
 * 
 * @throws TransientViolationError إذا كان الحدث يحتوي حقول محظورة
 */
export function assertTransient(event: TransientEvent): void {
  const eventType = event.type;
  const allowedFields = ALLOWED_FIELDS[eventType];
  
  if (!allowedFields) {
    throw new TransientViolationError('type', eventType);
  }
  
  const eventFields = Object.keys(event);
  
  // التحقق من وجود حقول محظورة
  for (const field of eventFields) {
    // هل الحقل محظور صراحة؟
    if (FORBIDDEN_FIELDS.includes(field as typeof FORBIDDEN_FIELDS[number])) {
      throw new TransientViolationError(field, eventType);
    }
    
    // هل الحقل غير مسموح لهذا النوع؟
    if (!allowedFields.includes(field)) {
      throw new TransientViolationError(field, eventType);
    }
  }
}

// ============= دوال التحقق =============

/**
 * التحقق من صحة هيكل الحدث
 */
export const isValidEventStructure = (event: unknown): event is TransientEvent => {
  if (!event || typeof event !== 'object') return false;
  
  const e = event as Record<string, unknown>;
  
  // التحقق من الحقول الأساسية
  if (typeof e.type !== 'string') return false;
  if (typeof e.event_id !== 'string') return false;
  if (typeof e.timestamp !== 'number') return false;
  
  // التحقق من نوع الحدث
  const validTypes: TransientEventType[] = [
    'buzzer_pressed',
    'buzzer_timeout',
    'buzzer_reset',
    'party_mode',
    'golden_celebration',
    'flash',
  ];
  
  if (!validTypes.includes(e.type as TransientEventType)) return false;
  
  // التحقق من الحقول المطلوبة
  const requiredFields = REQUIRED_FIELDS[e.type as TransientEventType];
  for (const field of requiredFields) {
    if (!(field in e)) return false;
  }
  
  return true;
};

/**
 * التحقق من صلاحية المُرسل
 */
export const canSendEvent = (
  eventType: TransientEventType,
  senderRole: 'host' | 'contestant' | 'display'
): boolean => {
  const rule = EVENT_SENDER_RULES[eventType];
  
  if (rule === 'any') return true;
  if (rule === 'host') return senderRole === 'host';
  if (rule === 'contestant') return senderRole === 'contestant';
  
  return false;
};

/**
 * التحقق من أن الحدث ليس قديماً جداً
 */
export const isEventFresh = (event: TransientEvent, maxAgeMs: number = 30000): boolean => {
  const now = Date.now();
  return (now - event.timestamp) <= maxAgeMs;
};

/**
 * التحقق من صحة team
 */
export const isValidTeam = (team: unknown): team is 'red' | 'green' => {
  return team === 'red' || team === 'green';
};

/**
 * التحقق من صحة winning path
 */
export const isValidWinningPath = (path: unknown): path is [number, number][] => {
  if (!Array.isArray(path)) return false;
  
  return path.every(point => 
    Array.isArray(point) &&
    point.length === 2 &&
    typeof point[0] === 'number' &&
    typeof point[1] === 'number' &&
    point[0] >= 0 && point[0] <= 6 &&
    point[1] >= 0 && point[1] <= 6
  );
};

// ============= التحقق الشامل =============

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * التحقق الشامل من الحدث
 */
export const validateEvent = (
  event: unknown,
  senderRole?: 'host' | 'contestant' | 'display'
): ValidationResult => {
  // 1. التحقق من الهيكل
  if (!isValidEventStructure(event)) {
    return { valid: false, error: 'Invalid event structure' };
  }
  
  // 2. التحقق من الحداثة
  if (!isEventFresh(event)) {
    return { valid: false, error: 'Event is too old' };
  }
  
  // 3. التحقق من صلاحية المُرسل (إذا كان معروفاً)
  if (senderRole && !canSendEvent(event.type, senderRole)) {
    return { valid: false, error: `Role ${senderRole} cannot send ${event.type}` };
  }
  
  // 4. التحقق من البيانات حسب النوع
  switch (event.type) {
    case 'buzzer_pressed':
      if (!event.player || typeof event.player !== 'string') {
        return { valid: false, error: 'Invalid player name' };
      }
      if (!isValidTeam(event.team)) {
        return { valid: false, error: 'Invalid team' };
      }
      break;
      
    case 'party_mode':
      if (!isValidTeam(event.winningTeam)) {
        return { valid: false, error: 'Invalid winning team' };
      }
      if (!isValidWinningPath(event.winningPath)) {
        return { valid: false, error: 'Invalid winning path' };
      }
      break;
      
    case 'flash':
      if (!isValidTeam(event.team)) {
        return { valid: false, error: 'Invalid team' };
      }
      break;
      
    case 'golden_celebration':
      if (!event.letter || typeof event.letter !== 'string') {
        return { valid: false, error: 'Invalid letter' };
      }
      break;
  }
  
  return { valid: true };
};

/**
 * تنظيف الحدث من أي بيانات غير متوقعة
 */
export const sanitizeEvent = (event: TransientEvent): TransientEvent => {
  const base = {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
  };
  
  switch (event.type) {
    case 'buzzer_pressed':
      return {
        ...base,
        type: 'buzzer_pressed',
        player: String(event.player).slice(0, 50), // حد أقصى 50 حرف
        team: event.team,
      };
      
    case 'buzzer_timeout':
      return { ...base, type: 'buzzer_timeout' };
      
    case 'buzzer_reset':
      return { ...base, type: 'buzzer_reset' };
      
    case 'party_mode':
      return {
        ...base,
        type: 'party_mode',
        active: Boolean(event.active),
        winningTeam: event.winningTeam,
        winningPath: event.winningPath.slice(0, 50), // حد أقصى 50 نقطة
      };
      
    case 'golden_celebration':
      return {
        ...base,
        type: 'golden_celebration',
        letter: String(event.letter).slice(0, 1), // حرف واحد فقط
      };
      
    case 'flash':
      return {
        ...base,
        type: 'flash',
        team: event.team,
      };
      
    default:
      return event;
  }
};
