/**
 * A3's evidence, and Gate 4's: *"`ConflictedValue` renders both `conflictRenderPlan` members."*
 *
 * The two members are the shapes a conflict arrives in — one WITH candidates and one WITHOUT. A4
 * names the second by record id (`DISPUTED_WITHOUT_CANDIDATES`) and is explicit about what it must
 * not produce: *"neither spinner, error, nor fallback"*. An empty candidate list is an answer the
 * pipeline gave, not a loading state, and this suite is where that distinction is held.
 *
 * The assertions below are about REFUSALS as much as renderings — no winner, no default selection,
 * no truncation, no ordering. Each is something the component could do that would look like a
 * feature and would be a lie.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { ConflictedValue } from '../ConflictedValue';
import { conflict } from '../../authority/authorityValue';
import type { ConflictCandidate } from '../../authority/authorityValue';

const pct = (v: number): string => `${String(v)}%`;

const candidates: readonly ConflictCandidate<number>[] = [
  { value: 3.5, provenance: 'BUNDLED_DATASET', sourceId: 'issuer-tariff', scope: 'כל הכרטיסים' },
  { value: 2.8, provenance: 'OFFICIAL_AUTHORITY', sourceId: 'boi-filing', scope: 'כרטיסי פרימיום' },
  { value: 3.0, provenance: 'DERIVED_CALCULATION', sourceId: 'statement-sample' },
];

describe('ConflictedValue — A3 / OD-9: one shared component, no winner', () => {
  it('renders EVERY competing reading — no truncation', () => {
    const { queryByTestId } = render(
      <ConflictedValue conflict={conflict(candidates, 'sources disagree')} format={pct} />,
    );

    // Derived from the fixture: a component that dropped the last row would still pass a test that
    // asserted "at least one candidate renders".
    for (let i = 0; i < candidates.length; i += 1) {
      expect(queryByTestId(`conflicted-value-candidate-${String(i)}`)).toBeTruthy();
    }
    expect(queryByTestId(`conflicted-value-candidate-${String(candidates.length)}`)).toBeNull();
  });

  it('preserves input order — sorting would be ranking, and the top row reads as the answer', () => {
    const { toJSON } = render(
      <ConflictedValue conflict={conflict(candidates, 'sources disagree')} format={pct} />,
    );
    const text = JSON.stringify(toJSON());
    const positions = candidates.map((c) => text.indexOf(pct(c.value)));

    expect(positions.every((p) => p >= 0)).toBe(true);
    // Strictly increasing: the order on screen is the order that arrived.
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // And the fixture is NOT already sorted by value, so this assertion can fail.
    expect(candidates.map((c) => c.value)).not.toEqual(
      [...candidates.map((c) => c.value)].sort((a, b) => a - b),
    );
  });

  it('shows each reading with its source AND its scope', () => {
    const { toJSON } = render(
      <ConflictedValue conflict={conflict(candidates, 'sources disagree')} format={pct} />,
    );
    const text = JSON.stringify(toJSON());

    for (const c of candidates) {
      if (c.sourceId !== undefined) expect(text).toContain(c.sourceId);
      if (c.scope !== undefined) expect(text).toContain(c.scope);
    }
  });

  it('names no winner and preselects nothing', () => {
    const { toJSON } = render(
      <ConflictedValue conflict={conflict(candidates, 'sources disagree')} format={pct} />,
    );
    const text = JSON.stringify(toJSON());

    // No row carries a selection or emphasis the others lack: every candidate row has the same
    // className, so no row is visually promoted.
    const classNames = [...text.matchAll(/conflicted-value-candidate-\d+/g)];
    expect(classNames).toHaveLength(candidates.length);
    expect(text).not.toMatch(/selected|recommended|best|winner/i);
  });

  it('is amber, never red — A3 says so and A8 says why', () => {
    const { toJSON } = render(
      <ConflictedValue conflict={conflict(candidates, 'sources disagree')} format={pct} />,
    );
    const text = JSON.stringify(toJSON());

    expect(text).toMatch(/amber/);
    expect(text).not.toMatch(/\bred-\d{2,3}\b/);
  });
});

describe('DISPUTED_WITHOUT_CANDIDATES — the second conflictRenderPlan member (A4)', () => {
  it('renders the sentence and NOTHING further', () => {
    const { queryByTestId, toJSON } = render(
      <ConflictedValue conflict={conflict<number>([], '')} format={pct} />,
    );

    // The banner is there.
    expect(queryByTestId('conflicted-value')).toBeTruthy();
    // The candidate list is not — not empty, ABSENT.
    expect(queryByTestId('conflicted-value-candidates')).toBeNull();
    expect(queryByTestId('conflicted-value-candidate-0')).toBeNull();

    // "neither spinner, error, nor fallback": nothing that reads as loading, failure or a
    // substitute figure.
    const text = JSON.stringify(toJSON());
    expect(text).not.toMatch(/ActivityIndicator|spinner|loading|טוען/i);
    expect(text).not.toMatch(/error|failed|שגיאה/i);
    expect(text).not.toMatch(/\d+(\.\d+)?%/);
  });

  it('does not invent a reason when the pipeline gave none', () => {
    const { toJSON } = render(<ConflictedValue conflict={conflict<number>([], '')} format={pct} />);
    const strings: string[] = [];
    const walk = (n: unknown): void => {
      if (typeof n === 'string') { strings.push(n); return; }
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n && typeof n === 'object' && 'children' in n) walk((n as { children: unknown }).children);
    };
    walk(toJSON());

    // Exactly two strings: the glyph and the sentence. A third would be something invented.
    expect(strings.filter((s) => s.trim() !== '')).toHaveLength(2);
  });
});
