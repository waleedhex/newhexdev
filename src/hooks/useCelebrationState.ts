import { useState, useEffect, useCallback, useRef } from 'react';
import { COLOR_SETS, GOLD_COLOR } from '@/components/HexBoard/constants';
import { rgbToHex } from '@/components/HexBoard/utils';

// ====== أنواع الاحتفالات ======
export type CelebrationType = 'win' | 'golden' | null;

export interface CelebrationState {
  isActive: boolean;
  type: CelebrationType;
  winningTeam: 'red' | 'green' | null;
}

interface FlashData {
  id: number;
  left: string;
  top: string;
  color: string;
}

interface UseCelebrationStateProps {
  /** حالة الاحتفال من boardState (partyMode) */
  partyMode: boolean;
  /** مؤشر مجموعة الألوان الحالية */
  colorSetIndex: number;
  /** هل الألوان مقلوبة */
  isSwapped: boolean;
}

/**
 * Hook لإدارة حالة الاحتفالات بشكل State-driven
 * 
 * المبدأ: الاحتفالات تُشغَّل عبر تغيير الحالة، لا عبر استدعاء دوال
 * 
 * ❌ القديم (Event-driven):
 *    onWin() → startPartyMode()
 * 
 * ✅ الجديد (State-driven):
 *    boardState.partyMode = true → useEffect يستجيب تلقائياً
 */
export const useCelebrationState = ({
  partyMode,
  colorSetIndex,
  isSwapped,
}: UseCelebrationStateProps) => {
  // ====== حالة الاحتفال المحلية ======
  const [celebration, setCelebration] = useState<CelebrationState>({
    isActive: false,
    type: null,
    winningTeam: null,
  });

  // ====== حالة التأثيرات البصرية ======
  const [partyTextColor, setPartyTextColor] = useState(GOLD_COLOR);
  const [partyFlashes, setPartyFlashes] = useState<FlashData[]>([]);
  const [goldenFlashes, setGoldenFlashes] = useState<FlashData[]>([]);

  // ====== المراجع ======
  const flashIdRef = useRef(0);
  const partyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const partyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goldenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goldenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // لمنع إعادة تشغيل احتفالية الفوز طالما partyMode ما زال true
  const prevPartyModeRef = useRef(false);
  
  // Sound Refs
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const goldSoundRef = useRef<HTMLAudioElement | null>(null);

  // ====== دوال مساعدة للألوان (نقية من boardState) ======
  const getTeamColor = useCallback((team: 'red' | 'green'): string => {
    const set = COLOR_SETS[colorSetIndex];
    if (isSwapped) {
      return team === 'red' ? set.green : set.red;
    }
    return team === 'red' ? set.red : set.green;
  }, [colorSetIndex, isSwapped]);

  // ====== إيقاف تأثيرات احتفال الفوز ======
  const stopPartyEffects = useCallback(() => {
    if (partyIntervalRef.current) {
      clearInterval(partyIntervalRef.current);
      partyIntervalRef.current = null;
    }
    if (partyTimeoutRef.current) {
      clearTimeout(partyTimeoutRef.current);
      partyTimeoutRef.current = null;
    }
    if (winSoundRef.current) {
      winSoundRef.current.pause();
      winSoundRef.current.currentTime = 0;
    }
    setPartyFlashes([]);
    setPartyTextColor(GOLD_COLOR);
  }, []);

  // ====== بدء تأثيرات احتفال الفوز ======
  // ملاحظة: لا يوجد مؤقت هنا - المؤقت يكون في Host فقط ويرسل partyMode=false للكل
  const startPartyEffects = useCallback(() => {
    // إيقاف أي تأثيرات سابقة
    stopPartyEffects();
    
    // تشغيل الصوت (بدون تكرار)
    if (!winSoundRef.current) {
      winSoundRef.current = new Audio('/sounds/winning.mp3');
    }
    winSoundRef.current.loop = false;
    winSoundRef.current.currentTime = 0;
    winSoundRef.current.play().catch(console.error);
    
    // تأثيرات بصرية
    partyIntervalRef.current = setInterval(() => {
      setPartyTextColor(prev =>
        rgbToHex(prev) === GOLD_COLOR ? COLOR_SETS[colorSetIndex].red : GOLD_COLOR
      );

      const newFlashes: FlashData[] = [];
      for (let i = 0; i < 5; i++) {
        const colors = [GOLD_COLOR, '#ff4500', '#00ff00'];
        newFlashes.push({
          id: flashIdRef.current++,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          color: colors[Math.floor(Math.random() * 3)]
        });
      }
      setPartyFlashes(prev => [...prev, ...newFlashes]);

      setTimeout(() => {
        setPartyFlashes(prev => prev.filter(f => !newFlashes.find(nf => nf.id === f.id)));
      }, 1000);
    }, 300);
    
    // ❌ لا مؤقت محلي هنا - يتوقف عندما يرسل Host الأمر partyMode=false
  }, [colorSetIndex, stopPartyEffects]);

  // ====== إيقاف تأثيرات احتفال الحرف الذهبي ======
  const stopGoldenEffects = useCallback(() => {
    if (goldenIntervalRef.current) {
      clearInterval(goldenIntervalRef.current);
      goldenIntervalRef.current = null;
    }
    if (goldenTimeoutRef.current) {
      clearTimeout(goldenTimeoutRef.current);
      goldenTimeoutRef.current = null;
    }
    if (goldSoundRef.current) {
      goldSoundRef.current.pause();
      goldSoundRef.current.currentTime = 0;
    }
    setGoldenFlashes([]);
  }, []);

  // ====== بدء تأثيرات احتفال الحرف الذهبي ======
  const startGoldenEffects = useCallback(() => {
    // إيقاف أي تأثيرات سابقة
    stopGoldenEffects();
    
    // تشغيل الصوت
    if (!goldSoundRef.current) {
      goldSoundRef.current = new Audio('/sounds/gold.mp3');
    }
    goldSoundRef.current.currentTime = 0;
    goldSoundRef.current.play().catch(console.error);
    
    // تأثيرات بصرية
    goldenIntervalRef.current = setInterval(() => {
      const colors = [GOLD_COLOR, '#ff4500'];
      const newFlashes: FlashData[] = [];
      for (let i = 0; i < 5; i++) {
        newFlashes.push({
          id: flashIdRef.current++,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          color: colors[Math.floor(Math.random() * 2)]
        });
      }
      setGoldenFlashes(prev => [...prev, ...newFlashes]);

      setTimeout(() => {
        setGoldenFlashes(prev => prev.filter(f => !newFlashes.find(nf => nf.id === f.id)));
      }, 1000);
    }, 300);
    
    // إيقاف بعد 3 ثواني
    goldenTimeoutRef.current = setTimeout(() => {
      stopGoldenEffects();
      setCelebration(prev => ({ ...prev, isActive: false, type: null }));
    }, 3000);
  }, [stopGoldenEffects]);

  // ====== 🔴 المحور الأساسي: State-driven Effect ======
  // هذا الـ useEffect يستجيب للحالة، لا للأحداث
  useEffect(() => {
    if (celebration.isActive) {
      if (celebration.type === 'win') {
        startPartyEffects();
      } else if (celebration.type === 'golden') {
        startGoldenEffects();
      }
    } else {
      stopPartyEffects();
      stopGoldenEffects();
    }
  }, [celebration.isActive, celebration.type, startPartyEffects, startGoldenEffects, stopPartyEffects, stopGoldenEffects]);

  // ====== الاستجابة لتغيير partyMode من boardState ======
  // مهم: نشتغل فقط على حافة التغيير (false -> true) حتى لو أوقفنا الاحتفال بعد 8 ثواني
  // لأن بعض الشاشات تبقي partyMode = true لفترة أطول.
  useEffect(() => {
    const wasPartyMode = prevPartyModeRef.current;

    // بدأ للتو
    if (partyMode && !wasPartyMode) {
      setCelebration({
        isActive: true,
        type: 'win',
        winningTeam: null,
      });
    }

    // توقف للتو
    if (!partyMode && wasPartyMode) {
      setCelebration({
        isActive: false,
        type: null,
        winningTeam: null,
      });
    }

    prevPartyModeRef.current = partyMode;
  }, [partyMode]);

  // ====== دالة لبدء احتفال الفوز (تغيير الحالة فقط) ======
  const triggerWinCelebration = useCallback((team: 'red' | 'green') => {
    setCelebration({
      isActive: true,
      type: 'win',
      winningTeam: team,
    });
  }, []);

  // ====== دالة لبدء احتفال الحرف الذهبي ======
  const triggerGoldenCelebration = useCallback(() => {
    setCelebration({
      isActive: true,
      type: 'golden',
      winningTeam: null,
    });
  }, []);

  // ====== دالة لإيقاف أي احتفال ======
  const stopCelebration = useCallback(() => {
    setCelebration({
      isActive: false,
      type: null,
      winningTeam: null,
    });
  }, []);

  // ====== تنظيف عند إزالة المكون ======
  useEffect(() => {
    return () => {
      if (partyIntervalRef.current) clearInterval(partyIntervalRef.current);
      if (partyTimeoutRef.current) clearTimeout(partyTimeoutRef.current);
      if (goldenIntervalRef.current) clearInterval(goldenIntervalRef.current);
      if (goldenTimeoutRef.current) clearTimeout(goldenTimeoutRef.current);
      
      [winSoundRef, goldSoundRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      });
    };
  }, []);

  return {
    // الحالة
    celebration,
    showParty: celebration.isActive && celebration.type === 'win',
    showGoldenCelebration: celebration.isActive && celebration.type === 'golden',
    
    // التأثيرات البصرية
    partyTextColor,
    partyFlashes,
    goldenFlashes,
    
    // دوال التحكم (تغيير الحالة فقط، لا تشغيل مباشر)
    triggerWinCelebration,
    triggerGoldenCelebration,
    stopCelebration,
    
    // دالة الألوان النقية
    getTeamColor,
  };
};
