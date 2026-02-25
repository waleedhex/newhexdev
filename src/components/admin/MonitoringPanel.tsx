import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { 
  Activity, Users, Gamepad2, Clock, Key, 
  CheckCircle2, XCircle, Timer, RefreshCw, Power,
  TrendingUp, Calendar, Award, Search, FileQuestion, X
} from 'lucide-react';
import { toast } from 'sonner';

interface ActiveSession {
  id: string;
  session_code: string;
  host_name: string | null;
  created_at: string | null;
  last_activity: string | null;
  is_active: boolean | null;
  teams: {
    red: string[];
    green: string[];
  } | null;
}

interface SessionPlayer {
  id: string;
  session_id: string | null;
  player_name: string;
  role: string;
  team: string | null;
  is_connected: boolean | null;
  last_seen: string | null;
}

interface CodeUsage {
  code: string;
  sessions_count: number;
  last_used: string | null;
  is_active: boolean;
}

interface SessionQuestion {
  id: number;
  session_code: string;
  letter: string;
  question: string;
  answer: string;
  created_at: string | null;
}

interface CodeSearchResult {
  session: ActiveSession | null;
  questions: SessionQuestion[];
}

const MonitoringPanel: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [allSessions, setAllSessions] = useState<ActiveSession[]>([]);
  const [connectedPlayers, setConnectedPlayers] = useState<SessionPlayer[]>([]);
  const [codeUsage, setCodeUsage] = useState<CodeUsage[]>([]);
  const [totalCodes, setTotalCodes] = useState(0);
  const [usedCodesCount, setUsedCodesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState<ActiveSession | null>(null);
  const [todaySessions, setTodaySessions] = useState(0);
  const [avgSessionDuration, setAvgSessionDuration] = useState(0);
  const [mostUsedCode, setMostUsedCode] = useState<string | null>(null);
  
  // Code Search
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState<CodeSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  const fetchMonitoringData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    await Promise.all([
      fetchSessions(),
      fetchPlayers(),
      fetchCodeUsage(),
    ]);
    if (isRefresh) {
      setRefreshing(false);
      toast.success('تم تحديث البيانات');
    } else {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchMonitoringData(true);
  };

  const handleEndSession = async (session: ActiveSession) => {
    const { error } = await supabase
      .from('game_sessions')
      .update({ is_active: false })
      .eq('id', session.id);

    if (error) {
      toast.error('فشل في إنهاء الجلسة');
    } else {
      toast.success('تم إنهاء الجلسة بنجاح');
      fetchMonitoringData(true);
    }
    setSessionToEnd(null);
  };

  const fetchSessions = async () => {
    // Fetch all sessions
    const { data: sessions } = await supabase
      .from('game_sessions')
      .select('id, session_code, host_name, created_at, last_activity, is_active, teams')
      .order('last_activity', { ascending: false });

    const typedSessions = (sessions || []).map(s => ({
      ...s,
      teams: s.teams as { red: string[]; green: string[] } | null
    }));

    setAllSessions(typedSessions);
    setActiveSessions(typedSessions.filter(s => s.is_active));

    // Calculate today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = typedSessions.filter(s => {
      if (!s.created_at) return false;
      return new Date(s.created_at) >= today;
    }).length;
    setTodaySessions(todayCount);

    // Calculate average session duration (in minutes)
    const sessionsWithDuration = typedSessions.filter(s => s.created_at && s.last_activity);
    if (sessionsWithDuration.length > 0) {
      const totalDuration = sessionsWithDuration.reduce((acc, s) => {
        const start = new Date(s.created_at!).getTime();
        const end = new Date(s.last_activity!).getTime();
        return acc + (end - start);
      }, 0);
      const avgMs = totalDuration / sessionsWithDuration.length;
      setAvgSessionDuration(Math.round(avgMs / 60000)); // Convert to minutes
    }
  };

  const fetchPlayers = async () => {
    const { data: players } = await supabase
      .from('session_players')
      .select('id, session_id, player_name, role, is_connected, last_seen, team, created_at')
      .eq('is_connected', true)
      .order('last_seen', { ascending: false });

    setConnectedPlayers(players || []);
  };

  const fetchCodeUsage = async () => {
    // Get total codes count
    const { count: total } = await supabase
      .from('subscription_codes')
      .select('*', { count: 'exact', head: true });
    setTotalCodes(total || 0);

    // Get all codes
    const { data: allCodes } = await supabase
      .from('subscription_codes')
      .select('code');

    // Get all sessions to calculate usage
    const { data: sessions } = await supabase
      .from('game_sessions')
      .select('session_code, created_at, last_activity, is_active')
      .order('last_activity', { ascending: false });

    // Calculate usage for each code
    const usageMap = new Map<string, CodeUsage>();
    
    // Initialize all codes with 0 usage
    (allCodes || []).forEach(c => {
      usageMap.set(c.code, {
        code: c.code,
        sessions_count: 0,
        last_used: null,
        is_active: false
      });
    });

    // Count sessions per code
    const usedCodes = new Set<string>();
    (sessions || []).forEach(s => {
      usedCodes.add(s.session_code);
      const existing = usageMap.get(s.session_code);
      if (existing) {
        existing.sessions_count += 1;
        if (!existing.last_used || (s.last_activity && s.last_activity > existing.last_used)) {
          existing.last_used = s.last_activity;
        }
        if (s.is_active) {
          existing.is_active = true;
        }
      }
    });

    setUsedCodesCount(usedCodes.size);

    // Sort by sessions count (most used first)
    const usageArray = Array.from(usageMap.values())
      .sort((a, b) => b.sessions_count - a.sessions_count);

    setCodeUsage(usageArray);

    // Find most used code
    if (usageArray.length > 0 && usageArray[0].sessions_count > 0) {
      setMostUsedCode(usageArray[0].code);
    }
  };

  // Search by code
  const handleSearchCode = async () => {
    if (!searchCode.trim()) {
      toast.error('يرجى إدخال رمز للبحث');
      return;
    }

    setSearching(true);
    try {
      const codeUpper = searchCode.trim().toUpperCase();
      
      // Fetch session info
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('id, session_code, host_name, created_at, last_activity, is_active, teams')
        .ilike('session_code', codeUpper)
        .maybeSingle();

      // Fetch session questions
      const { data: questionsData } = await supabase
        .from('session_questions')
        .select('*')
        .ilike('session_code', codeUpper)
        .order('letter', { ascending: true });

      const typedSession = sessionData ? {
        ...sessionData,
        teams: sessionData.teams as { red: string[]; green: string[] } | null
      } : null;

      setSearchResult({
        session: typedSession,
        questions: questionsData || []
      });

      if (!typedSession && (!questionsData || questionsData.length === 0)) {
        toast.info('لا توجد بيانات لهذا الرمز');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء البحث');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchCode('');
    setSearchResult(null);
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'غير معروف';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return `منذ ${diffDays} يوم`;
  };

  const formatDuration = (startDate: string | null) => {
    if (!startDate) return 'غير معروف';
    
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours > 0) {
      return `${diffHours} س ${remainingMins} د`;
    }
    return `${diffMins} دقيقة`;
  };

  const getTeamCount = (session: ActiveSession) => {
    const teams = session.teams;
    if (!teams) return { red: 0, green: 0 };
    return {
      red: teams.red?.length || 0,
      green: teams.green?.length || 0
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Activity className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">لوحة المراقبة</h2>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm"
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث البيانات
        </Button>
      </div>

      {/* Code Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            البحث برمز الدخول
          </CardTitle>
          <CardDescription>ابحث عن نشاط رمز معين (معلومات الجلسة + الأسئلة)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="أدخل رمز الدخول..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchCode()}
                className="font-mono"
              />
              {searchCode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={clearSearch}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearchCode} disabled={searching}>
              {searching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Search Results */}
          {searchResult && (
            <div className="space-y-4 border-t pt-4">
              {/* Session Info */}
              {searchResult.session ? (
                <div className="p-4 rounded-lg bg-muted space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4" />
                      معلومات الجلسة
                    </h4>
                    <Badge className={searchResult.session.is_active 
                      ? "bg-green-500/20 text-green-700 border-green-500/30"
                      : "bg-gray-500/20 text-gray-700 border-gray-500/30"
                    }>
                      {searchResult.session.is_active ? 'نشطة' : 'منتهية'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">الرمز</p>
                      <p className="font-mono font-bold">{searchResult.session.session_code}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">تاريخ الإنشاء</p>
                      <p>{searchResult.session.created_at 
                        ? new Date(searchResult.session.created_at).toLocaleDateString('ar-SA')
                        : 'غير معروف'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">آخر نشاط</p>
                      <p>{formatTimeAgo(searchResult.session.last_activity)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">مدة الجلسة</p>
                      <p>{formatDuration(searchResult.session.created_at)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-muted/50 text-center text-muted-foreground">
                  <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>لا توجد جلسة بهذا الرمز</p>
                </div>
              )}

              {/* Session Questions */}
              <div className="p-4 rounded-lg bg-muted space-y-3">
                <h4 className="font-bold flex items-center gap-2">
                  <FileQuestion className="w-4 h-4" />
                  أسئلة الجلسة ({searchResult.questions.length})
                </h4>
                {searchResult.questions.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {searchResult.questions.map((q) => (
                        <div key={q.id} className="flex items-start gap-3 p-2 bg-background rounded-lg text-sm">
                          <span className="font-bold text-primary w-6">{q.letter}</span>
                          <div className="flex-1">
                            <p>{q.question}</p>
                            <p className="text-muted-foreground text-xs mt-1">الجواب: {q.answer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    لا توجد أسئلة خاصة بهذا الرمز
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overview Stats - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Gamepad2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">جلسات نشطة</p>
                <p className="text-2xl font-bold text-green-600">{activeSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">لاعبين متصلين</p>
                <p className="text-2xl font-bold text-blue-600">{connectedPlayers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Key className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">رموز مستخدمة</p>
                <p className="text-2xl font-bold text-purple-600">{usedCodesCount} / {totalCodes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي الجلسات</p>
                <p className="text-2xl font-bold text-orange-600">{allSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview Stats - Row 2 (New Stats) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">جلسات اليوم</p>
                <p className="text-2xl font-bold text-cyan-600">{todaySessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">متوسط مدة الجلسة</p>
                <p className="text-2xl font-bold text-pink-600">{avgSessionDuration} د</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">أكثر رمز استخداماً</p>
                <p className="text-lg font-bold text-amber-600 font-mono">{mostUsedCode || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-green-600" />
              الجلسات النشطة
            </CardTitle>
            <CardDescription>الجلسات المفتوحة حالياً مع تفاصيلها</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {activeSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>لا توجد جلسات نشطة حالياً</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSessions.map((session) => {
                    const teamCount = getTeamCount(session);
                    return (
                      <div 
                        key={session.id} 
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {session.session_code}
                            </Badge>
                            <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                              <CheckCircle2 className="w-3 h-3 ml-1" />
                              نشطة
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              {formatDuration(session.created_at)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setSessionToEnd(session)}
                            >
                              <Power className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            {teamCount.red} لاعب
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            {teamCount.green} لاعب
                          </span>
                          <span className="text-muted-foreground text-xs mr-auto">
                            <Clock className="w-3 h-3 inline ml-1" />
                            {formatTimeAgo(session.last_activity)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Code Usage Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-600" />
              إحصائيات الرموز
            </CardTitle>
            <CardDescription>استخدام الرموز وآخر نشاط</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {codeUsage.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>لا توجد رموز</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {codeUsage.slice(0, 50).map((usage) => (
                    <div 
                      key={usage.code} 
                      className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {usage.code}
                        </Badge>
                        {usage.is_active && (
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {usage.sessions_count > 0 ? (
                          <>
                            <Badge variant="secondary" className="text-xs">
                              {usage.sessions_count} جلسة
                            </Badge>
                            <span className="text-muted-foreground">
                              {formatTimeAgo(usage.last_used)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">غير مستخدم</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {codeUsage.length > 50 && (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      و {codeUsage.length - 50} رمز آخر...
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Connected Players */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            اللاعبين المتصلين حالياً
          </CardTitle>
          <CardDescription>قائمة بجميع اللاعبين المتصلين في الجلسات النشطة</CardDescription>
        </CardHeader>
        <CardContent>
          {connectedPlayers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>لا يوجد لاعبين متصلين حالياً</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {connectedPlayers.map((player) => (
                  <div 
                    key={player.id} 
                    className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="font-medium text-sm truncate">{player.player_name}</span>
                    <Badge variant="outline" className="text-xs mr-auto">
                      {player.role === 'host' ? 'مقدم' : player.role === 'contestant' ? 'متسابق' : 'عرض'}
                    </Badge>
                    {player.team && (
                      <span 
                        className={`w-3 h-3 rounded-full ${player.team === 'red' ? 'bg-red-500' : 'bg-green-500'}`}
                      ></span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* End Session Confirmation Dialog */}
      <AlertDialog open={!!sessionToEnd} onOpenChange={() => setSessionToEnd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إنهاء الجلسة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إنهاء الجلسة <span className="font-mono font-bold">{sessionToEnd?.session_code}</span>؟
              <br />
              سيتم قطع اتصال جميع اللاعبين في هذه الجلسة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => sessionToEnd && handleEndSession(sessionToEnd)}
            >
              إنهاء الجلسة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MonitoringPanel;
