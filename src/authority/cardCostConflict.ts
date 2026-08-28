/**
 * Card-cost conflict envelopes belong here because A3 and OD-9 permit candidate construction and
 * folding in the authority layer and nowhere else. P5's N9 ordering is recency, not plausibility
 * ranking, so applying it while constructing the conflict is honest when the UI says newest
 * sources are shown first.
 */
import {
  conflict,
  type ConflictAuthority,
  type ConflictCandidate,
} from './authorityValue';
import {
  PROVENANCE_CHIPS,
  type ProvenanceChip,
} from './provenanceChip';
import type { ConflictRenderPlan } from '../data/adapter/conflictRenderPlan';

interface CardCostConflictEnvelope {
  readonly kind: 'card-cost-conflict';
  readonly version: 1;
  readonly reason: string;
  readonly candidates: readonly ConflictCandidate<string>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProvenanceChip(value: unknown): value is ProvenanceChip {
  return (
    typeof value === 'string' &&
    PROVENANCE_CHIPS.some((chip) => chip === value)
  );
}

function candidateFrom(value: unknown): ConflictCandidate<string> | null {
  if (
    !isRecord(value) ||
    typeof value.value !== 'string' ||
    !isProvenanceChip(value.provenance) ||
    (value.sourceId !== undefined && typeof value.sourceId !== 'string') ||
    (value.observedAt !== undefined && typeof value.observedAt !== 'string') ||
    (value.scope !== undefined && typeof value.scope !== 'string')
  ) {
    return null;
  }

  return {
    value: value.value,
    provenance: value.provenance,
    sourceId: value.sourceId,
    observedAt: value.observedAt,
    scope: value.scope,
  };
}

function conflictEnvelopeFrom(raw: string): CardCostConflictEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isRecord(parsed) ||
    parsed.kind !== 'card-cost-conflict' ||
    parsed.version !== 1 ||
    typeof parsed.reason !== 'string' ||
    !Array.isArray(parsed.candidates)
  ) {
    return null;
  }

  const candidates = parsed.candidates.map(candidateFrom);
  if (candidates.length <= 1 || candidates.some((candidate) => candidate === null)) {
    return null;
  }
  return {
    kind: 'card-cost-conflict',
    version: 1,
    reason: parsed.reason,
    candidates: candidates as readonly ConflictCandidate<string>[],
  };
}

function observedAtMillis(candidate: ConflictCandidate<string>): number {
  if (candidate.observedAt === undefined) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(candidate.observedAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function newestFirst(
  candidates: readonly ConflictCandidate<string>[],
): readonly ConflictCandidate<string>[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const byDate =
        observedAtMillis(right.candidate) - observedAtMillis(left.candidate);
      return byDate === 0 ? left.index - right.index : byDate;
    })
    .map(({ candidate }) => candidate);
}

/** Parse a stored card-cost envelope into the authority model without selecting a winner. */
export function cardCostConflictFrom(
  raw: string,
): ConflictAuthority<string> | null {
  const envelope = conflictEnvelopeFrom(raw);
  if (envelope === null) return null;
  return conflict(newestFirst(envelope.candidates), envelope.reason);
}

/** The adapter owns the render decision; Section A only passes its returned plan through. */
export function renderPlanForCardCostConflict(
  value: ConflictAuthority<string>,
): ConflictRenderPlan {
  // Lazy because ordinary Section A rows do not need the Node-targeted adapter runtime in render.
  // ConflictedValue likewise imports only the plan's erased type; the conflict path still asks the
  // adapter itself for the decision at the moment that decision is required.
  const { renderPlanFor } = require('../data/adapter/conflictRender') as typeof import('../data/adapter/conflictRender');
  // One valid envelope is one INLINE conflict record. renderPlanFor reads record availability here;
  // this complete authority conflict proves that record exists without manufacturing extra rivals.
  const inlineRecord = {
    conflictId: 'card-cost-conflict-envelope',
    shape: 'INLINE' as const,
    scope: 'card-cost',
    participants: value.candidates.map((candidate, index) => ({
      recordId: candidate.sourceId ?? `candidate:${String(index)}`,
      field: 'value',
      ...(candidate.sourceId === undefined
        ? {}
        : { sourceLabel: candidate.sourceId }),
      ...(candidate.observedAt === undefined
        ? {}
        : { publicationDate: candidate.observedAt }),
    })),
    detectedBy: 'card-cost-conflict-envelope',
    resolution: 'PRESERVED_NOT_ARBITRATED' as const,
    adjudication: { status: 'UNADJUDICATED' as const },
  };
  return renderPlanFor([inlineRecord]).plan;
}
