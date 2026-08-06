'use client';

import { useCallback, useEffect, useRef } from 'react';
import { recordVacancyView, recordVacancySave, recordVacancyHide } from '@/api/sync';

interface UseVacancyInteractionOptions {
  readonly vacancyId: string | null;
  readonly recordViewOnMount?: boolean;
}

interface UseVacancyInteractionResult {
  readonly recordView: (vacancyId: string) => void;
  readonly recordSave: (vacancyId: string) => void;
  readonly recordHide: (vacancyId: string) => void;
}

function fireAndForget(promise: Promise<unknown>): void {
  promise.catch(() => {
    // Interaction tracking is best-effort — failures are silent.
  });
}

export function useVacancyInteraction({
  vacancyId,
  recordViewOnMount = false,
}: UseVacancyInteractionOptions): UseVacancyInteractionResult {
  const hasRecordedView = useRef(false);

  useEffect(() => {
    if (!recordViewOnMount || !vacancyId || hasRecordedView.current) return;
    hasRecordedView.current = true;
    fireAndForget(recordVacancyView(vacancyId));
  }, [vacancyId, recordViewOnMount]);

  const recordView = useCallback((id: string) => {
    fireAndForget(recordVacancyView(id));
  }, []);

  const recordSave = useCallback((id: string) => {
    fireAndForget(recordVacancySave(id));
  }, []);

  const recordHide = useCallback((id: string) => {
    fireAndForget(recordVacancyHide(id));
  }, []);

  return { recordView, recordSave, recordHide };
}
