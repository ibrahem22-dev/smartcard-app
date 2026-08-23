/**
 * A2's evidence: **all five states render**, and the mapping refuses where it should.
 *
 * Gate 4 asks for *"all five chip states render"* — four states plus the Stale modifier. This suite
 * mounts each one and asserts what is actually on screen, because "the component exists" is not the
 * claim A2 makes.
 *
 * THE POPULATION IS DERIVED FROM `CHIP_STATES`, never listed here. A fifth state added upstream
 * makes this file fail rather than silently test four of five — the failure mode of every
 * hand-written "test all the cases" suite, and one this campaign has already found twice.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ASSERTIONS ARE LANGUAGE-INDEPENDENT ON PURPOSE.
 *
 * The first version asserted `getByText('מאומת')` and failed: the harness resolves Hebrew sources to
 * English, so it was really asserting which language the test happened to run in. Asserting the
 * translated string instead would have been worse — the test would compute the expected text the
 * same way the component does and prove only that a function is deterministic.
 *
 * So the render tests assert the SHAPE A9 requires — a glyph AND a word, both present, the word not
 * empty and not the glyph — and a separate test checks the translation tables directly. Neither
 * duplicates the component's logic, and together they cover what "icon + word, never colour alone"
 * actually means.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { ProvenanceChip } from '../ProvenanceChip';
import {
  CHIP_LABEL,
  CHIP_STALE_LABEL,
  CHIP_STATES,
  chipStateFor,
} from '../provenanceChipState';
import { PRESENTATION_TONES } from '../../authority/presentation';
import { arBySource } from '../../i18n/ar';
import { enBySource } from '../../i18n/en';

const GLYPHS = /^[✓✎≈?]$/;

/** Every string actually rendered, in order. */
const textsOf = (node: unknown): string[] => {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === 'string') { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n && typeof n === 'object' && 'children' in n) walk((n as { children: unknown }).children);
  };
  walk(node);
  return out;
};

describe('ProvenanceChip — A2: four states plus the Stale modifier, one definition', () => {
  it('has exactly the four states A2 names', () => {
    expect([...CHIP_STATES]).toEqual(['verified', 'user', 'estimate', 'unknown']);
  });

  it.each(CHIP_STATES.map((s) => [s]))('renders the %s state as a glyph AND a word', (state) => {
    const { queryByTestId, toJSON } = render(
      <ProvenanceChip view={{ state, stale: false }} />,
    );

    expect(queryByTestId(`provenance-chip-${state}`)).toBeTruthy();

    const texts = textsOf(toJSON());
    const glyphs = texts.filter((s) => GLYPHS.test(s));
    const words = texts.filter((s) => !GLYPHS.test(s) && s.trim() !== '');

    // A9: icon + word, never colour alone. A chip that lost either half would still "render".
    expect(glyphs).toHaveLength(1);
    expect(words.length).toBeGreaterThan(0);

    // Not stale unless asked.
    expect(queryByTestId('provenance-chip-stale')).toBeNull();
  });

  it('renders the Stale modifier ALONGSIDE a state, never instead of one', () => {
    const { queryByTestId, toJSON } = render(
      <ProvenanceChip view={{ state: 'verified', stale: true }} />,
    );

    expect(queryByTestId('provenance-chip-stale')).toBeTruthy();

    // Both the state's word and the modifier's word are on screen — two distinct words, which is
    // what makes Stale a modifier rather than a fifth state.
    const words = textsOf(toJSON()).filter((s) => !GLYPHS.test(s) && s.trim() !== '');
    expect(new Set(words).size).toBeGreaterThanOrEqual(2);
  });

  it('renders NOTHING for a conflict — a badge would pick a winner', () => {
    const { toJSON } = render(<ProvenanceChip view={chipStateFor('DISPUTED')} />);
    expect(toJSON()).toBeNull();
  });
});

describe('the chip’s words exist in every language the app ships', () => {
  const sources = [...Object.values(CHIP_LABEL), CHIP_STALE_LABEL];

  it.each(sources.map((s) => [s]))('“%s” has an Arabic and an English rendering', (source) => {
    expect(arBySource[source]).toBeTruthy();
    expect(enBySource[source]).toBeTruthy();
    // A translation identical to its Hebrew source is a missing translation wearing a costume.
    expect(arBySource[source]).not.toBe(source);
    expect(enBySource[source]).not.toBe(source);
  });

  it('gives every state a DISTINCT word — two states sharing one is not four states', () => {
    for (const table of [CHIP_LABEL, arBySource, enBySource]) {
      const words = Object.values(CHIP_LABEL).map((he) =>
        table === CHIP_LABEL ? he : (table as Record<string, string>)[he]);
      expect(new Set(words).size).toBe(CHIP_STATES.length);
    }
  });
});

describe('chipStateFor — the mapping, without rendering anything', () => {
  it('answers for every presentation tone the authority layer defines', () => {
    // Derived from PRESENTATION_TONES: a tone added upstream that nobody mapped shows up here as
    // undefined rather than as a chip somebody guessed at.
    for (const tone of PRESENTATION_TONES) {
      const view = chipStateFor(tone);
      expect(view === null || CHIP_STATES.includes(view.state)).toBe(true);
    }
  });

  it('distinguishes the user’s own figure from the app’s estimate', () => {
    expect(chipStateFor('UNVERIFIED_INPUT', 'USER_INPUT')?.state).toBe('user');
    expect(chipStateFor('UNVERIFIED_INPUT', 'BUNDLED_DATASET')?.state).toBe('estimate');
    expect(chipStateFor('UNVERIFIED_INPUT', 'DERIVED_CALCULATION')?.state).toBe('estimate');
  });

  it('marks a historical value stale WITHOUT demoting it to unknown', () => {
    expect(chipStateFor('STALE')).toEqual({ state: 'verified', stale: true });
  });

  it('never lets a provenance override a verified or an unavailable', () => {
    expect(chipStateFor('VERIFIED', 'USER_INPUT')?.state).toBe('verified');
    expect(chipStateFor('UNAVAILABLE', 'OFFICIAL_AUTHORITY')?.state).toBe('unknown');
  });
});
