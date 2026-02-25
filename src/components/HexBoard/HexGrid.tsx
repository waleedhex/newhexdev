import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { t, getLangFromUrl } from '@/lib/i18n';
import { useSearchParams } from 'react-router-dom';
import Hexagon from './Hexagon';
import PartyText from './PartyText';
import GoldenText from './GoldenText';
import FlashEffect from './FlashEffect';
import Confetti from './Confetti';
import ControlButtons from './ControlButtons';
import QuestionPanel from './QuestionPanel';
import AddQuestionPanel from './AddQuestionPanel';
import TeamPlayersPanel from './TeamPlayersPanel';
import { CREAM_COLOR } from './constants';
import { getLogicalColor } from './utils';
import { GridCell } from './types';
import { useBoardState, CellData } from '@/hooks/useBoardState';
import { useHostBoardActions } from '@/hooks/useHostBoardActions';
import { useVisualEffects } from '@/hooks/useVisualEffects';
import { useCelebrationState } from '@/hooks/useCelebrationState';
import { useGameEvents, BuzzerPressedEvent, BuzzerTimeoutEvent } from '@/hooks/useGameEvents';
import { usePlayerStatusNotifications } from '@/hooks/usePlayerStatusNotifications';
import { usePeerConnections } from '@/hooks/usePeerConnections';
import { supabase } from '@/integrations/supabase/client';
import { findWinningPath, pathsMatch } from '@/gameEngine';
import { useSessionExpiry } from '@/hooks/useSessionExpiry';

const HexGrid: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get('code') || '';
  const lang = (searchParams.get('lang') as 'ar' | 'en') || 'ar';

  // إعادة التوجيه عند انتهاء صلاحية الجلسة
  useSessionExpiry(sessionCode);
  
  // ====== استخدام Hook القراءة ======
  const { 
    boardState, 
    loading, 
    error,
    getRedColor, 
    getGreenColor, 
    buildCells,
    checkWinConditions,
    setBoardState,
  } = useBoardState({ sessionCode });

  // ====== استخدام Hook التعديل (للمقدم فقط) ======
  const {
    sessionId,
    isInitialized,
    updateHexagon,
    shuffle: shuffleBoard,
    changeColors: changeColorsAction,
    swapColors: swapColorsAction,
    setGoldenLetter: setGoldenLetterAction,
    setPartyMode,
  } = useHostBoardActions({ sessionCode, boardState, setBoardState });

  // حالة الفوز والمسار
  const [winningPath, setWinningPath] = useState<[number, number][]>([]);
  const [redWon, setRedWon] = useState(false);
  const [greenWon, setGreenWon] = useState(false);
  // Zoom state for large screens
  const [zoomLevel, setZoomLevel] = useState(100);

  // Question Panel State
  const [currentQuestionLetter, setCurrentQuestionLetter] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [useGeneralQuestions, setUseGeneralQuestions] = useState(true);
  const [goldenLetterEnabled, setGoldenLetterEnabled] = useState(true);

  // Cache: letter -> array of questions, and current index per letter
  const questionsCacheRef = useRef<Record<string, { question: string; answer: string }[]>>({});
  const questionIndexRef = useRef<Record<string, number>>({});

  // Refs
  
  const winTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingWinRef = useRef<{ color: 'red' | 'green'; path: [number, number][] } | null>(null);

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

  // ====== Dedup للتنبيهات على مستوى التطبيق ======
  const lastBuzzerEventRef = useRef<{ eventId: string; timestamp: number } | null>(null);
  const lastTimeoutEventRef = useRef<{ eventId: string; timestamp: number } | null>(null);

  // ====== معالجات أحداث البث ======
  const handleBuzzerPressed = useCallback((event: BuzzerPressedEvent) => {
    // منع التكرار: تجاهل نفس الحدث أو أي حدث خلال 3 ثواني
    const now = Date.now();
    const last = lastBuzzerEventRef.current;
    if (last && (last.eventId === event.event_id || now - last.timestamp < 3000)) {
      console.log('⏭️ Host: skipping duplicate buzzer event', event.event_id);
      return;
    }
    lastBuzzerEventRef.current = { eventId: event.event_id, timestamp: now };

    console.log('📡 Host received buzzer event:', event);
    playBellSound();
    flashScreen(event.team);
    
    const lang = getLangFromUrl();
    const teamName = event.team === 'red' ? t(lang, 'redTeamFull') : t(lang, 'greenTeamFull');
    addNotification(`${event.player} ${t(lang, 'buzzerPlayerFrom')} ${teamName}`, 'buzzer', event.team);
  }, [playBellSound, flashScreen, addNotification]);

  const handleBuzzerTimeout = useCallback((event: BuzzerTimeoutEvent) => {
    // منع التكرار
    const now = Date.now();
    const last = lastTimeoutEventRef.current;
    if (last && (last.eventId === event.event_id || now - last.timestamp < 3000)) {
      console.log('⏭️ Host: skipping duplicate timeout event', event.event_id);
      return;
    }
    lastTimeoutEventRef.current = { eventId: event.event_id, timestamp: now };

    console.log('📡 Host received timeout event:', event);
    playTimeoutSound();
    addNotification(t(getLangFromUrl(), 'timeUp'), 'timeout');
  }, [playTimeoutSound, addNotification]);

  // استخدام hook الأحداث
  const { sendPartyMode, sendGoldenCelebration, connectToPeer } = useGameEvents({
    sessionCode,
    onBuzzerPressed: handleBuzzerPressed,
    onBuzzerTimeout: handleBuzzerTimeout,
  });

  // ====== إدارة اتصالات RTC مع المتسابقين ======
  usePeerConnections({
    sessionCode,
    enabled: !!sessionCode,
    onConnectToPeer: connectToPeer,
  });

  // ====== إشعارات حالة اللاعبين ======
  usePlayerStatusNotifications({
    sessionId,
    enabled: true,
  });

  // ====== بناء شبكة منطقية لفحص الفوز ======
  const buildGridState = useCallback((): GridCell[][] => {
    const cells = buildCells();
    return cells.map(row =>
      row.map(cell => ({
        color: getLogicalColor(cell.color, boardState.colorSetIndex, boardState.isSwapped)
      }))
    );
  }, [buildCells, boardState.colorSetIndex, boardState.isSwapped]);

  // ====== إلغاء الفوز المعلق ======
  const cancelPendingWin = useCallback(() => {
    if (winTimerRef.current) {
      clearTimeout(winTimerRef.current);
      winTimerRef.current = null;
    }
    pendingWinRef.current = null;
  }, []);

  // ====== مسح تأثيرات الفوز ======
  const clearWinningEffects = useCallback(() => {
    cancelPendingWin();
    setWinningPath([]);
    setRedWon(false);
    setGreenWon(false);
    stopCelebration();
  }, [cancelPendingWin, stopCelebration]);

  // مرجع لمؤقت إيقاف الاحتفالية
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ====== بدء احتفالية الفوز مع البث (State-driven) ======
  // 🔴 المؤقت الوحيد في النظام - Host هو المصدر الوحيد للحقيقة
  const triggerPartyMode = useCallback((team: 'red' | 'green', path: [number, number][]) => {
    // مسح أي مؤقت سابق
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    
    setWinningPath(path);
    if (team === 'red') setRedWon(true);
    if (team === 'green') setGreenWon(true);
    
    // تحديث الحالة يشغّل الاحتفال تلقائياً
    triggerWinCelebration(team);
    setPartyMode(true);
    sendPartyMode(true, team, path);
    
    // 🔴 بعد 8 ثواني: إرسال partyMode=false لكل الشاشات عبر قاعدة البيانات
    celebrationTimeoutRef.current = setTimeout(async () => {
      console.log('⏱️ Host: إيقاف الاحتفالية بعد 8 ثواني');
      setWinningPath([]);
      stopCelebration();
      
      // 🔴 تحديث قاعدة البيانات ليصل التغيير لكل الشاشات
      await setPartyMode(false);
      sendPartyMode(false, team, []);
    }, 8000);
  }, [triggerWinCelebration, setPartyMode, sendPartyMode, stopCelebration]);

  // ====== بدء احتفالية الحرف الذهبي مع البث (State-driven) ======
  const handleGoldenCelebration = useCallback((letter: string) => {
    triggerGoldenCelebration();
    sendGoldenCelebration(letter);
  }, [triggerGoldenCelebration, sendGoldenCelebration]);

  // ====== جدولة الفوز ======
  const scheduleWin = useCallback((color: 'red' | 'green', path: [number, number][]) => {
    if (pendingWinRef.current) return;
    pendingWinRef.current = { color, path };

    winTimerRef.current = setTimeout(() => {
      const pending = pendingWinRef.current;
      if (!pending || pending.color !== color) return;

      const gridState = buildGridState();
      const currentPath = findWinningPath(gridState, color);

      if (currentPath && pathsMatch(currentPath, pending.path)) {
        triggerPartyMode(color, currentPath);
      }

      pendingWinRef.current = null;
      winTimerRef.current = null;
    }, 2000);
  }, [buildGridState, triggerPartyMode]);

  // ====== فحص شروط الفوز ======
  const checkWinConditionsLocal = useCallback(() => {
    if (pendingWinRef.current) return;

    const gridState = buildGridState();
    if (!redWon) {
      const path = findWinningPath(gridState, 'red');
      if (path) scheduleWin('red', path);
    }
    if (!greenWon) {
      const path = findWinningPath(gridState, 'green');
      if (path) scheduleWin('green', path);
    }
  }, [buildGridState, redWon, greenWon, scheduleWin]);

  // ====== استنتاج لغة الجلسة من الحروف ======
  const sessionLang = useMemo(() => {
    if (boardState.lettersOrder.length > 0) {
      const firstLetter = boardState.lettersOrder[0];
      // إذا كان الحرف الأول لاتيني، فاللغة إنجليزية
      return /^[A-Z]/.test(firstLetter) ? 'en' : 'ar';
    }
    return 'ar';
  }, [boardState.lettersOrder]);

  // ====== جلب الأسئلة مع التخزين المؤقت ======
  const fetchQuestion = useCallback(async (letter: string) => {
    setCurrentQuestionLetter(letter);

    const cacheKey = `${useGeneralQuestions ? 'g' : 's'}_${letter}`;
    const cached = questionsCacheRef.current[cacheKey];

    if (cached && cached.length > 0) {
      // Use cached questions - cycle through them instantly
      const idx = (questionIndexRef.current[cacheKey] ?? -1) + 1;
      const nextIdx = idx >= cached.length ? 0 : idx;
      questionIndexRef.current[cacheKey] = nextIdx;
      setCurrentQuestion(cached[nextIdx].question);
      setCurrentAnswer(cached[nextIdx].answer);
      return;
    }

    // First time for this letter - fetch all questions at once
    setQuestionLoading(true);
    setCurrentQuestion(null);
    setCurrentAnswer(null);

    try {
      let data = null;
      let error = null;
      
      if (useGeneralQuestions) {
        // فلترة الأسئلة العامة حسب اللغة المستنتجة من الحروف
        let query = supabase.from('general_questions').select('question, answer').eq('letter', letter);
        if (sessionLang === 'en') {
          query = query.eq('lang', 'E');
        } else {
          query = query.or('lang.is.null,lang.eq.');
        }
        const result = await query;
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase.from('session_questions').select('question, answer').eq('session_code', sessionCode).eq('letter', letter);
        data = result.data;
        error = result.error;
      }

      if (!error && data && data.length > 0) {
        // Shuffle and cache all questions for this letter
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        questionsCacheRef.current[cacheKey] = shuffled;
        questionIndexRef.current[cacheKey] = 0;
        setCurrentQuestion(shuffled[0].question);
        setCurrentAnswer(shuffled[0].answer);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setQuestionLoading(false);
    }
  }, [sessionCode, useGeneralQuestions, sessionLang]);

  // Clear cache when question type changes
  useEffect(() => {
    questionsCacheRef.current = {};
    questionIndexRef.current = {};
  }, [useGeneralQuestions]);

  // ====== معالجة النقر على المسدس ======
  // صوت نقرة خفيفة باستخدام Web Audio API
  const playClickSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }, []);

  const handleHexClick = useCallback((rowIndex: number, colIndex: number) => {
    cancelPendingWin();

    const cells = buildCells();
    const cell = cells[rowIndex]?.[colIndex];
    if (!cell || cell.isFixed) return;

    // تشغيل صوت النقرة
    playClickSound();

    // تحقق من الحرف الذهبي (فقط إذا كانت الميزة مفعلة)
    if (goldenLetterEnabled && cell.letter === boardState.goldenLetter && cell.clickCount === 0) {
      handleGoldenCelebration(cell.letter);
      setGoldenLetterAction(null);
    }

    // عرض السؤال عند النقرة الأولى
    if (cell.clickCount === 0 && cell.letter) {
      fetchQuestion(cell.letter);
    }

    const newCount = (cell.clickCount + 1) % 5;
    
    // استخدام دالة التحديث من hook التعديل
    updateHexagon(cell.letter, newCount);
  }, [cancelPendingWin, buildCells, boardState.goldenLetter, goldenLetterEnabled,
      handleGoldenCelebration, setGoldenLetterAction, fetchQuestion, updateHexagon, playClickSound]);

  // ====== خلط اللوحة ======
  const shuffle = useCallback(() => {
    cancelPendingWin();
    clearWinningEffects();
    shuffleBoard();
  }, [cancelPendingWin, clearWinningEffects, shuffleBoard]);

  // ====== تبديل الألوان ======
  const swapColors = useCallback(() => {
    cancelPendingWin();
    swapColorsAction();
  }, [cancelPendingWin, swapColorsAction]);

  // ====== تغيير مجموعة الألوان ======
  const changeColors = useCallback(() => {
    cancelPendingWin();
    changeColorsAction();
  }, [cancelPendingWin, changeColorsAction]);

  // ====== فحص الفوز بعد تغيير حالة اللوحة ======
  useEffect(() => {
    if (isInitialized && Object.keys(boardState.hexagons).length > 0) {
      checkWinConditionsLocal();
    }
  }, [boardState.hexagons, isInitialized, checkWinConditionsLocal]);

  // ====== تنظيف عند الإزالة ======
  useEffect(() => {
    return () => {
      if (winTimerRef.current) clearTimeout(winTimerRef.current);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    };
  }, []);

  // ====== حساب تأخير الأنيميشن ======
  const getWinAnimationDelay = (r: number, c: number) => {
    const index = winningPath.findIndex(([wr, wc]) => wr === r && wc === c);
    return index >= 0 ? index * 80 : 0;
  };

  const isInWinningPath = (r: number, c: number) => {
    return winningPath.some(([wr, wc]) => wr === r && wc === c);
  };

  // بناء الخلايا للعرض
  const cells = buildCells(winningPath);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">{t(lang, 'loading')}</div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col items-center justify-start min-h-screen bg-background p-[1vw] pb-16 w-full box-border font-tajawal overflow-auto relative transition-colors duration-100" 
      dir="rtl"
      style={getScreenBackground()}
    >
      {/* Zoom slider - large screens only */}
      <div className="hidden lg:flex items-center gap-3 mb-2 w-full max-w-2xl lg:max-w-none justify-center">
        <span className="text-foreground text-sm select-none">−</span>
        <input
          type="range"
          min={50}
          max={150}
          value={zoomLevel}
          onChange={(e) => setZoomLevel(Number(e.target.value))}
          className="w-48 accent-primary cursor-pointer"
        />
        <span className="text-foreground text-sm select-none">+</span>
        <span className="text-muted-foreground text-xs select-none">{zoomLevel}%</span>
      </div>

      <div
        className="w-full max-w-2xl lg:max-w-none mx-auto p-0 bg-card rounded-[1vw] shadow-[0_0.4vw_0.8vw_rgba(0,0,0,0.3)] overflow-hidden flex flex-col items-center relative"
        style={{
          transform: `scale(${zoomLevel / 100})`,
          transformOrigin: 'top center',
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
              gap: 'calc(90vw / 100)',
              marginTop: rowIndex !== 0 ? 'calc(-90vw / 35)' : 0,
              marginRight: rowIndex % 2 === 0 ? 'calc(0.5 * (90vw / 7) + (90vw / 200))' : 0,
              marginLeft: rowIndex % 2 === 1 ? 'calc(0.5 * (90vw / 7) + (90vw / 200))' : 0
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
                onClick={() => handleHexClick(rowIndex, colIndex)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* التنبيهات الآن تُدار بواسطة Toast في Toaster component */}

      <ControlButtons
        onShuffle={shuffle}
        onSwapColors={swapColors}
        onChangeColors={changeColors}
        onParty={() => triggerPartyMode('red', [])}
        sessionCode={sessionCode}
        buzzer={null}
        redColor={getRedColor()}
        greenColor={getGreenColor()}
        goldenLetterEnabled={goldenLetterEnabled}
        onToggleGoldenLetter={() => setGoldenLetterEnabled(!goldenLetterEnabled)}
      />

      <QuestionPanel
        letter={currentQuestionLetter}
        question={currentQuestion}
        answer={currentAnswer}
        onNext={() => {
          if (currentQuestionLetter) {
            fetchQuestion(currentQuestionLetter);
          }
        }}
        loading={questionLoading}
        useGeneralQuestions={useGeneralQuestions}
        onToggleQuestionType={() => setUseGeneralQuestions(!useGeneralQuestions)}
      />

      {!useGeneralQuestions && <AddQuestionPanel sessionCode={sessionCode} selectedLetter={currentQuestionLetter} />}

      {/* صندوقي الفرق */}
      <TeamPlayersPanel
        sessionId={sessionId}
        redColor={getRedColor()}
        greenColor={getGreenColor()}
      />
    </div>
  );
};

export default HexGrid;
