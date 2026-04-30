'use client';

import { useEffect, useRef, useState } from 'react';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a number from 0 → `target` once `trigger` becomes true.
 * Pass `instant=true` to skip the animation (respects reduced-motion).
 */
export function useCountUp(
  target: number,
  trigger: boolean,
  { duration = 1600, instant = false }: { duration?: number; instant?: boolean } = {},
): number {
  const [count, setCount] = useState(0);
  const frameRef = useRef(0);
  const hasRun   = useRef(false);

  useEffect(() => {
    if (!trigger || hasRun.current) return;
    hasRun.current = true;

    if (instant || typeof window === 'undefined') {
      setCount(target);
      return;
    }

    let startTime: number | null = null;

    const tick = (ts: number) => {
      if (startTime === null) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setCount(Math.round(easeOutCubic(p) * target));
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, trigger, duration, instant]);

  return trigger ? count : 0;
}
