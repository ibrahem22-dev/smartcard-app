import type { PackConflict } from '@smartcard/data-authority-adapter';

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
