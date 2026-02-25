/**
 * useRoomValidation.ts
 * دوال موحدة للتحقق من صلاحية الغرفة وأكواد الاشتراك
 * 
 * الفوائد:
 * - توحيد منطق التحقق في مكان واحد
 * - تجنب تكرار الكود في الصفحات المختلفة
 * - سهولة الصيانة والتحديث
 * - معالجة موحدة للأخطاء
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// ============= أنواع البيانات =============

export interface SubscriptionCodeData {
  id: string;
  code: string;
  is_admin: boolean;
}

export interface GameSessionData {
  id: string;
  session_code: string;
  is_active: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  data?: SubscriptionCodeData | GameSessionData;
}

export interface RoomValidationState {
  isLoading: boolean;
  error: string | null;
}

// ============= دوال التحقق الأساسية =============

/**
 * التحقق من صحة كود الاشتراك
 */
export const validateSubscriptionCode = async (code: string): Promise<ValidationResult> => {
  if (!code || !code.trim()) {
    return { isValid: false, error: 'الرجاء إدخال الرمز' };
  }

  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke('verify-code', {
      body: { code: code.trim() },
    });

    if (fnError) {
      console.error('Edge function error:', fnError);
      return { isValid: false, error: 'حدث خطأ أثناء التحقق من الرمز' };
    }

    if (!fnData.valid) {
      return { isValid: false, error: fnData.error || 'الرمز غير صحيح' };
    }

    return { 
      isValid: true, 
      error: null, 
      data: {
        id: '', // not exposed by edge function
        code: fnData.exact_code,
        is_admin: fnData.is_admin || false,
      }
    };
  } catch (err) {
    console.error('Validation error:', err);
    return { isValid: false, error: 'حدث خطأ أثناء التحقق من الرمز' };
  }
};

/**
 * التحقق من وجود جلسة لعب نشطة
 */
export const validateGameSession = async (sessionCode: string): Promise<ValidationResult> => {
  if (!sessionCode || !sessionCode.trim()) {
    return { isValid: false, error: 'رمز الجلسة مطلوب' };
  }

  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, session_code, is_active')
      .ilike('session_code', sessionCode.trim())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching session:', error);
      return { isValid: false, error: 'حدث خطأ في التحقق من الجلسة' };
    }

    if (!data) {
      return { isValid: false, error: 'لم يتم العثور على جلسة نشطة' };
    }

    return {
      isValid: true,
      error: null,
      data: {
        id: data.id,
        session_code: data.session_code,
        is_active: data.is_active || false,
      }
    };
  } catch (err) {
    console.error('Session validation error:', err);
    return { isValid: false, error: 'حدث خطأ في التحقق من الجلسة' };
  }
};

/**
 * إنشاء أو استئناف جلسة (Lazy Session Creation)
 * - إذا لم توجد جلسة: أنشئ جديدة
 * - إذا وجدت جلسة غير نشطة: أعد تفعيلها
 * - إذا وجدت جلسة نشطة: استخدمها
 */
export const createOrResumeSession = async (sessionCode: string): Promise<{
  success: boolean;
  sessionId: string | null;
  error: string | null;
  isNew: boolean;
}> => {
  if (!sessionCode || !sessionCode.trim()) {
    return { success: false, sessionId: null, error: 'رمز الجلسة مطلوب', isNew: false };
  }

  const inputCode = sessionCode.trim();

  try {
    // 1. التحقق من صحة كود الاشتراك عبر Edge Function
    const { data: fnData, error: fnError } = await supabase.functions.invoke('verify-code', {
      body: { code: inputCode },
    });

    if (fnError) {
      console.error('Error checking subscription code:', fnError);
      return { success: false, sessionId: null, error: 'حدث خطأ في التحقق من الرمز', isNew: false };
    }

    if (!fnData.valid) {
      return { success: false, sessionId: null, error: fnData.error || 'الرمز غير صحيح', isNew: false };
    }

    // استخدام الكود الصحيح من Edge Function (للتطابق مع foreign key)
    const exactCode = fnData.exact_code;

    // 2. البحث عن أي جلسة موجودة (نشطة أو غير نشطة) - الأحدث أولاً
    const { data: sessions, error: fetchError } = await supabase
      .from('game_sessions')
      .select('id, session_code, is_active, last_activity')
      .eq('session_code', exactCode)
      .order('created_at', { ascending: false })
      .limit(1);

    const existingSession = sessions?.[0] || null;

    if (fetchError) {
      console.error('Error fetching session:', fetchError);
      return { success: false, sessionId: null, error: 'حدث خطأ في البحث عن الجلسة', isNew: false };
    }

    // 3. إذا وجدت جلسة
    if (existingSession) {
      // إذا كانت نشطة، استخدمها مباشرة
      if (existingSession.is_active) {
        // تحديث last_activity
        await supabase
          .from('game_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', existingSession.id);
        
        return { success: true, sessionId: existingSession.id, error: null, isNew: false };
      }

      // إذا كانت غير نشطة، أعد تفعيلها
      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({ 
          is_active: true, 
          last_activity: new Date().toISOString(),
          // إعادة تعيين الحالة
          buzzer: { active: false, player: '', team: null },
          party_mode: false,
        })
        .eq('id', existingSession.id);

      if (updateError) {
        console.error('Error reactivating session:', updateError);
        return { success: false, sessionId: null, error: 'فشل إعادة تفعيل الجلسة', isNew: false };
      }

      return { success: true, sessionId: existingSession.id, error: null, isNew: false };
    }

    // 4. لا توجد جلسة، أنشئ جديدة باستخدام الكود الصحيح
    const defaultLetters = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];
    
    const { data: newSession, error: insertError } = await supabase
      .from('game_sessions')
      .insert({
        session_code: exactCode, // استخدام الكود الصحيح
        hexagons: {},
        letters_order: defaultLetters,
        teams: { red: [], green: [] },
        buzzer: { active: false, player: '', team: null },
        buzzer_locked: false,
        color_set_index: 0,
        is_swapped: false,
        golden_letter: null,
        party_mode: false,
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating session:', insertError);
      return { success: false, sessionId: null, error: 'فشل إنشاء الجلسة', isNew: false };
    }

    return { success: true, sessionId: newSession.id, error: null, isNew: true };
  } catch (err) {
    console.error('Session creation error:', err);
    return { success: false, sessionId: null, error: 'حدث خطأ غير متوقع', isNew: false };
  }
};

/**
 * التحقق الشامل من الغرفة (كود الاشتراك + الجلسة)
 */
export const validateRoom = async (code: string): Promise<{
  subscriptionValid: boolean;
  sessionExists: boolean;
  isAdmin: boolean;
  sessionId: string | null;
  error: string | null;
}> => {
  // التحقق من كود الاشتراك أولاً
  const subscriptionResult = await validateSubscriptionCode(code);
  
  if (!subscriptionResult.isValid) {
    return {
      subscriptionValid: false,
      sessionExists: false,
      isAdmin: false,
      sessionId: null,
      error: subscriptionResult.error,
    };
  }

  const subscriptionData = subscriptionResult.data as SubscriptionCodeData;
  
  // التحقق من وجود جلسة
  const sessionResult = await validateGameSession(code);
  
  return {
    subscriptionValid: true,
    sessionExists: sessionResult.isValid,
    isAdmin: subscriptionData.is_admin,
    sessionId: sessionResult.isValid ? (sessionResult.data as GameSessionData).id : null,
    error: null,
  };
};

// ============= Hook للاستخدام في المكونات =============

interface UseRoomValidationProps {
  redirectOnInvalid?: boolean;
  redirectPath?: string;
}

export const useRoomValidation = (props: UseRoomValidationProps = {}) => {
  const { redirectOnInvalid = true, redirectPath = '/' } = props;
  const navigate = useNavigate();
  const [state, setState] = useState<RoomValidationState>({
    isLoading: false,
    error: null,
  });

  /**
   * التحقق من كود الاشتراك مع إمكانية التوجيه التلقائي
   */
  const checkSubscriptionCode = useCallback(async (code: string): Promise<ValidationResult> => {
    setState({ isLoading: true, error: null });
    
    const result = await validateSubscriptionCode(code);
    
    if (!result.isValid && redirectOnInvalid) {
      navigate(redirectPath);
    }
    
    setState({ isLoading: false, error: result.error });
    return result;
  }, [navigate, redirectOnInvalid, redirectPath]);

  /**
   * التحقق من وجود جلسة نشطة
   */
  const checkGameSession = useCallback(async (sessionCode: string): Promise<ValidationResult> => {
    setState({ isLoading: true, error: null });
    
    const result = await validateGameSession(sessionCode);
    
    setState({ isLoading: false, error: result.error });
    return result;
  }, []);

  /**
   * التحقق الشامل من الغرفة
   */
  const checkRoom = useCallback(async (code: string) => {
    setState({ isLoading: true, error: null });
    
    const result = await validateRoom(code);
    
    if (!result.subscriptionValid && redirectOnInvalid) {
      navigate(redirectPath);
    }
    
    setState({ isLoading: false, error: result.error });
    return result;
  }, [navigate, redirectOnInvalid, redirectPath]);

  /**
   * التحقق من المعاملات الأساسية (code, name) مع التوجيه
   */
  const validateRequiredParams = useCallback((params: { code?: string | null; name?: string | null }): boolean => {
    const { code, name } = params;
    
    if (!code || !name) {
      if (redirectOnInvalid) {
        navigate(redirectPath);
      }
      return false;
    }
    
    return true;
  }, [navigate, redirectOnInvalid, redirectPath]);

  return {
    ...state,
    checkSubscriptionCode,
    checkGameSession,
    checkRoom,
    validateRequiredParams,
  };
};

export default useRoomValidation;
