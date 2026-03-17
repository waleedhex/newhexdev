/**
 * transport/BroadcastTransport.ts
 * تغليف Supabase Broadcast Channel كـ Transport
 * 
 * يدعم أيضاً Signaling و Peer Announcements على نفس القناة
 * لتقليل عدد الاشتراكات (قناة واحدة بدل ثلاث)
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  Transport,
  TransportType,
  TransportStatus,
  TransientEvent,
  TransientEventType,
  EventHandler,
  BroadcastTransportConfig,
  SignalingMessage,
  PeerAnnouncement,
} from './types';

export class BroadcastTransport implements Transport {
  readonly type: TransportType = 'broadcast';
  
  private _status: TransportStatus = 'disconnected';
  private channel: RealtimeChannel | null = null;
  private handlers: Set<EventHandler> = new Set();
  private typedHandlers: Map<TransientEventType, Set<EventHandler>> = new Map();
  private processedEvents: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private readonly config: BroadcastTransportConfig;
  private readonly channelName: string;
  
  constructor(config: BroadcastTransportConfig) {
    this.config = config;
    this.channelName = config.channelName || `game-events-${config.sessionCode.toLowerCase()}`;
  }
  
  get status(): TransportStatus {
    return this._status;
  }
  
  ready(): boolean {
    return this._status === 'connected';
  }
  
  send(event: TransientEvent): void {
    if (!this.channel) {
      console.warn('⚠️ [BroadcastTransport] Channel not ready');
      return;
    }
    
    this.processedEvents.add(event.event_id);
    
    this.channel.send({
      type: 'broadcast',
      event: 'game_event',
      payload: event,
    });
  }
  
  /**
   * إرسال رسالة Signaling عبر نفس القناة
   */
  sendSignaling(message: SignalingMessage): void {
    if (!this.channel || !this.ready()) {
      console.warn('⚠️ [BroadcastTransport] Cannot send signaling - not ready');
      return;
    }
    
    this.channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: message,
    });
  }
  
  /**
   * إرسال إعلان peer عبر نفس القناة
   */
  sendPeerAnnouncement(announcement: PeerAnnouncement): void {
    if (!this.channel || !this.ready()) {
      console.warn('⚠️ [BroadcastTransport] Cannot send peer announcement - not ready');
      return;
    }
    
    this.channel.send({
      type: 'broadcast',
      event: 'peer_announcement',
      payload: announcement,
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
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.handlers.clear();
    this.typedHandlers.clear();
    this.processedEvents.clear();
    this._status = 'disconnected';
  }
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.channel) {
        resolve();
        return;
      }
      
      console.log('🔌 [BroadcastTransport] Connecting to:', this.channelName);
      this._status = 'connecting';
      
      this.channel = supabase.channel(this.channelName, {
        config: {
          broadcast: { self: false },
        },
      });
      
      // 1️⃣ أحداث اللعبة العابرة
      this.channel.on('broadcast', { event: 'game_event' }, (payload) => {
        this.handleIncomingEvent(payload.payload as TransientEvent);
      });
      
      // 2️⃣ رسائل Signaling (مدمجة في نفس القناة)
      this.channel.on('broadcast', { event: 'signaling' }, (payload) => {
        this.config.onSignalingMessage?.(payload.payload as SignalingMessage);
      });
      
      // 3️⃣ إعلانات الأقران (مدمجة في نفس القناة)
      this.channel.on('broadcast', { event: 'peer_announcement' }, (payload) => {
        this.config.onPeerAnnouncement?.(payload.payload as PeerAnnouncement);
      });
      
      this.channel.subscribe((status) => {
        switch (status) {
          case 'SUBSCRIBED':
            this._status = 'connected';
            this.startCleanupInterval();
            resolve();
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            this._status = 'error';
            reject(new Error(`Channel ${status}`));
            break;
          case 'CLOSED':
            this._status = 'disconnected';
            break;
        }
      });
    });
  }
  
  private handleIncomingEvent(event: TransientEvent): void {
    if (this.processedEvents.has(event.event_id)) {
      return;
    }
    
    this.processedEvents.add(event.event_id);
    
    this.handlers.forEach(handler => {
      try { handler(event); } catch (err) { console.error('❌ [BroadcastTransport] Handler error:', err); }
    });
    
    const typeHandlers = this.typedHandlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try { handler(event); } catch (err) { console.error('❌ [BroadcastTransport] Typed handler error:', err); }
      });
    }
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

export const createBroadcastTransport = async (
  config: BroadcastTransportConfig
): Promise<BroadcastTransport> => {
  const transport = new BroadcastTransport(config);
  await transport.connect();
  return transport;
};
