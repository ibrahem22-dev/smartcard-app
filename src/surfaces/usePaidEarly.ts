import { useCallback, useMemo, useState } from 'react';

import type { SurfaceContext } from './surfaceContext';

export interface UsePaidEarlyResult {
  readonly paidEarlyCommitmentIds: readonly string[];
  readonly markPaidEarly: (commitmentId: string) => void;
  readonly context: SurfaceContext;
}

/**
 * The single Paid-early act shared by every surface.
 *
 * This hook changes only the engine input. The load engine owns the recalculation and reports
 * any released hold through `releasedByEarlyPayoffIls`; no released figure is derived here.
 */
export function usePaidEarly(baseContext: SurfaceContext): UsePaidEarlyResult {
  const [paidEarlyCommitmentIds, setPaidEarlyCommitmentIds] = useState<readonly string[]>(
    () => [...(baseContext.paidEarlyCommitmentIds ?? [])],
  );

  const markPaidEarly = useCallback((commitmentId: string): void => {
    setPaidEarlyCommitmentIds((current) =>
      current.includes(commitmentId) ? current : [...current, commitmentId],
    );
  }, []);

  const context = useMemo<SurfaceContext>(
    () => ({ ...baseContext, paidEarlyCommitmentIds }),
    [baseContext, paidEarlyCommitmentIds],
  );

  return useMemo(
    () => ({ paidEarlyCommitmentIds, markPaidEarly, context }),
    [context, markPaidEarly, paidEarlyCommitmentIds],
  );
}
