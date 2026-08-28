import type { SurfaceEngineResults } from '../../surfaces';

export interface BestForChip {
  readonly id: string;
  readonly kind: 'lowest-cost';
  readonly explanation: string | null;
}

const EFFECTIVE_COST_RULE = 'product spec §20.1 effective cost';

/**
 * Select the card-level effective-cost step because it is the scoring engine's account of the
 * basis on which this card entered the ranking.
 *
 * `null` means the engine gave no explanation for this chip. It does not mean that no explanation
 * exists, and the surface must not fill that gap with copy of its own.
 */
export function bestForChipsFor(
  result: SurfaceEngineResults['scoring'],
  cardId: string,
): readonly BestForChip[] {
  // The scoring engine's ranked array — not any score figure — is the authoritative order.
  const rankedCard = result?.ranked[0];
  if (rankedCard === undefined || rankedCard.cardId !== cardId) return [];

  const selectedStep = rankedCard.trace.steps.find(
    (candidate) => candidate.rule === EFFECTIVE_COST_RULE,
  );

  return [
    {
      id: rankedCard.cardId,
      kind: 'lowest-cost',
      explanation: selectedStep?.detail ?? null,
    },
  ];
}
