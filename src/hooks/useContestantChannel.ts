/**
 * useContestantChannel.ts
 * قناة موحدة للمتسابق — مُحدّث
 * 
 * ✅ التحسينات:
 * - إزالة اشتراك postgres_changes (يمنع إرسال hexagons الضخم للمتسابقين)
 * - استبدال بـ Smart Polling كل 10 ثوانٍ لعمود buzzer + team فقط
 * - جلب أولي للحالة عند الانضمام (Smart Reconnect Sync)
 * - Polling موحد: buzzer + team + kick في استعلام واحد
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

// ============= إعادة تصدير الأنواع =============
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

export interface UseContestantChannelProps {
  sessionCode: string;
  sessionId: string | null;
  playerId: string | null;
  playerName: string;
  onBuzzerPressed?: (event: BuzzerPressedEvent) => void;
  onBuzzerTimeout?: (event: BuzzerTimeoutEvent) => void;
  onPartyMode?: (event: PartyModeEvent) => void;
  onGoldenCelebration?: (event: GoldenCelebrationEvent) => void;
  onFlash?: (event: FlashEvent) => void;
  onBuzzerChange?: (buzzer: BuzzerData) => void;
  onTeamChange?: (team: 'red' | 'green') => void;
  onKicked?: () => void;
}

// ============= Helper =============

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

// ============= Hook =============

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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTeamRef = useRef<string | null>(null);
  const lastBuzzerRef = useRef<string>('');

  // ====== useTransport للأحداث العابرة ======
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

  // ====== دوال الإرسال ======
  
  const sendBuzzerPressed = useCallback((team: 'red' | 'green') => {
    transportSendBuzzerPressed(playerName, team);
  }, [playerName, transportSendBuzzerPressed]);

  const sendBuzzerTimeout = useCallback(() => {
    transportSendBuzzerTimeout();
  }, [transportSendBuzzerTimeout]);

  // ====== Smart Reconnect Sync: جلب أولي للحالة ======
  useEffect(() => {
    if (!sessionId || !playerId) return;

    const fetchInitialState = async () => {
      // جلب buzzer فقط (ليس hexagons!)
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('buzzer')
        .eq('id', sessionId)
        .single();

      if (sessionData) {
        const buzzer = parseBuzzer(sessionData.buzzer);
        lastBuzzerRef.current = JSON.stringify(buzzer);
        onBuzzerChange?.(buzzer);
      }

      // جلب team الحالي
      const { data: playerData } = await supabase
        .from('session_players')
        .select('team')
        .eq('id', playerId)
        .single();

      if (playerData?.team) {
        lastTeamRef.current = playerData.team;
        if (playerData.team === 'red' || playerData.team === 'green') {
          onTeamChange?.(playerData.team);
        }
      }
    };

    fetchInitialState();
  }, [sessionId, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ====== Smart Polling: buzzer + team + kick في استعلام واحد ======
  useEffect(() => {
    if (!playerId || !sessionId) return;

    const pollStatus = async () => {
      // 1️⃣ التحقق من وجود اللاعب + فريقه (kick + team change)
      const { data: playerData, error: playerError } = await supabase
        .from('session_players')
        .select('id, team')
        .eq('id', playerId)
        .maybeSingle();

      if (playerError || !playerData) {
        console.log('🚫 Player kicked (polling check)');
        onKicked?.();
        return;
      }

      // team change detection
      if (playerData.team && playerData.team !== lastTeamRef.current) {
        lastTeamRef.current = playerData.team;
        if (playerData.team === 'red' || playerData.team === 'green') {
          onTeamChange?.(playerData.team);
        }
      }

      // 2️⃣ جلب buzzer فقط (ليس hexagons!)
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('buzzer')
        .eq('id', sessionId)
        .single();

      if (sessionData) {
        const buzzer = parseBuzzer(sessionData.buzzer);
        const buzzerKey = JSON.stringify(buzzer);

        // إرسال التحديث فقط إذا تغيرت الحالة
        if (buzzerKey !== lastBuzzerRef.current) {
          lastBuzzerRef.current = buzzerKey;
          onBuzzerChange?.(buzzer);
        }
      }
    };

    pollIntervalRef.current = setInterval(pollStatus, KICK_CHECK_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [playerId, sessionId, onKicked, onTeamChange, onBuzzerChange]);

  // ====== حالة الاتصال ======
  useEffect(() => {
    setIsConnected(transportConnected);
  }, [transportConnected]);

  return {
    isConnected,
    sendBuzzerPressed,
    sendBuzzerTimeout,
    transportStats: stats,
  };
};

export default useContestantChannel;
