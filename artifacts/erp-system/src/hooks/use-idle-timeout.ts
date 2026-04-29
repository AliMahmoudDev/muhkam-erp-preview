/**
 * useIdleTimeout — يكشف خمول المستخدم لمدة محددة.
 * عند الخمول ساعة كاملة (3600 ثانية) يستدعي onIdle.
 * يُعاد ضبطه عند أي حركة: موس / لوحة مفاتيح / لمس.
 */
import { useEffect, useRef, useCallback } from 'react';

interface Options {
  timeoutMs?: number;
  onIdle: () => void;
}

export function useIdleTimeout({ timeoutMs = 3_600_000, onIdle }: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start immediately
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [reset]);
}
