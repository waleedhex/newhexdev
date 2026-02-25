import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// أنواع الأحداث اللحظية
export interface BuzzerEvent {
  type: 'buzzer_pressed';
  player: string;
  team: 'red' | 'green';
  timestamp: number;
}

export interface BuzzerTimeoutEvent {
  type: 'buzzer_timeout';
  timestamp: number;
}

export interface PartyModeEvent {
  type: 'party_mode';
  active: boolean;
  timestamp: number;
}

export interface GoldenCelebrationEvent {
  type: 'golden_celebration';
  timestamp: number;
}

export interface FlashEvent {
  type: 'flash';
  team: 'red' | 'green';
  timestamp: number;
}

export type BroadcastEvent = 
  | BuzzerEvent 
  | BuzzerTimeoutEvent 
  | PartyModeEvent 
  | GoldenCelebrationEvent
  | FlashEvent;

interface UseBroadcastProps {
  sessionCode: string;
  onBuzzerPressed?: (event: BuzzerEvent) => void;
  onBuzzerTimeout?: (event: BuzzerTimeoutEvent) => void;
  onPartyMode?: (event: PartyModeEvent) => void;
  onGoldenCelebration?: (event: GoldenCelebrationEvent) => void;
  onFlash?: (event: FlashEvent) => void;
}

export const useBroadcast = ({
  sessionCode,
  onBuzzerPressed,
  onBuzzerTimeout,
  onPartyMode,
  onGoldenCelebration,
  onFlash,
}: UseBroadcastProps) => {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // إرسال حدث عبر البث
  const broadcast = useCallback((event: BroadcastEvent) => {
    if (!channelRef.current) {
      console.warn('Broadcast channel not ready');
      return;
    }
    
    console.log('📡 Broadcasting event:', event.type, event);
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'game_event',
      payload: event,
    });
  }, []);

  // دوال مساعدة لإرسال أحداث محددة
  const sendBuzzerPressed = useCallback((player: string, team: 'red' | 'green') => {
    broadcast({
      type: 'buzzer_pressed',
      player,
      team,
      timestamp: Date.now(),
    });
  }, [broadcast]);

  const sendBuzzerTimeout = useCallback(() => {
    broadcast({
      type: 'buzzer_timeout',
      timestamp: Date.now(),
    });
  }, [broadcast]);

  const sendPartyMode = useCallback((active: boolean) => {
    broadcast({
      type: 'party_mode',
      active,
      timestamp: Date.now(),
    });
  }, [broadcast]);

  const sendGoldenCelebration = useCallback(() => {
    broadcast({
      type: 'golden_celebration',
      timestamp: Date.now(),
    });
  }, [broadcast]);

  const sendFlash = useCallback((team: 'red' | 'green') => {
    broadcast({
      type: 'flash',
      team,
      timestamp: Date.now(),
    });
  }, [broadcast]);

  // الاشتراك في قناة البث
  useEffect(() => {
    if (!sessionCode) return;

    const channelName = `game-broadcast-${sessionCode.toLowerCase()}`;
    console.log('📡 Subscribing to broadcast channel:', channelName);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: false, // لا نستقبل الأحداث التي نرسلها نحن
        },
      },
    });

    channel.on('broadcast', { event: 'game_event' }, (payload) => {
      const event = payload.payload as BroadcastEvent;
      console.log('📡 Received broadcast event:', event.type, event);

      switch (event.type) {
        case 'buzzer_pressed':
          onBuzzerPressed?.(event);
          break;
        case 'buzzer_timeout':
          onBuzzerTimeout?.(event);
          break;
        case 'party_mode':
          onPartyMode?.(event);
          break;
        case 'golden_celebration':
          onGoldenCelebration?.(event);
          break;
        case 'flash':
          onFlash?.(event);
          break;
      }
    });

    channel.subscribe((status) => {
      console.log('📡 Broadcast channel status:', status);
    });

    channelRef.current = channel;

    return () => {
      console.log('📡 Unsubscribing from broadcast channel');
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionCode, onBuzzerPressed, onBuzzerTimeout, onPartyMode, onGoldenCelebration, onFlash]);

  return {
    broadcast,
    sendBuzzerPressed,
    sendBuzzerTimeout,
    sendPartyMode,
    sendGoldenCelebration,
    sendFlash,
  };
};
