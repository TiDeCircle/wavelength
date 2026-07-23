"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Simple wall-clock countdown. Pass `null` seconds to disable it entirely.
 * `onExpire` fires once when the clock reaches zero.
 */
export function useCountdown(
  seconds: number | null,
  onExpire?: () => void,
): number | null {
  const [left, setLeft] = useState<number | null>(seconds);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    expired.current = false;
    setLeft(seconds);
    if (seconds === null) return;

    const endAt = Date.now() + seconds * 1000;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !expired.current) {
        expired.current = true;
        window.clearInterval(id);
        onExpireRef.current?.();
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [seconds]);

  return left;
}
