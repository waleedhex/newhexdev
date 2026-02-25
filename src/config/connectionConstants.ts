/**
 * connectionConstants.ts
 * ثوابت موحدة لإدارة الاتصال والـ heartbeat
 * 
 * جميع الملفات تستخدم هذا الملف كمصدر واحد للحقيقة
 * 
 * التحسينات:
 * - Heartbeat ذكي حسب الدور (مقدم أسرع، متسابق أبطأ، عرض أبطأ)
 * - كتابة شرطية (لا نكتب إلا عند الحاجة)
 * - Cleanup عدواني (أوقات أقصر)
 */

// ====== Heartbeat حسب الدور ======
/** Heartbeat للمقدم - أسرع لأنه يدير اللعبة */
export const HOST_HEARTBEAT_INTERVAL = 15000; // 15 ثانية

/** Heartbeat للمتسابق - أبطأ لتقليل الحمل */
export const CONTESTANT_HEARTBEAT_INTERVAL = 30000; // 30 ثانية

/** Heartbeat لشاشة العرض - الأبطأ لأنها للعرض فقط */
export const DISPLAY_HEARTBEAT_INTERVAL = 45000; // 45 ثانية

/** الـ heartbeat الافتراضي (للتوافق مع الكود القديم) */
export const HEARTBEAT_INTERVAL = 15000; // 15 ثانية

// ====== عتبات الانقطاع حسب الدور ======
/** عتبة اعتبار المقدم منقطعاً */
export const HOST_INACTIVE_THRESHOLD = 45000; // 45 ثانية (3x heartbeat)

/** عتبة اعتبار المتسابق منقطعاً */
export const CONTESTANT_INACTIVE_THRESHOLD = 60000; // 60 ثانية (2x heartbeat)

/** عتبة اعتبار شاشة العرض منقطعة */
export const DISPLAY_INACTIVE_THRESHOLD = 90000; // 90 ثانية (2x heartbeat)

/** العتبة الافتراضية (للتوافق مع الكود القديم) */
export const INACTIVE_THRESHOLD = 30000; // 30 ثانية

// ====== الكتابة الشرطية ======
/** الحد الأدنى للوقت بين كتابتين متتاليتين */
export const MIN_WRITE_INTERVAL = 10000; // 10 ثواني

/** لا نكتب إذا كان الفرق أقل من هذا */
export const WRITE_THRESHOLD_MS = 5000; // 5 ثواني

// ====== Presence & Status ======
/** الفترة للتحقق من حالة اللاعبين على شاشة المقدم */
export const PLAYER_STATUS_CHECK_INTERVAL = 15000; // 15 ثانية

// ====== Reconnection ======
/** الفترة بين محاولات إعادة الاتصال (بالميلي ثانية) */
export const RECONNECT_INTERVAL = 5000; // 5 ثواني

/** عدد المحاولات قبل اعتبار الاتصال منقطعاً نهائياً */
export const MAX_RECONNECT_ATTEMPTS = 5;

// ====== Polling ======
/** فترة التحقق من الطرد (backup polling) */
export const KICK_CHECK_INTERVAL = 10000; // 10 ثواني

// ====== Debounce ======
/** تأخير تحديث حالة اللوحة لمنع الـ flickering */
export const BOARD_UPDATE_DEBOUNCE = 100; // 100 مللي ثانية

/** تأخير تحديث حالة اللاعبين */
export const PLAYER_STATUS_DEBOUNCE = 500; // 500 مللي ثانية

// ====== Cleanup (Edge Function) - أوقات عدوانية ======
/** فترة الخمول قبل اعتبار الجلسة غير نشطة */
export const SESSION_STALE_THRESHOLD = 5 * 60 * 1000; // 5 دقائق

/** جلسة بلا مقدم نشط - تعطيل سريع */
export const SESSION_NO_HOST_THRESHOLD = 10 * 60 * 1000; // 10 دقائق

/** فترة الانقطاع قبل حذف اللاعب - أسرع */
export const PLAYER_DISCONNECT_THRESHOLD = 30 * 60 * 1000; // 30 دقيقة (بدلاً من ساعة)

/** جلسة فارغة (بلا لاعبين) - حذف سريع */
export const EMPTY_SESSION_DELETE_THRESHOLD = 2 * 60 * 60 * 1000; // ساعتين

/** فترة الخمول قبل حذف الجلسة نهائياً - أسرع */
export const SESSION_DELETE_THRESHOLD = 6 * 60 * 60 * 1000; // 6 ساعات (بدلاً من 24)

// ====== Helper: الحصول على heartbeat حسب الدور ======
export type PlayerRole = 'host' | 'contestant' | 'display';

export const getHeartbeatInterval = (role: PlayerRole): number => {
  switch (role) {
    case 'host':
      return HOST_HEARTBEAT_INTERVAL;
    case 'contestant':
      return CONTESTANT_HEARTBEAT_INTERVAL;
    case 'display':
      return DISPLAY_HEARTBEAT_INTERVAL;
    default:
      return HEARTBEAT_INTERVAL;
  }
};

export const getInactiveThreshold = (role: PlayerRole): number => {
  switch (role) {
    case 'host':
      return HOST_INACTIVE_THRESHOLD;
    case 'contestant':
      return CONTESTANT_INACTIVE_THRESHOLD;
    case 'display':
      return DISPLAY_INACTIVE_THRESHOLD;
    default:
      return INACTIVE_THRESHOLD;
  }
};
