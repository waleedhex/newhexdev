/**
 * transport/BroadcastTransport.ts
 * تغليف Supabase Broadcast Channel كـ Transport
 * 
 * هذا هو النقل الافتراضي والـ fallback
 * يستخدم نفس قناة game-events الحالية
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
} from './types';

export class BroadcastTransport implements Transport {
  readonly type: TransportType = 'broadcast';
  
  private _status: TransportStatus = 'disconnected';
  private channel: RealtimeChannel | null = null;
  private handlers: Set<EventHandler> = new Set();
  private typedHandlers: Map<TransientEventType, Set<EventHandler>> = new Map();
  private processedEvents: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private readonly sessionCode: string;
  private readonly channelName: string;
  
  constructor(config: BroadcastTransportConfig) {
    this.sessionCode = config.sessionCode;
    this.channelName = config.channelName || `game-events-${config.sessionCode.toLowerCase()}`;
  }
  
  // ============= Getters =============
  
  get status(): TransportStatus {
    return this._status;
  }
  
  // ============= Transport Interface =============
  
  ready(): boolean {
    return this._status === 'connected';
  }
  
  send(event: TransientEvent): void {
    if (!this.channel) {
      console.warn('⚠️ [BroadcastTransport] Channel not ready');
      return;
    }
    
    // أضف الحدث للأحداث المعالجة (لتجنب معالجته عند استلامه)
    this.processedEvents.add(event.event_id);
    
    console.log('📡 [BroadcastTransport] Sending:', event.type, event.event_id);
    
    this.channel.send({
      type: 'broadcast',
      event: 'game_event',
      payload: event,
    });
  }
  
  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    
    return () => {
      this.handlers.delete(handler);
    };
  }
  
  on<T extends TransientEventType>(
    type: T,
    handler: EventHandler<Extract<TransientEvent, { type: T }>>
  ): () => void {
    if (!this.typedHandlers.has(type)) {
      this.typedHandlers.set(type, new Set());
    }
    
    this.typedHandlers.get(type)!.add(handler as EventHandler);
    
    return () => {
      this.typedHandlers.get(type)?.delete(handler as EventHandler);
    };
  }
  
  disconnect(): void {
    console.log('🔌 [BroadcastTransport] Disconnecting');
    
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
  
  // ============= Connection Management =============
  
  /**
   * الاتصال بالقناة
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.channel) {
        console.log('⚠️ [BroadcastTransport] Already connected');
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
      
      // الاشتراك في أحداث اللعبة
      this.channel.on('broadcast', { event: 'game_event' }, (payload) => {
        this.handleIncomingEvent(payload.payload as TransientEvent);
      });
      
      // بدء الاشتراك
      this.channel.subscribe((status) => {
        console.log('📡 [BroadcastTransport] Status:', status);
        
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
  
  // ============= Private Methods =============
  
  /**
   * معالجة الأحداث الواردة
   */
  private handleIncomingEvent(event: TransientEvent): void {
    // تجاهل الأحداث المعالجة مسبقاً
    if (this.processedEvents.has(event.event_id)) {
      console.log('⏭️ [BroadcastTransport] Skipping duplicate:', event.type, event.event_id);
      return;
    }
    
    // تسجيل الحدث كمُعالج
    this.processedEvents.add(event.event_id);
    
    console.log('📥 [BroadcastTransport] Received:', event.type, event.event_id);
    
    // إشعار المعالجات العامة
    this.handlers.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error('❌ [BroadcastTransport] Handler error:', err);
      }
    });
    
    // إشعار المعالجات المحددة بالنوع
    const typeHandlers = this.typedHandlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (err) {
          console.error('❌ [BroadcastTransport] Typed handler error:', err);
        }
      });
    }
  }
  
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
    }, 10000); // كل 10 ثواني
  }
}

/**
 * إنشاء BroadcastTransport وبدء الاتصال
 */
export const createBroadcastTransport = async (
  config: BroadcastTransportConfig
): Promise<BroadcastTransport> => {
  const transport = new BroadcastTransport(config);
  await transport.connect();
  return transport;
};
