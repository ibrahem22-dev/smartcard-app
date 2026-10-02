import { convertToIls } from '../currency';
import { REASON_TRACE_SCHEMA_VERSION, step, trace } from '../reasonTrace';

/**
 * T1 -- the reason trace travels with the engine output, as an engine output.
 */

describe('the reason-trace schema (T1)', () => {
  it('refuses a step with no rule citation and a trace with no steps', () => {
    expect(() => step('', 'detail')).toThrow(/rule citation/);
    expect(() => step('rule', '  ')).toThrow(/says nothing/);
    expect(() => trace('engine', [])).toThrow(/vacuous/);
  });

  it('a built trace names its schema version and its engine', () => {
    const t = trace('scoring', [step('some rule', 'did a thing', ['input'])]);
    expect(t.schema).toBe(REASON_TRACE_SCHEMA_VERSION);
    expect(t.engine).toBe('scoring');
    expect(t.steps).toHaveLength(1);
  });
});

describe('convertToIls carries its reason trace (T1)', () => {
  const rate = {
    currency: 'JPY',
    quoteUnit: 100,
    rateIlsPerQuoteUnit: 1.8697,
    rateDate: '2026-08-24',
    fetchDate: '2026-08-24',
    source: 'BUNDLED',
    provenance: 'ESTIMATE',
    rateBasis: 'BOI_REPRESENTATIVE',
  } as const;

  it('the conversion output explains itself: divide, reference, markup, in order', () => {
    const r = convertToIls({ amount: 50_000, currency: 'JPY' }, rate, { percent: 2.75 });
    expect(r.trace.schema).toBe(REASON_TRACE_SCHEMA_VERSION);
    expect(r.trace.engine).toBe('currency');
    expect(r.trace.steps.map((s) => s.rule)).toEqual([
      'quoteUnit divide',
      'ADR-013 s2 reference',
      'card FX markup',
    ]);
    // The steps name the inputs that matter, not their bytes.
    expect(r.trace.steps[0]?.inputs).toContain('quoteUnit');
  });

  it('the trace is present even with no markup at all', () => {
    const r = convertToIls({ amount: 10, currency: 'USD' }, { ...rate, currency: 'USD' });
    expect(r.trace.steps.length).toBeGreaterThanOrEqual(2);
  });
});
