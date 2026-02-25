/**
 * usePlayerStatusNotifications.ts
 * إشعارات حالة اللاعبين للمقدم
 * 
 * يراقب حالة اتصال اللاعبين ويعرض toast عند:
 * - انقطاع لاعب (بعد تأكد الانقطاع لفترة)
 * - عودة لاعب
 * - انضمام لاعب جديد
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  PLAYER_STATUS_CHECK_INTERVAL, 
  CONTESTANT_INACTIVE_THRESHOLD 
} from '@/config/connectionConstants';

interface Player {
  id: string;
  player_name: string;
  team: string | null;
  is_connected: boolean;
  last_seen: string | null;
}

interface UsePlayerStatusNotificationsProps {
  sessionId: string | null;
  enabled?: boolean;
}

// Debounce: عدد الفحوصات المتتالية التي يجب أن يكون فيها اللاعب منقطعاً قبل عرض الإشعار
const DISCONNECT_CONFIRM_COUNT = 2;

export const usePlayerStatusNotifications = ({
  sessionId,
  enabled = true,
}: UsePlayerStatusNotificationsProps) => {
  const previousPlayersRef = useRef<Map<string, Player>>(new Map());
  const isFirstLoadRef = useRef(true);
  // عدّاد لتأكيد الانقطاع - لا نُشعر إلا بعد رؤية الانقطاع عدة مرات متتالية
  const disconnectCountRef = useRef<Map<string, number>>(new Map());

  const checkPlayerStatus = useCallback(async () => {
    if (!sessionId || !enabled) return;

    const { data: players, error } = await supabase
      .from('session_players')
      .select('id, player_name, team, is_connected, last_seen')
      .eq('session_id', sessionId)
      .eq('role', 'contestant');

    if (error || !players) return;

    const now = Date.now();
    const currentPlayers = new Map<string, Player>();

    players.forEach((player) => {
      const lastSeenTime = player.last_seen ? new Date(player.last_seen).getTime() : 0;
      const isActuallyConnected = player.is_connected && (now - lastSeenTime < CONTESTANT_INACTIVE_THRESHOLD);
      
      currentPlayers.set(player.id, {
        ...player,
        is_connected: isActuallyConnected,
      });
    });

    // تخطي الإشعارات في التحميل الأول
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      previousPlayersRef.current = currentPlayers;
      return;
    }

    // فحص التغييرات
    currentPlayers.forEach((player, id) => {
      const previousPlayer = previousPlayersRef.current.get(id);

      if (!previousPlayer) {
        // لاعب جديد انضم
        const teamName = player.team === 'red' ? 'الأحمر' : player.team === 'green' ? 'الأخضر' : '';
        toast.success(`${player.player_name} انضم للفريق ${teamName}`, {
          duration: 3000,
          position: 'top-center',
        });
        disconnectCountRef.current.delete(id);
      } else if (previousPlayer.is_connected && !player.is_connected) {
        // لاعب يبدو منقطعاً - زيادة العدّاد
        const count = (disconnectCountRef.current.get(id) || 0) + 1;
        disconnectCountRef.current.set(id, count);
        
        // لا نُشعر إلا بعد تأكيد الانقطاع عدة مرات متتالية
        if (count >= DISCONNECT_CONFIRM_COUNT) {
          toast.warning(`${player.player_name} انقطع الاتصال`, {
            duration: 4000,
            position: 'top-center',
          });
        }
      } else if (!previousPlayer.is_connected && player.is_connected) {
        // لاعب عاد - فقط إذا كنا أرسلنا إشعار انقطاع
        const count = disconnectCountRef.current.get(id) || 0;
        if (count >= DISCONNECT_CONFIRM_COUNT) {
          toast.success(`${player.player_name} عاد للاتصال`, {
            duration: 3000,
            position: 'top-center',
          });
        }
        disconnectCountRef.current.delete(id);
      } else if (player.is_connected) {
        // لاعب متصل بشكل مستمر - إعادة تعيين العدّاد
        disconnectCountRef.current.delete(id);
      }
    });

    // فحص اللاعبين المحذوفين (المطرودين)
    previousPlayersRef.current.forEach((player, id) => {
      if (!currentPlayers.has(id)) {
        toast.info(`${player.player_name} غادر الجلسة`, {
          duration: 3000,
          position: 'top-center',
        });
        disconnectCountRef.current.delete(id);
      }
    });

    previousPlayersRef.current = currentPlayers;
  }, [sessionId, enabled]);

  // Polling لفحص حالة اللاعبين
  useEffect(() => {
    if (!sessionId || !enabled) return;

    checkPlayerStatus();

    const interval = setInterval(checkPlayerStatus, PLAYER_STATUS_CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [sessionId, enabled, checkPlayerStatus]);

  // الاشتراك في تحديثات Realtime (انضمام/مغادرة فقط)
  useEffect(() => {
    if (!sessionId || !enabled) return;

    const channel = supabase
      .channel(`player-status-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_players',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          setTimeout(checkPlayerStatus, 300);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'session_players',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          setTimeout(checkPlayerStatus, 300);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, enabled, checkPlayerStatus]);

  return {
    refreshStatus: checkPlayerStatus,
  };
};

export default usePlayerStatusNotifications;
