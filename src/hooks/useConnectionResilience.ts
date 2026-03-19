/**
 * useConnectionResilience.ts
 * نظام إعادة الاتصال التلقائي مع المزامنة
 * 
 * التحسينات:
 * - Heartbeat ذكي حسب الدور
 * - كتابة شرطية (لا نكتب إلا عند الحاجة)
 * - تقليل الحمل على قاعدة البيانات
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  RECONNECT_INTERVAL,
  MAX_RECONNECT_ATTEMPTS,
  MIN_WRITE_INTERVAL,
  getHeartbeatInterval,
  PlayerRole,
} from '@/config/connectionConstants';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface UseConnectionResilienceProps {
  playerId: string | null;
  sessionId: string | null;
  sessionCode: string;
  role?: PlayerRole; // الدور لتحديد سرعة الـ heartbeat
  onReconnected?: () => void;
  onDisconnected?: () => void;
  onKicked?: () => void;
}

export interface ConnectionResilienceReturn {
  status: ConnectionStatus;
  reconnectAttempt: number;
  maxAttempts: number;
  isOnline: boolean;
  lastHeartbeat: Date | null;
  forceReconnect: () => void;
  writeCount: number; // للمراقبة: عدد الكتابات الفعلية
}

// ============= Helper: فحص اتصال الشبكة =============
const checkNetworkConnection = async (): Promise<boolean> => {
  if (!navigator.onLine) return false;
  
  try {
    const { error } = await supabase.from('game_sessions').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};

// ============= Hook الرئيسي =============
export const useConnectionResilience = ({
  playerId,
  sessionId,
  sessionCode,
  role = 'contestant', // الافتراضي متسابق
  onReconnected,
  onDisconnected,
  onKicked,
}: UseConnectionResilienceProps): ConnectionResilienceReturn => {
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [writeCount, setWriteCount] = useState(0); // للمراقبة

  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isReconnectingRef = useRef(false);
  
  // ====== الكتابة الشرطية: تتبع آخر كتابة ======
  const lastWriteTimeRef = useRef<number>(0);
  const lastWrittenDataRef = useRef<{ is_connected: boolean } | null>(null);

  // الحصول على الـ heartbeat حسب الدور
  const heartbeatInterval = getHeartbeatInterval(role);

  // ====== إرسال Heartbeat مع كتابة شرطية ======
  const sendHeartbeat = useCallback(async (forceWrite = false) => {
    if (!playerId || !sessionId) return false;

    const now = Date.now();
    const timeSinceLastWrite = now - lastWriteTimeRef.current;
    
    // الكتابة الشرطية: لا نكتب إلا إذا:
    // 1. مر وقت كافي (MIN_WRITE_INTERVAL)
    // 2. أو هذه كتابة إجبارية (forceWrite)
    // 3. أو تغيرت الحالة
    const shouldWrite = forceWrite || timeSinceLastWrite >= MIN_WRITE_INTERVAL;
    
    if (!shouldWrite) {
      // فقط نحدّث الـ state المحلي
      setLastHeartbeat(new Date());
      return true;
    }

    try {
      const { error } = await supabase
        .from('session_players')
        .update({
          last_seen: new Date().toISOString(),
          is_connected: true,
        })
        .eq('id', playerId);

      if (error) {
        console.error('❌ Heartbeat failed:', error);
        return false;
      }

      // تحديث tracking الكتابة
      lastWriteTimeRef.current = now;
      lastWrittenDataRef.current = { is_connected: true };
      setWriteCount(prev => prev + 1);
      setLastHeartbeat(new Date());
      
      return true;
    } catch (err) {
      console.error('❌ Heartbeat error:', err);
      return false;
    }
  }, [playerId, sessionId]);

  // ====== التحقق من أن اللاعب لا يزال في الجلسة ======
  const checkPlayerStillInSession = useCallback(async (): Promise<boolean> => {
    if (!playerId) return false;

    try {
      const { data, error } = await supabase
        .from('session_players')
        .select('id, is_connected')
        .eq('id', playerId)
        .maybeSingle();

      if (error || !data) {
        console.log('🚫 Player no longer in session');
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }, [playerId]);

  // ====== محاولة إعادة الاتصال ======
  const attemptReconnect = useCallback(async (): Promise<boolean> => {
    console.log(`🔄 Reconnect attempt ${reconnectAttempt + 1}/${MAX_RECONNECT_ATTEMPTS}`);

    const networkOk = await checkNetworkConnection();
    if (!networkOk) {
      console.log('📵 Network still down');
      return false;
    }

    const stillInSession = await checkPlayerStillInSession();
    if (!stillInSession) {
      console.log('🚫 Player was kicked from session');
      onKicked?.();
      return false;
    }

    // كتابة إجبارية عند إعادة الاتصال
    const heartbeatOk = await sendHeartbeat(true);
    if (!heartbeatOk) {
      console.log('💔 Failed to send heartbeat');
      return false;
    }

    console.log('✅ Reconnected successfully!');
    return true;
  }, [reconnectAttempt, checkPlayerStillInSession, sendHeartbeat, onKicked]);

  // ====== بدء عملية إعادة الاتصال ======
  const startReconnecting = useCallback(() => {
    if (isReconnectingRef.current) return;
    
    isReconnectingRef.current = true;
    setStatus('reconnecting');
    setReconnectAttempt(0);

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    reconnectIntervalRef.current = setInterval(async () => {
      setReconnectAttempt((prev) => {
        const newAttempt = prev + 1;

        if (newAttempt > MAX_RECONNECT_ATTEMPTS) {
          console.log('❌ Max reconnect attempts reached - disconnecting');
          clearInterval(reconnectIntervalRef.current!);
          reconnectIntervalRef.current = null;
          isReconnectingRef.current = false;
          setStatus('disconnected');
          onDisconnected?.();
          return prev;
        }

        return newAttempt;
      });

      const success = await attemptReconnect();
      if (success) {
        clearInterval(reconnectIntervalRef.current!);
        reconnectIntervalRef.current = null;
        isReconnectingRef.current = false;
        setStatus('connected');
        setReconnectAttempt(0);
        onReconnected?.();

        // إعادة تشغيل heartbeat بالفترة المناسبة للدور
        heartbeatIntervalRef.current = setInterval(() => {
          sendHeartbeat();
        }, heartbeatInterval);
      }
    }, RECONNECT_INTERVAL);
  }, [attemptReconnect, sendHeartbeat, heartbeatInterval, onReconnected, onDisconnected]);

  // ====== إعادة اتصال يدوية ======
  const forceReconnect = useCallback(() => {
    console.log('🔄 Force reconnect triggered');
    
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
    
    isReconnectingRef.current = false;
    startReconnecting();
  }, [startReconnecting]);

  // ====== مراقبة حالة الشبكة ======
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network online');
      setIsOnline(true);
      
      if (status === 'disconnected') {
        forceReconnect();
      }
    };

    const handleOffline = () => {
      console.log('📵 Network offline');
      setIsOnline(false);
      
      if (status === 'connected') {
        startReconnecting();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status, startReconnecting, forceReconnect]);

  // ====== Heartbeat الأساسي - بالفترة المناسبة للدور ======
  useEffect(() => {
    if (!playerId || !sessionId) return;

    console.log(`💓 Starting heartbeat for ${role} role every ${heartbeatInterval / 1000}s`);

    // إرسال heartbeat فوري (إجباري)
    sendHeartbeat(true);

    // بدء interval بالفترة المناسبة للدور
    heartbeatIntervalRef.current = setInterval(async () => {
      const success = await sendHeartbeat();
      
      if (!success && status === 'connected') {
        startReconnecting();
      }
    }, heartbeatInterval);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [playerId, sessionId, role, heartbeatInterval, sendHeartbeat, status, startReconnecting]);

  // ====== تنظيف عند الخروج ======
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
    };
  }, []);

  // ====== تحديث حالة الاتصال عند الخروج ======
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (playerId) {
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/session_players?id=eq.${playerId}`,
          JSON.stringify({ is_connected: false })
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && playerId) {
        console.log('👁️ Page hidden - may lose connection');
      } else if (!document.hidden && status !== 'connected') {
        console.log('👁️ Page visible - checking connection');
        forceReconnect();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [playerId, status, forceReconnect]);

  return {
    status,
    reconnectAttempt,
    maxAttempts: MAX_RECONNECT_ATTEMPTS,
    isOnline,
    lastHeartbeat,
    forceReconnect,
    writeCount, // للمراقبة
  };
};

export default useConnectionResilience;
