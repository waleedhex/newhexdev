/**
 * useRoomSubscription.ts
 * Hook موحد للاشتراك في تحديثات الغرفة في الوقت الفعلي
 * 
 * الفوائد:
 * - توحيد منطق الاشتراك في مكان واحد
 * - إدارة مركزية للقنوات
 * - تنظيف تلقائي عند إلغاء التثبيت
 * - دعم تحديثات قاعدة البيانات والبث اللحظي
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============= أنواع البيانات =============

export type SubscriptionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface DatabaseChangePayload<T = Record<string, unknown>> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T | null;
}

export interface UseRoomSubscriptionProps {
  sessionCode: string;
  /** معالج تحديثات قاعدة البيانات */
  onDatabaseChange?: (payload: DatabaseChangePayload) => void;
  /** معالج أحداث البث اللحظي */
  onBroadcast?: (eventName: string, payload: unknown) => void;
  /** تفعيل/تعطيل الاشتراك */
  enabled?: boolean;
}

export interface RoomSubscriptionReturn {
  /** حالة الاتصال */
  status: SubscriptionStatus;
  /** هل الاتصال نشط */
  isConnected: boolean;
  /** إرسال حدث بث */
  broadcast: (eventName: string, payload: unknown) => void;
  /** إعادة الاتصال يدويًا */
  reconnect: () => void;
}

// ============= Hook الرئيسي =============

export const useRoomSubscription = ({
  sessionCode,
  onDatabaseChange,
  onBroadcast,
  enabled = true,
}: UseRoomSubscriptionProps): RoomSubscriptionReturn => {
  const [status, setStatus] = useState<SubscriptionStatus>('disconnected');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تنظيف القناة
  const cleanupChannel = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (channelRef.current) {
      console.log('🔌 Cleaning up subscription channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // إرسال حدث بث
  const broadcast = useCallback((eventName: string, payload: unknown) => {
    if (!channelRef.current) {
      console.warn('⚠️ Cannot broadcast - channel not ready');
      return;
    }

    console.log('📡 Broadcasting:', eventName);
    channelRef.current.send({
      type: 'broadcast',
      event: eventName,
      payload,
    });
  }, []);

  // إعادة الاتصال
  const reconnect = useCallback(() => {
    cleanupChannel();
    setStatus('connecting');
  }, [cleanupChannel]);

  // الاشتراك في القناة
  useEffect(() => {
    if (!sessionCode || !enabled) {
      cleanupChannel();
      setStatus('disconnected');
      return;
    }

    const channelName = `room-subscription-${sessionCode.toLowerCase()}`;
    console.log('🔌 Subscribing to channel:', channelName);
    setStatus('connecting');

    // إنشاء القناة
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    // الاشتراك في تحديثات game_sessions مع فلتر مباشر لتقليل حركة الشبكة
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `session_code=eq.${sessionCode.toUpperCase()}`,
      },
      (payload) => {
        console.log('📥 Database change: game_sessions', payload.eventType);
        onDatabaseChange?.({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown> | null,
        });
      }
    );

    // الاشتراك في أحداث البث
    channel.on('broadcast', { event: 'room_event' }, (payload) => {
      console.log('📡 Received broadcast:', payload.event);
      onBroadcast?.(payload.event, payload.payload);
    });

    // بدء الاشتراك
    channel.subscribe((channelStatus) => {
      console.log('🔌 Channel status:', channelStatus);
      
      switch (channelStatus) {
        case 'SUBSCRIBED':
          setStatus('connected');
          break;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          setStatus('error');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            reconnect();
          }, 5000);
          break;
        case 'CLOSED':
          setStatus('disconnected');
          break;
      }
    });

    channelRef.current = channel;

    return () => {
      cleanupChannel();
    };
  }, [sessionCode, enabled, onDatabaseChange, onBroadcast, cleanupChannel, reconnect]);

  return {
    status,
    isConnected: status === 'connected',
    broadcast,
    reconnect,
  };
};

// ============= Hooks مساعدة =============

/**
 * Hook مبسط للاشتراك في تحديثات game_sessions فقط
 */
export const useGameSessionSubscription = ({
  sessionCode,
  onUpdate,
  enabled = true,
}: {
  sessionCode: string;
  onUpdate: (data: Record<string, unknown>) => void;
  enabled?: boolean;
}) => {
  const handleDatabaseChange = useCallback(
    (payload: DatabaseChangePayload) => {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        onUpdate(payload.new);
      }
    },
    [onUpdate]
  );

  return useRoomSubscription({
    sessionCode,
    onDatabaseChange: handleDatabaseChange,
    enabled,
  });
};

/**
 * Hook للاشتراك في أحداث البث فقط (بدون قاعدة البيانات)
 */
export const useBroadcastSubscription = ({
  sessionCode,
  onEvent,
  enabled = true,
}: {
  sessionCode: string;
  onEvent: (eventName: string, payload: unknown) => void;
  enabled?: boolean;
}) => {
  return useRoomSubscription({
    sessionCode,
    onBroadcast: onEvent,
    enabled,
  });
};

export default useRoomSubscription;
