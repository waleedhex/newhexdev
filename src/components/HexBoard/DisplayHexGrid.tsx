import React, { useCallback, useState, useEffect, useRef } from 'react';
import { t } from '@/lib/i18n';
import { useSearchParams } from 'react-router-dom';
import Hexagon from './Hexagon';
import PartyText from './PartyText';
import GoldenText from './GoldenText';
import FlashEffect from './FlashEffect';
import Confetti from './Confetti';
import { Loader2 } from 'lucide-react';
import { useBoardState } from '@/hooks/useBoardState';
import { useGameEvents, BuzzerPressedEvent, BuzzerTimeoutEvent, PartyModeEvent, GoldenCelebrationEvent } from '@/hooks/useGameEvents';
import { useVisualEffects } from '@/hooks/useVisualEffects';
import { useCelebrationState } from '@/hooks/useCelebrationState';

interface DisplayHexGridProps {
  playerName?: string;
}

const DisplayHexGrid: React.FC<DisplayHexGridProps> = ({ playerName }) => {
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get('code') || '';
  const lang = (searchParams.get('lang') as 'ar' | 'en') || 'ar';
  
  // ====== استخدام Hook القراءة فقط ======
  const { 
    boardState, 
    loading, 
    error,
    getRedColor, 
    getGreenColor, 
    buildCells: buildCellsFromHook,
  } = useBoardState({ sessionCode });
  
  // حالة المسار الفائز (يُستلم من البث)
  const [winningPath, setWinningPath] = useState<[number, number][]>([]);

  // ====== التأثيرات البصرية الفورية ======
  const {
    flashScreen,
    getScreenBackground,
    addNotification,
    playBellSound,
    playTimeoutSound,
  } = useVisualEffects({ 
    colorSetIndex: boardState.colorSetIndex, 
    isSwapped: boardState.isSwapped 
  });

  // ====== حالة الاحتفالات (State-driven) ======
  const {
    showParty,
    partyTextColor,
    partyFlashes,
    showGoldenCelebration,
    goldenFlashes,
    triggerWinCelebration,
    triggerGoldenCelebration,
    stopCelebration,
  } = useCelebrationState({
    partyMode: boardState.partyMode,
    colorSetIndex: boardState.colorSetIndex,
    isSwapped: boardState.isSwapped,
  });

  // ====== Dedup للتنبيهات ======
  const lastBuzzerEventRef = useRef<{ eventId: string; timestamp: number } | null>(null);
  const lastTimeoutEventRef = useRef<{ eventId: string; timestamp: number } | null>(null);

  // ====== معالجات أحداث اللعبة (من البث) ======
  const handleBuzzerPressed = useCallback((event: BuzzerPressedEvent) => {
    const now = Date.now();
    const last = lastBuzzerEventRef.current;
    if (last && (last.eventId === event.event_id || now - last.timestamp < 3000)) return;
    lastBuzzerEventRef.current = { eventId: event.event_id, timestamp: now };

    playBellSound();
    flashScreen(event.team);
    const teamName = event.team === 'red' ? 'الأحمر' : 'الأخضر';
    addNotification(`${event.player} من الفريق ${teamName} ضغط الجرس`, 'buzzer', event.team);
  }, [playBellSound, flashScreen, addNotification]);

  const handleBuzzerTimeout = useCallback((event: BuzzerTimeoutEvent) => {
    const now = Date.now();
    const last = lastTimeoutEventRef.current;
    if (last && (last.eventId === event.event_id || now - last.timestamp < 3000)) return;
    lastTimeoutEventRef.current = { eventId: event.event_id, timestamp: now };

    playTimeoutSound();
    addNotification('انتهى الوقت', 'timeout');
  }, [playTimeoutSound, addNotification]);

  // ✅ النقطة 4: Display يستقبل طلقة واحدة ويشغّل مؤقت محلي 8 ثوانٍ
  const displayPartyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handlePartyMode = useCallback((event: PartyModeEvent) => {
    console.log('📡 Display received party mode event:', event);
    
    if (!event.active) return; // تجاهل أي رسالة إيقاف قديمة
    
    // مسح أي مؤقت سابق
    if (displayPartyTimeoutRef.current) {
      clearTimeout(displayPartyTimeoutRef.current);
    }
    
    // بدء الاحتفال
    setWinningPath(event.winningPath || []);
    triggerWinCelebration(event.winningTeam);
    
    // ✅ مؤقت محلي — إيقاف تلقائي بعد 8 ثوانٍ
    displayPartyTimeoutRef.current = setTimeout(() => {
      console.log('⏱️ Display: إيقاف الاحتفالية تلقائياً بعد 8 ثواني');
      setWinningPath([]);
      stopCelebration();
      displayPartyTimeoutRef.current = null;
    }, 8000);
  }, [triggerWinCelebration, stopCelebration]);

  const handleGoldenCelebration = useCallback((event: GoldenCelebrationEvent) => {
    console.log('📡 Display received golden celebration event:', event);
    triggerGoldenCelebration();
  }, [triggerGoldenCelebration]);

  // Use game events hook for instant events
  useGameEvents({
    sessionCode,
    onBuzzerPressed: handleBuzzerPressed,
    onBuzzerTimeout: handleBuzzerTimeout,
    onPartyMode: handlePartyMode,
    onGoldenCelebration: handleGoldenCelebration,
  });

  // لا حاجة لمؤقت تنظيف - المؤقت فقط في Host

  // ====== حساب تأخير الأنيميشن المتتالي (مثل شاشة المقدم) ======
  const getWinAnimationDelay = (r: number, c: number) => {
    const index = winningPath.findIndex(([wr, wc]) => wr === r && wc === c);
    return index >= 0 ? index * 80 : 0;
  };

  const isInWinningPath = (r: number, c: number) => {
    return winningPath.some(([wr, wc]) => wr === r && wc === c);
  };

  // بناء الخلايا باستخدام hook القراءة مع المسار الفائز
  const cells = buildCellsFromHook(winningPath);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <span className="text-lg text-muted-foreground">{t(lang, 'loading')}</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-4 p-8 bg-card rounded-lg shadow-lg">
          <span className="text-xl text-destructive">{error}</span>
          <span className="text-muted-foreground">تأكد من صحة رمز الجلسة</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen h-screen p-[1vh] w-full box-border font-tajawal overflow-hidden transition-colors duration-100 bg-background"
      dir="rtl"
      style={getScreenBackground()}
    >

      {/* Hex Grid - Height based sizing */}
      <div
        className="p-0 bg-card rounded-[1vh] shadow-[0_0.4vh_0.8vh_rgba(0,0,0,0.3)] overflow-hidden flex flex-col items-center relative pointer-events-none"
        style={{
          width: 'calc(7 * (75vh / 7) + 6 * (75vh / 200))'
        }}
      >
        <Confetti active={showParty} />
        <PartyText visible={showParty} textColor={partyTextColor} text={t(lang, 'congratsText')} />
        <GoldenText visible={showGoldenCelebration} text={t(lang, 'goldenLetterText')} />
        {partyFlashes.map(flash => (
          <FlashEffect key={flash.id} left={flash.left} top={flash.top} color={flash.color} />
        ))}
        {goldenFlashes.map(flash => (
          <FlashEffect key={flash.id} left={flash.left} top={flash.top} color={flash.color} />
        ))}

        {cells.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex justify-center"
            style={{
              gap: 'calc(75vh / 100)',
              marginTop: rowIndex !== 0 ? 'calc(-75vh / 35)' : 0,
              marginRight: rowIndex % 2 === 0 ? 'calc(0.5 * (75vh / 7) + (75vh / 200))' : 0,
              marginLeft: rowIndex % 2 === 1 ? 'calc(0.5 * (75vh / 7) + (75vh / 200))' : 0
            }}
          >
          {row.map((cell, colIndex) => (
              <Hexagon
                key={colIndex}
                letter={cell.letter}
                backgroundColor={cell.color}
                isWinning={isInWinningPath(rowIndex, colIndex)}
                winAnimationDelay={getWinAnimationDelay(rowIndex, colIndex)}
                isFixed={cell.isFixed}
                fixedType={cell.fixedType}
                clipClass={cell.clipClass}
                onClick={() => {}}
                sizeUnit="vh"
              />
            ))}
          </div>
        ))}
      </div>

      {/* التنبيهات الآن تُدار بواسطة Toast في Toaster component */}
    </div>
  );
};

export default DisplayHexGrid;
