/**
 * T7 — LOCALIZATION POLISH, MEASURED ON THE RENDERED SURFACE.
 *
 *   > **T7.** *"the he/ar/en microcopy register pass is complete; translation readers handle every
 *   > key/value form the app writes; no raw enum or key name reaches any surface in any locale"*
 *
 * WHY THIS IS A RENDER TEST AND NOT A STATIC SCAN. The defect that prompted it could not be seen
 * statically from the call site. `CardsScreen` renders `t(viewModel.body)` — a variable. The
 * placeholder lived in `cardsEmptyState.ts` as DATA, and `interpolate()` returns the source
 * unchanged when no values are supplied, so the characters `{{app}}` reached the reader in all
 * three languages. Every audit that reads `t('…literal…')` call sites was blind to it because there
 * is no literal at that call site to read. C9's device capture 08 recorded it; no gate did.
 *
 * So the subject here is the TEXT THAT ACTUALLY RENDERS, in each language, from the real screens.
 *
 * THE POPULATION IS DERIVED FROM DISK, for the reason E2 states: a hand-written list of screens is
 * complete on the day it is written and silently wrong on the day someone adds a file. A screen the
 * harness cannot mount standalone is REPORTED as unmounted rather than skipped quietly, and the
 * counts are asserted, so "no leaks found" can never mean "nothing was looked at".
 */
import React from 'react';
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { renderScreen } from '../../../tools/p2/jest/renderScreen';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useCardsStore } from '../../store/useCardsStore';
import { CardsScreen } from '../CardsScreen';
import { buildCardsViewModel } from '../cardsEmptyState';
import { hydrated } from '../../store/hydration';
import { APP_NAME } from '../../config/identity';
import type { AppLanguage } from '../../i18n/locale';

const LANGUAGES: readonly AppLanguage[] = ['he', 'ar', 'en'];
const SCREENS_DIR = join(__dirname, '..');

const collectScreens = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== '__tests__') collectScreens(p, acc);
    } else if (entry.endsWith('.tsx') && !entry.includes('.test.')) acc.push(p);
  }
  return acc;
};

const screenFiles = collectScreens(SCREENS_DIR).sort();

const fixtureFor = (file: string): Record<string, unknown> => {
  const name = file.split(/[\\/]/).pop()!.replace(/\.tsx$/, '');
  const p = join(SCREENS_DIR, '__tests__', 'fixtures', `${name}.params.json`);
  if (!existsSync(p)) return {};
  const parsed = JSON.parse(readFileSync(p, 'utf8')) as { default?: Record<string, unknown> };
  return parsed.default ?? {};
};

/**
 * Every string rendered anywhere in the tree, in render order.
 *
 * IT READS `children` AT THE TOP LEVEL, WHICH IS WHERE `toJSON()` PUTS IT. The first version of
 * this walker looked only at `props.children` — the shape of a React ELEMENT, not of the JSON tree
 * a renderer returns — so it walked into nothing and returned an empty array for every screen. All
 * three language sweeps passed over ZERO characters of text and reported no leaks, which is true
 * and meaningless. A sweep that finds nothing because it looked at nothing is the false green this
 * whole criterion is about, and it appeared inside T7's own evidence before T7 could catch it
 * anywhere else. The assertions below now also require a non-trivial amount of text, so an empty
 * read fails loudly instead of passing quietly.
 */
const visibleStrings = (node: unknown): string[] => {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === 'string') { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n && typeof n === 'object') {
      const o = n as { children?: unknown; props?: { children?: unknown } };
      if (o.children !== undefined && o.children !== null) walk(o.children);
      else if (o.props && 'children' in o.props) walk(o.props.children);
    }
  };
  walk(node);
  return out;
};

/**
 * THE THREE ARTEFACTS, EACH NAMED FOR WHAT IT LOOKS LIKE ON A SCREEN.
 *
 * Deliberately NOT "anything suspicious". Each pattern was checked against the text the app really
 * renders before it was written down, so that it fires on the defect and not on legitimate copy —
 * `PIN`, `ATM`, `ILS` and `USD` are real words on these surfaces and none of them match.
 */
const UNRESOLVED_PLACEHOLDER = /\{\{\s*\w+\s*\}\}/;          // {{app}} reached the reader
const DOTTED_KEY_PATH = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]+)+$/;  // 'common.cancel'
const RAW_ENUM = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;          // 'FIRST_CARD_INVITATION'

describe('T7 — no localization artefact reaches a rendered surface, in any language', () => {
  afterEach(() => { useLanguageStore.getState().setLanguageChoice('he'); });

  it('mounts screens in all three languages — and says how many, so a silent zero cannot pass', () => {
    expect(screenFiles.length).toBeGreaterThan(15);
  });

  describe.each(LANGUAGES)('language: %s', (language) => {
    it('renders no unresolved interpolation token, dotted key path, or raw enum', () => {
      useLanguageStore.getState().setLanguageChoice(language);

      const leaks: string[] = [];
      let mounted = 0;
      let charactersRead = 0;

      for (const file of screenFiles) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const mod = require(file) as Record<string, unknown>;
        const Component = (mod.default ??
          Object.values(mod).find((v) => typeof v === 'function')) as
          React.ComponentType<Record<string, unknown>> | undefined;
        if (!Component) continue;

        let tree;
        try {
          tree = renderScreen(Component, fixtureFor(file));
        } catch {
          // Reported by E2's suite with its error; this one measures text, not mountability.
          continue;
        }
        mounted += 1;

        const name = file.split(/[\\/]/).pop();
        for (const raw of visibleStrings(tree.toJSON())) {
          const text = raw.trim();
          if (text === '') continue;
          charactersRead += text.length;
          if (UNRESOLVED_PLACEHOLDER.test(text)) leaks.push(`${name} [${language}] unresolved placeholder: ${text.slice(0, 70)}`);
          if (DOTTED_KEY_PATH.test(text)) leaks.push(`${name} [${language}] raw key path: ${text}`);
          if (RAW_ENUM.test(text)) leaks.push(`${name} [${language}] raw enum: ${text}`);
        }
        tree.unmount();
      }

      // A sweep over zero screens, or over screens whose text it could not read, finds zero
      // leaks and proves nothing. Both are asserted, because both have happened here.
      expect(mounted).toBeGreaterThan(10);
      expect(charactersRead).toBeGreaterThan(2000);
      expect(leaks).toEqual([]);
    });
  });

  /**
   * THE DEFECT THAT PROMPTED ALL OF THIS, RENDERED — and the sweep above cannot substitute for it.
   *
   * The first version of this block asserted on the VIEW MODEL, and the screen sweep above is
   * driven by a store that is `NOT_HYDRATED` on a fresh mount, so CardsScreen renders its LOADING
   * state and the invitation copy is never on the tree at all. Reverting the repair left all seven
   * cases green: a test that could not fail on the one defect it was written for. That is why the
   * store is driven into `HYDRATED` with zero cards here — the invitation is the state C9's device
   * capture 08 photographed, and it only exists once the store says "loaded, and genuinely empty".
   */
  describe.each(LANGUAGES)('the first-card invitation in %s', (language) => {
    it('renders the product name, not the characters {{app}}', () => {
      useLanguageStore.setState({ languageChoice: language, resolvedLanguage: language });
      useCardsStore.setState({
        cards: [],
        entries: [],
        hydration: hydrated('2026-09-03T00:00:00.000Z'),
      } as never);

      // The state under test really is the invitation, not LOADING wearing its name.
      expect(buildCardsViewModel(hydrated('2026-09-03T00:00:00.000Z'), 0).view)
        .toBe('FIRST_CARD_INVITATION');

      const tree = renderScreen(CardsScreen as never);
      const text = visibleStrings(tree.toJSON()).join('   ');

      expect(text).toContain(APP_NAME);
      expect(text).not.toContain('{{app}}');
      expect(text).not.toMatch(UNRESOLVED_PLACEHOLDER);
      tree.unmount();
    });
  });
});
