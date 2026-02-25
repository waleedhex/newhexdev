import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const VERIFICATION_EXPIRY_MS = 5 * 60 * 1000;

/**
 * يراقب عودة المستخدم للتطبيق بعد مغادرة المتصفح.
 * إذا انتهت صلاحية التحقق (5 دقائق)، يعيده لشاشة رمز الدخول.
 */
export function useSessionExpiry(code: string) {
  const navigate = useNavigate();

  useEffect(() => {
    const checkExpiry = () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const stored = JSON.parse(sessionStorage.getItem('code_verified') || '{}');
        if (
          !stored.code ||
          stored.code.toUpperCase() !== code.toUpperCase() ||
          !stored.ts ||
          Date.now() - stored.ts > VERIFICATION_EXPIRY_MS
        ) {
          sessionStorage.removeItem('code_verified');
          navigate('/', { replace: true });
        }
      } catch {
        sessionStorage.removeItem('code_verified');
        navigate('/', { replace: true });
      }
    };

    document.addEventListener('visibilitychange', checkExpiry);
    // Also check immediately on mount
    checkExpiry();

    return () => document.removeEventListener('visibilitychange', checkExpiry);
  }, [code, navigate]);
}
