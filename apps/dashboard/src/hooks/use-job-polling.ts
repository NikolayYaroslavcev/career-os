'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseJobPollingOptions<T> {
  readonly jobId: string | null;
  readonly enabled: boolean;
  readonly fetchStatus: (jobId: string) => Promise<T>;
  readonly isDone: (status: T) => boolean;
  readonly intervalMs?: number;
  readonly maxAttempts?: number;
}

export interface UseJobPollingResult<T> {
  readonly status: T | null;
}

/**
 * Generic interval-based job-status poller, extracted from the pattern in
 * apps/dashboard/src/features/intelligence/search-button.tsx (the one
 * pre-existing async-status polling implementation in this dashboard — plain
 * `setInterval`, no SWR/react-query anywhere in the repo). Used by
 * TailorResumeTab to drive the resume-tailoring stage stepper (ADR-031).
 */
export function useJobPolling<T>({
  jobId,
  enabled,
  fetchStatus,
  isDone,
  intervalMs = 4000,
  maxAttempts = 60,
}: UseJobPollingOptions<T>): UseJobPollingResult<T> {
  const [status, setStatus] = useState<T | null>(null);

  const fetchStatusRef = useRef(fetchStatus);
  fetchStatusRef.current = fetchStatus;
  const isDoneRef = useRef(isDone);
  isDoneRef.current = isDone;

  useEffect(() => {
    if (!jobId || !enabled) return;

    let attempts = 0;
    let cancelled = false;

    const tick = async (): Promise<void> => {
      attempts += 1;
      try {
        const next = await fetchStatusRef.current(jobId);
        if (cancelled) return;
        setStatus(next);
        if (isDoneRef.current(next) || attempts >= maxAttempts) {
          clearInterval(intervalId);
        }
      } catch {
        // Transient poll failure — try again next tick.
      }
    };

    void tick();
    const intervalId = setInterval(tick, intervalMs);

    return (): void => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [jobId, enabled, intervalMs, maxAttempts]);

  return { status };
}
