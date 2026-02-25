/**
 * AdminPanel - لوحة تحكم المسؤول
 * 
 * تم إعادة هيكلة هذا الملف من 1100+ سطر إلى مكونات منفصلة:
 * - CodesTab: إدارة رموز الاشتراك
 * - QuestionsTab: إدارة الأسئلة
 * - AnnouncementsTab: إدارة الإعلانات
 * - MonitoringPanel: مراقبة اللعبة
 * 
 * الأمان:
 * - التحقق من كود الأدمن من قاعدة البيانات (is_admin = true)
 * - Rate limiting لمنع محاولات الاختراق
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { adminApi } from '@/lib/adminApi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Key, HelpCircle, Megaphone, Activity, ArrowRight, ShieldAlert } from 'lucide-react';

// Components
import CodesTab from '@/components/admin/CodesTab';
import QuestionsTab from '@/components/admin/QuestionsTab';
import AnnouncementsTab from '@/components/admin/AnnouncementsTab';
import MonitoringPanel from '@/components/admin/MonitoringPanel';

// Hooks
import { useAdminAuth } from '@/hooks/useAdminAuth';

// Types
import { Question, Announcement } from '@/components/admin/types';

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') || '';

  // Admin authentication with rate limiting
  const { isLoading, isAuthenticated, isLockedOut, lockoutRemaining, attemptsRemaining } = useAdminAuth(code);

  // Stats
  const [codesCount, setCodesCount] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Fetch functions
  const fetchCodesCount = useCallback(async () => {
    if (!code) return;
    const { data } = await adminApi<{ count: number }>(code, 'codes.count');
    setCodesCount(data?.count || 0);
  }, [code]);

  const fetchQuestions = useCallback(async () => {
    // Fetch all questions (bypass 1000 row default limit)
    let allQuestions: Question[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await supabase
        .from('general_questions')
        .select('*')
        .order('id', { ascending: false })
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      allQuestions = [...allQuestions, ...data];
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setQuestions(allQuestions);
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('id', { ascending: false });
    setAnnouncements(data || []);
  }, []);

  // Initial fetch on authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchCodesCount();
      fetchQuestions();
      fetchAnnouncements();
    }
  }, [isAuthenticated, fetchCodesCount, fetchQuestions, fetchAnnouncements]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Lockout state
  if (isLockedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 font-tajawal" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="w-16 h-16 mx-auto text-destructive" />
            <h1 className="text-2xl font-bold">تم حظر المحاولات</h1>
            <p className="text-muted-foreground">
              تم تجاوز الحد الأقصى للمحاولات. يرجى الانتظار.
            </p>
            <div className="text-4xl font-bold text-destructive">
              {Math.floor(lockoutRemaining / 60)}:{String(lockoutRemaining % 60).padStart(2, '0')}
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              العودة للصفحة الرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated - should redirect (handled by hook)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 font-tajawal" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">لوحة التحكم</h1>
            <p className="text-muted-foreground">إدارة الرموز والأسئلة والإعلانات ومراقبة اللعبة</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/select-role?code=${code}`)}>
            <ArrowRight className="w-4 h-4 ml-2" />
            الذهاب للعبة
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الرموز</p>
                <p className="text-3xl font-bold">{codesCount}</p>
              </div>
              <Key className="w-10 h-10 text-primary" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">الأسئلة العامة</p>
                <p className="text-3xl font-bold">{questions.length}</p>
              </div>
              <HelpCircle className="w-10 h-10 text-primary" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">الإعلانات</p>
                <p className="text-3xl font-bold">{announcements.length}</p>
              </div>
              <Megaphone className="w-10 h-10 text-primary" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="codes" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="codes" className="gap-2">
              <Key className="w-4 h-4" />
              الرموز
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2">
              <HelpCircle className="w-4 h-4" />
              الأسئلة
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-2">
              <Megaphone className="w-4 h-4" />
              الإعلانات
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="w-4 h-4" />
              المراقبة
            </TabsTrigger>
          </TabsList>

          {/* Codes Tab */}
          <TabsContent value="codes">
            <CodesTab codesCount={codesCount} onRefresh={fetchCodesCount} adminCode={code} />
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions">
            <QuestionsTab questions={questions} onRefresh={fetchQuestions} adminCode={code} />
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <AnnouncementsTab announcements={announcements} onRefresh={fetchAnnouncements} adminCode={code} />
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring">
            <MonitoringPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
