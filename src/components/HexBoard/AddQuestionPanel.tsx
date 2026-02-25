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
}

const AddQuestionPanel: React.FC<AddQuestionPanelProps> = ({ sessionCode, selectedLetter = '' }) => {
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
    <div className="w-full max-w-2xl mx-auto mt-4 bg-card border rounded-xl shadow-lg overflow-hidden">
      <div className="bg-secondary px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
        <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-secondary-foreground" />
        <span className="text-secondary-foreground font-bold text-sm sm:text-lg">{t(lang, 'addCustomQuestion')}</span>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t(lang, 'letter')}</label>
          <select
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
            disabled={loading}
          >
            <option value="">{t(lang, 'chooseLetter')}</option>
            {availableLetters.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t(lang, 'question')}</label>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t(lang, 'enterQuestionPlaceholder')}
            className="min-h-[80px] resize-none"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t(lang, 'answerLabel')}</label>
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t(lang, 'enterAnswerPlaceholder')}
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          className="w-full gap-2"
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
