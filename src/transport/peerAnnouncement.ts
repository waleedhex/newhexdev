/**
 * transport/peerAnnouncement.ts
 * نظام إعلان انضمام اللاعبين للـ Host
 * 
 * عندما ينضم متسابق جديد، يُرسل إعلان عبر Broadcast
 * Host يستقبل الإعلان ويُنشئ اتصال RTC مع المتسابق
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============= أنواع =============

export interface PeerAnnouncement {
  type: 'peer_joined' | 'peer_left';
  peerId: string;
  role: 'contestant' | 'display';
  playerName?: string;
  timestamp: number;
}

export interface PeerAnnouncementHandlers {
  onPeerJoined?: (peerId: string, playerName?: string) => void;
  onPeerLeft?: (peerId: string) => void;
}

// ============= PeerAnnouncementManager =============

export class PeerAnnouncementManager {
  private channel: RealtimeChannel | null = null;
  private readonly sessionCode: string;
  private readonly channelName: string;
  private handlers: PeerAnnouncementHandlers = {};
  private isConnected = false;
  
  constructor(sessionCode: string) {
    this.sessionCode = sessionCode;
    this.channelName = `peer-announce-${sessionCode.toLowerCase()}`;
  }
  
  /**
   * بدء الاستماع (للـ Host)
   */
  async listen(handlers: PeerAnnouncementHandlers): Promise<void> {
    if (this.isConnected) return;
    
    this.handlers = handlers;
    
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
   * إرسال إعلان انضمام (للمتسابق/الشاشة)
   */
  async announceJoin(peerId: string, role: 'contestant' | 'display', playerName?: string): Promise<void> {
    if (!this.channel) {
      // إنشاء قناة مؤقتة للإرسال
      this.channel = supabase.channel(this.channelName);
      await new Promise<void>((resolve) => {
        this.channel!.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve();
        });
      });
    }
    
    const announcement: PeerAnnouncement = {
      type: 'peer_joined',
      peerId,
      role,
      playerName,
      timestamp: Date.now(),
    };
    
    console.log('📢 [PeerAnnouncement] Announcing join:', peerId);
    
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
    if (!this.channel) return;
    
    const announcement: PeerAnnouncement = {
      type: 'peer_left',
      peerId,
      role,
      timestamp: Date.now(),
    };
    
    console.log('📢 [PeerAnnouncement] Announcing leave:', peerId);
    
    this.channel.send({
      type: 'broadcast',
      event: 'peer_announcement',
      payload: announcement,
    });
  }
  
  /**
   * معالجة الإعلانات الواردة
   */
  private handleAnnouncement(announcement: PeerAnnouncement): void {
    console.log('📢 [PeerAnnouncement] Received:', announcement.type, announcement.peerId);
    
    switch (announcement.type) {
      case 'peer_joined':
        this.handlers.onPeerJoined?.(announcement.peerId, announcement.playerName);
        break;
      case 'peer_left':
        this.handlers.onPeerLeft?.(announcement.peerId);
        break;
    }
  }
  
  /**
   * إغلاق القناة
   */
  disconnect(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.isConnected = false;
  }
}

/**
 * إنشاء مدير إعلانات للـ Host
 */
export const createHostAnnouncementListener = async (
  sessionCode: string,
  handlers: PeerAnnouncementHandlers
): Promise<PeerAnnouncementManager> => {
  const manager = new PeerAnnouncementManager(sessionCode);
  await manager.listen(handlers);
  return manager;
};
