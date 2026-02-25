/**
 * CodesTab - إدارة رموز الاشتراك (عبر Edge Function)
 */
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Trash2, Download, Upload, Copy, Loader2 } from 'lucide-react';
import { isProtectedCode, generateRandomCode, generateSpecialCode } from './types';
import { adminApi } from '@/lib/adminApi';

interface CodesTabProps {
  codesCount: number;
  onRefresh: () => void;
  adminCode: string;
}

const CodesTab: React.FC<CodesTabProps> = ({ codesCount, onRefresh, adminCode }) => {
  const [generateCount, setGenerateCount] = useState('10');
  const [specialCount, setSpecialCount] = useState('10');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteList, setDeleteList] = useState('');
  const [isDeletingToday, setIsDeletingToday] = useState(false);

  const handleGenerateCodes = async (isSpecial = false) => {
    const count = parseInt(isSpecial ? specialCount : generateCount);
    if (isNaN(count) || count < 1 || count > 5000) {
      toast.error('أدخل عدد صحيح بين 1 و5000');
      return;
    }

    setIsGenerating(true);
    try {
      const newCodes: string[] = [];
      const localSet = new Set<string>();
      const targetCount = Math.min(count * 1.2, count + 500);
      
      while (localSet.size < targetCount) {
        const code = isSpecial ? generateSpecialCode() : generateRandomCode();
        if (!localSet.has(code) && !isProtectedCode(code)) {
          localSet.add(code);
          newCodes.push(code);
        }
      }

      // Send via Edge Function in batches
      const BATCH_SIZE = 500;
      let totalInserted = 0;
      const successfulCodes: string[] = [];

      for (let i = 0; i < newCodes.length && totalInserted < count; i += BATCH_SIZE) {
        const remaining = count - totalInserted;
        const batch = newCodes.slice(i, i + Math.min(BATCH_SIZE, remaining + 100));
        
        const result = await adminApi<{ data: { code: string }[] }>(adminCode, 'codes.insert', { codes: batch });

        if (!result.error && result.data?.data) {
          totalInserted += result.data.data.length;
          successfulCodes.push(...result.data.data.map(d => d.code));
        }
        if (totalInserted >= count) break;
      }

      setGeneratedCodes(successfulCodes.slice(0, count));
      toast.success(`تم توليد ${Math.min(totalInserted, count)} رمز بنجاح`);
      onRefresh();
    } catch (error) {
      toast.error('حدث خطأ أثناء توليد الرموز');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddManualCode = async () => {
    const trimmedCode = manualCode.trim().toUpperCase();
    if (!trimmedCode) { toast.error('أدخل رمزًا صحيحًا'); return; }

    const result = await adminApi(adminCode, 'codes.insert', { codes: [trimmedCode] });
    if (result.error) { toast.error(result.error); return; }

    toast.success('تم إضافة الرمز بنجاح');
    setManualCode('');
    onRefresh();
  };

  const handleDeleteCode = async () => {
    const trimmedCode = deleteCode.trim().toUpperCase();
    if (!trimmedCode) { toast.error('أدخل رمزًا لحذفه'); return; }
    if (isProtectedCode(trimmedCode)) { toast.error('لا يمكن حذف هذا الرمز المحمي'); return; }

    const result = await adminApi(adminCode, 'codes.delete', { codes: [trimmedCode] });
    if (result.error) { toast.error(result.error); return; }

    toast.success('تم حذف الرمز بنجاح');
    setDeleteCode('');
    onRefresh();
  };

  const handleDeleteList = async () => {
    const codes = deleteList.split('\n').map(c => c.trim().toUpperCase()).filter(c => c && !isProtectedCode(c));
    if (codes.length === 0) { toast.error('أدخل قائمة رموز صحيحة'); return; }

    // Batch delete in chunks of 500
    let totalDeleted = 0;
    const BATCH = 500;
    for (let i = 0; i < codes.length; i += BATCH) {
      const batch = codes.slice(i, i + BATCH);
      if (codes.length > BATCH) {
        toast.info(`جاري حذف ${i + 1} - ${Math.min(i + BATCH, codes.length)} من ${codes.length}...`);
      }
      const result = await adminApi(adminCode, 'codes.delete', { codes: batch });
      if (!result.error) totalDeleted += batch.length;
    }

    toast.success(`تم حذف ${totalDeleted} رمز`);
    setDeleteList('');
    onRefresh();
  };

  const handleDeleteTodayCodes = async () => {
    setIsDeletingToday(true);
    try {
      const result = await adminApi<{ deleted: number }>(adminCode, 'codes.delete_today', {});
      if (result.error) { toast.error(result.error); return; }

      const deleted = result.data?.deleted || 0;
      if (deleted === 0) { toast.info('لا توجد رموز مولدة اليوم'); return; }

      toast.success(`تم حذف ${deleted} رمز مولد اليوم`);
      setGeneratedCodes([]);
      onRefresh();
    } finally {
      setIsDeletingToday(false);
    }
  };

  const handleCopyCodes = async () => {
    if (generatedCodes.length === 0) { toast.error('لا توجد رموز لنسخها'); return; }
    await navigator.clipboard.writeText(generatedCodes.join('\n'));
    toast.success('تم نسخ الرموز');
  };

  const handleExportCodes = async () => {
    const result = await adminApi<{ data: { code: string }[] }>(adminCode, 'codes.list', {});
    if (result.error || !result.data?.data) { toast.error('حدث خطأ أثناء تصدير الرموز'); return; }

    const csvContent = 'Code\n' + result.data.data.map(d => d.code).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `codes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير الرموز');
  };

  const handleImportCodes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').slice(1); // skip header
      const codes = lines
        .map(l => l.split(',')[0].trim().toUpperCase()) // take first column only
        .filter(c => c && /^[A-Z0-9]{6,7}$/.test(c) && !isProtectedCode(c));

      if (codes.length === 0) { toast.error('لا توجد رموز صالحة'); return; }

      // Batch insert in chunks of 500
      let totalAdded = 0;
      const BATCH = 500;
      for (let i = 0; i < codes.length; i += BATCH) {
        const batch = codes.slice(i, i + BATCH);
        const result = await adminApi<{ data: { code: string }[] }>(adminCode, 'codes.insert', { codes: batch });
        if (!result.error && result.data?.data) totalAdded += result.data.data.length;
      }

      toast.success(`تم إضافة ${totalAdded} رمز`);
      onRefresh();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Generate Codes */}
        <Card>
          <CardHeader>
            <CardTitle>توليد رموز عادية</CardTitle>
            <CardDescription>توليد رموز من 6 أحرف وأرقام</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input type="number" placeholder="العدد" value={generateCount} onChange={(e) => setGenerateCount(e.target.value)} min={1} max={5000} />
              <Button onClick={() => handleGenerateCodes(false)} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                توليد
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generate Special Codes */}
        <Card>
          <CardHeader>
            <CardTitle>توليد رموز خاصة</CardTitle>
            <CardDescription>رموز تبدأ بـ X (7 أحرف)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input type="number" placeholder="العدد" value={specialCount} onChange={(e) => setSpecialCount(e.target.value)} min={1} max={5000} />
              <Button onClick={() => handleGenerateCodes(true)} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                توليد
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Manual Code */}
        <Card>
          <CardHeader><CardTitle>إضافة رمز يدوياً</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="أدخل الرمز" value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} maxLength={7} />
              <Button onClick={handleAddManualCode}><Plus className="w-4 h-4" /> إضافة</Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Code */}
        <Card>
          <CardHeader><CardTitle>حذف رمز</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="أدخل الرمز للحذف" value={deleteCode} onChange={(e) => setDeleteCode(e.target.value.toUpperCase())} maxLength={7} />
              <Button variant="destructive" onClick={handleDeleteCode}><Trash2 className="w-4 h-4" /> حذف</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete List */}
      <Card>
        <CardHeader>
          <CardTitle>حذف قائمة رموز</CardTitle>
          <CardDescription>أدخل كل رمز في سطر جديد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder={"ABCD12\nEFGH34\n..."} value={deleteList} onChange={(e) => setDeleteList(e.target.value)} rows={4} />
          <Button variant="destructive" onClick={handleDeleteList}><Trash2 className="w-4 h-4 ml-2" /> حذف القائمة</Button>
        </CardContent>
      </Card>

      {/* Delete Today's Codes */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">حذف رموز اليوم</CardTitle>
          <CardDescription>حذف جميع الرموز التي تم توليدها اليوم</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDeleteTodayCodes} disabled={isDeletingToday}>
            {isDeletingToday ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Trash2 className="w-4 h-4 ml-2" />}
            حذف رموز اليوم
          </Button>
        </CardContent>
      </Card>

      {/* Import/Export */}
      <Card>
        <CardHeader><CardTitle>استيراد وتصدير</CardTitle></CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Button variant="outline" onClick={handleExportCodes}><Download className="w-4 h-4 ml-2" /> تصدير الرموز (CSV)</Button>
          <div className="relative">
            <input type="file" accept=".csv,.txt" onChange={handleImportCodes} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Button variant="outline"><Upload className="w-4 h-4 ml-2" /> استيراد رموز</Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Codes */}
      {generatedCodes.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>الرموز المولدة ({generatedCodes.length})</CardTitle>
            <Button size="sm" onClick={handleCopyCodes}><Copy className="w-4 h-4 ml-2" /> نسخ الكل</Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="grid grid-cols-4 gap-2 text-sm font-mono">
                {generatedCodes.map((code, i) => (
                  <div key={i} className="p-2 bg-muted rounded text-center">{code}</div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CodesTab;
