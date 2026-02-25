/**
 * ConnectionStatus.tsx
 * مكون لعرض حالة الاتصال مع مؤشر بصري
 */

import React from 'react';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionStatus as ConnectionStatusType } from '@/hooks/useConnectionResilience';
import { t, getLangFromUrl, isRtl } from '@/lib/i18n';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  reconnectAttempt: number;
  maxAttempts: number;
  isOnline: boolean;
  onRetry?: () => void;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  reconnectAttempt,
  maxAttempts,
  isOnline,
  onRetry,
  className,
}) => {
  if (status === 'connected' && isOnline) return null;

  const lang = getLangFromUrl();

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 p-3 text-center font-tajawal animate-in slide-in-from-top',
        status === 'reconnecting' && 'bg-accent text-accent-foreground',
        status === 'disconnected' && 'bg-destructive text-destructive-foreground',
        !isOnline && 'bg-muted text-muted-foreground',
        className
      )}
      dir={isRtl(lang) ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-center gap-3">
        {status === 'reconnecting' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t(lang, 'reconnecting')} ({reconnectAttempt}/{maxAttempts})</span>
          </>
        ) : status === 'disconnected' ? (
          <>
            <WifiOff className="w-5 h-5" />
            <span>{t(lang, 'disconnected')}</span>
            {onRetry && (
              <button onClick={onRetry} className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                <RefreshCw className="w-4 h-4" />
                <span>{t(lang, 'retry')}</span>
              </button>
            )}
          </>
        ) : !isOnline ? (
          <>
            <WifiOff className="w-5 h-5" />
            <span>{t(lang, 'noInternet')}</span>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ConnectionStatus;
