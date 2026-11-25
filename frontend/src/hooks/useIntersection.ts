'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Returns a ref and a `visible` flag that flips to true once the element
 * enters the viewport. Disconnects the observer after first trigger.
 */
export function useIntersection<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.1,
) {
  const ref     = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, visible]);

  return { ref, visible };
}
