import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Json } from '@/integrations/supabase/types';

interface HexagonData {
  color: string;
  clickCount: number;
}

interface BuzzerData {
  active: boolean;
  player: string;
  team: 'red' | 'green' | null;
  isTimeOut?: boolean;
}

interface TeamsData {
  red: string[];
  green: string[];
}

interface GameSessionData {
  id: string;
  session_code: string;
  hexagons: Record<string, HexagonData>;
  letters_order: string[];
  teams: TeamsData;
  buzzer: BuzzerData;
  buzzer_locked: boolean;
  color_set_index: number;
  is_swapped: boolean;
  golden_letter: string | null;
  party_mode: boolean;
  is_active: boolean;
}

interface UseGameSessionProps {
  sessionCode: string;
  isHost?: boolean;
}

// Helper to safely cast JSON to our types
const parseHexagons = (data: Json | null): Record<string, HexagonData> => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data as unknown as Record<string, HexagonData>;
};

const parseTeams = (data: Json | null): TeamsData => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { red: [], green: [] };
  }
  const obj = data as Record<string, unknown>;
  return {
    red: Array.isArray(obj.red) ? obj.red as string[] : [],
    green: Array.isArray(obj.green) ? obj.green as string[] : [],
  };
};

const parseBuzzer = (data: Json | null): BuzzerData => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { active: false, player: '', team: null };
  }
  const obj = data as Record<string, unknown>;
  return {
    active: Boolean(obj.active),
    player: String(obj.player || ''),
    team: (obj.team === 'red' || obj.team === 'green') ? obj.team : null,
    isTimeOut: Boolean(obj.isTimeOut),
  };
};

export const useGameSession = ({ sessionCode, isHost = false }: UseGameSessionProps) => {
  const [session, setSession] = useState<GameSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create new session (for host)
  const createSession = useCallback(async (initialData: {
    hexagons: Record<string, HexagonData>;
    letters_order: string[];
    golden_letter: string | null;
    color_set_index: number;
    is_swapped: boolean;
  }): Promise<GameSessionData | null> => {
    if (!sessionCode) return null;

    try {
      // Check if session already exists
      const { data: existingSession } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('session_code', sessionCode)
        .eq('is_active', true)
        .maybeSingle();

      if (existingSession) {
        // Session exists, update it
        const { data: updatedData, error: updateError } = await supabase
          .from('game_sessions')
          .update({
            hexagons: initialData.hexagons as unknown as Json,
            letters_order: initialData.letters_order,
            golden_letter: initialData.golden_letter,
            color_set_index: initialData.color_set_index,
            is_swapped: initialData.is_swapped,
            buzzer: { active: false, player: '', team: null } as unknown as Json,
            party_mode: false,
            last_activity: new Date().toISOString(),
          })
          .eq('id', existingSession.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating session:', updateError);
          return null;
        }

        const sessionData: GameSessionData = {
          id: updatedData.id,
          session_code: updatedData.session_code,
          hexagons: parseHexagons(updatedData.hexagons),
          letters_order: updatedData.letters_order || [],
          teams: parseTeams(updatedData.teams),
          buzzer: parseBuzzer(updatedData.buzzer),
          buzzer_locked: updatedData.buzzer_locked || false,
          color_set_index: updatedData.color_set_index || 0,
          is_swapped: updatedData.is_swapped || false,
          golden_letter: updatedData.golden_letter || null,
          party_mode: updatedData.party_mode || false,
          is_active: updatedData.is_active || true,
        };
        setSession(sessionData);
        setLoading(false);
        return sessionData;
      }

      // Create new session
      const { data, error: insertError } = await supabase
        .from('game_sessions')
        .insert({
          session_code: sessionCode,
          hexagons: initialData.hexagons as unknown as Json,
          letters_order: initialData.letters_order,
          golden_letter: initialData.golden_letter,
          color_set_index: initialData.color_set_index,
          is_swapped: initialData.is_swapped,
          buzzer: { active: false, player: '', team: null } as unknown as Json,
          teams: { red: [], green: [] } as unknown as Json,
          buzzer_locked: false,
          party_mode: false,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating session:', insertError);
        setError('فشل إنشاء الجلسة');
        setLoading(false);
        return null;
      }

      const sessionData: GameSessionData = {
        id: data.id,
        session_code: data.session_code,
        hexagons: parseHexagons(data.hexagons),
        letters_order: data.letters_order || [],
        teams: parseTeams(data.teams),
        buzzer: parseBuzzer(data.buzzer),
        buzzer_locked: data.buzzer_locked || false,
        color_set_index: data.color_set_index || 0,
        is_swapped: data.is_swapped || false,
        golden_letter: data.golden_letter || null,
        party_mode: data.party_mode || false,
        is_active: data.is_active || true,
      };
      setSession(sessionData);
      setLoading(false);
      return sessionData;
    } catch (err) {
      console.error('Error:', err);
      setError('حدث خطأ');
      setLoading(false);
      return null;
    }
  }, [sessionCode]);

  // Fetch initial session data
  const fetchSession = useCallback(async () => {
    if (!sessionCode) {
      setLoading(false);
      return;
    }

    try {
      // Use ilike for case-insensitive matching
      const { data, error: fetchError } = await supabase
        .from('game_sessions')
        .select('*')
        .ilike('session_code', sessionCode)
        .eq('is_active', true)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching session:', fetchError);
        setError('لم يتم العثور على الجلسة');
        setLoading(false);
        return;
      }

      if (!data) {
        // For hosts, don't set error - they will create the session
        if (!isHost) {
          setError('لم يتم العثور على الجلسة');
        }
        setLoading(false);
        return;
      }

      const sessionData: GameSessionData = {
        id: data.id,
        session_code: data.session_code,
        hexagons: parseHexagons(data.hexagons),
        letters_order: data.letters_order || [],
        teams: parseTeams(data.teams),
        buzzer: parseBuzzer(data.buzzer),
        buzzer_locked: data.buzzer_locked || false,
        color_set_index: data.color_set_index || 0,
        is_swapped: data.is_swapped || false,
        golden_letter: data.golden_letter || null,
        party_mode: data.party_mode || false,
        is_active: data.is_active || true,
      };
      setSession(sessionData);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError('حدث خطأ في تحميل الجلسة');
      setLoading(false);
    }
  }, [sessionCode, isHost]);

  // Update session in database (for host only)
  const updateSession = useCallback(async (updates: Record<string, unknown>) => {
    if (!session || !isHost) return;

    try {
      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({
          ...updates,
          last_activity: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('Error updating session:', updateError);
      }
    } catch (err) {
      console.error('Update error:', err);
    }
  }, [session, isHost]);

  // Update hexagon
  const updateHexagon = useCallback(async (letter: string, color: string, clickCount: number) => {
    if (!session) return;

    const newHexagons = {
      ...session.hexagons,
      [letter]: { color, clickCount }
    };

    setSession(prev => prev ? { ...prev, hexagons: newHexagons } : null);
    await updateSession({ hexagons: newHexagons as unknown as Json });
  }, [session, updateSession]);

  // Update buzzer
  const updateBuzzer = useCallback(async (buzzerData: BuzzerData) => {
    if (!session) return;

    setSession(prev => prev ? { ...prev, buzzer: buzzerData } : null);
    await updateSession({ buzzer: buzzerData as unknown as Json });
  }, [session, updateSession]);

  // Update party mode
  const setPartyMode = useCallback(async (active: boolean) => {
    if (!session) return;

    setSession(prev => prev ? { ...prev, party_mode: active } : null);
    await updateSession({ party_mode: active });
  }, [session, updateSession]);

  // Update golden letter
  const setGoldenLetter = useCallback(async (letter: string | null) => {
    if (!session) return;

    setSession(prev => prev ? { ...prev, golden_letter: letter } : null);
    await updateSession({ golden_letter: letter });
  }, [session, updateSession]);

  // Shuffle - update hexagons and letters order
  const shuffle = useCallback(async (hexagons: Record<string, HexagonData>, lettersOrder: string[], goldenLetter: string | null) => {
    if (!session) return;

    const updates = {
      hexagons: hexagons as unknown as Json,
      letters_order: lettersOrder,
      golden_letter: goldenLetter,
      party_mode: false,
    };

    setSession(prev => prev ? { 
      ...prev, 
      hexagons, 
      letters_order: lettersOrder, 
      golden_letter: goldenLetter, 
      party_mode: false 
    } : null);
    await updateSession(updates);
  }, [session, updateSession]);

  // Change colors
  const changeColors = useCallback(async (colorSetIndex: number) => {
    if (!session) return;

    setSession(prev => prev ? { ...prev, color_set_index: colorSetIndex } : null);
    await updateSession({ color_set_index: colorSetIndex });
  }, [session, updateSession]);

  // Swap colors
  const swapColors = useCallback(async (isSwapped: boolean) => {
    if (!session) return;

    setSession(prev => prev ? { ...prev, is_swapped: isSwapped } : null);
    await updateSession({ is_swapped: isSwapped });
  }, [session, updateSession]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!sessionCode) return;

    fetchSession();

    // Subscribe to changes on the game_sessions table (without filter for case-insensitive)
    const channel: RealtimeChannel = supabase
      .channel(`game-session-${sessionCode.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          const newData = payload.new as Record<string, unknown>;
          
          // Check if this is our session (case-insensitive)
          if (newData && String(newData.session_code).toLowerCase() === sessionCode.toLowerCase()) {
            setSession({
              id: String(newData.id),
              session_code: String(newData.session_code),
              hexagons: parseHexagons(newData.hexagons as Json),
              letters_order: (newData.letters_order as string[]) || [],
              teams: parseTeams(newData.teams as Json),
              buzzer: parseBuzzer(newData.buzzer as Json),
              buzzer_locked: Boolean(newData.buzzer_locked),
              color_set_index: Number(newData.color_set_index) || 0,
              is_swapped: Boolean(newData.is_swapped),
              golden_letter: newData.golden_letter as string | null,
              party_mode: Boolean(newData.party_mode),
              is_active: Boolean(newData.is_active),
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionCode, fetchSession]);

  return {
    session,
    loading,
    error,
    createSession,
    updateHexagon,
    updateBuzzer,
    setPartyMode,
    setGoldenLetter,
    shuffle,
    changeColors,
    swapColors,
    refetch: fetchSession,
  };
};
