/**
 * transport/signaling.ts
 * إدارة Signaling لـ WebRTC
 * 
 * يدعم وضعين:
 * 1. مدمج: يستخدم sendFn خارجية (عبر BroadcastTransport) — بدون قناة منفصلة
 * 2. مستقل: ينشئ قناة خاصة (للتوافق القديم)
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SignalingMessage, SignalingType } from './types';
import { SIGNALING_TIMEOUT } from './rtcConfig';

// ============= أنواع =============

export interface SignalingHandlers {
  onOffer?: (from: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (from: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (from: string, candidate: RTCIceCandidateInit) => void;
}

export interface SignalingManagerConfig {
  sessionCode: string;
  peerId: string;
  handlers: SignalingHandlers;
  /** دالة إرسال خارجية (وضع مدمج - بدون قناة منفصلة) */
  sendFn?: (msg: SignalingMessage) => void;
}

// ============= ICE Rate Limiting =============

const MAX_ICE_CANDIDATES_PER_PEER = 10;
const ICE_GATHERING_TIMEOUT = 5000;

// ============= Signaling Manager =============

export class SignalingManager {
  private channel: RealtimeChannel | null = null;
  private readonly peerId: string;
  private readonly channelName: string;
  private handlers: SignalingHandlers;
  private isConnected = false;
  private readonly sendFn?: (msg: SignalingMessage) => void;
  
  // ICE Rate Limiting
  private iceCandidateCount: Map<string, number> = new Map();
  private iceStoppedForPeer: Set<string> = new Set();
  private iceTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  
  constructor(config: SignalingManagerConfig) {
    this.peerId = config.peerId;
    this.channelName = `signaling-${config.sessionCode.toLowerCase()}`;
    this.handlers = config.handlers;
    this.sendFn = config.sendFn;
  }
  
  /**
   * بدء الاستماع
   * في الوضع المدمج: لا حاجة لقناة منفصلة
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;
    
    // وضع مدمج: لا نحتاج قناة منفصلة
    if (this.sendFn) {
      console.log('🔗 [Signaling] Using integrated mode (no separate channel)');
      this.isConnected = true;
      return;
    }
    
    // وضع مستقل: قناة منفصلة (fallback)
    console.log('🔗 [Signaling] Connecting to:', this.channelName);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Signaling connection timeout'));
      }, SIGNALING_TIMEOUT);
      
      this.channel = supabase.channel(this.channelName, {
        config: { broadcast: { self: false } },
      });
      
      this.channel.on('broadcast', { event: 'signaling' }, (payload) => {
        this.handleSignalingMessage(payload.payload as SignalingMessage);
      });
      
      this.channel.subscribe((status) => {
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
  
  disconnect(): void {
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
  
  /**
   * معالجة رسالة Signaling واردة (يُستدعى من الخارج في الوضع المدمج)
   */
  handleIncomingMessage(message: SignalingMessage): void {
    this.handleSignalingMessage(message);
  }
  
  // ============= ICE Rate Limiting =============
  
  stopIceForPeer(peerId: string): void {
    this.iceStoppedForPeer.add(peerId);
    const timeout = this.iceTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.iceTimeouts.delete(peerId);
    }
  }
  
  resetIceForPeer(peerId: string): void {
    this.iceStoppedForPeer.delete(peerId);
    this.iceCandidateCount.delete(peerId);
    const timeout = this.iceTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.iceTimeouts.delete(peerId);
    }
  }
  
  private canSendIce(to: string): boolean {
    if (this.iceStoppedForPeer.has(to)) return false;
    const count = this.iceCandidateCount.get(to) || 0;
    if (count >= MAX_ICE_CANDIDATES_PER_PEER) return false;
    return true;
  }
  
  private startIceTimeout(peerId: string): void {
    if (this.iceTimeouts.has(peerId)) return;
    const timeout = setTimeout(() => {
      this.stopIceForPeer(peerId);
    }, ICE_GATHERING_TIMEOUT);
    this.iceTimeouts.set(peerId, timeout);
  }
  
  // ============= Sending =============
  
  sendOffer(to: string, offer: RTCSessionDescriptionInit): void {
    this.sendMessage('offer', to, offer);
  }
  
  sendAnswer(to: string, answer: RTCSessionDescriptionInit): void {
    this.sendMessage('answer', to, answer);
  }
  
  sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
    if (!this.canSendIce(to)) return;
    const count = (this.iceCandidateCount.get(to) || 0) + 1;
    this.iceCandidateCount.set(to, count);
    this.startIceTimeout(to);
    this.sendMessage('ice-candidate', to, candidate);
  }
  
  // ============= Private =============
  
  private sendMessage(
    type: SignalingType,
    to: string,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ): void {
    if (!this.isConnected) {
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
    
    // وضع مدمج: إرسال عبر الدالة الخارجية
    if (this.sendFn) {
      this.sendFn(message);
      return;
    }
    
    // وضع مستقل: إرسال عبر القناة
    if (!this.channel) return;
    
    this.channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: message,
    });
  }
  
  private handleSignalingMessage(message: SignalingMessage): void {
    if (message.to !== this.peerId) return;
    
    switch (message.type) {
      case 'offer':
        this.handlers.onOffer?.(message.from, message.payload as RTCSessionDescriptionInit);
        break;
      case 'answer':
        this.handlers.onAnswer?.(message.from, message.payload as RTCSessionDescriptionInit);
        break;
      case 'ice-candidate':
        this.handlers.onIceCandidate?.(message.from, message.payload as RTCIceCandidateInit);
        break;
    }
  }
}

export const createSignalingManager = async (
  config: SignalingManagerConfig
): Promise<SignalingManager> => {
  const manager = new SignalingManager(config);
  await manager.connect();
  return manager;
};
