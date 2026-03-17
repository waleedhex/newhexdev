/**
 * transport/WebRTCTransport.ts
 * تنفيذ WebRTC Transport للاتصال المباشر P2P
 * 
 * المعمارية: Host-to-All (المقدم هو Hub)
 * يدعم Signaling مدمج عبر BroadcastTransport (بدون قناة منفصلة)
 */

import {
  Transport,
  TransportType,
  TransportStatus,
  TransientEvent,
  TransientEventType,
  EventHandler,
  WebRTCTransportConfig,
  SignalingMessage,
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

interface PeerConnection {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  isReady: boolean;
  failedHealthChecks: number;
}

export class WebRTCTransport implements Transport {
  readonly type: TransportType = 'webrtc';
  
  private _status: TransportStatus = 'disconnected';
  private readonly sessionCode: string;
  private readonly role: 'host' | 'contestant' | 'display';
  private readonly playerId: string;
  private readonly rtcConfig: RTCConfiguration;
  private readonly signalingSendFn?: (msg: SignalingMessage) => void;
  
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
    this.signalingSendFn = config.signalingSendFn;
  }
  
  get status(): TransportStatus {
    return this._status;
  }
  
  get connectedPeers(): number {
    let count = 0;
    this.peers.forEach(peer => {
      if (peer.isReady) count++;
    });
    return count;
  }
  
  ready(): boolean {
    if (this._status !== 'connected') return false;
    if (this.role === 'host') return true;
    return this.connectedPeers > 0;
  }
  
  send(event: TransientEvent): void {
    if (!this.ready()) return;
    
    this.processedEvents.add(event.event_id);
    const message = JSON.stringify(event);
    
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
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.peers.forEach((_, peerId) => this.closePeerConnection(peerId));
    this.peers.clear();
    
    this.signaling?.disconnect();
    this.signaling = null;
    
    this.handlers.clear();
    this.typedHandlers.clear();
    this.processedEvents.clear();
    this._status = 'disconnected';
  }
  
  async connect(): Promise<void> {
    if (!isDataChannelSupported()) {
      throw new Error('WebRTC DataChannel not supported');
    }
    
    console.log('🔌 [WebRTCTransport] Connecting as', this.role, this.playerId);
    this._status = 'connecting';
    
    try {
      // إنشاء Signaling Manager (مدمج أو مستقل)
      this.signaling = await createSignalingManager({
        sessionCode: this.sessionCode,
        peerId: this.playerId,
        handlers: {
          onOffer: (from, offer) => this.handleOffer(from, offer),
          onAnswer: (from, answer) => this.handleAnswer(from, answer),
          onIceCandidate: (from, candidate) => this.handleIceCandidate(from, candidate),
        },
        sendFn: this.signalingSendFn,
      });
      
      this._status = 'connected';
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
   * تمرير رسالة Signaling واردة (من BroadcastTransport المدمج)
   */
  handleSignalingMessage(message: SignalingMessage): void {
    this.signaling?.handleIncomingMessage(message);
  }
  
  async connectToPeer(peerId: string): Promise<void> {
    if (this.role !== 'host') return;
    if (this.peers.has(peerId)) return;
    
    console.log('🤝 [WebRTCTransport] Initiating connection to', peerId);
    
    const pc = this.createPeerConnection(peerId);
    const dataChannel = pc.createDataChannel(DATA_CHANNEL_NAME, DATA_CHANNEL_CONFIG);
    this.setupDataChannel(peerId, dataChannel);
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signaling?.sendOffer(peerId, offer);
    
    setTimeout(() => {
      const peer = this.peers.get(peerId);
      if (peer && !peer.isReady) {
        console.warn('⏱️ [WebRTCTransport] Connection timeout to', peerId);
        this.closePeerConnection(peerId);
      }
    }, RTC_CONNECTION_TIMEOUT);
  }
  
  // ============= Signaling Handlers =============
  
  private async handleOffer(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.createPeerConnection(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.signaling?.sendAnswer(from, answer);
  }
  
  private async handleAnswer(from: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(from);
    if (!peer) return;
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
  
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
  
  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.rtcConfig);
    
    const peerData: PeerConnection = {
      pc,
      dataChannel: null,
      isReady: false,
      failedHealthChecks: 0,
    };
    
    this.peers.set(peerId, peerData);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling?.sendIceCandidate(peerId, event.candidate.toJSON());
      }
    };
    
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.signaling?.stopIceForPeer(peerId);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.closePeerConnection(peerId);
      }
    };
    
    pc.ondatachannel = (event) => {
      this.setupDataChannel(peerId, event.channel);
    };
    
    return pc;
  }
  
  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    
    peer.dataChannel = channel;
    
    channel.onopen = () => { peer.isReady = true; };
    channel.onclose = () => { peer.isReady = false; };
    channel.onerror = (error) => { console.error('❌ [WebRTCTransport] DataChannel error with', peerId, error); };
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as TransientEvent;
        this.handleIncomingEvent(message);
      } catch (err) {
        console.error('❌ [WebRTCTransport] Invalid message:', err);
      }
    };
  }
  
  private closePeerConnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.dataChannel?.close();
    peer.pc.close();
    this.peers.delete(peerId);
  }
  
  private handleIncomingEvent(event: TransientEvent): void {
    if (this.processedEvents.has(event.event_id)) return;
    this.processedEvents.add(event.event_id);
    
    this.handlers.forEach(handler => {
      try { handler(event); } catch (err) { console.error('❌ [WebRTCTransport] Handler error:', err); }
    });
    
    const typeHandlers = this.typedHandlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try { handler(event); } catch (err) { console.error('❌ [WebRTCTransport] Typed handler error:', err); }
      });
    }
  }
  
  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;
    this.healthCheckInterval = setInterval(() => {
      this.peers.forEach((peer, peerId) => {
        if (!peer.isReady || peer.dataChannel?.readyState !== 'open') {
          peer.failedHealthChecks++;
          if (peer.failedHealthChecks >= MAX_FAILED_HEALTH_CHECKS) {
            this.closePeerConnection(peerId);
          }
        } else {
          peer.failedHealthChecks = 0;
        }
      });
    }, HEALTH_CHECK_INTERVAL);
  }
  
  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 30000;
      const newSet = new Set<string>();
      this.processedEvents.forEach(eventId => {
        const timestamp = parseInt(eventId.split('-')[0], 10);
        if (timestamp > cutoff) newSet.add(eventId);
      });
      this.processedEvents = newSet;
    }, 10000);
  }
}

export const createWebRTCTransport = async (
  config: WebRTCTransportConfig
): Promise<WebRTCTransport> => {
  const transport = new WebRTCTransport(config);
  await transport.connect();
  return transport;
};
