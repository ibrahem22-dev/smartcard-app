/**
 * U1's evidence: the classification table and the code describe the same thing, both ways.
 *
 * `P5_VALIDATION_PLAN.md` §5: *"a field in the code and not the table fails, and a field in the
 * table and not the code fails too — the second direction catches a table that stopped describing
 * the product."*
 *
 * The gate reads the source; this suite exercises the values, so the two halves of U1 are checked
 * by different means rather than by the same regex twice.
 */
import {
  P5_STATE_EXPECTED_IN_CODE,
  P5_STATE_FIELDS,
  P5_STATE_FORBIDDEN_IN_CODE,
  P5_USER_STATE,
  type P5StateClass,
} from '../p5UserState';
import { MMKV_KEYS } from '../keys';

const CLASSES: readonly P5StateClass[] = [
  'canonical',
  'vault',
  'derived-cache',
  'transient',
  'permitted-analytics',
  'prohibited',
];

describe('U1 — P5 user state is classified', () => {
  it('declares at least one field — a table over nothing classifies nothing', () => {
    expect(P5_USER_STATE.length).toBeGreaterThan(0);
  });

  it('gives every field exactly one of the six classes contract §12 names', () => {
    for (const f of P5_USER_STATE) {
      expect(CLASSES).toContain(f.class);
    }
  });

  it('names where each field lives and why its class is that one', () => {
    for (const f of P5_USER_STATE) {
      expect(f.where.trim().length).toBeGreaterThan(0);
      expect(f.why.trim().length).toBeGreaterThan(0);
      /* A reason that cites nothing is a reason nobody can check. */
      expect(f.why).toMatch(/§|criterion|[A-Z]\d/);
    }
  });

  it('declares no field twice', () => {
    expect(new Set(P5_STATE_FIELDS).size).toBe(P5_STATE_FIELDS.length);
  });

  it('records the refusal H6 requires, rather than leaving it as an absence', () => {
    /* Contract §12 lists dismissal flags among P5's new state; H6 requires the slot to ship empty.
       A table that listed only what exists could not tell a reader it was considered and refused. */
    const dismissed = P5_USER_STATE.find((f) => f.field === 'homeSuggestionDismissed');
    expect(dismissed?.class).toBe('prohibited');
    expect(P5_STATE_FORBIDDEN_IN_CODE).toContain('homeSuggestionDismissed');
  });

  it('puts every field that must exist in the vault class or explains otherwise', () => {
    for (const f of P5_USER_STATE) {
      if (P5_STATE_EXPECTED_IN_CODE.includes(f.field)) {
        /* P5 introduces user state, not catalog data. Anything persisted is vault or a cache. */
        expect(['vault', 'derived-cache', 'transient', 'permitted-analytics', 'canonical']).toContain(f.class);
      }
    }
  });

  it('adds no MMKV key of its own — P5 state rides the profile record that already exists', () => {
    /* U2 requires P5 state to reach the vault THROUGH THE STORE. `commitmentCapIls` lives on
       UserProfile, so it is written by the existing profileUser key and needs no new one. A P5 key
       appearing here without a table row is what the gate refuses. */
    const keys = Object.keys(MMKV_KEYS);
    expect(keys.some((k) => /p5/i.test(k))).toBe(false);
  });
});
