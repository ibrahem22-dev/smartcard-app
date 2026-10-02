import { cardCostConflictFrom } from '../cardCostConflict';

function envelope(candidates: readonly Record<string, unknown>[]): string {
  return JSON.stringify({
    kind: 'card-cost-conflict',
    version: 1,
    reason: 'Published sources disagree',
    candidates,
  });
}

const older = {
  value: '111',
  provenance: 'ESTIMATE',
  sourceId: 'older-source',
  observedAt: '2024-02-05T08:00:00Z',
  scope: 'Older scope',
};

const newer = {
  value: '222',
  provenance: 'VERIFIED',
  sourceId: 'newer-source',
  observedAt: '2026-08-27T15:30:00Z',
  scope: 'Newer scope',
};

describe('cardCostConflictFrom', () => {
  it('returns null for a value that is not a conflict envelope', () => {
    expect(cardCostConflictFrom('250')).toBeNull();
  });

  it('builds a ConflictAuthority from a well-formed envelope', () => {
    expect(cardCostConflictFrom(envelope([older, newer]))).toEqual({
      state: 'CONFLICT',
      reason: 'Published sources disagree',
      candidates: [newer, older],
    });
  });

  it('orders candidates newest observed first', () => {
    const tiedFirst = {
      ...older,
      value: 'tie-a',
      sourceId: 'tie-a',
      observedAt: '2025-01-01T00:00:00Z',
    };
    const tiedSecond = {
      ...older,
      value: 'tie-b',
      sourceId: 'tie-b',
      observedAt: '2025-01-01T00:00:00Z',
    };
    const conflict = cardCostConflictFrom(
      envelope([tiedFirst, newer, tiedSecond, older]),
    );

    expect(conflict?.candidates.map((candidate) => candidate.sourceId)).toEqual([
      'newer-source',
      'tie-a',
      'tie-b',
      'older-source',
    ]);
  });

  it('keeps a candidate whose observedAt is missing rather than dropping it', () => {
    const undated = {
      value: '333',
      provenance: 'USER',
      sourceId: 'undated-source',
      scope: 'Undated scope',
    };
    const conflict = cardCostConflictFrom(envelope([undated, newer]));

    expect(conflict?.candidates).toHaveLength(2);
    expect(conflict?.candidates[1]).toEqual(undated);
  });

  it('preserves every candidate, and does not fold or truncate them', () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      value: String(index),
      provenance: 'ESTIMATE',
      sourceId: `source-${String(index)}`,
      observedAt: `2025-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
      scope: `scope-${String(index)}`,
    }));
    const conflict = cardCostConflictFrom(envelope(candidates));

    expect(conflict?.candidates).toHaveLength(candidates.length);
    expect(new Set(conflict?.candidates.map((candidate) => candidate.sourceId))).toEqual(
      new Set(candidates.map((candidate) => candidate.sourceId)),
    );
  });
});
