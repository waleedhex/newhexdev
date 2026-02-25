import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { LETTERS, ENGLISH_LETTERS, LAYOUT, CREAM_COLOR, COLOR_SETS } from '@/components/HexBoard/constants';
import { shuffleArray, getColorCycle } from '@/components/HexBoard/utils';
import { HexagonData, BoardState } from './useBoardState';
import { toast } from 'sonner';
import { validateSubscriptionCode } from '@/hooks/useRoomValidation';

// ====== أنواع الأخطاء ======
type HostActionError = {
  code: 'NO_SESSION' | 'NOT_HOST' | 'UPDATE_FAILED' | 'CREATE_FAILED';
  message: string;
};

interface UseHostBoardActionsProps {
  sessionCode: string;
  boardState: BoardState;
  setBoardState: React.Dispatch<React.SetStateAction<BoardState>>;
  /** 
   * تفعيل التحقق من صلاحيات المقدم (افتراضي: true)
   * عند التفعيل، يجب أن يكون المستخدم قد دخل من صفحة المقدم
   */
  enableHostValidation?: boolean;
}

// ====== مفتاح التخزين المحلي للتحقق من الدور ======
const HOST_TOKEN_KEY = 'hexboard_host_token';

/**
 * التحقق من أن المستخدم دخل كمقدم
 * يتم تعيين التوكن عند الدخول من صفحة اختيار الدور
 */
const validateHostRole = (sessionCode: string): boolean => {
  if (!sessionCode) return false;
  
  try {
    const storedToken = localStorage.getItem(`${HOST_TOKEN_KEY}_${sessionCode.toLowerCase()}`);
    // التوكن يمكن أن يكون 'host' (القديم) أو UUID (الجديد)
    return !!storedToken;
  } catch {
    return false;
  }
};

/**
 * الحصول على توكن المقدم المخزن
 */
export const getHostToken = (sessionCode: string): string | null => {
  if (!sessionCode) return null;
  try {
    const token = localStorage.getItem(`${HOST_TOKEN_KEY}_${sessionCode.toLowerCase()}`);
    // إذا كان التوكن القديم 'host'، نعيد null لإنشاء توكن جديد
    if (token === 'host') return null;
    return token;
  } catch {
    return null;
  }
};

/**
 * تعيين توكن المقدم (يُستدعى عند الدخول كمقدم)
 * @param sessionCode رمز الجلسة
 * @param token التوكن (UUID) - اختياري، إذا لم يُحدد يُستخدم 'host'
 */
export const setHostToken = (sessionCode: string, token?: string): void => {
  if (!sessionCode) return;
  try {
    localStorage.setItem(`${HOST_TOKEN_KEY}_${sessionCode.toLowerCase()}`, token || 'host');
  } catch {
    console.warn('⚠️ Failed to set host token');
  }
};

/**
 * إزالة توكن المقدم (عند الخروج)
 */
export const clearHostToken = (sessionCode: string): void => {
  if (!sessionCode) return;
  try {
    localStorage.removeItem(`${HOST_TOKEN_KEY}_${sessionCode.toLowerCase()}`);
  } catch {
    console.warn('⚠️ Failed to clear host token');
  }
};

/**
 * Hook للتعديل فقط - يُستخدم حصرياً من شاشة المقدم
 * يحتوي على جميع دوال تعديل حالة اللوحة مع تحقق من الصلاحيات
 */
export const useHostBoardActions = ({ 
  sessionCode, 
  boardState, 
  setBoardState,
  enableHostValidation = true,
}: UseHostBoardActionsProps) => {
  const [searchParams] = useSearchParams();
  const lang = searchParams.get('lang') || 'ar';
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const hasShownHostError = useRef(false);

  // ====== التحقق من صلاحية المقدم عند التحميل ======
  useEffect(() => {
    if (!sessionCode) return;
    
    const hostValid = validateHostRole(sessionCode);
    setIsHost(hostValid);
    
    if (enableHostValidation && !hostValid && !hasShownHostError.current) {
      console.warn('⚠️ User is not authorized as host for session:', sessionCode);
      hasShownHostError.current = true;
    }
  }, [sessionCode, enableHostValidation]);

  // ====== دالة مساعدة للتحقق قبل أي عملية ======
  const validateBeforeAction = useCallback((): HostActionError | null => {
    if (!sessionId) {
      return { code: 'NO_SESSION', message: 'لا توجد جلسة نشطة' };
    }
    
    if (enableHostValidation && !isHost) {
      return { code: 'NOT_HOST', message: 'غير مصرح لك بإجراء هذا التعديل - يجب الدخول كمقدم' };
    }
    
    return null;
  }, [sessionId, isHost, enableHostValidation]);

  // ====== معالجة الخطأ بشكل موحد ======
  const handleActionError = useCallback((error: HostActionError, actionName: string): void => {
    console.error(`❌ ${actionName} failed:`, error.code, error.message);
    toast.error(error.message);
  }, []);

  // ====== تهيئة اللوحة ======
  const initializeBoard = useCallback(() => {
    const lettersSet = lang === 'en' ? ENGLISH_LETTERS : LETTERS;
    const shuffledLetters = shuffleArray(lettersSet);
    const hexagons: Record<string, HexagonData> = {};
    const lettersOrder: string[] = [];
    
    let letterIndex = 0;
    LAYOUT.forEach((row, rowIndex) => {
      row.forEach((letter, colIndex) => {
        if (rowIndex > 0 && rowIndex < 6 && colIndex > 0 && colIndex < 6 && letter) {
          const currentLetter = shuffledLetters[letterIndex++];
          lettersOrder.push(currentLetter);
          hexagons[currentLetter] = { color: CREAM_COLOR, clickCount: 0 };
        }
      });
    });

    // اختيار حرف ذهبي عشوائي
    const allLetters = Object.keys(hexagons);
    const goldenLetter = allLetters.length > 0 
      ? allLetters[Math.floor(Math.random() * allLetters.length)] 
      : null;

    return { hexagons, lettersOrder, goldenLetter };
  }, [lang]);

  // ====== تحديث مسدس ======
  const updateHexagon = useCallback(async (letter: string, newClickCount: number): Promise<boolean> => {
    const validationError = validateBeforeAction();
    if (validationError) {
      handleActionError(validationError, 'updateHexagon');
      return false;
    }

    const newColor = getColorCycle(boardState.colorSetIndex, boardState.isSwapped)[newClickCount];
    const newHexagons = {
      ...boardState.hexagons,
      [letter]: { color: newColor, clickCount: newClickCount }
    };

    // تحديث محلي أولاً (للاستجابة السريعة)
    setBoardState(prev => ({ ...prev, hexagons: newHexagons }));

    // تحديث قاعدة البيانات
    const { error } = await supabase
      .from('game_sessions')
      .update({
        hexagons: newHexagons as unknown as Json,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Error updating hexagon:', error);
      toast.error('فشل تحديث الخلية');
      return false;
    }
    
    return true;
  }, [sessionId, boardState.hexagons, boardState.colorSetIndex, boardState.isSwapped, setBoardState, validateBeforeAction, handleActionError]);

  // ====== خلط اللوحة ======
  const shuffle = useCallback(async (): Promise<{ hexagons: Record<string, HexagonData>; lettersOrder: string[]; goldenLetter: string | null } | null> => {
    const validationError = validateBeforeAction();
    if (validationError) {
      handleActionError(validationError, 'shuffle');
      return null;
    }

    const { hexagons, lettersOrder, goldenLetter } = initializeBoard();

    // تحديث محلي
    setBoardState(prev => ({
      ...prev,
      hexagons,
      lettersOrder,
      goldenLetter,
      partyMode: false,
    }));

    // تحديث قاعدة البيانات
    const { error } = await supabase
      .from('game_sessions')
      .update({
        hexagons: hexagons as unknown as Json,
        letters_order: lettersOrder,
        golden_letter: goldenLetter,
        party_mode: false,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Error shuffling board:', error);
      toast.error('فشل خلط اللوحة');
      return null;
    }

    return { hexagons, lettersOrder, goldenLetter };
  }, [sessionId, initializeBoard, setBoardState, validateBeforeAction, handleActionError]);

  // ====== تغيير الألوان ======
  const changeColors = useCallback(async (): Promise<boolean> => {
    const validationError = validateBeforeAction();
    if (validationError) {
      handleActionError(validationError, 'changeColors');
      return false;
    }

    const newIndex = (boardState.colorSetIndex + 1) % COLOR_SETS.length;

    setBoardState(prev => ({ ...prev, colorSetIndex: newIndex }));

    const { error } = await supabase
      .from('game_sessions')
      .update({
        color_set_index: newIndex,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Error changing colors:', error);
      toast.error('فشل تغيير الألوان');
      return false;
    }
    
    return true;
  }, [sessionId, boardState.colorSetIndex, setBoardState, validateBeforeAction, handleActionError]);

  // ====== تبديل الألوان ======
  const swapColors = useCallback(async (): Promise<boolean> => {
    const validationError = validateBeforeAction();
    if (validationError) {
      handleActionError(validationError, 'swapColors');
      return false;
    }

    const newSwapped = !boardState.isSwapped;

    setBoardState(prev => ({ ...prev, isSwapped: newSwapped }));

    const { error } = await supabase
      .from('game_sessions')
      .update({
        is_swapped: newSwapped,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Error swapping colors:', error);
      toast.error('فشل تبديل الألوان');
      return false;
    }
    
    return true;
  }, [sessionId, boardState.isSwapped, setBoardState, validateBeforeAction, handleActionError]);

  // ====== تحديث الحرف الذهبي ======
  const setGoldenLetter = useCallback(async (letter: string | null): Promise<boolean> => {
    const validationError = validateBeforeAction();
    if (validationError) {
      handleActionError(validationError, 'setGoldenLetter');
      return false;
    }

    setBoardState(prev => ({ ...prev, goldenLetter: letter }));

    const { error } = await supabase
      .from('game_sessions')
      .update({
        golden_letter: letter,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Error setting golden letter:', error);
      toast.error('فشل تحديث الحرف الذهبي');
      return false;
    }
    
    return true;
  }, [sessionId, setBoardState, validateBeforeAction, handleActionError]);

  // ====== تفعيل وضع الاحتفال ======
  const setPartyMode = useCallback(async (active: boolean): Promise<boolean> => {
    const validationError = validateBeforeAction();
    if (validationError) {
      handleActionError(validationError, 'setPartyMode');
      return false;
    }

    setBoardState(prev => ({ ...prev, partyMode: active }));

    const { error } = await supabase
      .from('game_sessions')
      .update({
        party_mode: active,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Error setting party mode:', error);
      toast.error('فشل تفعيل وضع الاحتفال');
      return false;
    }
    
    return true;
  }, [sessionId, setBoardState, validateBeforeAction, handleActionError]);

  // ====== حفظ مسار الفوز ======
  const setWinningPath = useCallback(async (path: [number, number][] | null): Promise<boolean> => {
    const validationError = validateBeforeAction();
    if (validationError) {
      handleActionError(validationError, 'setWinningPath');
      return false;
    }

    setBoardState(prev => ({ ...prev, winningPath: path }));

    const { error } = await supabase
      .from('game_sessions')
      .update({
        winning_path: path as unknown as Json,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Error setting winning path:', error);
      toast.error('فشل حفظ مسار الفوز');
      return false;
    }
    
    return true;
  }, [sessionId, setBoardState, validateBeforeAction, handleActionError]);

  // ====== إنشاء الجلسة (عند بدء اللعبة) ======
  const createSession = useCallback(async (): Promise<boolean> => {
    if (!sessionCode) {
      console.warn('⚠️ Cannot create session: no session code');
      return false;
    }

    // 0) تأكيد أن الرمز صحيح + الحصول على الصيغة المطابقة لقاعدة البيانات (لتجنب مشاكل الـ FK/Case)
    const subscriptionResult = await validateSubscriptionCode(sessionCode);
    if (!subscriptionResult.isValid) {
      toast.error(subscriptionResult.error || 'الرمز غير صحيح');
      return false;
    }

    const exactCode = (subscriptionResult.data as { code: string }).code;

    // تعيين توكن المقدم عند إنشاء/استئناف الجلسة
    setHostToken(exactCode);
    setIsHost(true);

    const { hexagons, lettersOrder, goldenLetter } = initializeBoard();

    // 1) تحقق من وجود جلسة سابقة (نشطة أو غير نشطة)
    const { data: existingSession, error: existingError } = await supabase
      .from('game_sessions')
      .select('id, is_active')
      .eq('session_code', exactCode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('❌ Error fetching existing session:', existingError);
      toast.error('فشل جلب الجلسة');
      return false;
    }

    if (existingSession) {
      // 2) تحديث/إعادة تفعيل الجلسة الموجودة (وبدء لعبة جديدة)
      const { error } = await supabase
        .from('game_sessions')
        .update({
          hexagons: hexagons as unknown as Json,
          letters_order: lettersOrder,
          golden_letter: goldenLetter,
          color_set_index: 0,
          is_swapped: false,
          party_mode: false,
          winning_path: null,
          buzzer: { active: false, player: '', team: null } as unknown as Json,
          is_active: true,
          last_activity: new Date().toISOString(),
        })
        .eq('id', existingSession.id);

      if (error) {
        console.error('❌ Error updating session:', error);
        toast.error('فشل تحديث الجلسة');
        return false;
      }

      setSessionId(existingSession.id);
      setBoardState({
        hexagons,
        lettersOrder,
        goldenLetter,
        colorSetIndex: 0,
        isSwapped: false,
        partyMode: false,
        winningPath: null,
      });
      setIsInitialized(true);
      return true;
    } else {
      // 3) إنشاء جلسة جديدة باستخدام الصيغة المطابقة (exactCode)
      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          session_code: exactCode,
          hexagons: hexagons as unknown as Json,
          letters_order: lettersOrder,
          golden_letter: goldenLetter,
          color_set_index: 0,
          is_swapped: false,
          party_mode: false,
          winning_path: null,
          buzzer: { active: false, player: '', team: null } as unknown as Json,
          teams: { red: [], green: [] } as unknown as Json,
          is_active: true,
        })
        .select()
        .single();

      if (error || !data) {
        console.error('❌ Error creating session:', error);
        toast.error('فشل إنشاء الجلسة');
        return false;
      }

      setSessionId(data.id);
      setBoardState({
        hexagons,
        lettersOrder,
        goldenLetter,
        colorSetIndex: 0,
        isSwapped: false,
        partyMode: false,
        winningPath: null,
      });
      setIsInitialized(true);
      return true;
    }
  }, [sessionCode, initializeBoard, setBoardState]);

  // ====== تهيئة الجلسة عند التحميل ======
  useEffect(() => {
    if (!sessionCode || isInitialized) return;
    createSession();
  }, [sessionCode, isInitialized, createSession]);

  return {
    sessionId,
    isInitialized,
    isHost,
    
    // Actions
    updateHexagon,
    shuffle,
    changeColors,
    swapColors,
    setGoldenLetter,
    setPartyMode,
    setWinningPath,
    createSession,
  };
};
