import { PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME } from '../config/financial';
import type { SurfaceEngineResults } from './surfaceEngines';

export interface SafeToCommit {
  readonly amountIls: number;
  readonly incomeIls: number;
  readonly obligationsIls: number;
  readonly bufferIls: number;
}

/** Derive Home's commitment estimate from the shared load result and configured cash buffer. */
export function safeToCommitFrom(results: SurfaceEngineResults): SafeToCommit | null {
  const incomeIls = results.context.profile?.monthlyIncome;
  if (results.load === null || incomeIls === undefined) return null;

  const obligationsIls = results.load.current.monthlyObligationsIls.value;
  const bufferIls = incomeIls * PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME;

  return {
    amountIls: incomeIls - obligationsIls - bufferIls,
    incomeIls,
    obligationsIls,
    bufferIls,
  };
}
