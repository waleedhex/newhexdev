/**
 * hooks/useGameEvents.ts
 * Hook للأحداث العابرة - مُحدّث لاستخدام HybridTransport
 * 
 * الواجهة الخارجية لم تتغير - التوافق الكامل محفوظ
 * التغيير الداخلي: استخدام HybridTransport بدلاً من Supabase مباشرة
 * 
 * ✅ DEDUPLICATION: يتم تلقائياً في طبقة HybridTransport
 * ✅ TRANSIENT GUARD: assertTransient يمنع إرسال DB-state
 * ✅ ICE RATE LIMITING: تلقائي في SignalingManager
 */

import { useCallback } from 'react';
import { useTransport } from './useTransport';
import type {
  BuzzerPressedEvent,
  BuzzerTimeoutEvent,
  BuzzerResetEvent,
  PartyModeEvent,
  GoldenCelebrationEvent,
  FlashEvent,
} from '@/transport';

// ====== إعادة تصدير الأنواع للتوافق ======
export type { 
  BuzzerPressedEvent,
  BuzzerTimeoutEvent,
  BuzzerResetEvent,
  PartyModeEvent,
  GoldenCelebrationEvent,
  FlashEvent,
} from '@/transport';

// نوع موحد للأحداث (للتوافق مع الكود القديم)
export interface GameEvent {
  event_id: string;
  timestamp: number;
}

export type BroadcastGameEvent = 
  | BuzzerPressedEvent 
  | BuzzerTimeoutEvent 
  | BuzzerResetEvent
  | PartyModeEvent 
  | GoldenCelebrationEvent
  | FlashEvent;

// ====== Props (نفس الواجهة القديمة) ======
interface UseGameEventsProps {
  sessionCode: string;
  onBuzzerPressed?: (event: BuzzerPressedEvent) => void;
  onBuzzerTimeout?: (event: BuzzerTimeoutEvent) => void;
  onBuzzerReset?: (event: BuzzerResetEvent) => void;
  onPartyMode?: (event: PartyModeEvent) => void;
  onGoldenCelebration?: (event: GoldenCelebrationEvent) => void;
  onFlash?: (event: FlashEvent) => void;
}

// ====== توليد معرف فريد (للتوافق) ======
export const generateEventId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// ====== Hook الرئيسي ======
export const useGameEvents = ({
  sessionCode,
  onBuzzerPressed,
  onBuzzerTimeout,
  onBuzzerReset,
  onPartyMode,
  onGoldenCelebration,
  onFlash,
}: UseGameEventsProps) => {
  
  // استخدام useTransport داخلياً (Host role)
  const {
    isConnected,
    sendBuzzerPressed: transportSendBuzzerPressed,
    sendBuzzerTimeout: transportSendBuzzerTimeout,
    sendBuzzerReset: transportSendBuzzerReset,
    sendPartyMode: transportSendPartyMode,
    sendGoldenCelebration: transportSendGoldenCelebration,
    sendFlash: transportSendFlash,
    connectToPeer,
    stats,
  } = useTransport({
    sessionCode,
    role: 'host',
    onBuzzerPressed,
    onBuzzerTimeout,
    onBuzzerReset,
    onPartyMode,
    onGoldenCelebration,
    onFlash,
  });

  // ====== دوال الإرسال (نفس التوقيع القديم) ======
  
  const sendBuzzerPressed = useCallback((player: string, team: 'red' | 'green') => {
    transportSendBuzzerPressed(player, team);
  }, [transportSendBuzzerPressed]);

  const sendBuzzerTimeout = useCallback(() => {
    transportSendBuzzerTimeout();
  }, [transportSendBuzzerTimeout]);

  const sendBuzzerReset = useCallback(() => {
    transportSendBuzzerReset();
  }, [transportSendBuzzerReset]);

  const sendPartyMode = useCallback((
    active: boolean, 
    winningTeam: 'red' | 'green', 
    winningPath: [number, number][]
  ) => {
    transportSendPartyMode(active, winningTeam, winningPath);
  }, [transportSendPartyMode]);

  const sendGoldenCelebration = useCallback((letter: string) => {
    transportSendGoldenCelebration(letter);
  }, [transportSendGoldenCelebration]);

  const sendFlash = useCallback((team: 'red' | 'green') => {
    transportSendFlash(team);
  }, [transportSendFlash]);

  // ====== Return (نفس الواجهة القديمة + إضافات اختيارية) ======
  return {
    isConnected,
    sendBuzzerPressed,
    sendBuzzerTimeout,
    sendBuzzerReset,
    sendPartyMode,
    sendGoldenCelebration,
    sendFlash,
    // إضافات جديدة (اختيارية - لا تكسر التوافق)
    connectToPeer,
    transportStats: stats,
  };
};
