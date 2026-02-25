import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { HelpCircle, SkipForward, Loader2, BookOpen } from 'lucide-react';
import { t, getLangFromUrl } from '@/lib/i18n';

interface QuestionPanelProps {
  letter: string;
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
}) => {
  const lang = getLangFromUrl();
  const hasQuestion = letter && (question || loading);

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 bg-card border rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-primary px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <Button
            onClick={onNext}
            variant="secondary"
            size="sm"
            className="gap-1 sm:gap-2 text-[10px] sm:text-sm px-2 sm:px-3 h-7 sm:h-9"
            disabled={!letter || loading}
          >
            <SkipForward className="w-3 h-3 sm:w-4 sm:h-4" />
            {t(lang, 'next')}
          </Button>
          
          {onToggleQuestionType && (
            <div dir="ltr" className="flex items-center gap-1 sm:gap-2 bg-primary-foreground/15 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-primary-foreground/20">
              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
              <span className="text-primary-foreground text-[10px] sm:text-sm font-medium whitespace-nowrap">{t(lang, 'general')}</span>
              <Switch
                checked={useGeneralQuestions}
                onCheckedChange={onToggleQuestionType}
                className="data-[state=checked]:bg-primary-foreground/40 data-[state=unchecked]:bg-primary-foreground/20 scale-75 sm:scale-100"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {hasQuestion ? (
            <>
              <span className="text-primary-foreground font-bold text-xs sm:text-lg truncate">{t(lang, 'questionFor')} {letter}</span>
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center text-primary-foreground text-sm sm:text-xl font-bold flex-shrink-0">
                {letter}
              </div>
            </>
          ) : (
            <>
              <span className="text-primary-foreground font-bold text-xs sm:text-lg truncate">{t(lang, 'clickLetterPrompt')}</span>
              <HelpCircle className="w-5 h-5 sm:w-8 sm:h-8 text-primary-foreground/70 flex-shrink-0" />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 min-h-[120px] flex items-center justify-center">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground">{t(lang, 'loadingQuestion')}</span>
          </div>
        ) : hasQuestion && question ? (
          <div className="w-full space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <p className="text-lg font-medium leading-relaxed">{question}</p>
              </div>
            </div>

            {answer && (
              <div className="bg-accent/50 border-2 border-accent px-4 py-3 rounded-lg">
                <p className="text-lg font-bold text-accent-foreground">
                  {t(lang, 'answer')}: {answer}
                </p>
              </div>
            )}
          </div>
        ) : hasQuestion && !question ? (
          <div className="flex items-center justify-center gap-3 py-6 text-muted-foreground">
            <HelpCircle className="w-8 h-8 opacity-50" />
            <p>{t(lang, 'noQuestionForLetter')}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-6 text-muted-foreground">
            <p className="text-lg">{t(lang, 'waitingForLetter')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionPanel;
