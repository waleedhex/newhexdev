import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Bell } from 'lucide-react';
import { t, getLangFromUrl, isRtl } from '@/lib/i18n';
import { Json } from '@/integrations/supabase/types';
import Hexagon from '@/components/HexBoard/Hexagon';
import Confetti from '@/components/HexBoard/Confetti';
import PartyText from '@/components/HexBoard/PartyText';
import GoldenText from '@/components/HexBoard/GoldenText';
import { useBoardState } from '@/hooks/useBoardState';
import { useContestantChannel, BuzzerPressedEvent, BuzzerTimeoutEvent, PartyModeEvent, GoldenCelebrationEvent, BuzzerData } from '@/hooks/useContestantChannel';
import { useVisualEffects } from '@/hooks/useVisualEffects';
import { useCelebrationState } from '@/hooks/useCelebrationState';
import { validateSubscriptionCode, createOrResumeSession } from '@/hooks/useRoomValidation';
import { useConnectionResilience } from '@/hooks/useConnectionResilience';
import ConnectionStatus from '@/components/ConnectionStatus';
import { useSessionExpiry } from '@/hooks/useSessionExpiry';

// Helper function للتحميل الأولي
const parseBuzzerData = (data: Json | null): BuzzerData => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { active: false, player: '', team: null };
  }
  const obj = data as Record<string, unknown>;
  return {
    active: Boolean(obj.active),
    player: String(obj.player || ''),
    team: (obj.team === 'red' || obj.team === 'green') ? obj.team : null,
    timestamp: obj.timestamp as number | undefined,
    isTimeOut: Boolean(obj.isTimeOut),
  };
};

const ContestantPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const name = searchParams.get('name') || '';
  const code = searchParams.get('code') || '';
  const decodedName = decodeURIComponent(name);

  // إعادة التوجيه عند انتهاء صلاحية الجلسة
  useSessionExpiry(code);

  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [team, setTeam] = useState<'red' | 'green' | null>(null);
  const [buzzer, setBuzzer] = useState<BuzzerData>({ active: false, player: '', team: null });
  const [isPressing, setIsPressing] = useState(false);
  const [buzzerDisabledUntil, setBuzzerDisabledUntil] = useState<number>(0);
  const [winningPath, setWinningPath] = useState<[number, number][]>([]);
  
  const timeoutShownRef = useRef(false);

  // ====== استخدام Hook القراءة فقط ======
  const { 
    boardState,
    getRedColor, 
    getGreenColor, 
    buildCells: buildCellsFromHook,
  } = useBoardState({ sessionCode: code });

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
    showGoldenCelebration,
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
    const lang = getLangFromUrl();
    const teamName = event.team === 'red' ? t(lang, 'redTeamFull') : t(lang, 'greenTeamFull');
    addNotification(`${event.player} ${t(lang, 'buzzerPlayerFrom')} ${teamName}`, 'buzzer', event.team);
    setBuzzerDisabledUntil(Date.now() + 6000);
  }, [playBellSound, flashScreen, addNotification]);

  const handleBuzzerTimeout = useCallback((event: BuzzerTimeoutEvent) => {
    const now = Date.now();
    const last = lastTimeoutEventRef.current;
    if (last && (last.eventId === event.event_id || now - last.timestamp < 3000)) return;
    lastTimeoutEventRef.current = { eventId: event.event_id, timestamp: now };

    playTimeoutSound();
    addNotification(t(getLangFromUrl(), 'timeUp'), 'timeout');
  }, [playTimeoutSound, addNotification]);

  const handlePartyMode = useCallback((event: PartyModeEvent) => {
    console.log('📡 Contestant received party mode event:', event);
    if (event.active) {
      setWinningPath(event.winningPath || []);
      triggerWinCelebration(event.winningTeam);
    } else {
      console.log('📡 Contestant: إيقاف الاحتفالية (أمر من Host)');
      setWinningPath([]);
      stopCelebration();
    }
  }, [triggerWinCelebration, stopCelebration]);

  const handleGoldenCelebration = useCallback((event: GoldenCelebrationEvent) => {
    console.log('📡 Received golden celebration event:', event);
    triggerGoldenCelebration();
  }, [triggerGoldenCelebration]);

  // ====== معالج تغيير الـ Buzzer ======
  const handleBuzzerChange = useCallback((newBuzzer: BuzzerData) => {
    setBuzzer(newBuzzer);
    if (newBuzzer.isTimeOut && !timeoutShownRef.current) {
      timeoutShownRef.current = true;
    }
    if (!newBuzzer.isTimeOut && !newBuzzer.active) {
      timeoutShownRef.current = false;
    }
  }, []);

  // ====== معالج تغيير الفريق ======
  const handleTeamChange = useCallback((newTeam: 'red' | 'green') => {
    setTeam(newTeam);
  }, []);

  // ====== معالج الطرد (يُستخدم لكل من القناة الموحدة و useConnectionResilience) ======
  const handleKickedFromChannel = useCallback(() => {
    console.log('🚫 Player was kicked - redirecting to home');
    navigate('/');
  }, [navigate]);

  // ====== القناة الموحدة للمتسابق ======
  const { sendBuzzerPressed, sendBuzzerTimeout } = useContestantChannel({
    sessionCode: code,
    sessionId,
    playerId,
    playerName: decodedName,
    onBuzzerPressed: handleBuzzerPressed,
    onBuzzerTimeout: handleBuzzerTimeout,
    onPartyMode: handlePartyMode,
    onGoldenCelebration: handleGoldenCelebration,
    onBuzzerChange: handleBuzzerChange,
    onTeamChange: handleTeamChange,
    onKicked: handleKickedFromChannel,
  });

  const cells = buildCellsFromHook(winningPath);

  const getWinAnimationDelay = useCallback((r: number, c: number) => {
    const index = winningPath.findIndex(([wr, wc]) => wr === r && wc === c);
    return index >= 0 ? index * 80 : 0;
  }, [winningPath]);

  const isInWinningPath = useCallback((r: number, c: number) => {
    return winningPath.some(([wr, wc]) => wr === r && wc === c);
  }, [winningPath]);

  // ====== تسجيل اللاعب في session_players ======
  const registerPlayer = useCallback(async (sessId: string): Promise<{ playerId: string; team: 'red' | 'green' } | null> => {
    try {
      // 1. تحقق إذا اللاعب مسجل مسبقاً
      const { data: existingPlayer } = await supabase
        .from('session_players')
        .select('id, team')
        .eq('session_id', sessId)
        .eq('player_name', decodedName)
        .eq('role', 'contestant')
        .maybeSingle();

      if (existingPlayer) {
        // تحديث حالة الاتصال
        await supabase
          .from('session_players')
          .update({ 
            is_connected: true, 
            last_seen: new Date().toISOString() 
          })
          .eq('id', existingPlayer.id);
        
        return { 
          playerId: existingPlayer.id, 
          team: (existingPlayer.team as 'red' | 'green') || 'red' 
        };
      }

      // 2. حساب الفريق بناءً على عدد اللاعبين الحاليين
      const { data: players } = await supabase
        .from('session_players')
        .select('team')
        .eq('session_id', sessId)
        .eq('role', 'contestant');

      const redCount = players?.filter(p => p.team === 'red').length || 0;
      const greenCount = players?.filter(p => p.team === 'green').length || 0;
      const assignedTeam = redCount <= greenCount ? 'red' : 'green';

      // 3. تسجيل اللاعب الجديد
      const { data: newPlayer, error } = await supabase
        .from('session_players')
        .insert({
          session_id: sessId,
          player_name: decodedName,
          role: 'contestant',
          team: assignedTeam,
          is_connected: true,
          last_seen: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error registering player:', error);
        return null;
      }

      return { playerId: newPlayer.id, team: assignedTeam };
    } catch (err) {
      console.error('Error in registerPlayer:', err);
      return null;
    }
  }, [decodedName]);

  // ====== نظام إعادة الاتصال التلقائي ======
  const handleReconnected = useCallback(() => {
    console.log('✅ Reconnected - board is already synced via useBoardState');
    // اللوحة متزامنة تلقائياً عبر useBoardState
  }, []);

  const handleDisconnectedPermanently = useCallback(() => {
    console.log('❌ Disconnected permanently - removing from session');
    if (playerId) {
      // إخراج اللاعب من الجلسة
      supabase
        .from('session_players')
        .delete()
        .eq('id', playerId)
        .then(() => {
          navigate('/');
        });
    } else {
      navigate('/');
    }
  }, [playerId, navigate]);

  // handleKicked يُستخدم لكل من useConnectionResilience و useContestantChannel
  const handleKicked = useCallback(() => {
    console.log('🚫 Player was kicked from session');
    navigate('/');
  }, [navigate]);

  const {
    status: connectionStatus,
    reconnectAttempt,
    maxAttempts,
    isOnline,
    forceReconnect,
  } = useConnectionResilience({
    playerId,
    sessionId,
    sessionCode: code,
    onReconnected: handleReconnected,
    onDisconnected: handleDisconnectedPermanently,
    onKicked: handleKicked,
  });

  // ====== تحميل الجلسة وتسجيل اللاعب ======
  useEffect(() => {
    if (!code || !name) {
      navigate('/');
      return;
    }

    const loadSession = async () => {
      try {
        // 1. التحقق من كود الاشتراك
        const subscriptionResult = await validateSubscriptionCode(code);
        if (!subscriptionResult.isValid) {
          console.error('Invalid subscription code');
          navigate('/');
          return;
        }

        // 2. إنشاء أو استئناف الجلسة
        const sessionResult = await createOrResumeSession(code);
        if (!sessionResult.success) {
          console.error('Failed to create/resume session:', sessionResult.error);
          navigate('/');
          return;
        }

        // 3. جلب بيانات الجلسة
        const { data, error } = await supabase
          .from('game_sessions')
          .select('id, buzzer')
          .eq('id', sessionResult.sessionId)
          .single();

        if (error) {
          console.error('Error fetching session:', error);
          navigate('/');
          return;
        }

        setSessionId(data.id);
        setBuzzer(parseBuzzerData(data.buzzer));

        // 4. تسجيل اللاعب في session_players
        const playerResult = await registerPlayer(data.id);
        if (!playerResult) {
          console.error('Failed to register player');
          navigate('/');
          return;
        }

        setPlayerId(playerResult.playerId);
        setTeam(playerResult.team);

        // Heartbeat يُدار الآن من useConnectionResilience

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading session:', err);
        navigate('/');
      }
    };

    loadSession();
  }, [code, name, navigate, registerPlayer]);

  // ====== القنوات القديمة تم استبدالها بـ useContestantChannel ======
  // تم دمج الاشتراكات في قناة موحدة لتقليل استهلاك الموارد

  // Timer to reset buzzer after 6 seconds
  useEffect(() => {
    if (!buzzer.active || !sessionId) return;
    
    const resetTimer = setTimeout(async () => {
      if (buzzer.player !== decodedName) return;
      
      sendBuzzerTimeout();

      // Atomic reset with timeout flag
      await (supabase.rpc as any)('reset_buzzer', {
        p_session_id: sessionId,
        p_is_timeout: true,
      });

      if (!timeoutShownRef.current) {
        timeoutShownRef.current = true;
      addNotification(t(getLangFromUrl(), 'timeUp'), 'timeout');
      }
      
      // Clear timeout flag after 500ms
      setTimeout(async () => {
        await (supabase.rpc as any)('reset_buzzer', {
          p_session_id: sessionId,
          p_is_timeout: false,
        });
        timeoutShownRef.current = false;
      }, 500);
    }, 6000);

    return () => clearTimeout(resetTimer);
  }, [buzzer.active, buzzer.player, sessionId, addNotification, sendBuzzerTimeout, decodedName, playTimeoutSound]);

  const isBuzzerTemporarilyDisabled = Date.now() < buzzerDisabledUntil;

  useEffect(() => {
    if (buzzerDisabledUntil > Date.now()) {
      const timeout = setTimeout(() => {
        setBuzzerDisabledUntil(0);
      }, buzzerDisabledUntil - Date.now());
      return () => clearTimeout(timeout);
    }
  }, [buzzerDisabledUntil]);

  const handlePressBuzzer = async () => {
    if (!sessionId || !team || buzzer.active || isPressing || isBuzzerTemporarilyDisabled) return;

    setIsPressing(true);

    try {
      // Use atomic claim_buzzer - only first player wins
      const { data, error } = await (supabase.rpc as any)('claim_buzzer', {
        p_session_id: sessionId,
        p_player_name: decodedName,
        p_team: team,
      });

      if (error) {
        console.error('Error pressing buzzer:', error);
        setIsPressing(false);
        return;
      }

      const result = data?.[0];
      if (!result?.success) {
        // Someone else claimed it first - just disable locally
        console.log('🔒 Buzzer already claimed by:', result?.already_claimed_by);
        setBuzzerDisabledUntil(Date.now() + 6000);
        setIsPressing(false);
        return;
      }

      // We won the claim! Play effects and broadcast
      playBellSound();
      flashScreen(team);
      sendBuzzerPressed(team);
      const lang = getLangFromUrl();
      const teamName = team === 'red' ? t(lang, 'redTeamFull') : t(lang, 'greenTeamFull');
      addNotification(`${decodedName} ${t(lang, 'buzzerPlayerFrom')} ${teamName}`, 'buzzer', team);
      // تسجيل الحدث المحلي لمنع تكرار التنبيه عند استلام نفس الحدث من Transport
      lastBuzzerEventRef.current = { eventId: 'local-' + Date.now(), timestamp: Date.now() };
      setBuzzerDisabledUntil(Date.now() + 6000);
    } catch (err) {
      console.error('Buzzer error:', err);
    } finally {
      setIsPressing(false);
    }
  };

  if (isLoading) {
    const lang = getLangFromUrl();
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen bg-background p-4 font-tajawal"
        dir={isRtl(lang) ? 'rtl' : 'ltr'}
      >
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t(lang, 'loading')}</p>
      </div>
    );
  }

  const isMyBuzzer = buzzer.active && buzzer.player === decodedName;
  const canPressBuzzer = sessionId && team && !buzzer.active && !isPressing && !isBuzzerTemporarilyDisabled;

  const lang = getLangFromUrl();

  return (
    <div 
      className="flex flex-col items-center min-h-screen p-2 font-tajawal transition-colors duration-100 overflow-auto bg-background"
      dir={isRtl(lang) ? 'rtl' : 'ltr'}
      style={getScreenBackground()}
    >
      {/* Connection Status Banner */}
      <ConnectionStatus
        status={connectionStatus}
        reconnectAttempt={reconnectAttempt}
        maxAttempts={maxAttempts}
        isOnline={isOnline}
        onRetry={forceReconnect}
      />
      {/* Hex Grid */}
      <div
        dir="rtl"
        className="p-0 bg-card rounded-[1vw] shadow-[0_0.4vw_0.8vw_rgba(0,0,0,0.3)] overflow-hidden flex flex-col items-center relative pointer-events-none flex-shrink-0"
        style={{
          width: 'calc(7 * (90vw / 7) + 6 * (90vw / 200))'
        }}
      >
        <Confetti active={showParty} />
        <PartyText visible={showParty} textColor={partyTextColor} />
        <GoldenText visible={showGoldenCelebration} />
        
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
                onClick={() => {}}
                sizeUnit="vw"
              />
            ))}
          </div>
        ))}
      </div>

      {/* Player Info & Buzzer */}
      <div className="flex flex-col items-center gap-3 flex-1 justify-center py-4">
        <p className="text-lg text-foreground">
          {decodedName} - {t(lang, 'youAreInTeam')} {team === 'red' ? t(lang, 'redTeamFull') : t(lang, 'greenTeamFull')}
        </p>

        <button
          onClick={handlePressBuzzer}
          disabled={!canPressBuzzer}
          className={`
            w-52 h-52 rounded-full
            flex flex-col items-center justify-center gap-2
            text-white font-bold text-xl
            shadow-xl
            ${canPressBuzzer 
              ? 'bg-yellow-500 hover:bg-yellow-600 active:scale-95 cursor-pointer' 
              : 'bg-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Bell className="w-28 h-28" />
          {canPressBuzzer ? (
            <span>{t(lang, 'press')}</span>
          ) : buzzer.active ? (
            <span className="text-lg">{buzzer.player}</span>
          ) : (
            <span className="text-lg">{t(lang, 'wait')}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default ContestantPage;
