import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LETTERS, ENGLISH_LETTERS } from './constants';
import { t, getLangFromUrl } from '@/lib/i18n';

interface AddQuestionPanelProps {
  sessionCode: string;
  selectedLetter?: string;
  isLandscape?: boolean;
}

const AddQuestionPanel: React.FC<AddQuestionPanelProps> = ({ sessionCode, selectedLetter = '', isLandscape = false }) => {
  const lang = getLangFromUrl();
  const availableLetters = lang === 'en' ? ENGLISH_LETTERS : LETTERS;

  const [letter, setLetter] = useState(selectedLetter);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (selectedLetter) {
      setLetter(selectedLetter);
    }
  }, [selectedLetter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!letter || !question.trim() || !answer.trim()) {
      toast.error(t(lang, 'fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_questions')
        .insert({
          session_code: sessionCode,
          letter: letter,
          question: question.trim(),
          answer: answer.trim(),
        });

      if (error) {
        console.error('Error adding question:', error);
        toast.error(t(lang, 'errorAddingQuestion'));
        return;
      }

      toast.success(t(lang, 'questionAdded'));
      setLetter('');
      setQuestion('');
      setAnswer('');
    } catch (err) {
      console.error('Error:', err);
      toast.error(t(lang, 'unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full mx-auto bg-card border rounded-xl shadow-lg ${isLandscape ? '' : 'max-w-2xl mt-4'}`}>
      <div className={`bg-secondary rounded-t-xl flex items-center gap-2 ${isLandscape ? 'px-2 py-1' : 'px-2 sm:px-4 py-2 sm:py-3 gap-2 sm:gap-3'}`}>
        <Plus className={isLandscape ? 'w-3.5 h-3.5 text-secondary-foreground' : 'w-5 h-5 sm:w-6 sm:h-6 text-secondary-foreground'} />
        <span className={`text-secondary-foreground font-bold ${isLandscape ? 'text-[10px]' : 'text-sm sm:text-lg'}`}>{t(lang, 'addCustomQuestion')}</span>
      </div>

      <form onSubmit={handleSubmit} className={isLandscape ? 'p-1.5 space-y-1.5' : 'p-4 space-y-4'}>
        <div className={isLandscape ? 'space-y-0.5' : 'space-y-2'}>
          <label className={`font-medium text-foreground ${isLandscape ? 'text-[10px]' : 'text-sm'}`}>{t(lang, 'letter')}</label>
          <select
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            className={`w-full rounded-md border border-input bg-background text-foreground ${isLandscape ? 'h-7 px-2 text-xs' : 'h-10 px-3'}`}
            disabled={loading}
          >
            <option value="">{t(lang, 'chooseLetter')}</option>
            {availableLetters.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className={isLandscape ? 'space-y-0.5' : 'space-y-2'}>
          <label className={`font-medium text-foreground ${isLandscape ? 'text-[10px]' : 'text-sm'}`}>{t(lang, 'question')}</label>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t(lang, 'enterQuestionPlaceholder')}
            className={isLandscape ? 'min-h-[40px] resize-none text-xs' : 'min-h-[80px] resize-none'}
            disabled={loading}
          />
        </div>

        <div className={isLandscape ? 'space-y-0.5' : 'space-y-2'}>
          <label className={`font-medium text-foreground ${isLandscape ? 'text-[10px]' : 'text-sm'}`}>{t(lang, 'answerLabel')}</label>
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t(lang, 'enterAnswerPlaceholder')}
            className={isLandscape ? 'h-7 text-xs' : ''}
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          className={`w-full gap-2 ${isLandscape ? 'h-7 text-xs' : ''}`}
          disabled={loading || !letter || !question.trim() || !answer.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t(lang, 'adding')}
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {t(lang, 'addQuestion')}
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default AddQuestionPanel;
