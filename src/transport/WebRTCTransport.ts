/**
 * transport/WebRTCTransport.ts
 * تنفيذ WebRTC Transport للاتصال المباشر P2P
 * 
 * المعمارية: Host-to-All (المقدم هو Hub)
 * - المقدم ينشئ اتصالات مع كل متسابق/شاشة
 * - المتسابقون لا يتصلون ببعضهم مباشرة
 */

import {
  Transport,
  TransportType,
  TransportStatus,
  TransientEvent,
  TransientEventType,
  EventHandler,
  WebRTCTransportConfig,
} from './types';
import {
  DEFAULT_RTC_CONFIG,
  DATA_CHANNEL_CONFIG,
  DATA_CHANNEL_NAME,
  RTC_CONNECTION_TIMEOUT,
  HEALTH_CHECK_INTERVAL,
  MAX_FAILED_HEALTH_CHECKS,
  isDataChannelSupported,
} from './rtcConfig';
import { SignalingManager, createSignalingManager } from './signaling';

// ============= أنواع داخلية =============

interface PeerConnection {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  isReady: boolean;
  failedHealthChecks: number;
}

// ============= WebRTCTransport Class =============

export class WebRTCTransport implements Transport {
  readonly type: TransportType = 'webrtc';
  
  private _status: TransportStatus = 'disconnected';
  private readonly sessionCode: string;
  private readonly role: 'host' | 'contestant' | 'display';
  private readonly playerId: string;
  private readonly rtcConfig: RTCConfiguration;
  
  private signaling: SignalingManager | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private handlers: Set<EventHandler> = new Set();
  private typedHandlers: Map<TransientEventType, Set<EventHandler>> = new Map();
  private processedEvents: Set<string> = new Set();
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor(config: WebRTCTransportConfig) {
    this.sessionCode = config.sessionCode;
    this.role = config.role;
    this.playerId = config.playerId || `${config.role}-${Date.now()}`;
    this.rtcConfig = config.iceServers 
      ? { ...DEFAULT_RTC_CONFIG, iceServers: config.iceServers }
      : DEFAULT_RTC_CONFIG;
  }
  
  // ============= Getters =============
  
  get status(): TransportStatus {
    return this._status;
  }
  
  /**
   * عدد الاتصالات النشطة
   */
  get connectedPeers(): number {
    let count = 0;
    this.peers.forEach(peer => {
      if (peer.isReady) count++;
    });
    return count;
  }
  
  // ============= Transport Interface =============
  
  ready(): boolean {
    // جاهز إذا كان متصلاً وله اتصال واحد على الأقل (للـ Host)
    // أو متصل بالـ Host (للمتسابق/الشاشة)
    if (this._status !== 'connected') return false;
    
    if (this.role === 'host') {
      return true; // Host جاهز حتى بدون peers
    }
    
    // المتسابق/الشاشة يحتاج اتصال بالـ Host
    return this.connectedPeers > 0;
  }
  
  send(event: TransientEvent): void {
    if (!this.ready()) {
      console.warn('⚠️ [WebRTCTransport] Not ready to send');
      return;
    }
    
    // تسجيل الحدث كمُرسل
    this.processedEvents.add(event.event_id);
    
    const message = JSON.stringify(event);
    console.log('📡 [WebRTCTransport] Sending:', event.type, 'to', this.peers.size, 'peers');
    
    // إرسال لجميع الـ peers المتصلين
    this.peers.forEach((peer, peerId) => {
      if (peer.isReady && peer.dataChannel?.readyState === 'open') {
        try {
          peer.dataChannel.send(message);
        } catch (err) {
          console.error('❌ [WebRTCTransport] Send failed to', peerId, err);
        }
      }
    });
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
    console.log('🔌 [WebRTCTransport] Disconnecting');
    
    // إيقاف الفحوصات الدورية
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // إغلاق جميع اتصالات Peer
    this.peers.forEach((peer, peerId) => {
      this.closePeerConnection(peerId);
    });
    this.peers.clear();
    
    // إغلاق Signaling
    this.signaling?.disconnect();
    this.signaling = null;
    
    // تنظيف
    this.handlers.clear();
    this.typedHandlers.clear();
    this.processedEvents.clear();
    
    this._status = 'disconnected';
  }
  
  // ============= Connection Management =============
  
  /**
   * بدء الاتصال
   */
  async connect(): Promise<void> {
    // التحقق من دعم WebRTC
    if (!isDataChannelSupported()) {
      throw new Error('WebRTC DataChannel not supported');
    }
    
    console.log('🔌 [WebRTCTransport] Connecting as', this.role, this.playerId);
    this._status = 'connecting';
    
    try {
      // إنشاء Signaling Manager
      this.signaling = await createSignalingManager({
        sessionCode: this.sessionCode,
        peerId: this.playerId,
        handlers: {
          onOffer: (from, offer) => this.handleOffer(from, offer),
          onAnswer: (from, answer) => this.handleAnswer(from, answer),
          onIceCandidate: (from, candidate) => this.handleIceCandidate(from, candidate),
        },
      });
      
      this._status = 'connected';
      
      // بدء الفحوصات الدورية
      this.startHealthCheck();
      this.startCleanupInterval();
      
      console.log('✅ [WebRTCTransport] Connected');
    } catch (err) {
      console.error('❌ [WebRTCTransport] Connection failed:', err);
      this._status = 'error';
      throw err;
    }
  }
  
  /**
   * إنشاء اتصال مع peer (يُستخدم من المقدم)
   */
  async connectToPeer(peerId: string): Promise<void> {
    if (this.role !== 'host') {
      console.warn('⚠️ [WebRTCTransport] Only host can initiate connections');
      return;
    }
    
    if (this.peers.has(peerId)) {
      console.log('⏭️ [WebRTCTransport] Already connected to', peerId);
      return;
    }
    
    console.log('🤝 [WebRTCTransport] Initiating connection to', peerId);
    
    const pc = this.createPeerConnection(peerId);
    
    // إنشاء DataChannel (المُنشئ يصنعها)
    const dataChannel = pc.createDataChannel(DATA_CHANNEL_NAME, DATA_CHANNEL_CONFIG);
    this.setupDataChannel(peerId, dataChannel);
    
    // إنشاء Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // إرسال Offer عبر Signaling
    this.signaling?.sendOffer(peerId, offer);
    
    // Timeout للاتصال
    setTimeout(() => {
      const peer = this.peers.get(peerId);
      if (peer && !peer.isReady) {
        console.warn('⏱️ [WebRTCTransport] Connection timeout to', peerId);
        this.closePeerConnection(peerId);
      }
    }, RTC_CONNECTION_TIMEOUT);
  }
  
  // ============= Signaling Handlers =============
  
  /**
   * معالجة Offer من peer آخر
   */
  private async handleOffer(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📥 [WebRTCTransport] Handling offer from', from);
    
    const pc = this.createPeerConnection(from);
    
    // DataChannel سيتم استلامها عبر ondatachannel
    
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    this.signaling?.sendAnswer(from, answer);
  }
  
  /**
   * معالجة Answer من peer
   */
  private async handleAnswer(from: string, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('📥 [WebRTCTransport] Handling answer from', from);
    
    const peer = this.peers.get(from);
    if (!peer) {
      console.warn('⚠️ [WebRTCTransport] No peer found for', from);
      return;
    }
    
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
  
  /**
   * معالجة ICE Candidate
   */
  private async handleIceCandidate(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(from);
    if (!peer) return;
    
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('❌ [WebRTCTransport] ICE candidate error:', err);
    }
  }
  
  // ============= PeerConnection Management =============
  
  /**
   * إنشاء RTCPeerConnection جديد
   */
  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.rtcConfig);
    
    const peerData: PeerConnection = {
      pc,
      dataChannel: null,
      isReady: false,
      failedHealthChecks: 0,
    };
    
    this.peers.set(peerId, peerData);
    
    // معالجة ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling?.sendIceCandidate(peerId, event.candidate.toJSON());
      }
    };
    
    // معالجة حالة الاتصال
    pc.onconnectionstatechange = () => {
      console.log('🔗 [WebRTCTransport] Connection state:', peerId, pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        // ✅ إيقاف ICE عند نجاح الاتصال
        console.log('✅ [WebRTCTransport] Connection established, stopping ICE for:', peerId);
        this.signaling?.stopIceForPeer(peerId);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.closePeerConnection(peerId);
      }
    };
    
    // استقبال DataChannel (للمستقبِل)
    pc.ondatachannel = (event) => {
      console.log('📡 [WebRTCTransport] Received DataChannel from', peerId);
      this.setupDataChannel(peerId, event.channel);
    };
    
    return pc;
  }
  
  /**
   * إعداد DataChannel
   */
  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    
    peer.dataChannel = channel;
    
    channel.onopen = () => {
      console.log('✅ [WebRTCTransport] DataChannel open with', peerId);
      peer.isReady = true;
    };
    
    channel.onclose = () => {
      console.log('🔌 [WebRTCTransport] DataChannel closed with', peerId);
      peer.isReady = false;
    };
    
    channel.onerror = (error) => {
      console.error('❌ [WebRTCTransport] DataChannel error with', peerId, error);
    };
    
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as TransientEvent;
        this.handleIncomingEvent(message);
      } catch (err) {
        console.error('❌ [WebRTCTransport] Invalid message:', err);
      }
    };
  }
  
  /**
   * إغلاق اتصال peer
   */
  private closePeerConnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    
    console.log('🔌 [WebRTCTransport] Closing connection to', peerId);
    
    peer.dataChannel?.close();
    peer.pc.close();
    this.peers.delete(peerId);
  }
  
  // ============= Event Handling =============
  
  /**
   * معالجة الأحداث الواردة
   */
  private handleIncomingEvent(event: TransientEvent): void {
    // تجنب التكرار
    if (this.processedEvents.has(event.event_id)) {
      return;
    }
    
    this.processedEvents.add(event.event_id);
    console.log('📥 [WebRTCTransport] Received:', event.type);
    
    // إشعار المعالجات العامة
    this.handlers.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error('❌ [WebRTCTransport] Handler error:', err);
      }
    });
    
    // إشعار المعالجات المحددة
    const typeHandlers = this.typedHandlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (err) {
          console.error('❌ [WebRTCTransport] Typed handler error:', err);
        }
      });
    }
  }
  
  // ============= Health Check =============
  
  /**
   * فحص صحة الاتصالات
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;
    
    this.healthCheckInterval = setInterval(() => {
      this.peers.forEach((peer, peerId) => {
        if (!peer.isReady || peer.dataChannel?.readyState !== 'open') {
          peer.failedHealthChecks++;
          
          if (peer.failedHealthChecks >= MAX_FAILED_HEALTH_CHECKS) {
            console.warn('💔 [WebRTCTransport] Peer unhealthy:', peerId);
            this.closePeerConnection(peerId);
          }
        } else {
          peer.failedHealthChecks = 0;
        }
      });
    }, HEALTH_CHECK_INTERVAL);
  }
  
  /**
   * تنظيف الأحداث القديمة
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - 30000;
      
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
}

/**
 * إنشاء WebRTCTransport وبدء الاتصال
 */
export const createWebRTCTransport = async (
  config: WebRTCTransportConfig
): Promise<WebRTCTransport> => {
  const transport = new WebRTCTransport(config);
  await transport.connect();
  return transport;
};
