import { useState, useEffect } from 'react';

/**
 * Detects mobile landscape mode (landscape orientation + short viewport).
 * Returns true when the device is in landscape and viewport height ≤ 500px.
 */
export function useLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const check = () => {
      const landscape = window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
      setIsLandscape(landscape);
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);

    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return isLandscape;
}
