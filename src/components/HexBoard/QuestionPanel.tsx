import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { HelpCircle, SkipForward, Loader2, BookOpen, Eye, EyeOff } from 'lucide-react';
import { t, getLangFromUrl } from '@/lib/i18n';

interface QuestionPanelProps {
  letter: string;
  isLandscape?: boolean;
  question: string | null;
  answer: string | null;
  onNext: () => void;
  loading?: boolean;
  useGeneralQuestions?: boolean;
  onToggleQuestionType?: () => void;
}

const QuestionPanel: React.FC<QuestionPanelProps> = ({
  letter,
  question,
  answer,
  onNext,
  loading = false,
  useGeneralQuestions = true,
  onToggleQuestionType,
  isLandscape = false,
}) => {
  const lang = getLangFromUrl();
  const hasQuestion = letter && (question || loading);
  const [showAnswer, setShowAnswer] = useState(true);
  const [temporaryReveal, setTemporaryReveal] = useState(false);

  return (
    <div className={`w-full mx-auto bg-card border rounded-xl shadow-lg ${isLandscape ? '' : 'max-w-2xl mt-4'}`}>
      {/* Header */}
      <div className={`bg-primary rounded-t-xl flex items-center justify-between gap-1 ${isLandscape ? 'px-2 py-1' : 'px-2 sm:px-4 py-2 sm:py-3'}`}>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Button
            onClick={onNext}
            variant="secondary"
            size="sm"
            className={`gap-1 ${isLandscape ? 'text-[9px] px-1.5 h-6' : 'sm:gap-2 text-[10px] sm:text-sm px-2 sm:px-3 h-7 sm:h-9'}`}
            disabled={!letter || loading}
          >
            <SkipForward className={isLandscape ? 'w-2.5 h-2.5' : 'w-3 h-3 sm:w-4 sm:h-4'} />
            {t(lang, 'next')}
          </Button>
          
          {onToggleQuestionType && (
            <div dir="ltr" className={`flex items-center gap-1 bg-primary-foreground/15 rounded-lg border border-primary-foreground/20 ${isLandscape ? 'px-1 py-0.5' : 'sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5'}`}>
              <BookOpen className={isLandscape ? 'w-2.5 h-2.5 text-primary-foreground' : 'w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground'} />
              <span className={`text-primary-foreground font-medium whitespace-nowrap ${isLandscape ? 'text-[8px]' : 'text-[10px] sm:text-sm'}`}>{t(lang, 'general')}</span>
              <Switch
                checked={useGeneralQuestions}
                onCheckedChange={onToggleQuestionType}
                className={`data-[state=checked]:bg-primary-foreground/40 data-[state=unchecked]:bg-primary-foreground/20 ${isLandscape ? 'scale-50' : 'scale-75 sm:scale-100'}`}
              />
            </div>
          )}
          
          {hasQuestion && answer && (
            <button
              onClick={() => setShowAnswer(prev => !prev)}
              className={`flex items-center justify-center rounded-md bg-primary-foreground/15 border border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/25 transition-colors ${isLandscape ? 'w-5 h-5' : 'w-7 h-7 sm:w-9 sm:h-9'}`}
              title={showAnswer ? 'إخفاء الإجابة' : 'إظهار الإجابة'}
            >
              {showAnswer ? (
                <Eye className={isLandscape ? 'w-3 h-3' : 'w-4 h-4 sm:w-5 sm:h-5'} />
              ) : (
                <EyeOff className={isLandscape ? 'w-3 h-3' : 'w-4 h-4 sm:w-5 sm:h-5'} />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          {hasQuestion ? (
            <>
              <span className={`text-primary-foreground font-bold truncate ${isLandscape ? 'text-[9px]' : 'text-xs sm:text-lg'}`}>{t(lang, 'questionFor')} {letter}</span>
              <div className={`rounded-full bg-white/20 flex items-center justify-center text-primary-foreground font-bold flex-shrink-0 ${isLandscape ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 sm:w-10 sm:h-10 text-sm sm:text-xl'}`}>
                {letter}
              </div>
            </>
          ) : (
            <>
              <span className={`text-primary-foreground font-bold truncate ${isLandscape ? 'text-[9px]' : 'text-xs sm:text-lg'}`}>{t(lang, 'clickLetterPrompt')}</span>
              <HelpCircle className={`text-primary-foreground/70 flex-shrink-0 ${isLandscape ? 'w-4 h-4' : 'w-5 h-5 sm:w-8 sm:h-8'}`} />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={isLandscape ? 'p-1.5' : 'p-4 min-h-[120px] flex items-center justify-center'}>
        {loading ? (
          <div className={`flex items-center justify-center gap-2 ${isLandscape ? 'py-2' : 'py-6 gap-3'}`}>
            <Loader2 className={`animate-spin text-primary ${isLandscape ? 'w-4 h-4' : 'w-6 h-6'}`} />
            <span className={`text-muted-foreground ${isLandscape ? 'text-xs' : ''}`}>{t(lang, 'loadingQuestion')}</span>
          </div>
        ) : hasQuestion && question ? (
          <div className={`w-full ${isLandscape ? 'space-y-1.5' : 'space-y-4'}`}>
            <div
              className={`bg-muted rounded-lg ${!showAnswer && answer ? 'cursor-pointer active:bg-muted/70 select-none' : ''} ${isLandscape ? 'p-2' : 'p-4'}`}
              onPointerDown={() => { if (!showAnswer && answer) setTemporaryReveal(true); }}
              onPointerUp={() => setTemporaryReveal(false)}
              onPointerLeave={() => setTemporaryReveal(false)}
            >
              <div className="flex items-start gap-2">
                <HelpCircle className={`text-primary mt-0.5 flex-shrink-0 ${isLandscape ? 'w-3.5 h-3.5' : 'w-6 h-6 mt-1'}`} />
                <p className={`font-medium leading-relaxed break-words ${isLandscape ? 'text-[11px]' : 'text-lg'}`}>{question}</p>
              </div>
            </div>

            {answer && (showAnswer || temporaryReveal) && (
              <div className={`bg-accent/50 border-2 border-accent rounded-lg ${isLandscape ? 'px-2 py-1' : 'px-4 py-3'}`}>
                <p className={`font-bold text-accent-foreground break-words ${isLandscape ? 'text-[11px]' : 'text-lg'}`}>
                  {t(lang, 'answer')}: {answer}
                </p>
              </div>
            )}
          </div>
        ) : hasQuestion && !question ? (
          <div className={`flex items-center justify-center gap-2 text-muted-foreground ${isLandscape ? 'py-2' : 'py-6 gap-3'}`}>
            <HelpCircle className={`opacity-50 ${isLandscape ? 'w-5 h-5' : 'w-8 h-8'}`} />
            <p className={isLandscape ? 'text-xs' : ''}>{t(lang, 'noQuestionForLetter')}</p>
          </div>
        ) : (
          <div className={`flex items-center justify-center gap-2 text-muted-foreground ${isLandscape ? 'py-2' : 'py-6 gap-3'}`}>
            <p className={isLandscape ? 'text-xs' : 'text-lg'}>{t(lang, 'waitingForLetter')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionPanel;
