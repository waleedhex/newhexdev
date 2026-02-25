import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Bell } from 'lucide-react';
import { setHostToken, clearHostToken, getHostToken } from '@/hooks/useHostBoardActions';
import { supabase } from '@/integrations/supabase/client';
import { registerHostAtomic } from '@/hooks/useHostValidation';
import { createOrResumeSession } from '@/hooks/useRoomValidation';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import logoImg from '@/assets/logo.png';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { t, Lang, isRtl } from '@/lib/i18n';

const MAX_WORDS = 2;
const isNameValid = (n: string) => {
  const trimmed = n.trim();
  if (!trimmed) return false;
  return trimmed.split(/\s+/).length <= MAX_WORDS;
};

const RoleSelection: React.FC = () => {
  const [name, setName] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '';
  const lang = (searchParams.get('lang') || 'ar') as Lang;
  
  const [isCheckingHost, setIsCheckingHost] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    const VERIFICATION_EXPIRY_MS = 5 * 60 * 1000;
    try {
      const stored = JSON.parse(sessionStorage.getItem('code_verified') || '{}');
      if (!stored.code || stored.code.toUpperCase() !== code.toUpperCase() || 
          !stored.ts || (Date.now() - stored.ts) > VERIFICATION_EXPIRY_MS) {
        sessionStorage.removeItem('code_verified');
        navigate('/');
        return;
      }
    } catch {
      sessionStorage.removeItem('code_verified');
      navigate('/');
      return;
    }

    const ensureSession = async () => {
      try {
        const result = await createOrResumeSession(code);
        if (!result.success) {
          console.error('Failed to ensure session:', result.error);
          if (result.error === 'الرمز غير صحيح') {
            navigate('/');
          }
        }
      } catch (err) {
        console.error('Failed to ensure session:', err);
      }
    };

    ensureSession();
  }, [code, navigate]);

  const handleRoleSelect = async (role: 'host' | 'contestant') => {
    if (!isNameValid(name)) {
      return;
    }
    
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

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen bg-background p-4 font-tajawal"
      dir={isRtl(lang) ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-md space-y-8">
        <AnnouncementBanner />
        
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t(lang, 'gameTitle')}</h1>
          <p className="text-muted-foreground">{t(lang, 'enterNameAndRole')}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              {t(lang, 'name')}
            </label>
            <Input
              id="name"
              type="text"
              placeholder={t(lang, 'enterNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-center text-lg h-14"
              maxLength={50}
            />
          </div>

          {hostError && (
            <Alert variant="destructive" className="animate-in fade-in">
              <AlertDescription className="text-center">
                {hostError}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4 pt-4">
            <Button
              onClick={() => handleRoleSelect('host')}
              disabled={!isNameValid(name) || isCheckingHost}
              className="h-32 flex flex-col items-center justify-center gap-3 text-lg bg-primary hover:bg-primary/90 transition-all"
            >
              <User className="w-10 h-10" />
              <span>{isCheckingHost ? t(lang, 'checkingHost') : t(lang, 'host')}</span>
            </Button>

            <Button
              onClick={() => handleRoleSelect('contestant')}
              disabled={!isNameValid(name) || isCheckingHost}
              variant="secondary"
              className="h-32 flex flex-col items-center justify-center gap-3 text-lg hover:bg-secondary/80 transition-all"
            >
              <Bell className="w-10 h-10" />
              <span>{t(lang, 'contestant')}</span>
            </Button>
          </div>

          {!name.trim() ? (
            <p className="text-center text-sm text-muted-foreground">
              {t(lang, 'enterNameFirst')}
            </p>
          ) : name.trim().split(/\s+/).length > MAX_WORDS ? (
            <p className="text-center text-sm text-destructive">
              {t(lang, 'nameTooLong')}
            </p>
          ) : null}

          <div className="flex flex-col items-center gap-2 pt-4">
            <a href="https://hex-store.com" target="_blank" rel="noopener noreferrer"><img src={logoImg} alt="Hex logo" className="w-20 h-20 object-contain" /></a>
            <span className="text-sm text-primary">{t(lang, 'visitStore')}</span>
            <span className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} متجر هيكس. جميع الحقوق محفوظة</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
