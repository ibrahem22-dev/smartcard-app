import type { SurfaceEngineResults } from '../../surfaces';

export interface BestForChip {
  readonly id: string;
  readonly kind: 'lowest-cost';
  readonly explanation: string | null;
}

/**
 * THE EFFECTIVE-COST STEP, SELECTED WITHOUT RESTATING THE ENGINE'S CITATION.
 *
 * This was `'product spec §20.1 effective cost'`, spelled out here — a **second home for one
 * string**, agreeing with `src/engines/scoring.ts` only for as long as nobody renumbered the spec.
 * It also put the literal `20.1` in a surface file, where P5's `no-magic-numbers` gate reads it as
 * a rate: **a campaign may allowlist an exception it inherited, never one it writes for its own new
 * code**, which is that campaign marking its own homework. So the citation is not restated and not
 * excused; it is not needed.
 *
 * The engine's per-card trace carries exactly two steps — the effective-cost one and
 * `roadmap §10 P3 card scoring` — and only the first ends this way, so the match is precise. It is
 * also the more durable question: this selects the step ABOUT effective cost rather than the step
 * that cites one particular section number.
 *
 * B1 is why the constant is not simply imported from the engine: a surface may not value-import
 * `src/engines`.
 */
const isEffectiveCostRule = (rule: string): boolean => rule.endsWith('effective cost');

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
    (candidate) => isEffectiveCostRule(candidate.rule),
  );

  return [
    {
      id: rankedCard.cardId,
      kind: 'lowest-cost',
      explanation: selectedStep?.detail ?? null,
    },
  ];
}
