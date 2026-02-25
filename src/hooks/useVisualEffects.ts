import { useState, useCallback, useRef, useEffect } from 'react';
import { COLOR_SETS } from '@/components/HexBoard/constants';
import { toast } from '@/hooks/use-toast';

interface UseVisualEffectsProps {
  /** مؤشر مجموعة الألوان من boardState */
  colorSetIndex: number;
  /** هل الألوان مقلوبة من boardState */
  isSwapped: boolean;
}

/**
 * Hook للتأثيرات البصرية الفورية (غير مرتبطة بالاحتفالات)
 * - وميض الشاشة عند ضغط الجرس
 * - التنبيهات (باستخدام Toast)
 * - الأصوات الفورية (جرس، انتهاء الوقت)
 * 
 * ملاحظة: تأثيرات الاحتفالات (party, golden) انتقلت إلى useCelebrationState
 */
export const useVisualEffects = ({ colorSetIndex, isSwapped }: UseVisualEffectsProps) => {
  // ====== Screen Flash State ======
  const [screenFlash, setScreenFlash] = useState<'red' | 'green' | null>(null);

  // ====== Refs ======
  const bellSoundRef = useRef<HTMLAudioElement | null>(null);
  const timeoutSoundRef = useRef<HTMLAudioElement | null>(null);

  // ====== دوال الألوان النقية من boardState ======
  const getRedColor = useCallback(() => {
    const set = COLOR_SETS[colorSetIndex];
    return isSwapped ? set.green : set.red;
  }, [colorSetIndex, isSwapped]);

  const getGreenColor = useCallback(() => {
    const set = COLOR_SETS[colorSetIndex];
    return isSwapped ? set.red : set.green;
  }, [colorSetIndex, isSwapped]);

  /**
   * دالة موحدة للحصول على لون الفريق
   * اللون = دالة نقية من boardState
   */
  const getTeamColor = useCallback((team: 'red' | 'green'): string => {
    return team === 'red' ? getRedColor() : getGreenColor();
  }, [getRedColor, getGreenColor]);

  // ====== إضافة تنبيه باستخدام Toast (يختفي بعد 2 ثانية) ======
  const addNotification = useCallback((message: string, type: 'buzzer' | 'timeout' | 'info', team?: 'red' | 'green') => {
    const bgColor = type === 'buzzer' 
      ? team === 'red' ? getRedColor() : getGreenColor()
      : '#f97316'; // Orange for timeout

    toast({
      description: message,
      duration: 2000,
      className: "px-8 py-3 rounded-lg text-white font-bold text-lg border-0 shadow-xl animate-pulse pointer-events-none",
      style: {
        backgroundColor: bgColor,
      }
    });
  }, [getRedColor, getGreenColor]);

  // ====== وميض الشاشة (400ms) ======
  const flashScreen = useCallback((teamColor: 'red' | 'green') => {
    setScreenFlash(teamColor);
    setTimeout(() => setScreenFlash(null), 400);
  }, []);

  // ====== تشغيل صوت الجرس ======
  const playBellSound = useCallback(() => {
    if (!bellSoundRef.current) {
      bellSoundRef.current = new Audio('/sounds/bell.mp3');
    }
    bellSoundRef.current.currentTime = 0;
    bellSoundRef.current.play().catch(console.error);
  }, []);

  // ====== تشغيل صوت انتهاء الوقت ======
  const playTimeoutSound = useCallback(() => {
    if (!timeoutSoundRef.current) {
      timeoutSoundRef.current = new Audio('/sounds/timeisup.mp3');
    }
    timeoutSoundRef.current.currentTime = 0;
    timeoutSoundRef.current.play().catch(console.error);
  }, []);

  // ====== الحصول على خلفية الشاشة ======
  const getScreenBackground = useCallback(() => {
    if (screenFlash === 'red') {
      return { backgroundColor: getRedColor() };
    }
    if (screenFlash === 'green') {
      return { backgroundColor: getGreenColor() };
    }
    return {};
  }, [screenFlash, getRedColor, getGreenColor]);

  // ====== تنظيف عند إزالة المكون ======
  useEffect(() => {
    return () => {
      [bellSoundRef, timeoutSoundRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      });
    };
  }, []);

  return {
    // Colors (نقية من boardState)
    getRedColor,
    getGreenColor,
    getTeamColor,
    
    // Screen Flash
    screenFlash,
    flashScreen,
    getScreenBackground,
    
    // Notifications (Toast-based)
    addNotification,
    
    // Sounds
    playBellSound,
    playTimeoutSound,
  };
};
