import React, { useState, useEffect } from 'react';
import logoImg from '@/assets/logo.png';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Bell, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { setHostToken, clearHostToken, getHostToken } from '@/hooks/useHostBoardActions';
import { registerHostAtomic } from '@/hooks/useHostValidation';
import { createOrResumeSession } from '@/hooks/useRoomValidation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { t, Lang, isRtl } from '@/lib/i18n';

const INVITE_LINK_EXPIRATION_MS = 60 * 60 * 1000;

const MAX_WORDS = 2;
const isNameValid = (n: string) => {
  const trimmed = n.trim();
  if (!trimmed) return false;
  return trimmed.split(/\s+/).length <= MAX_WORDS;
};

const InvitePage: React.FC = () => {
  const [name, setName] = useState('');
  const [lang, setLang] = useState<Lang>('ar');
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '';
  const timestamp = searchParams.get('t');

  const [isCheckingHost, setIsCheckingHost] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  useEffect(() => {
    const verifyCode = async () => {
      if (!code) {
        navigate('/');
        return;
      }

      if (timestamp) {
        const linkCreatedAt = parseInt(timestamp, 10);
        const now = Date.now();
        const elapsed = now - linkCreatedAt;

        if (isNaN(linkCreatedAt) || elapsed > INVITE_LINK_EXPIRATION_MS) {
          setIsExpired(true);
          setIsLoading(false);
          return;
        }
      }

      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('verify-code', {
          body: { code },
        });

        if (fnError || !fnData?.valid) {
          navigate('/');
          return;
        }

        await supabase
          .from('game_sessions')
          .update({ 
            is_active: true, 
            last_activity: new Date().toISOString() 
          })
          .ilike('session_code', code);

        sessionStorage.setItem('code_verified', JSON.stringify({ code, ts: Date.now() }));
        setIsValid(true);
      } catch (err) {
        console.error('Verification error:', err);
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    verifyCode();
  }, [code, timestamp, navigate]);

  const handleRoleSelect = async (role: 'host' | 'contestant') => {
    if (!isNameValid(name)) return;
    
    const encodedName = encodeURIComponent(name.trim());
    const encodedCode = encodeURIComponent(code);
    
    if (role === 'host') {
      setIsCheckingHost(true);
      setHostError(null);
      
      const sessionResult = await createOrResumeSession(code);
      if (!sessionResult.success) {
        setIsCheckingHost(false);
        setHostError(sessionResult.error || t(lang, 'sessionCreationFailed'));
        return;
      }
      
      let token = getHostToken(code);
      if (!token) {
        token = crypto.randomUUID();
      }
      
      const result = await registerHostAtomic(code, name.trim(), token);
      
      setIsCheckingHost(false);
      
      if (!result.success) {
        if (result.existingHostName) {
          setHostError(`${t(lang, 'activeHostExists')}: ${result.existingHostName}`);
        } else {
          setHostError(result.error || t(lang, 'registrationFailed'));
        }
        return;
      }
      
      setHostToken(code, token);
      navigate(`/host?name=${encodedName}&code=${encodedCode}&lang=${lang}`);
    } else {
      clearHostToken(code);
      navigate(`/contestant?name=${encodedName}&code=${encodedCode}&lang=${lang}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 font-tajawal" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t(lang, 'verifying')}</p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 font-tajawal" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{t(lang, 'inviteExpiredTitle')}</h1>
            <p className="text-muted-foreground text-lg">{t(lang, 'inviteExpiredMessage')}</p>
          </div>
          <Alert variant="destructive" className={isRtl(lang) ? 'text-right' : 'text-left'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t(lang, 'inviteExpiredNote')}</AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/')} className="mt-4" size="lg">
            {t(lang, 'backToHome')}
          </Button>

        </div>
      </div>
    );
  }

  if (!isValid) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 font-tajawal" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">🎮</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">{t(lang, 'welcomeTitle')}</h1>
          <p className="text-muted-foreground">{t(lang, 'inviteSubtitle')}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">{t(lang, 'name')}</label>
            <Input id="name" type="text" placeholder={t(lang, 'enterNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className="text-center text-lg h-14" maxLength={50} />
          </div>

          {hostError && (
            <Alert variant="destructive" className="animate-in fade-in">
              <AlertDescription className="text-center">{hostError}</AlertDescription>
            </Alert>
          )}


          <div className="grid grid-cols-2 gap-4 pt-4">
            <Button onClick={() => handleRoleSelect('host')} disabled={!isNameValid(name) || isCheckingHost} className="h-32 flex flex-col items-center justify-center gap-3 text-lg bg-primary hover:bg-primary/90 transition-all">
              <User className="w-10 h-10" />
              <span>{isCheckingHost ? t(lang, 'checkingHost') : t(lang, 'host')}</span>
            </Button>
            <Button onClick={() => handleRoleSelect('contestant')} disabled={!isNameValid(name) || isCheckingHost} variant="secondary" className="h-32 flex flex-col items-center justify-center gap-3 text-lg hover:bg-secondary/80 transition-all">
              <Bell className="w-10 h-10" />
              <span>{t(lang, 'contestant')}</span>
            </Button>
          </div>

          {!name.trim() ? (
            <p className="text-center text-sm text-muted-foreground">{t(lang, 'enterNameFirst')}</p>
          ) : name.trim().split(/\s+/).length > MAX_WORDS ? (
            <p className="text-center text-sm text-destructive">{t(lang, 'nameTooLong')}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2 pt-4">
          <a href="https://hex-store.com" target="_blank" rel="noopener noreferrer">
            <img src={logoImg} alt="Hex logo" className="w-20 h-20 object-contain" />
          </a>
          <span className="text-sm text-primary">{t(lang, 'visitStore')}</span>
          <span className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} متجر هيكس. جميع الحقوق محفوظة</span>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;
