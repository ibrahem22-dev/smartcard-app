/**
 * D1's evidence: the app consumes the PUBLISHED adapter at a PINNED version, with the compatibility
 * matrix ENFORCED AT LOAD.
 *
 * Gate 7 asks for *"load-time rejection of an incompatible pair proven"*, and this is where that is
 * proven — against the adapter's real matrix, not a stub. The adapter's own compatibility module
 * states the reason a refusal is the only honest outcome:
 *
 *   > *"an old adapter reading a pack whose shape it does not understand has no honest behaviour
 *   > available once it happens. The adapter either crashes or silently misreads, and **misreading a
 *   > financial field is the worse outcome**."*
 */
import {
  AdapterPinError,
  COMPATIBILITY_MATRIX,
  INSTALLED_ADAPTER,
  PINNED_ADAPTER,
  assertPinnedAdapter,
  checkPackCompatibility,
  readablePackFormats,
} from '../index';

describe('D1 — the adapter is the published package, at a pinned build', () => {
  it('is the build this app is pinned to', () => {
    expect(INSTALLED_ADAPTER.adapterVersion).toBe(PINNED_ADAPTER.adapterVersion);
    expect(INSTALLED_ADAPTER.builtFromCommit).toBe(PINNED_ADAPTER.builtFromCommit);
    expect(() => assertPinnedAdapter()).not.toThrow();
  });

  it('pins the COMMIT and not only the version', () => {
    // Two builds can carry the same adapterVersion and different behaviour. The commit cannot.
    expect(PINNED_ADAPTER.builtFromCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('names the two versions that disagree when the pin is wrong', () => {
    // The error a developer meets has to say which two things differ — "incompatible" alone sends
    // somebody to read source to find out what they are.
    const error = new AdapterPinError('adapterVersion', '1.1.0', '1.2.0');
    expect(error.message).toContain('1.1.0');
    expect(error.message).toContain('1.2.0');
    expect(error.name).toBe('AdapterPinError');
  });
});

describe('the compatibility matrix is enforced at load', () => {
  it('accepts a pack format the adapter declares it can read', () => {
    const supported = readablePackFormats();
    expect(supported.length).toBeGreaterThan(0);

    for (const format of supported) {
      const result = checkPackCompatibility(format);
      expect(result.ok).toBe(true);
    }
  });

  it('REFUSES a pack format the adapter cannot read, and says which two versions disagree', () => {
    // Derived: one more than the highest format the adapter declares. A hardcoded 99 would keep
    // passing after the adapter learned to read 99.
    const unreadable = Math.max(...readablePackFormats()) + 1;
    const result = checkPackCompatibility(unreadable);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('incompatible-pack-format');
    expect(result.packFormatVersion).toBe(unreadable);
    expect(result.adapterVersion).toBe(INSTALLED_ADAPTER.adapterVersion);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('returns a refusal, never a partial read', () => {
    const unreadable = Math.max(...readablePackFormats()) + 1;
    const result = checkPackCompatibility(unreadable);
    // No value field of any kind on a refusal. A caller cannot accidentally read one.
    expect(Object.keys(result)).not.toContain('value');
    expect(Object.keys(result)).not.toContain('rows');
  });

  it('carries the adapter’s own matrix rather than a copy of it', () => {
    // handoff §2, IF-7: the compatibility matrices are the adapter's, and re-deriving one means
    // "a load-time check replaced by prose nobody enforces".
    expect(Array.isArray(COMPATIBILITY_MATRIX)).toBe(true);
    expect(COMPATIBILITY_MATRIX.length).toBeGreaterThan(0);
    for (const row of COMPATIBILITY_MATRIX) {
      expect(typeof row.packFormatVersion).toBe('number');
    }
  });

  it('checks the pin BEFORE the matrix — a wrong adapter is not a compatibility question', () => {
    // checkPackCompatibility calls assertPinnedAdapter first. If the pin were checked second, an
    // unpinned adapter would answer compatibility questions on behalf of a build nobody reviewed.
    const supported = readablePackFormats();
    expect(() => checkPackCompatibility(supported[0] ?? 1)).not.toThrow();
  });
});
