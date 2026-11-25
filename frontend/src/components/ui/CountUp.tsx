'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Shows a number that counts up when it first appears and to its new value whenever
 * it changes (e.g. when a dashboard's data refreshes). Shown at once for people who prefer reduced motion.
 */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  // Starts at 0 so the first value counts up when the card appears
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || start === value) { setShown(value); return; }
    let raf = 0;
    let t0: number | null = null;
    const tick = (ts: number) => {
      t0 ??= ts;
      const p = Math.min((ts - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{shown.toLocaleString()}</>;
}
