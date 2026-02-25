/**
 * useContestantChannel.ts
 * قناة موحدة للمتسابق - مُحدّث لاستخدام HybridTransport
 * 
 * الواجهة الخارجية لم تتغير - التوافق الكامل محفوظ
 * يجمع بين:
 * - HybridTransport للأحداث العابرة (buzzer, party, golden)
 * - Supabase Realtime للتحديثات الدائمة (buzzer state, team, kick)
 * 
 * ✅ DEDUPLICATION: يتم تلقائياً في طبقة HybridTransport
 * ✅ TRANSIENT GUARD: assertTransient يمنع إرسال DB-state
 * ✅ ICE RATE LIMITING: تلقائي في SignalingManager
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Json } from '@/integrations/supabase/types';
import { KICK_CHECK_INTERVAL } from '@/config/connectionConstants';
import { useTransport } from './useTransport';
import type {
  BuzzerPressedEvent,
  BuzzerTimeoutEvent,
  PartyModeEvent,
  GoldenCelebrationEvent,
  FlashEvent,
} from '@/transport';

// ============= إعادة تصدير الأنواع للتوافق =============
export type { 
  BuzzerPressedEvent, 
  BuzzerTimeoutEvent, 
  PartyModeEvent, 
  GoldenCelebrationEvent,
  FlashEvent,
} from '@/transport';

export type GameEvent = BuzzerPressedEvent | BuzzerTimeoutEvent | PartyModeEvent | GoldenCelebrationEvent | FlashEvent;

export interface BuzzerData {
  active: boolean;
  player: string;
  team: 'red' | 'green' | null;
  timestamp?: number;
  isTimeOut?: boolean;
}

// ============= Props (نفس الواجهة القديمة) =============

export interface UseContestantChannelProps {
  sessionCode: string;
  sessionId: string | null;
  playerId: string | null;
  playerName: string;
  // معالجات الأحداث
  onBuzzerPressed?: (event: BuzzerPressedEvent) => void;
  onBuzzerTimeout?: (event: BuzzerTimeoutEvent) => void;
  onPartyMode?: (event: PartyModeEvent) => void;
  onGoldenCelebration?: (event: GoldenCelebrationEvent) => void;
  onFlash?: (event: FlashEvent) => void;
  onBuzzerChange?: (buzzer: BuzzerData) => void;
  onTeamChange?: (team: 'red' | 'green') => void;
  onKicked?: () => void;
}

// ============= Helper Functions =============

const parseBuzzer = (data: Json | null): BuzzerData => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { active: false, player: '', team: null };
  }
  const obj = data as Record<string, unknown>;
  return {
    active: Boolean(obj.active),
    player: String(obj.player || ''),
    team: (obj.team === 'red' || obj.team === 'green') ? obj.team : null,
    timestamp: obj.timestamp as number | undefined,
    isTimeOut: Boolean(obj.isTimeOut),
  };
};

// ============= Hook الرئيسي =============

export const useContestantChannel = ({
  sessionCode,
  sessionId,
  playerId,
  playerName,
  onBuzzerPressed,
  onBuzzerTimeout,
  onPartyMode,
  onGoldenCelebration,
  onFlash,
  onBuzzerChange,
  onTeamChange,
  onKicked,
}: UseContestantChannelProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const dbChannelRef = useRef<RealtimeChannel | null>(null);
  const kickCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ====== استخدام useTransport للأحداث العابرة ======
  const {
    isConnected: transportConnected,
    sendBuzzerPressed: transportSendBuzzerPressed,
    sendBuzzerTimeout: transportSendBuzzerTimeout,
    stats,
  } = useTransport({
    sessionCode,
    role: 'contestant',
    playerId: playerId || undefined,
    playerName,
    onBuzzerPressed,
    onBuzzerTimeout,
    onPartyMode,
    onGoldenCelebration,
    onFlash,
  });

  // ====== دوال إرسال (نفس التوقيع القديم) ======
  
  const sendBuzzerPressed = useCallback((team: 'red' | 'green') => {
    transportSendBuzzerPressed(playerName, team);
  }, [playerName, transportSendBuzzerPressed]);

  const sendBuzzerTimeout = useCallback(() => {
    transportSendBuzzerTimeout();
  }, [transportSendBuzzerTimeout]);

  // ====== Polling للتحقق من الطرد (backup) ======
  useEffect(() => {
    if (!playerId) return;

    const checkIfKicked = async () => {
      const { data, error } = await supabase
        .from('session_players')
        .select('id')
        .eq('id', playerId)
        .maybeSingle();

      if (error || !data) {
        console.log('🚫 Player kicked (polling check)');
        onKicked?.();
      }
    };

    kickCheckIntervalRef.current = setInterval(checkIfKicked, KICK_CHECK_INTERVAL);

    return () => {
      if (kickCheckIntervalRef.current) {
        clearInterval(kickCheckIntervalRef.current);
      }
    };
  }, [playerId, onKicked]);

  // ====== قناة DB للتحديثات الدائمة (buzzer state, team, kick) ======
  useEffect(() => {
    if (!sessionCode || !sessionId) return;

    // تنظيف القناة السابقة
    if (dbChannelRef.current) {
      supabase.removeChannel(dbChannelRef.current);
      dbChannelRef.current = null;
    }

    const channelName = `db-updates-${sessionCode.toLowerCase()}`;
    console.log('📡 [ContestantChannel] Subscribing to DB updates:', channelName);

    const channel = supabase.channel(channelName);

    // 1️⃣ تحديثات game_sessions (buzzer state)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
      },
      (payload) => {
        const newData = payload.new as Record<string, unknown>;
        if (String(newData.session_code).toLowerCase() === sessionCode.toLowerCase()) {
          const buzzer = parseBuzzer(newData.buzzer as Json);
          onBuzzerChange?.(buzzer);
        }
      }
    );

    // 2️⃣ تحديثات session_players (تغيير الفريق + الطرد)
    if (playerId) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_players',
          filter: `id=eq.${playerId}`,
        },
        (payload) => {
          const newData = payload.new as Record<string, unknown>;
          if (newData.team === 'red' || newData.team === 'green') {
            onTeamChange?.(newData.team);
          }
        }
      );

      channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'session_players',
          filter: `id=eq.${playerId}`,
        },
        () => {
          console.log('🚫 Player kicked (realtime)');
          onKicked?.();
        }
      );
    }

    // بدء الاشتراك
    channel.subscribe((status) => {
      console.log('📡 [ContestantChannel] DB channel status:', status);
    });

    dbChannelRef.current = channel;

    return () => {
      if (dbChannelRef.current) {
        supabase.removeChannel(dbChannelRef.current);
        dbChannelRef.current = null;
      }
    };
  }, [sessionCode, sessionId, playerId, onBuzzerChange, onTeamChange, onKicked]);

  // ====== حالة الاتصال الموحدة ======
  useEffect(() => {
    setIsConnected(transportConnected);
  }, [transportConnected]);

  return {
    isConnected,
    sendBuzzerPressed,
    sendBuzzerTimeout,
    // إضافات جديدة (اختيارية)
    transportStats: stats,
  };
};

export default useContestantChannel;
