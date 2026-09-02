import type {
  ConflictRenderPlan,
  IntervalRankability,
  PackConflict,
} from '../data/adapter/conflictRender';

import { conflict, type ConflictAuthority } from './authorityValue';

/**
 * Convert one shipped conflict record into the authority shape the FX engine can carry.
 * Participant order is retained exactly. Missing values remain missing; they are never inferred
 * from a sibling row, a unit, or a record id.
 */
export function numericConflictAuthorityFromPack(
  record: PackConflict,
): ConflictAuthority<number> {
  return conflict(
    record.participants.flatMap((participant) => {
      if (typeof participant.value !== 'number' || !Number.isFinite(participant.value)) return [];
      return [{
        value: participant.value,
        // The pack records a value, source and scope, but no provenance; report that absence.
        provenance: 'UNKNOWN' as const,
        sourceId: participant.sourceLabel ?? participant.recordId,
        observedAt: participant.publicationDate,
        scope: record.scope,
      }];
    }),
    `Preserved conflict ${record.conflictId}: sources disagree; no winner was selected`,
  );
}

/** Ask the adapter for both FX conflict decisions without exposing candidates to the surface. */
export function conflictDecisionFor(conflictValue: ConflictAuthority<number>): {
  readonly plan: ConflictRenderPlan;
  readonly rankability: IntervalRankability;
} {
  // Lazy for the same reason as Section A: ordinary comparisons must not pull the adapter runtime
  // into the React Native graph. The authority layer translates the complete envelope back into
  // the adapter input shape; the surface only receives the resulting decisions.
  const { intervalRankabilityFor, renderPlanFor } = require('../data/adapter/conflictRender') as typeof import('../data/adapter/conflictRender');
  const renderableRecords = conflictValue.candidates.map((candidate, index) => ({
    conflictId: `fx-conflict-candidate:${String(index)}`,
    shape: 'INLINE' as const,
    scope: candidate.scope ?? 'fx-cost',
    participants: [{
      recordId: candidate.sourceId ?? `candidate:${String(index)}`,
      field: 'FX_COMMISSION_PCT',
      value: candidate.value,
      ...(candidate.sourceId === undefined ? {} : { sourceLabel: candidate.sourceId }),
      ...(candidate.observedAt === undefined
        ? {}
        : { publicationDate: candidate.observedAt }),
    }],
    detectedBy: 'fx-conflict-authority-envelope',
    resolution: 'PRESERVED_NOT_ARBITRATED' as const,
    adjudication: { status: 'UNADJUDICATED' as const },
  }));
  return {
    plan: renderPlanFor(renderableRecords).plan,
    rankability: intervalRankabilityFor(renderableRecords),
  };
}
