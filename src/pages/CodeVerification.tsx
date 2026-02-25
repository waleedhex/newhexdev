import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KeyRound, Loader2 } from 'lucide-react';
import { validateSubscriptionCode, SubscriptionCodeData } from '@/hooks/useRoomValidation';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import logoImg from '@/assets/logo.png';
import { t, Lang, isRtl } from '@/lib/i18n';

const CodeVerification: React.FC = () => {
  const [code, setCode] = useState(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    return isPWA ? (localStorage.getItem('last_used_code') || '') : '';
  });
  const [lang, setLang] = useState<Lang>('ar');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError(t(lang, 'enterCodeError'));
      return;
    }

    setIsLoading(true);
    setError('');

    const normalizedCode = code.trim().toUpperCase();

    try {
      if (normalizedCode === 'IMWRA143') {
        navigate(`/admin?code=${encodeURIComponent(normalizedCode)}`);
        return;
      }

      const result = await validateSubscriptionCode(normalizedCode);

      if (!result.isValid) {
        setError(result.error || t(lang, 'codeInvalid'));
        return;
      }

      const data = result.data as SubscriptionCodeData;

      if (data.is_admin) {
        navigate(`/admin?code=${encodeURIComponent(normalizedCode)}`);
        return;
      }

      sessionStorage.setItem('code_verified', JSON.stringify({ code: normalizedCode, ts: Date.now() }));
      localStorage.setItem('last_used_code', normalizedCode);
      navigate(`/select-role?code=${encodeURIComponent(normalizedCode)}&lang=${lang}`);
    } catch (err) {
      console.error('Verification error:', err);
      setError(t(lang, 'verificationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleVerifyCode();
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-background p-4 font-tajawal"
      dir={isRtl(lang) ? 'rtl' : 'ltr'}>

      <div className="w-full max-w-md space-y-8">
        <AnnouncementBanner />
        
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t(lang, 'gameTitle')}</h1>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium text-foreground">
              {t(lang, 'subscriptionCode')}
            </label>
            <Input
              id="code"
              type="text"
              placeholder={t(lang, 'enterCodePlaceholder')}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              onKeyPress={handleKeyPress}
              className="text-center text-lg h-14 tracking-widest uppercase"
              maxLength={20}
              disabled={isLoading} />
          </div>

          {error &&
          <div className="text-center text-destructive text-sm bg-destructive/10 py-2 px-4 rounded-lg">
              {error}
            </div>
          }

          <Button
            onClick={handleVerifyCode}
            disabled={isLoading || !code.trim()}
            className="w-full h-14 text-lg">
            {isLoading ?
            <>
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
                {t(lang, 'verifying')}
              </> :
            t(lang, 'verifyCode')
            }
          </Button>

          {/* اختيار اللغة */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant={lang === 'ar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLang('ar')}
              className="min-w-[80px]"
            >
              عربي
            </Button>
            <Button
              variant={lang === 'en' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLang('en')}
              className="min-w-[80px]"
            >
              English
            </Button>
          </div>

          <div className="flex flex-col items-center gap-2 pt-4">
            <a href="https://hex-store.com" target="_blank" rel="noopener noreferrer"><img src={logoImg} alt="Hex logo" className="w-20 h-20 object-contain" /></a>
            <span className="text-sm text-primary">{t(lang, 'visitStore')}</span>
            <span className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} متجر هيكس. جميع الحقوق محفوظة</span>
          </div>
        </div>
      </div>
    </div>);
};

export default CodeVerification;
