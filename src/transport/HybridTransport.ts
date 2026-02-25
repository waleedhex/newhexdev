/**
 * transport/HybridTransport.ts
 * النقل الهجين: يجمع بين Broadcast و WebRTC
 * 
 * الاستراتيجية:
 * 1. يبدأ بـ Broadcast (مضمون)
 * 2. يحاول WebRTC في الخلفية
 * 3. عند نجاح RTC: dual-send (إرسال عبر الاثنين)
 * 4. عند فشل RTC: يستمر على Broadcast فقط
 * 
 * Deduplication: يستخدم event_id لمنع معالجة نفس الحدث مرتين
 */

import {
  Transport,
  TransportType,
  TransportStatus,
  TransientEvent,
  TransientEventType,
  createEvent,
  EventHandler,
  HybridTransportConfig,
} from './types';
import { BroadcastTransport } from './BroadcastTransport';
import { WebRTCTransport } from './WebRTCTransport';
import { RTC_CONNECTION_TIMEOUT, RTC_RETRY_DELAYS, isDataChannelSupported } from './rtcConfig';
import { assertTransient, TransientViolationError } from './validation';

// ============= أنواع داخلية =============

type TransportMode = 'broadcast-only' | 'hybrid' | 'rtc-preferred';

interface HybridState {
  mode: TransportMode;
  rtcAttempts: number;
  lastRtcAttempt: number;
  rtcEnabled: boolean;
  /** قائمة الـ peers للإعادة الاتصال بهم */
  knownPeers: Set<string>;
}

// ============= HybridTransport Class =============

export class HybridTransport implements Transport {
  readonly type: TransportType = 'hybrid';
  
  private _status: TransportStatus = 'disconnected';
  private readonly config: HybridTransportConfig;
  
  // النقلان الفرعيان
  private broadcast: BroadcastTransport | null = null;
  private webrtc: WebRTCTransport | null = null;
  
  // حالة الهجين
  private state: HybridState = {
    mode: 'broadcast-only',
    rtcAttempts: 0,
    lastRtcAttempt: 0,
    rtcEnabled: true,
    knownPeers: new Set(),
  };
  
  // معالجات الأحداث
  private handlers: Set<EventHandler> = new Set();
  private typedHandlers: Map<TransientEventType, Set<EventHandler>> = new Map();
  
  // Deduplication
  private processedEvents: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // RTC retry
  private rtcRetryTimeout: NodeJS.Timeout | null = null;
  
  constructor(config: HybridTransportConfig) {
    this.config = config;
    this.state.rtcEnabled = config.enableWebRTC !== false;
  }
  
  // ============= Getters =============
  
  get status(): TransportStatus {
    return this._status;
  }
  
  /**
   * الوضع الحالي للنقل
   */
  get mode(): TransportMode {
    return this.state.mode;
  }
  
  /**
   * هل WebRTC نشط؟
   */
  get isRTCActive(): boolean {
    return this.webrtc?.ready() ?? false;
  }
  
  // ============= Transport Interface =============
  
  ready(): boolean {
    // جاهز إذا Broadcast جاهز (الحد الأدنى)
    return this.broadcast?.ready() ?? false;
  }
  
  send(event: TransientEvent): void {
    if (!this.ready()) {
      console.warn('⚠️ [HybridTransport] Not ready to send');
      return;
    }
    
    // ✅ Guard: التحقق من أن الحدث عابر فقط
    try {
      assertTransient(event);
    } catch (err) {
      if (err instanceof TransientViolationError) {
        console.error('🚫 [HybridTransport]', err.message);
        throw err; // فشل صريح - هذا خطأ برمجي يجب إصلاحه
      }
      throw err;
    }
    
    // تسجيل الحدث (لتجنب معالجته عند الاستلام)
    this.processedEvents.add(event.event_id);
    
    console.log('📡 [HybridTransport] Sending:', event.type, 'mode:', this.state.mode);
    
    // Dual-send: إرسال عبر كلا القناتين
    // هذا يضمن وصول الحدث حتى لو فشل أحدهما
    
    // 1. دائماً عبر Broadcast (الضمان)
    this.broadcast?.send(event);
    
    // 2. عبر RTC إذا متاح (السرعة)
    if (this.webrtc?.ready()) {
      this.webrtc.send(event);
    }
  }
  
  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  
  on<T extends TransientEventType>(
    type: T,
    handler: EventHandler<Extract<TransientEvent, { type: T }>>
  ): () => void {
    if (!this.typedHandlers.has(type)) {
      this.typedHandlers.set(type, new Set());
    }
    this.typedHandlers.get(type)!.add(handler as EventHandler);
    return () => this.typedHandlers.get(type)?.delete(handler as EventHandler);
  }
  
  disconnect(): void {
    console.log('🔌 [HybridTransport] Disconnecting');
    
    // إيقاف المؤقتات
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.rtcRetryTimeout) {
      clearTimeout(this.rtcRetryTimeout);
      this.rtcRetryTimeout = null;
    }
    
    // إغلاق النقلين
    this.broadcast?.disconnect();
    this.broadcast = null;
    
    this.webrtc?.disconnect();
    this.webrtc = null;
    
    // تنظيف
    this.handlers.clear();
    this.typedHandlers.clear();
    this.processedEvents.clear();
    
    this._status = 'disconnected';
    this.state.mode = 'broadcast-only';
  }
  
  // ============= Connection Management =============
  
  /**
   * بدء الاتصال
   */
  async connect(): Promise<void> {
    console.log('🔌 [HybridTransport] Connecting as', this.config.role);
    this._status = 'connecting';
    
    try {
      // 1. إنشاء Broadcast أولاً (مضمون)
      this.broadcast = new BroadcastTransport({
        sessionCode: this.config.sessionCode,
      });
      
      // الاشتراك في أحداث Broadcast
      this.broadcast.subscribe((event) => this.handleIncomingEvent(event, 'broadcast'));
      
      await this.broadcast.connect();
      console.log('✅ [HybridTransport] Broadcast connected');
      
      this._status = 'connected';
      this.state.mode = 'broadcast-only';
      
      // بدء تنظيف الأحداث
      this.startCleanupInterval();
      
      // 2. محاولة WebRTC في الخلفية (إذا مفعّل)
      if (this.state.rtcEnabled && isDataChannelSupported()) {
        this.attemptRTCConnection();
      } else {
        console.log('ℹ️ [HybridTransport] WebRTC disabled or not supported');
      }
      
    } catch (err) {
      console.error('❌ [HybridTransport] Connection failed:', err);
      this._status = 'error';
      throw err;
    }
  }
  
  /**
   * محاولة اتصال WebRTC
   */
  private async attemptRTCConnection(): Promise<void> {
    if (!this.state.rtcEnabled) return;
    
    // التحقق من عدد المحاولات
    if (this.state.rtcAttempts >= RTC_RETRY_DELAYS.length) {
      console.log('ℹ️ [HybridTransport] Max RTC attempts reached, staying on Broadcast');
      return;
    }
    
    this.state.lastRtcAttempt = Date.now();
    this.state.rtcAttempts++;
    
    console.log('🔄 [HybridTransport] Attempting RTC connection, attempt:', this.state.rtcAttempts);
    
    try {
      this.webrtc = new WebRTCTransport({
        sessionCode: this.config.sessionCode,
        role: this.config.role,
        playerId: this.config.playerId,
      });
      
      // الاشتراك في أحداث RTC
      this.webrtc.subscribe((event) => this.handleIncomingEvent(event, 'webrtc'));
      
      // محاولة الاتصال مع timeout
      await Promise.race([
        this.webrtc.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RTC timeout')), 
            this.config.rtcTimeout || RTC_CONNECTION_TIMEOUT)
        ),
      ]);
      
      console.log('✅ [HybridTransport] WebRTC connected!');
      this.state.mode = 'hybrid';
      this.state.rtcAttempts = 0; // إعادة تعيين عند النجاح
      
      // ✅ إعادة الاتصال بالـ peers المعروفين (RTC Auto-Reconnect)
      await this.reconnectToKnownPeers();
      
    } catch (err) {
      console.warn('⚠️ [HybridTransport] RTC connection failed:', err);
      
      // تنظيف WebRTC الفاشل
      this.webrtc?.disconnect();
      this.webrtc = null;
      
      // جدولة إعادة المحاولة
      this.scheduleRTCRetry();
    }
  }
  
  /**
   * جدولة إعادة محاولة RTC
   */
  private scheduleRTCRetry(): void {
    if (this.state.rtcAttempts >= RTC_RETRY_DELAYS.length) {
      console.log('ℹ️ [HybridTransport] No more RTC retries');
      return;
    }
    
    const delay = RTC_RETRY_DELAYS[this.state.rtcAttempts - 1] || RTC_RETRY_DELAYS[0];
    console.log(`🔄 [HybridTransport] Scheduling RTC retry in ${delay / 1000}s`);
    
    this.rtcRetryTimeout = setTimeout(() => {
      this.attemptRTCConnection();
    }, delay);
  }
  
  // ============= Host-specific Methods =============
  
  /**
   * إنشاء اتصال RTC مع peer (للـ Host فقط)
   */
  async connectToPeer(peerId: string): Promise<void> {
    if (this.config.role !== 'host') {
      console.warn('⚠️ [HybridTransport] Only host can initiate peer connections');
      return;
    }
    
    // تسجيل الـ peer لإعادة الاتصال عند الحاجة
    this.state.knownPeers.add(peerId);
    
    if (!this.webrtc?.ready()) {
      console.log('ℹ️ [HybridTransport] WebRTC not ready, peer will use Broadcast. Will reconnect when ready.');
      return;
    }
    
    await this.webrtc.connectToPeer(peerId);
  }
  
  /**
   * إزالة peer من القائمة المعروفة
   */
  removePeer(peerId: string): void {
    this.state.knownPeers.delete(peerId);
  }
  
  /**
   * إعادة الاتصال بجميع الـ peers المعروفين
   * يُستخدم عند عودة RTC بعد فقدانه
   */
  private async reconnectToKnownPeers(): Promise<void> {
    if (this.config.role !== 'host' || this.state.knownPeers.size === 0) {
      return;
    }
    
    console.log('🔄 [HybridTransport] Reconnecting to', this.state.knownPeers.size, 'known peers');
    
    for (const peerId of this.state.knownPeers) {
      try {
        await this.webrtc?.connectToPeer(peerId);
      } catch (err) {
        console.warn('⚠️ [HybridTransport] Failed to reconnect to:', peerId, err);
      }
    }
  }
  
  // ============= Event Handling =============
  
  /**
   * معالجة الأحداث الواردة مع deduplication
   */
  private handleIncomingEvent(event: TransientEvent, source: 'broadcast' | 'webrtc'): void {
    // Deduplication: تجاهل الأحداث المعالجة
    if (this.processedEvents.has(event.event_id)) {
      console.log('⏭️ [HybridTransport] Skipping duplicate from', source, ':', event.type);
      return;
    }
    
    // تسجيل الحدث
    this.processedEvents.add(event.event_id);
    
    console.log('📥 [HybridTransport] Received from', source, ':', event.type);
    
    // إشعار المعالجات العامة
    this.handlers.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error('❌ [HybridTransport] Handler error:', err);
      }
    });
    
    // إشعار المعالجات المحددة
    const typeHandlers = this.typedHandlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (err) {
          console.error('❌ [HybridTransport] Typed handler error:', err);
        }
      });
    }
  }
  
  // ============= Cleanup =============
  
  /**
   * تنظيف الأحداث القديمة
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - 30000; // 30 ثانية
      
      const newSet = new Set<string>();
      this.processedEvents.forEach(eventId => {
        const timestamp = parseInt(eventId.split('-')[0], 10);
        if (timestamp > cutoff) {
          newSet.add(eventId);
        }
      });
      
      this.processedEvents = newSet;
    }, 10000);
  }
  
  // ============= Utility Methods =============
  
  /**
   * تعطيل WebRTC يدوياً
   */
  disableRTC(): void {
    console.log('🔌 [HybridTransport] Disabling RTC');
    
    this.state.rtcEnabled = false;
    
    if (this.rtcRetryTimeout) {
      clearTimeout(this.rtcRetryTimeout);
      this.rtcRetryTimeout = null;
    }
    
    this.webrtc?.disconnect();
    this.webrtc = null;
    
    this.state.mode = 'broadcast-only';
  }
  
  /**
   * إعادة تفعيل WebRTC
   */
  enableRTC(): void {
    if (this.state.rtcEnabled) return;
    
    console.log('🔄 [HybridTransport] Enabling RTC');
    
    this.state.rtcEnabled = true;
    this.state.rtcAttempts = 0;
    
    if (isDataChannelSupported()) {
      this.attemptRTCConnection();
    }
  }
  
  /**
   * الحصول على إحصائيات الاتصال
   */
  getStats(): {
    mode: TransportMode;
    broadcastReady: boolean;
    rtcReady: boolean;
    rtcAttempts: number;
    connectedPeers: number;
  } {
    return {
      mode: this.state.mode,
      broadcastReady: this.broadcast?.ready() ?? false,
      rtcReady: this.webrtc?.ready() ?? false,
      rtcAttempts: this.state.rtcAttempts,
      connectedPeers: this.webrtc?.connectedPeers ?? 0,
    };
  }
}

/**
 * إنشاء HybridTransport وبدء الاتصال
 */
export const createHybridTransport = async (
  config: HybridTransportConfig
): Promise<HybridTransport> => {
  const transport = new HybridTransport(config);
  await transport.connect();
  return transport;
};
