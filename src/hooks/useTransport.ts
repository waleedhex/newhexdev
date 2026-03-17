/**
 * hooks/useTransport.ts
 * Hook موحد لإدارة النقل الهجين
 * 
 * ✅ مُحدّث:
 * - statsInterval رُفع إلى 15 ثانية
 * - Peer Announcements مدمجة في HybridTransport (بدون PeerAnnouncementManager منفصل)
 * - Signaling مدمج في نفس قناة game-events
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  HybridTransport,
  createHybridTransport,
  TransientEvent,
  BuzzerPressedEvent,
  BuzzerTimeoutEvent,
  BuzzerResetEvent,
  PartyModeEvent,
  GoldenCelebrationEvent,
  FlashEvent,
  createEvent,
} from '@/transport';

// ============= أنواع =============

export type TransportRole = 'host' | 'contestant' | 'display';

export interface UseTransportProps {
  sessionCode: string;
  role: TransportRole;
  playerId?: string;
  playerName?: string;
  disableRTC?: boolean;
  onBuzzerPressed?: (event: BuzzerPressedEvent) => void;
  onBuzzerTimeout?: (event: BuzzerTimeoutEvent) => void;
  onBuzzerReset?: (event: BuzzerResetEvent) => void;
  onPartyMode?: (event: PartyModeEvent) => void;
  onGoldenCelebration?: (event: GoldenCelebrationEvent) => void;
  onFlash?: (event: FlashEvent) => void;
}

export interface TransportStats {
  mode: 'broadcast-only' | 'hybrid' | 'rtc-preferred';
  broadcastReady: boolean;
  rtcReady: boolean;
  connectedPeers: number;
}

/** فترة تحديث الإحصائيات (15 ثانية بدلاً من 5) */
const STATS_INTERVAL = 15000;

// ============= Hook =============

export const useTransport = ({
  sessionCode,
  role,
  playerId,
  playerName,
  disableRTC = false,
  onBuzzerPressed,
  onBuzzerTimeout,
  onBuzzerReset,
  onPartyMode,
  onGoldenCelebration,
  onFlash,
}: UseTransportProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<TransportStats>({
    mode: 'broadcast-only',
    broadcastReady: false,
    rtcReady: false,
    connectedPeers: 0,
  });
  
  const transportRef = useRef<HybridTransport | null>(null);
  const handlersRef = useRef({
    onBuzzerPressed,
    onBuzzerTimeout,
    onBuzzerReset,
    onPartyMode,
    onGoldenCelebration,
    onFlash,
  });
  
  useEffect(() => {
    handlersRef.current = {
      onBuzzerPressed,
      onBuzzerTimeout,
      onBuzzerReset,
      onPartyMode,
      onGoldenCelebration,
      onFlash,
    };
  }, [onBuzzerPressed, onBuzzerTimeout, onBuzzerReset, onPartyMode, onGoldenCelebration, onFlash]);
  
  const handleEvent = useCallback((event: TransientEvent) => {
    switch (event.type) {
      case 'buzzer_pressed':
        handlersRef.current.onBuzzerPressed?.(event);
        break;
      case 'buzzer_timeout':
        handlersRef.current.onBuzzerTimeout?.(event);
        break;
      case 'buzzer_reset':
        handlersRef.current.onBuzzerReset?.(event);
        break;
      case 'party_mode':
        handlersRef.current.onPartyMode?.(event);
        break;
      case 'golden_celebration':
        handlersRef.current.onGoldenCelebration?.(event);
        break;
      case 'flash':
        handlersRef.current.onFlash?.(event);
        break;
    }
  }, []);
  
  // ============= دوال الإرسال =============
  
  const sendBuzzerPressed = useCallback((player: string, team: 'red' | 'green') => {
    if (!transportRef.current?.ready()) return;
    const event = createEvent({ type: 'buzzer_pressed', player, team }) as BuzzerPressedEvent;
    transportRef.current.send(event);
  }, []);
  
  const sendBuzzerTimeout = useCallback(() => {
    if (!transportRef.current?.ready()) return;
    const event = createEvent({ type: 'buzzer_timeout' }) as BuzzerTimeoutEvent;
    transportRef.current.send(event);
  }, []);
  
  const sendBuzzerReset = useCallback(() => {
    if (!transportRef.current?.ready()) return;
    const event = createEvent({ type: 'buzzer_reset' }) as BuzzerResetEvent;
    transportRef.current.send(event);
  }, []);
  
  const sendPartyMode = useCallback((
    active: boolean,
    winningTeam: 'red' | 'green',
    winningPath: [number, number][]
  ) => {
    if (!transportRef.current?.ready()) return;
    const event = createEvent({ type: 'party_mode', active, winningTeam, winningPath }) as PartyModeEvent;
    transportRef.current.send(event);
  }, []);
  
  const sendGoldenCelebration = useCallback((letter: string) => {
    if (!transportRef.current?.ready()) return;
    const event = createEvent({ type: 'golden_celebration', letter }) as GoldenCelebrationEvent;
    transportRef.current.send(event);
  }, []);
  
  const sendFlash = useCallback((team: 'red' | 'green') => {
    if (!transportRef.current?.ready()) return;
    const event = createEvent({ type: 'flash', team }) as FlashEvent;
    transportRef.current.send(event);
  }, []);
  
  const connectToPeer = useCallback(async (peerId: string) => {
    if (role !== 'host' || !transportRef.current) return;
    await transportRef.current.connectToPeer(peerId);
  }, [role]);
  
  // ============= إدارة الاتصال =============
  
  useEffect(() => {
    if (!sessionCode) return;
    
    let mounted = true;
    let statsInterval: NodeJS.Timeout | null = null;
    
    const connect = async () => {
      try {
        console.log('🔌 [useTransport] Connecting...', { role, sessionCode });
        
        const transport = await createHybridTransport({
          sessionCode,
          role,
          playerId,
          enableWebRTC: !disableRTC,
        });
        
        if (!mounted) {
          transport.disconnect();
          return;
        }
        
        transport.subscribe(handleEvent);
        
        transportRef.current = transport;
        setIsConnected(true);
        setStats(transport.getStats());
        
        // إعلان الانضمام (للمتسابق والشاشة فقط) — مدمج في HybridTransport
        if (role !== 'host' && playerId) {
          transport.announceJoin(playerId, role as 'contestant' | 'display', playerName);
        }
        
        // ✅ تحديث الإحصائيات كل 15 ثانية (بدلاً من 5)
        statsInterval = setInterval(() => {
          if (transportRef.current) {
            setStats(transportRef.current.getStats());
          }
        }, STATS_INTERVAL);
        
      } catch (err) {
        console.error('❌ [useTransport] Connection failed:', err);
        setIsConnected(false);
      }
    };
    
    connect();
    
    return () => {
      mounted = false;
      if (statsInterval) clearInterval(statsInterval);
      
      // إعلان المغادرة — مدمج في HybridTransport
      if (transportRef.current && playerId && role !== 'host') {
        transportRef.current.announceLeave(playerId, role as 'contestant' | 'display');
      }
      
      transportRef.current?.disconnect();
      transportRef.current = null;
      setIsConnected(false);
    };
  }, [sessionCode, role, playerId, playerName, disableRTC, handleEvent]);
  
  useEffect(() => {
    const handleBeforeUnload = () => {
      transportRef.current?.disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
  
  return {
    isConnected,
    stats,
    sendBuzzerPressed,
    sendBuzzerTimeout,
    sendBuzzerReset,
    sendPartyMode,
    sendGoldenCelebration,
    sendFlash,
    connectToPeer,
  };
};

export default useTransport;
