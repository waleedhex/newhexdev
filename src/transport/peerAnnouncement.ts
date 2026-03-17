/**
 * transport/peerAnnouncement.ts
 * نظام إعلان انضمام اللاعبين للـ Host
 * 
 * يدعم وضعين:
 * 1. مدمج: يستخدم sendFn خارجية (عبر BroadcastTransport) — بدون قناة منفصلة
 * 2. مستقل: ينشئ قناة خاصة (للتوافق القديم)
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PeerAnnouncement } from './types';

// إعادة تصدير النوع
export type { PeerAnnouncement } from './types';

export interface PeerAnnouncementHandlers {
  onPeerJoined?: (peerId: string, playerName?: string) => void;
  onPeerLeft?: (peerId: string) => void;
}

export class PeerAnnouncementManager {
  private channel: RealtimeChannel | null = null;
  private readonly sessionCode: string;
  private readonly channelName: string;
  private handlers: PeerAnnouncementHandlers = {};
  private isConnected = false;
  private readonly sendFn?: (announcement: PeerAnnouncement) => void;
  
  constructor(sessionCode: string, sendFn?: (announcement: PeerAnnouncement) => void) {
    this.sessionCode = sessionCode;
    this.channelName = `peer-announce-${sessionCode.toLowerCase()}`;
    this.sendFn = sendFn;
  }
  
  /**
   * بدء الاستماع (للـ Host)
   */
  async listen(handlers: PeerAnnouncementHandlers): Promise<void> {
    if (this.isConnected) return;
    
    this.handlers = handlers;
    
    // وضع مدمج: لا نحتاج قناة منفصلة
    if (this.sendFn) {
      console.log('📢 [PeerAnnouncement] Using integrated mode (no separate channel)');
      this.isConnected = true;
      return;
    }
    
    // وضع مستقل: قناة منفصلة
    console.log('📢 [PeerAnnouncement] Listening on:', this.channelName);
    
    return new Promise((resolve, reject) => {
      this.channel = supabase.channel(this.channelName, {
        config: { broadcast: { self: false } },
      });
      
      this.channel.on('broadcast', { event: 'peer_announcement' }, (payload) => {
        this.handleAnnouncement(payload.payload as PeerAnnouncement);
      });
      
      this.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Announcement channel ${status}`));
        }
      });
    });
  }
  
  /**
   * إرسال إعلان انضمام
   */
  async announceJoin(peerId: string, role: 'contestant' | 'display', playerName?: string): Promise<void> {
    const announcement: PeerAnnouncement = {
      type: 'peer_joined',
      peerId,
      role,
      playerName,
      timestamp: Date.now(),
    };
    
    console.log('📢 [PeerAnnouncement] Announcing join:', peerId);
    
    // وضع مدمج
    if (this.sendFn) {
      this.sendFn(announcement);
      return;
    }
    
    // وضع مستقل
    if (!this.channel) {
      this.channel = supabase.channel(this.channelName);
      await new Promise<void>((resolve) => {
        this.channel!.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve();
        });
      });
    }
    
    this.channel.send({
      type: 'broadcast',
      event: 'peer_announcement',
      payload: announcement,
    });
  }
  
  /**
   * إرسال إعلان مغادرة
   */
  announceLeave(peerId: string, role: 'contestant' | 'display'): void {
    const announcement: PeerAnnouncement = {
      type: 'peer_joined',
      peerId,
      role,
      timestamp: Date.now(),
    };
    // Fix: type should be 'peer_left'
    announcement.type = 'peer_left';
    
    console.log('📢 [PeerAnnouncement] Announcing leave:', peerId);
    
    if (this.sendFn) {
      this.sendFn(announcement);
      return;
    }
    
    if (!this.channel) return;
    
    this.channel.send({
      type: 'broadcast',
      event: 'peer_announcement',
      payload: announcement,
    });
  }
  
  /**
   * معالجة إعلان وارد (يُستدعى من الخارج في الوضع المدمج)
   */
  handleIncomingAnnouncement(announcement: PeerAnnouncement): void {
    this.handleAnnouncement(announcement);
  }
  
  private handleAnnouncement(announcement: PeerAnnouncement): void {
    switch (announcement.type) {
      case 'peer_joined':
        this.handlers.onPeerJoined?.(announcement.peerId, announcement.playerName);
        break;
      case 'peer_left':
        this.handlers.onPeerLeft?.(announcement.peerId);
        break;
    }
  }
  
  disconnect(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.isConnected = false;
  }
}

export const createHostAnnouncementListener = async (
  sessionCode: string,
  handlers: PeerAnnouncementHandlers
): Promise<PeerAnnouncementManager> => {
  const manager = new PeerAnnouncementManager(sessionCode);
  await manager.listen(handlers);
  return manager;
};
