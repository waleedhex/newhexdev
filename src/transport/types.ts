/**
 * transport/types.ts
 * أنواع وواجهات نظام النقل الموحد
 * 
 * القاعدة: هذه الأنواع تُستخدم للأحداث العابرة فقط (Transient Events)
 * الحالة الدائمة (Persistent State) تبقى عبر DB مباشرة
 */

// ============= أنواع الأحداث العابرة =============

/** معرف فريد لكل حدث لمنع التكرار */
export interface EventMetadata {
  event_id: string;
  timestamp: number;
}

/** حدث ضغط الجرس */
export interface BuzzerPressedEvent extends EventMetadata {
  type: 'buzzer_pressed';
  player: string;
  team: 'red' | 'green';
}

/** حدث انتهاء وقت الجرس */
export interface BuzzerTimeoutEvent extends EventMetadata {
  type: 'buzzer_timeout';
}

/** حدث إعادة تعيين الجرس */
export interface BuzzerResetEvent extends EventMetadata {
  type: 'buzzer_reset';
}

/** حدث وضع الاحتفال */
export interface PartyModeEvent extends EventMetadata {
  type: 'party_mode';
  active: boolean;
  winningTeam: 'red' | 'green';
  winningPath: [number, number][];
}

/** حدث احتفال الحرف الذهبي */
export interface GoldenCelebrationEvent extends EventMetadata {
  type: 'golden_celebration';
  letter: string;
}

/** حدث وميض الشاشة */
export interface FlashEvent extends EventMetadata {
  type: 'flash';
  team: 'red' | 'green';
}

/** جميع الأحداث العابرة */
export type TransientEvent =
  | BuzzerPressedEvent
  | BuzzerTimeoutEvent
  | BuzzerResetEvent
  | PartyModeEvent
  | GoldenCelebrationEvent
  | FlashEvent;

/** أنواع الأحداث */
export type TransientEventType = TransientEvent['type'];

// ============= واجهة النقل =============

/** نوع وسيلة النقل */
export type TransportType = 'broadcast' | 'webrtc' | 'hybrid';

/** حالة الاتصال */
export type TransportStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** معالج الأحداث */
export type EventHandler<T extends TransientEvent = TransientEvent> = (event: T) => void;

/** معالج حسب نوع الحدث */
export type TypedEventHandlers = {
  buzzer_pressed?: EventHandler<BuzzerPressedEvent>;
  buzzer_timeout?: EventHandler<BuzzerTimeoutEvent>;
  buzzer_reset?: EventHandler<BuzzerResetEvent>;
  party_mode?: EventHandler<PartyModeEvent>;
  golden_celebration?: EventHandler<GoldenCelebrationEvent>;
  flash?: EventHandler<FlashEvent>;
};

/**
 * واجهة النقل الموحدة
 * 
 * كل وسيلة نقل (Broadcast, WebRTC, Hybrid) تطبق هذه الواجهة
 * الـ Hooks لا تعرف نوع النقل الفعلي
 */
export interface Transport {
  /** نوع وسيلة النقل */
  readonly type: TransportType;
  
  /** حالة الاتصال الحالية */
  readonly status: TransportStatus;
  
  /** هل النقل جاهز للإرسال؟ */
  ready(): boolean;
  
  /** إرسال حدث */
  send(event: TransientEvent): void;
  
  /** الاشتراك في جميع الأحداث */
  subscribe(handler: EventHandler): () => void;
  
  /** الاشتراك في نوع محدد من الأحداث */
  on<T extends TransientEventType>(
    type: T,
    handler: EventHandler<Extract<TransientEvent, { type: T }>>
  ): () => void;
  
  /** إغلاق الاتصال وتنظيف الموارد */
  disconnect(): void;
}

// ============= إعدادات النقل =============

/** إعدادات Broadcast Transport */
export interface BroadcastTransportConfig {
  sessionCode: string;
  /** اسم القناة (افتراضي: game-events-${sessionCode}) */
  channelName?: string;
}

/** إعدادات WebRTC Transport */
export interface WebRTCTransportConfig {
  sessionCode: string;
  /** دور المستخدم */
  role: 'host' | 'contestant' | 'display';
  /** معرف اللاعب */
  playerId?: string;
  /** STUN/TURN servers */
  iceServers?: RTCIceServer[];
}

/** إعدادات Hybrid Transport */
export interface HybridTransportConfig {
  sessionCode: string;
  role: 'host' | 'contestant' | 'display';
  playerId?: string;
  /** تفعيل WebRTC (افتراضي: true) */
  enableWebRTC?: boolean;
  /** مهلة محاولة RTC قبل fallback (بالميلي ثانية) */
  rtcTimeout?: number;
}

// ============= أنواع Signaling (للـ WebRTC) =============

/** أنواع رسائل Signaling */
export type SignalingType = 'offer' | 'answer' | 'ice-candidate';

/** رسالة Signaling */
export interface SignalingMessage {
  type: SignalingType;
  from: string;
  to: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  timestamp: number;
}

// ============= دوال مساعدة =============

/** توليد معرف فريد للحدث */
export const generateEventId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/** إنشاء حدث مع metadata */
export const createEvent = <T extends Omit<TransientEvent, 'event_id' | 'timestamp'>>(
  event: T
): T & EventMetadata => {
  return {
    ...event,
    event_id: generateEventId(),
    timestamp: Date.now(),
  } as T & EventMetadata;
};

/** التحقق من أن الحدث من النوع المحدد */
export const isEventType = <T extends TransientEventType>(
  event: TransientEvent,
  type: T
): event is Extract<TransientEvent, { type: T }> => {
  return event.type === type;
};
