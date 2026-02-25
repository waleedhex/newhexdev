/**
 * useDebouncedBoardState.ts
 * نسخة محسنة من useBoardState مع Debounce
 * 
 * يمنع الـ flickering عند التحديثات السريعة
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LETTERS, LAYOUT, CREAM_COLOR, COLOR_SETS } from '@/components/HexBoard/constants';
import { getLogicalColor, getSwappedColor, convertToCurrentColorSet } from '@/components/HexBoard/utils';
import { GridCell } from '@/components/HexBoard/types';
import { findWinningPath } from '@/gameEngine';
import { createOrResumeSession } from '@/hooks/useRoomValidation';
import { BOARD_UPDATE_DEBOUNCE } from '@/config/connectionConstants';

// ====== أنواع البيانات ======
export interface HexagonData {
  color: string;
  clickCount: number;
}

export interface CellData {
  letter: string;
  color: string;
  clickCount: number;
  isFixed: boolean;
  fixedType?: 'red' | 'green';
  clipClass?: string;
  isWinning?: boolean;
}

export interface BoardState {
  hexagons: Record<string, HexagonData>;
  lettersOrder: string[];
  goldenLetter: string | null;
  colorSetIndex: number;
  isSwapped: boolean;
  partyMode: boolean;
  winningPath: [number, number][] | null;
}

interface UseDebouncedBoardStateProps {
  sessionCode: string;
  debounceMs?: number;
}

/**
 * Hook للقراءة مع Debounce - يُستخدم من شاشات العرض والمتسابقين
 * يمنع الـ flickering عند التحديثات السريعة
 */
export const useDebouncedBoardState = ({ 
  sessionCode, 
  debounceMs = BOARD_UPDATE_DEBOUNCE 
}: UseDebouncedBoardStateProps) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [boardState, setBoardState] = useState<BoardState>({
    hexagons: {},
    lettersOrder: [],
    goldenLetter: null,
    colorSetIndex: 0,
    isSwapped: false,
    partyMode: false,
    winningPath: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce refs
  const pendingUpdateRef = useRef<BoardState | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ====== تطبيق التحديث مع Debounce ======
  const applyDebouncedUpdate = useCallback((newState: BoardState) => {
    pendingUpdateRef.current = newState;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      if (pendingUpdateRef.current) {
        setBoardState(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    }, debounceMs);
  }, [debounceMs]);

  // ====== حساب ألوان الفرق ======
  const getRedColor = useCallback(() => {
    const set = COLOR_SETS[boardState.colorSetIndex];
    return boardState.isSwapped ? set.green : set.red;
  }, [boardState.colorSetIndex, boardState.isSwapped]);

  const getGreenColor = useCallback(() => {
    const set = COLOR_SETS[boardState.colorSetIndex];
    return boardState.isSwapped ? set.red : set.green;
  }, [boardState.colorSetIndex, boardState.isSwapped]);

  // ====== بناء الخلايا من حالة اللوحة ======
  const buildCells = useCallback((winningPathOverride?: [number, number][]): CellData[][] => {
    const pathToUse = winningPathOverride ?? boardState.winningPath ?? [];
    return LAYOUT.map((row, rowIndex) => {
      return row.map((letter, colIndex) => {
        let isFixed = false;
        let fixedType: 'red' | 'green' | undefined;
        let clipClass: string | undefined;
        let cellLetter = '';
        let cellColor = CREAM_COLOR;
        let clickCount = 0;
        const isWinning = pathToUse.some(([r, c]) => r === rowIndex && c === colIndex);

        if (rowIndex === 0) {
          isFixed = true;
          fixedType = (colIndex === 0 || colIndex === 6) ? 'green' : 'red';
          cellColor = fixedType === 'red' ? getRedColor() : getGreenColor();
          clipClass = colIndex === 6 ? 'outer-fixed-top-left' : 'outer-fixed-top';
        } else if (rowIndex === 6) {
          isFixed = true;
          fixedType = (colIndex === 0 || colIndex === 6) ? 'green' : 'red';
          cellColor = fixedType === 'red' ? getRedColor() : getGreenColor();
          clipClass = colIndex === 6 ? 'outer-fixed-bottom-left' : 'outer-fixed-bottom';
        } else if (colIndex === 0 || colIndex === 6) {
          isFixed = true;
          fixedType = 'green';
          cellColor = getGreenColor();
          if (colIndex === 0 && [1, 3, 5].includes(rowIndex)) {
            clipClass = 'outer-fixed-odd-right';
          } else if (colIndex === 6 && [2, 4].includes(rowIndex)) {
            clipClass = 'outer-fixed-even-left';
          }
        } else if (letter) {
          const letterIndex = (rowIndex - 1) * 5 + (colIndex - 1);
          cellLetter = boardState.lettersOrder[letterIndex] || letter;
          
          const hexData = boardState.hexagons[cellLetter];
          const rawColor = hexData?.color || CREAM_COLOR;
          const colorInCurrentSet = convertToCurrentColorSet(rawColor, boardState.colorSetIndex);
          cellColor = getSwappedColor(colorInCurrentSet, boardState.colorSetIndex, boardState.isSwapped);
          clickCount = hexData?.clickCount || 0;
        }

        return {
          letter: cellLetter,
          color: cellColor,
          clickCount,
          isFixed,
          fixedType,
          clipClass,
          isWinning
        };
      });
    });
  }, [boardState, getRedColor, getGreenColor]);

  // ====== بناء شبكة منطقية لفحص الفوز ======
  const buildGridState = useCallback((): GridCell[][] => {
    const cells = buildCells();
    return cells.map(row =>
      row.map(cell => ({
        color: getLogicalColor(cell.color, boardState.colorSetIndex, boardState.isSwapped)
      }))
    );
  }, [buildCells, boardState.colorSetIndex, boardState.isSwapped]);

  // ====== فحص شروط الفوز ======
  const checkWinConditions = useCallback((): { team: 'red' | 'green'; path: [number, number][] } | null => {
    const gridState = buildGridState();
    
    const redPath = findWinningPath(gridState, 'red');
    if (redPath) return { team: 'red', path: redPath };
    
    const greenPath = findWinningPath(gridState, 'green');
    if (greenPath) return { team: 'green', path: greenPath };
    
    return null;
  }, [buildGridState]);

  // ====== جلب الجلسة ======
  const fetchSession = useCallback(async () => {
    if (!sessionCode) {
      setLoading(false);
      return;
    }

    const sessionResult = await createOrResumeSession(sessionCode);
    
    if (!sessionResult.success) {
      setError(sessionResult.error || 'فشل إنشاء الجلسة');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionResult.sessionId)
      .single();

    if (fetchError) {
      setError('حدث خطأ في تحميل الجلسة');
      setLoading(false);
      return;
    }

    if (!data) {
      setError('لم يتم العثور على الجلسة');
      setLoading(false);
      return;
    }

    setSessionId(data.id);
    
    const hexagons = (data.hexagons as unknown as Record<string, HexagonData>) || {};
    const lettersOrder = data.letters_order || [];
    const winningPath = (data as unknown as { winning_path: [number, number][] | null }).winning_path || null;
    
    // التحديث الأول بدون debounce
    setBoardState({
      hexagons,
      lettersOrder,
      goldenLetter: data.golden_letter,
      colorSetIndex: data.color_set_index || 0,
      isSwapped: data.is_swapped || false,
      partyMode: data.party_mode || false,
      winningPath,
    });
    
    setLoading(false);
  }, [sessionCode]);

  // ====== الاشتراك في التحديثات مع Debounce ======
  useEffect(() => {
    if (!sessionCode) return;

    fetchSession();

    const channel = supabase
      .channel(`board-state-debounced-${sessionCode.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
        },
        (payload) => {
          const newData = payload.new as Record<string, unknown>;
          
          if (String(newData.session_code).toLowerCase() === sessionCode.toLowerCase()) {
            const hexagons = (newData.hexagons as unknown as Record<string, HexagonData>) || {};
            const lettersOrder = (newData.letters_order as string[]) || [];
            const winningPath = (newData.winning_path as [number, number][] | null) || null;
            
            // استخدام Debounce للتحديثات
            applyDebouncedUpdate({
              hexagons,
              lettersOrder,
              goldenLetter: newData.golden_letter as string | null,
              colorSetIndex: (newData.color_set_index as number) || 0,
              isSwapped: Boolean(newData.is_swapped),
              partyMode: Boolean(newData.party_mode),
              winningPath,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [sessionCode, fetchSession, applyDebouncedUpdate]);

  return {
    sessionId,
    boardState,
    loading,
    error,
    getRedColor,
    getGreenColor,
    buildCells,
    checkWinConditions,
    setBoardState,
  };
};
