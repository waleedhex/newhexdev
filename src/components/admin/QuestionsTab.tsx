/**
 * QuestionsTab - إدارة الأسئلة العامة وأسئلة الجلسات (عبر Edge Function)
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Download, Upload, Copy, RefreshCw, HelpCircle, Users } from 'lucide-react';
import { LETTERS, ENGLISH_LETTERS, ALL_VALID_LETTERS, Question, SessionQuestion } from './types';
import { adminApi } from '@/lib/adminApi';
import * as XLSX from 'xlsx';

interface QuestionsTabProps {
  questions: Question[];
  onRefresh: () => void;
  adminCode: string;
}

const QuestionsTab: React.FC<QuestionsTabProps> = ({ questions, onRefresh, adminCode }) => {
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [newQuestion, setNewQuestion] = useState({ letter: '', question: '', answer: '' });
  const [questionFilter, setQuestionFilter] = useState('');
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>(questions);
  const [sessionQuestions, setSessionQuestions] = useState<SessionQuestion[]>([]);
  const [selectedSessionQuestions, setSelectedSessionQuestions] = useState<number[]>([]);
  const [deletingSessionQuestions, setDeletingSessionQuestions] = useState(false);

  useEffect(() => {
    if (questionFilter) {
      setFilteredQuestions(questions.filter(q => q.letter === questionFilter));
    } else {
      setFilteredQuestions(questions);
    }
  }, [questions, questionFilter]);

  const handleAddQuestion = async () => {
    if (!newQuestion.letter || !newQuestion.question.trim() || !newQuestion.answer.trim()) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }

    const result = await adminApi(adminCode, 'questions.insert', {
      letter: newQuestion.letter,
      question: newQuestion.question.trim(),
      answer: newQuestion.answer.trim(),
    });

    if (result.error) { toast.error('حدث خطأ أثناء إضافة السؤال'); return; }

    toast.success('تم إضافة السؤال');
    setNewQuestion({ letter: '', question: '', answer: '' });
    onRefresh();
  };

  const handleDeleteQuestions = async () => {
    if (selectedQuestions.length === 0) { toast.error('يرجى تحديد أسئلة لحذفها'); return; }

    // Batch delete in chunks of 500
    const BATCH = 500;
    let totalDeleted = 0;
    for (let i = 0; i < selectedQuestions.length; i += BATCH) {
      const batch = selectedQuestions.slice(i, i + BATCH);
      const result = await adminApi(adminCode, 'questions.delete', { ids: batch });
      if (!result.error) totalDeleted += batch.length;
    }

    toast.success(`تم حذف ${totalDeleted} سؤال`);
    setSelectedQuestions([]);
    onRefresh();
  };

  // Session questions are read via direct query (read is still public)
  const fetchSessionQuestions = async () => {
    const { data } = await supabase
      .from('session_questions')
      .select('*')
      .order('session_code', { ascending: true })
      .order('letter', { ascending: true });
    setSessionQuestions(data || []);
    setSelectedSessionQuestions([]);
  };

  const handleCopyToGeneralQuestions = async () => {
    if (selectedSessionQuestions.length === 0) { toast.error('يرجى تحديد أسئلة لنسخها'); return; }

    const items = sessionQuestions
      .filter(q => selectedSessionQuestions.includes(q.id))
      .map(q => ({
        letter: q.letter,
        question: q.question,
        answer: q.answer,
        ...(ENGLISH_LETTERS.includes(q.letter.toUpperCase()) ? { lang: 'E' } : {}),
      }));

    const result = await adminApi<{ added: number }>(adminCode, 'questions.bulk_insert', { items });
    if (result.error) { toast.error('حدث خطأ'); return; }

    toast.success(`تم نسخ ${result.data?.added || 0} سؤال للأسئلة العامة`);
    setSelectedSessionQuestions([]);
    onRefresh();
  };

  const handleDeleteSessionQuestions = async () => {
    if (selectedSessionQuestions.length === 0) { toast.error('يرجى تحديد أسئلة لحذفها'); return; }

    setDeletingSessionQuestions(true);
    try {
      const result = await adminApi(adminCode, 'session_questions.delete', { ids: selectedSessionQuestions });
      if (result.error) { toast.error('حدث خطأ أثناء حذف الأسئلة'); return; }

      toast.success(`تم حذف ${selectedSessionQuestions.length} سؤال`);
      setSelectedSessionQuestions([]);
      fetchSessionQuestions();
    } finally {
      setDeletingSessionQuestions(false);
    }
  };

  const handleExportXLSX = async () => {
    // Fetch all questions (bypass 1000 limit)
    let allData: { letter: string; question: string; answer: string }[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('general_questions')
        .select('letter, question, answer')
        .order('letter', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < PAGE) break;
      from += PAGE;
    }

    if (allData.length === 0) { toast.error('لا توجد أسئلة للتصدير'); return; }

    const worksheetData = allData.map(q => ({ 'الحرف': q.letter, 'السؤال': q.question, 'الإجابة': q.answer }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الأسئلة');
    XLSX.writeFile(workbook, `questions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('تم تصدير الأسئلة بنجاح');
  };

  const handleImportXLSX = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Normalize similar Arabic letters to match LETTERS list
        const normalizeLetter = (l: string): string => {
          const map: Record<string, string> = {
            'ا': 'أ', 'إ': 'أ', 'آ': 'أ', 'ة': 'ه', 'هـ': 'ه',
            'ؤ': 'و', 'ئ': 'ي',
          };
          return map[l] || l;
        };

        // Detect if first row is a header (non-single-letter first cell)
        const firstRow = jsonData[0];
        const isHeader = firstRow && firstRow.length >= 3 && String(firstRow[0]).trim().length > 2;
        const startIdx = isHeader ? 1 : 0;

        const items: { letter: string; question: string; answer: string; lang?: string }[] = [];
        let skippedCount = 0;
        for (let i = startIdx; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row.length >= 3) {
            const rawLetter = String(row[0]).trim().toUpperCase();
            const letter = ENGLISH_LETTERS.includes(rawLetter) ? rawLetter : normalizeLetter(String(row[0]).trim());
            const question = String(row[1]).trim();
            const answer = String(row[2]).trim();
            // Check 4th column for language, default based on letter type
            const langCol = row.length >= 4 ? String(row[3]).trim().toUpperCase() : '';
            const isEnglish = ENGLISH_LETTERS.includes(letter);
            const lang = langCol === 'E' || isEnglish ? 'E' : undefined;
            
            if (letter && question && answer && ALL_VALID_LETTERS.includes(letter)) {
              items.push({ letter, question, answer, ...(lang ? { lang } : {}) });
            } else if (rawLetter && question && answer) {
              skippedCount++;
            }
          }
        }

        if (items.length === 0) { toast.error('لا توجد أسئلة صالحة'); return; }

        // Send in batches of 500 to avoid timeout
        let totalAdded = 0;
        const BATCH = 500;
        for (let i = 0; i < items.length; i += BATCH) {
          const batch = items.slice(i, i + BATCH);
          toast.info(`جاري استيراد ${i + 1} - ${Math.min(i + BATCH, items.length)} من ${items.length}...`);
          const result = await adminApi<{ added: number }>(adminCode, 'questions.bulk_insert', { items: batch });
          if (!result.error) totalAdded += result.data?.added || 0;
        }
        if (skippedCount > 0) {
          toast.warning(`تم تخطي ${skippedCount} سؤال بسبب حرف غير معروف`);
        }
        toast.success(`تم استيراد ${totalAdded} سؤال من أصل ${items.length + skippedCount}`);
        onRefresh();
      } catch (error) {
        toast.error('حدث خطأ أثناء قراءة الملف');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Add Question */}
      <Card>
        <CardHeader><CardTitle>إضافة سؤال جديد</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={newQuestion.letter} onValueChange={(value) => setNewQuestion(prev => ({ ...prev, letter: value }))}>
              <SelectTrigger><SelectValue placeholder="الحرف" /></SelectTrigger>
              <SelectContent>
                {LETTERS.map(letter => (<SelectItem key={letter} value={letter}>{letter}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input placeholder="السؤال" value={newQuestion.question} onChange={(e) => setNewQuestion(prev => ({ ...prev, question: e.target.value }))} className="md:col-span-2" />
            <Input placeholder="الإجابة" value={newQuestion.answer} onChange={(e) => setNewQuestion(prev => ({ ...prev, answer: e.target.value }))} />
          </div>
          <Button onClick={handleAddQuestion}><Plus className="w-4 h-4 ml-2" /> إضافة السؤال</Button>
        </CardContent>
      </Card>

      {/* Import/Export */}
      <Card>
        <CardHeader>
          <CardTitle>استيراد وتصدير الأسئلة</CardTitle>
          <CardDescription>صيغة الملف: العمود A (الحرف) - العمود B (السؤال) - العمود C (الإجابة)</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Button variant="outline" onClick={handleExportXLSX}><Download className="w-4 h-4 ml-2" /> تصدير الأسئلة (XLSX)</Button>
          <div className="relative">
            <input type="file" accept=".xlsx,.xls" onChange={handleImportXLSX} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Button variant="outline"><Upload className="w-4 h-4 ml-2" /> استيراد أسئلة (XLSX)</Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions List with Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="general" onValueChange={(value) => { if (value === 'session') fetchSessionQuestions(); }}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="general" className="gap-2"><HelpCircle className="w-4 h-4" /> الأسئلة العامة ({filteredQuestions.length})</TabsTrigger>
              <TabsTrigger value="session" className="gap-2"><Users className="w-4 h-4" /> أسئلة الجلسات ({sessionQuestions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <div className="flex gap-2 items-center justify-between mb-4 flex-wrap">
                <div className="flex gap-2 items-center">
                  <Select value={questionFilter || "all"} onValueChange={(value) => setQuestionFilter(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="كل الحروف" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحروف</SelectItem>
                      {LETTERS.map(letter => (<SelectItem key={letter} value={letter}>{letter}</SelectItem>))}
                      {ENGLISH_LETTERS.map(letter => (<SelectItem key={letter} value={letter}>{letter}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Checkbox
                    checked={filteredQuestions.length > 0 && selectedQuestions.length === filteredQuestions.length}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedQuestions(filteredQuestions.map(q => q.id));
                      else setSelectedQuestions([]);
                    }}
                  />
                  <span className="text-sm text-muted-foreground">تحديد الكل</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={onRefresh}><RefreshCw className="w-4 h-4" /></Button>
                  {selectedQuestions.length > 0 && (
                    <Button variant="destructive" onClick={handleDeleteQuestions}>
                      <Trash2 className="w-4 h-4 ml-2" /> حذف ({selectedQuestions.length})
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredQuestions.map((q) => (
                    <div key={q.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <Checkbox
                        checked={selectedQuestions.includes(q.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedQuestions(prev => [...prev, q.id]);
                          else setSelectedQuestions(prev => prev.filter(id => id !== q.id));
                        }}
                      />
                      <span className="font-bold text-primary w-8">{q.letter}</span>
                      <span className="flex-1">{q.question}</span>
                      <span className="text-muted-foreground">- {q.answer}</span>
                    </div>
                  ))}
                  {filteredQuestions.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد أسئلة</p>}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="session">
              <div className="flex gap-2 items-center justify-between mb-4 flex-wrap">
                <div className="flex gap-2 items-center">
                  <Button variant="outline" size="icon" onClick={fetchSessionQuestions}><RefreshCw className="w-4 h-4" /></Button>
                  {sessionQuestions.length > 0 && (
                    <>
                      <Checkbox
                        checked={sessionQuestions.length > 0 && selectedSessionQuestions.length === sessionQuestions.length}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedSessionQuestions(sessionQuestions.map(q => q.id));
                          else setSelectedSessionQuestions([]);
                        }}
                      />
                      <span className="text-sm text-muted-foreground">تحديد الكل</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {selectedSessionQuestions.length > 0 && (
                    <>
                      <Button onClick={handleCopyToGeneralQuestions}><Copy className="w-4 h-4 ml-2" /> نسخ للأسئلة العامة ({selectedSessionQuestions.length})</Button>
                      <Button variant="destructive" onClick={handleDeleteSessionQuestions} disabled={deletingSessionQuestions}>
                        <Trash2 className="w-4 h-4 ml-2" /> حذف ({selectedSessionQuestions.length})
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {sessionQuestions.map((q) => (
                    <div key={q.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <Checkbox
                        checked={selectedSessionQuestions.includes(q.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedSessionQuestions(prev => [...prev, q.id]);
                          else setSelectedSessionQuestions(prev => prev.filter(id => id !== q.id));
                        }}
                      />
                      <span className="font-mono text-xs bg-primary/20 text-primary px-2 py-1 rounded min-w-[70px] text-center">{q.session_code}</span>
                      <span className="font-bold text-primary w-8">{q.letter}</span>
                      <span className="flex-1">{q.question}</span>
                      <span className="text-muted-foreground">- {q.answer}</span>
                    </div>
                  ))}
                  {sessionQuestions.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد أسئلة جلسات</p>}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuestionsTab;
