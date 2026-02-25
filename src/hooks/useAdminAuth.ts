/**
 * useAdminAuth - التحقق من صلاحيات الأدمن مع Rate Limiting
 * 
 * الميزات:
 * - التحقق من كود الأدمن من قاعدة البيانات (is_admin = true)
 * - Rate limiting لمنع محاولات الاختراق
 * - حماية ضد brute force
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const ATTEMPT_WINDOW = 60 * 1000; // 1 minute

interface RateLimitState {
  attempts: number[];
  lockedUntil: number | null;
}

// Get rate limit state from sessionStorage
const getRateLimitState = (): RateLimitState => {
  try {
    const stored = sessionStorage.getItem('admin_rate_limit');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }
  return { attempts: [], lockedUntil: null };
};

// Save rate limit state to sessionStorage
const saveRateLimitState = (state: RateLimitState) => {
  sessionStorage.setItem('admin_rate_limit', JSON.stringify(state));
};

// Check if currently locked out
const isLockedOut = (): { locked: boolean; remainingTime: number } => {
  const state = getRateLimitState();
  
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return {
      locked: true,
      remainingTime: Math.ceil((state.lockedUntil - Date.now()) / 1000)
    };
  }
  
  return { locked: false, remainingTime: 0 };
};

// Record an attempt
const recordAttempt = (): { blocked: boolean; attemptsRemaining: number } => {
  const state = getRateLimitState();
  const now = Date.now();
  
  // Clear old attempts outside the window
  state.attempts = state.attempts.filter(t => now - t < ATTEMPT_WINDOW);
  
  // Add new attempt
  state.attempts.push(now);
  
  // Check if too many attempts
  if (state.attempts.length >= MAX_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_DURATION;
    saveRateLimitState(state);
    return { blocked: true, attemptsRemaining: 0 };
  }
  
  saveRateLimitState(state);
  return { blocked: false, attemptsRemaining: MAX_ATTEMPTS - state.attempts.length };
};

// Clear rate limit on success
const clearRateLimit = () => {
  sessionStorage.removeItem('admin_rate_limit');
};

export interface UseAdminAuthReturn {
  isLoading: boolean;
  isAuthenticated: boolean;
  isLockedOut: boolean;
  lockoutRemaining: number;
  attemptsRemaining: number;
}

export const useAdminAuth = (code: string): UseAdminAuthReturn => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lockoutState, setLockoutState] = useState({ locked: false, remainingTime: 0 });
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);

  // Update lockout timer
  useEffect(() => {
    const checkLockout = () => {
      const lockout = isLockedOut();
      setLockoutState(lockout);
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  // Verify admin code
  useEffect(() => {
    const verifyAdmin = async () => {
      if (!code) {
        navigate('/');
        return;
      }

      // Check if locked out
      const lockout = isLockedOut();
      if (lockout.locked) {
        setLockoutState(lockout);
        setIsLoading(false);
        toast.error(`تم حظر المحاولات. انتظر ${Math.ceil(lockout.remainingTime / 60)} دقيقة`);
        return;
      }

      try {
        // Check if code exists and is admin via Edge Function
        const { data: fnData, error: fnError } = await supabase.functions.invoke('verify-code', {
          body: { code },
        });

        if (fnError || !fnData?.valid) {
          // Invalid code - record attempt
          const result = recordAttempt();
          setAttemptsRemaining(result.attemptsRemaining);
          
          if (result.blocked) {
            toast.error('تم حظر المحاولات لمدة 5 دقائق');
          } else {
            toast.error(`رمز غير صحيح. المحاولات المتبقية: ${result.attemptsRemaining}`);
          }
          
          navigate('/');
          return;
        }

        const data = { is_admin: fnData.is_admin };

        if (!data.is_admin) {
          // Valid code but not admin - record attempt
          const result = recordAttempt();
          setAttemptsRemaining(result.attemptsRemaining);
          
          if (result.blocked) {
            toast.error('تم حظر المحاولات لمدة 5 دقائق');
          } else {
            toast.error(`هذا الرمز ليس رمز مسؤول. المحاولات المتبقية: ${result.attemptsRemaining}`);
          }
          
          navigate('/');
          return;
        }

        // Success - clear rate limit
        clearRateLimit();
        setIsAuthenticated(true);
        setAttemptsRemaining(MAX_ATTEMPTS);
      } catch (err) {
        console.error('Admin verification error:', err);
        toast.error('حدث خطأ أثناء التحقق');
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAdmin();
  }, [code, navigate]);

  return {
    isLoading,
    isAuthenticated,
    isLockedOut: lockoutState.locked,
    lockoutRemaining: lockoutState.remainingTime,
    attemptsRemaining
  };
};

export default useAdminAuth;
