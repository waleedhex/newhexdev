import { supabase } from '@/integrations/supabase/client';
import { HOST_INACTIVE_THRESHOLD } from '@/config/connectionConstants';

interface ActiveHostResult {
  hasActiveHost: boolean;
  hostName: string | null;
  error: string | null;
}

interface RegisterHostResult {
  success: boolean;
  playerId: string | null;
  error: string | null;
  existingHostName: string | null;
}

/**
 * التحقق مما إذا كان هناك مقدم نشط في الجلسة
 * المقدم يعتبر نشطاً إذا:
 * 1. role = 'host'
 * 2. is_connected = true
 * 3. last_seen < 60 ثانية
 */
export const checkActiveHost = async (sessionCode: string): Promise<ActiveHostResult> => {
  if (!sessionCode) {
    return { hasActiveHost: false, hostName: null, error: 'لا يوجد رمز جلسة' };
  }

  try {
    // 1) الحصول على session_id
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('id')
      .ilike('session_code', sessionCode)
      .maybeSingle();

    if (sessionError) {
      console.error('❌ Error fetching session:', sessionError);
      return { hasActiveHost: false, hostName: null, error: 'فشل جلب الجلسة' };
    }

    // إذا لم توجد جلسة، لا يوجد مقدم
    if (!sessionData) {
      return { hasActiveHost: false, hostName: null, error: null };
    }

    // 2) البحث عن مقدم متصل
    const { data: hosts, error: hostError } = await supabase
      .from('session_players')
      .select('id, player_name, is_connected, last_seen')
      .eq('session_id', sessionData.id)
      .eq('role', 'host');

    if (hostError) {
      console.error('❌ Error fetching hosts:', hostError);
      return { hasActiveHost: false, hostName: null, error: 'فشل جلب بيانات المقدم' };
    }

    if (!hosts || hosts.length === 0) {
      return { hasActiveHost: false, hostName: null, error: null };
    }

    // 3) التحقق من نشاط المقدم
    const now = Date.now();
    const activeHost = hosts.find(host => {
      if (!host.is_connected) return false;
      if (!host.last_seen) return host.is_connected;
      
      const lastSeenTime = new Date(host.last_seen).getTime();
      const isRecent = (now - lastSeenTime) < HOST_INACTIVE_THRESHOLD;
      
      return isRecent;
    });

    if (activeHost) {
      return { hasActiveHost: true, hostName: activeHost.player_name, error: null };
    }

    return { hasActiveHost: false, hostName: null, error: null };
  } catch (err) {
    console.error('❌ Unexpected error in checkActiveHost:', err);
    return { hasActiveHost: false, hostName: null, error: 'حدث خطأ غير متوقع' };
  }
};

/**
 * تسجيل المقدم باستخدام دالة ذرية في قاعدة البيانات
 * هذه الدالة تمنع Race Condition وتضمن وجود مقدم واحد فقط
 * 
 * @param sessionCode رمز الجلسة
 * @param playerName اسم المقدم
 * @param token توكن المقدم (UUID)
 * @returns نتيجة التسجيل
 */
export const registerHostAtomic = async (
  sessionCode: string,
  playerName: string,
  token: string
): Promise<RegisterHostResult> => {
  if (!sessionCode || !playerName) {
    return { 
      success: false, 
      playerId: null, 
      error: 'بيانات غير مكتملة', 
      existingHostName: null 
    };
  }

  try {
    // استدعاء الدالة الذرية في قاعدة البيانات
    const { data, error } = await supabase.rpc('register_host', {
      p_session_code: sessionCode,
      p_player_name: playerName,
      p_token: token
    });

    if (error) {
      console.error('❌ Error calling register_host:', error);
      return { 
        success: false, 
        playerId: null, 
        error: 'فشل التسجيل كمقدم', 
        existingHostName: null 
      };
    }

    // الدالة ترجع مصفوفة من صف واحد
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return { 
        success: false, 
        playerId: null, 
        error: 'لم يتم الحصول على نتيجة', 
        existingHostName: null 
      };
    }

    return {
      success: result.success,
      playerId: result.player_id,
      error: result.error_message,
      existingHostName: result.existing_host_name
    };
  } catch (err) {
    console.error('❌ Unexpected error in registerHostAtomic:', err);
    return { 
      success: false, 
      playerId: null, 
      error: 'حدث خطأ غير متوقع', 
      existingHostName: null 
    };
  }
};
