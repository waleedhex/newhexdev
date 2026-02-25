import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LETTERS, LAYOUT, CREAM_COLOR, COLOR_SETS } from '@/components/HexBoard/constants';
import { getLogicalColor, getSwappedColor, convertToCurrentColorSet } from '@/components/HexBoard/utils';
import { GridCell } from '@/components/HexBoard/types';
import { findWinningPath } from '@/gameEngine';
import { createOrResumeSession } from '@/hooks/useRoomValidation';
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

interface UseBoardStateProps {
  sessionCode: string;
}

/**
 * Hook للقراءة فقط - يُستخدم من جميع الشاشات
 * لا يحتوي على أي دوال تعديل
 */
export const useBoardState = ({ sessionCode }: UseBoardStateProps) => {
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
          // 1. تحويل اللون للمجموعة الحالية (تغيير الألوان)
          const colorInCurrentSet = convertToCurrentColorSet(rawColor, boardState.colorSetIndex);
          // 2. عكس اللون إذا كان isSwapped مفعل (عكس الألوان)
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

  // ====== جلب الجلسة (مع Lazy Session Creation) ======
  const fetchSession = useCallback(async () => {
    if (!sessionCode) {
      setLoading(false);
      return;
    }

    // 1. إنشاء أو استئناف الجلسة تلقائياً
    const sessionResult = await createOrResumeSession(sessionCode);
    
    if (!sessionResult.success) {
      setError(sessionResult.error || 'فشل إنشاء الجلسة');
      setLoading(false);
      return;
    }

    // 2. جلب بيانات الجلسة
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
    
    // استخراج winning_path من البيانات
    const winningPath = (data as unknown as { winning_path: [number, number][] | null }).winning_path || null;
    
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

  // ====== الاشتراك في التحديثات ======
  useEffect(() => {
    if (!sessionCode) return;

    fetchSession();

    // الاشتراك في تحديثات قاعدة البيانات
    const channel = supabase
      .channel(`board-state-${sessionCode.toLowerCase()}`)
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
            
            setBoardState(prev => ({
              ...prev,
              hexagons,
              lettersOrder,
              goldenLetter: newData.golden_letter as string | null,
              colorSetIndex: (newData.color_set_index as number) || 0,
              isSwapped: Boolean(newData.is_swapped),
              partyMode: Boolean(newData.party_mode),
              winningPath,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionCode, fetchSession]);

  return {
    // State
    sessionId,
    boardState,
    loading,
    error,
    
    // Computed helpers
    getRedColor,
    getGreenColor,
    buildCells,
    checkWinConditions,
    
    // للاستخدام من useHostBoardActions
    setBoardState,
  };
};
