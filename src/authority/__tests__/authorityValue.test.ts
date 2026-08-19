import {
  AuthorityUnavailableError,
  blocked,
  conflict,
  currentAuthorityOrNull,
  foldAuthority,
  historical,
  isCurrentAuthority,
  isUnavailable,
  known,
  requireCurrentAuthority,
  unknown,
} from '../authorityValue';

describe('W1-AS-02 five-state authority values', () => {
  it('carries no value at all when unavailable', () => {
    // Structural, not conventional: there is no `value` key to read as 0.
    expect('value' in unknown('no_source')).toBe(false);
    expect('value' in blocked('integration_off')).toBe(false);
    expect('value' in conflict([], 'sources_disagree')).toBe(false);
  });

  it('treats only authority-grade KNOWN as current authority', () => {
    expect(isCurrentAuthority(known(2.8, 'OFFICIAL_AUTHORITY', '2026-01-01'))).toBe(true);
    expect(isCurrentAuthority(known(2.8, 'BUNDLED_DATASET', '2026-01-01'))).toBe(false);
    expect(isCurrentAuthority(known(2.8, 'USER_INPUT', '2026-01-01'))).toBe(false);
    expect(isCurrentAuthority(known(2.8, 'DERIVED_CALCULATION', '2026-01-01'))).toBe(false);
  });

  it('never lets a HISTORICAL value pass as current authority', () => {
    const stale = historical(1.5, 'OFFICIAL_AUTHORITY', '2019-01-01', '2020-01-01');
    // It HAS a value -- that is exactly why it is dangerous.
    expect(stale.value).toBe(1.5);
    expect(isCurrentAuthority(stale)).toBe(false);
    expect(currentAuthorityOrNull(stale)).toBeNull();
  });

  it('preserves every candidate in a conflict without picking a winner', () => {
    const disputed = conflict(
      [
        { value: 2.8, provenance: 'OFFICIAL_AUTHORITY', sourceId: 'a' },
        { value: 3.0, provenance: 'OFFICIAL_AUTHORITY', sourceId: 'b' },
      ],
      'two_tariffs',
    );
    expect(disputed.candidates).toHaveLength(2);
    expect(currentAuthorityOrNull(disputed)).toBeNull();
    expect(isUnavailable(disputed)).toBe(true);
  });

  it('throws rather than substituting a value', () => {
    expect(() => requireCurrentAuthority(unknown('no_source'))).toThrow(
      AuthorityUnavailableError,
    );
    expect(() => requireCurrentAuthority(blocked('off'))).toThrow(/BLOCKED/);
    expect(requireCurrentAuthority(known(7, 'OFFICIAL_AUTHORITY', '2026-01-01'))).toBe(7);
  });

  it('folds every state exhaustively', () => {
    const states = [
      known(1, 'OFFICIAL_AUTHORITY', '2026-01-01'),
      unknown('r'),
      blocked('r'),
      conflict<number>([], 'r'),
      historical(1, 'OFFICIAL_AUTHORITY', '2026-01-01'),
    ];
    const seen = states.map((value) =>
      foldAuthority<number, string>(value, {
        onKnown: () => 'KNOWN',
        onUnknown: () => 'UNKNOWN',
        onBlocked: () => 'BLOCKED',
        onConflict: () => 'CONFLICT',
        onHistorical: () => 'HISTORICAL',
      }),
    );
    expect(seen).toEqual([
      'KNOWN',
      'UNKNOWN',
      'BLOCKED',
      'CONFLICT',
      'HISTORICAL',
    ]);
  });
});
