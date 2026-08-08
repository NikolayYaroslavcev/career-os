'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A boolean flag that reverts to false on its own after `durationMs` —
 * "copied!"/"saved!" style transient confirmations. Clears the pending
 * timeout on unmount (and before starting a new one, in case trigger() is
 * called again while one is still running), so a component unmounted
 * mid-window never sets state after unmount.
 */
export function useTimedFlag(durationMs = 2000): readonly [boolean, () => void] {
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return (): void => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const trigger = useCallback((): void => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActive(true);
    timeoutRef.current = setTimeout(() => setActive(false), durationMs);
  }, [durationMs]);

  return [active, trigger] as const;
}
