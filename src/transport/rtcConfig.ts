/**
 * transport/rtcConfig.ts
 * إعدادات WebRTC - STUN/TURN servers
 * 
 * STUN: يساعد في اكتشاف العنوان العام (مجاني)
 * TURN: relay server للحالات الصعبة (يحتاج خادم خاص)
 */

// ============= STUN Servers (مجانية) =============

/**
 * قائمة STUN servers المجانية
 * Google و Twilio توفر خوادم مجانية وموثوقة
 */
export const FREE_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// ============= الإعدادات الافتراضية =============

/**
 * إعدادات RTCPeerConnection الافتراضية
 */
export const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: FREE_STUN_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

/**
 * إعدادات DataChannel
 */
export const DATA_CHANNEL_CONFIG: RTCDataChannelInit = {
  ordered: true,      // ترتيب الرسائل مضمون
  maxRetransmits: 3,  // إعادة المحاولة 3 مرات
};

/**
 * اسم DataChannel الموحد
 */
export const DATA_CHANNEL_NAME = 'game-events';

// ============= Timeouts =============

/** مهلة إنشاء اتصال RTC (بالميلي ثانية) */
export const RTC_CONNECTION_TIMEOUT = 10000; // 10 ثواني

/** مهلة Signaling (بالميلي ثانية) */
export const SIGNALING_TIMEOUT = 5000; // 5 ثواني

/** فترة Health Check (بالميلي ثانية) */
export const HEALTH_CHECK_INTERVAL = 5000; // 5 ثواني

/** عدد Health Checks الفاشلة قبل اعتبار الاتصال ميتاً */
export const MAX_FAILED_HEALTH_CHECKS = 3;

/** فترة إعادة محاولة RTC بعد الفشل (exponential backoff) */
export const RTC_RETRY_DELAYS = [30000, 60000, 120000]; // 30s, 60s, 120s

// ============= Feature Detection =============

/**
 * التحقق من دعم المتصفح لـ WebRTC
 */
export const isWebRTCSupported = (): boolean => {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof RTCSessionDescription !== 'undefined' &&
    typeof RTCIceCandidate !== 'undefined'
  );
};

/**
 * التحقق من دعم DataChannel
 */
export const isDataChannelSupported = (): boolean => {
  if (!isWebRTCSupported()) return false;
  
  try {
    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel('test');
    dc.close();
    pc.close();
    return true;
  } catch {
    return false;
  }
};

/**
 * الحصول على معلومات المتصفح
 */
export const getBrowserInfo = (): { name: string; supportsRTC: boolean } => {
  const ua = navigator.userAgent;
  let name = 'unknown';
  
  if (ua.includes('Chrome')) name = 'chrome';
  else if (ua.includes('Firefox')) name = 'firefox';
  else if (ua.includes('Safari')) name = 'safari';
  else if (ua.includes('Edge')) name = 'edge';
  
  return {
    name,
    supportsRTC: isDataChannelSupported(),
  };
};
