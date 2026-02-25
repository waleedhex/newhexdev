/**
 * transport/signaling.ts
 * إدارة Signaling لـ WebRTC عبر Supabase Broadcast
 * 
 * Signaling هو عملية تبادل معلومات الاتصال بين الأطراف:
 * - Offer: عرض من المُنشئ
 * - Answer: رد من المستقبِل
 * - ICE Candidate: معلومات الشبكة للاتصال
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SignalingMessage, SignalingType } from './types';
import { SIGNALING_TIMEOUT } from './rtcConfig';

// ============= أنواع Signaling =============

export interface SignalingHandlers {
  onOffer?: (from: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (from: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (from: string, candidate: RTCIceCandidateInit) => void;
}

export interface SignalingManagerConfig {
  sessionCode: string;
  peerId: string;
  handlers: SignalingHandlers;
}

// ============= Signaling Manager =============

/**
 * مدير Signaling
 * يستخدم قناة Broadcast منفصلة للـ Signaling
 * لا يتداخل مع قناة الأحداث الرئيسية
 */
// ============= ICE Rate Limiting Constants =============

/** الحد الأقصى لعدد ICE candidates لكل peer */
const MAX_ICE_CANDIDATES_PER_PEER = 10;

/** مهلة إيقاف ICE candidates بعد نجاح الاتصال (ms) */
const ICE_GATHERING_TIMEOUT = 5000;

// ============= Signaling Manager =============

export class SignalingManager {
  private channel: RealtimeChannel | null = null;
  private readonly sessionCode: string;
  private readonly peerId: string;
  private readonly channelName: string;
  private handlers: SignalingHandlers;
  private isConnected = false;
  
  // ====== ICE Rate Limiting ======
  /** عدد ICE candidates المرسلة لكل peer */
  private iceCandidateCount: Map<string, number> = new Map();
  /** هل تم إيقاف ICE لهذا الـ peer؟ */
  private iceStoppedForPeer: Set<string> = new Set();
  /** مؤقتات إيقاف ICE */
  private iceTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(config: SignalingManagerConfig) {
    this.sessionCode = config.sessionCode;
    this.peerId = config.peerId;
    this.channelName = `signaling-${config.sessionCode.toLowerCase()}`;
    this.handlers = config.handlers;
  }
  
  // ============= Lifecycle =============
  
  /**
   * بدء الاستماع لرسائل Signaling
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;
    
    console.log('🔗 [Signaling] Connecting to:', this.channelName);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Signaling connection timeout'));
      }, SIGNALING_TIMEOUT);
      
      this.channel = supabase.channel(this.channelName, {
        config: {
          broadcast: { self: false },
        },
      });
      
      // الاستماع لرسائل Signaling
      this.channel.on('broadcast', { event: 'signaling' }, (payload) => {
        this.handleSignalingMessage(payload.payload as SignalingMessage);
      });
      
      this.channel.subscribe((status) => {
        console.log('🔗 [Signaling] Status:', status);
        
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          this.isConnected = true;
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(new Error(`Signaling channel ${status}`));
        }
      });
    });
  }
  
  /**
   * إغلاق الاتصال وتنظيف الموارد
   */
  disconnect(): void {
    console.log('🔌 [Signaling] Disconnecting');
    
    // تنظيف مؤقتات ICE
    this.iceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.iceTimeouts.clear();
    this.iceCandidateCount.clear();
    this.iceStoppedForPeer.clear();
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.isConnected = false;
  }
  
  // ============= ICE Rate Limiting =============
  
  /**
   * إيقاف ICE candidates لـ peer معين (عند نجاح الاتصال)
   */
  stopIceForPeer(peerId: string): void {
    console.log('🛑 [Signaling] Stopping ICE for peer:', peerId);
    this.iceStoppedForPeer.add(peerId);
    
    // تنظيف المؤقت إذا كان موجوداً
    const timeout = this.iceTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.iceTimeouts.delete(peerId);
    }
  }
  
  /**
   * إعادة تعيين ICE لـ peer (عند إعادة الاتصال)
   */
  resetIceForPeer(peerId: string): void {
    this.iceStoppedForPeer.delete(peerId);
    this.iceCandidateCount.delete(peerId);
    
    const timeout = this.iceTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.iceTimeouts.delete(peerId);
    }
  }
  
  /**
   * التحقق من إمكانية إرسال ICE candidate
   */
  private canSendIce(to: string): boolean {
    // هل تم إيقاف ICE لهذا الـ peer؟
    if (this.iceStoppedForPeer.has(to)) {
      return false;
    }
    
    // التحقق من الحد الأقصى
    const count = this.iceCandidateCount.get(to) || 0;
    if (count >= MAX_ICE_CANDIDATES_PER_PEER) {
      console.warn(`⚠️ [Signaling] ICE limit reached for peer: ${to}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * بدء مؤقت إيقاف ICE التلقائي
   */
  private startIceTimeout(peerId: string): void {
    // لا تبدأ مؤقت جديد إذا كان موجوداً
    if (this.iceTimeouts.has(peerId)) return;
    
    const timeout = setTimeout(() => {
      console.log('⏱️ [Signaling] ICE timeout for peer:', peerId);
      this.stopIceForPeer(peerId);
    }, ICE_GATHERING_TIMEOUT);
    
    this.iceTimeouts.set(peerId, timeout);
  }
  
  // ============= Sending Methods =============
  
  /**
   * إرسال Offer
   */
  sendOffer(to: string, offer: RTCSessionDescriptionInit): void {
    this.send('offer', to, offer);
  }
  
  /**
   * إرسال Answer
   */
  sendAnswer(to: string, answer: RTCSessionDescriptionInit): void {
    this.send('answer', to, answer);
  }
  
  /**
   * إرسال ICE Candidate (مع rate limiting)
   */
  sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
    // التحقق من rate limiting
    if (!this.canSendIce(to)) {
      return;
    }
    
    // زيادة العداد
    const count = (this.iceCandidateCount.get(to) || 0) + 1;
    this.iceCandidateCount.set(to, count);
    
    // بدء مؤقت الإيقاف التلقائي
    this.startIceTimeout(to);
    this.send('ice-candidate', to, candidate);
  }
  
  // ============= Private Methods =============
  
  /**
   * إرسال رسالة Signaling
   */
  private send(
    type: SignalingType,
    to: string,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ): void {
    if (!this.channel || !this.isConnected) {
      console.warn('⚠️ [Signaling] Not connected, cannot send:', type);
      return;
    }
    
    const message: SignalingMessage = {
      type,
      from: this.peerId,
      to,
      payload,
      timestamp: Date.now(),
    };
    
    console.log('📤 [Signaling] Sending:', type, 'to:', to);
    
    this.channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: message,
    });
  }
  
  /**
   * معالجة رسائل Signaling الواردة
   */
  private handleSignalingMessage(message: SignalingMessage): void {
    // تجاهل الرسائل غير الموجهة لنا
    if (message.to !== this.peerId) {
      return;
    }
    
    console.log('📥 [Signaling] Received:', message.type, 'from:', message.from);
    
    switch (message.type) {
      case 'offer':
        this.handlers.onOffer?.(
          message.from,
          message.payload as RTCSessionDescriptionInit
        );
        break;
        
      case 'answer':
        this.handlers.onAnswer?.(
          message.from,
          message.payload as RTCSessionDescriptionInit
        );
        break;
        
      case 'ice-candidate':
        this.handlers.onIceCandidate?.(
          message.from,
          message.payload as RTCIceCandidateInit
        );
        break;
    }
  }
}

/**
 * إنشاء SignalingManager وبدء الاتصال
 */
export const createSignalingManager = async (
  config: SignalingManagerConfig
): Promise<SignalingManager> => {
  const manager = new SignalingManager(config);
  await manager.connect();
  return manager;
};
