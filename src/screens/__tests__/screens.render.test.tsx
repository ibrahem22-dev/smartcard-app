/**
 * THE RENDERING SUITE — criterion E2.
 *
 * *"Screens render in tests. The harness is extended past `testEnvironment: node` /
 * `testMatch: *.test.ts`; a rendering suite exists and runs."*
 *
 * THE POPULATION IS DERIVED FROM DISK. Every `.tsx` under `src/screens/` is a screen and every one
 * is attempted. A hand-written list of "the screens we render" is the defect this campaign has
 * found four separate times: it is complete on the day it is written and silently wrong on the day
 * someone adds the next file.
 *
 * EVERY OUTCOME IS RECORDED, INCLUDING THE FAILURES. A screen that cannot mount standalone is not
 * skipped and not hidden — it is written to the report with the error that stopped it. The count in
 * E2's sentinel is the number that GENUINELY MOUNTED, stated against the size of the population, so
 * "N screens render" can never be read as "all screens render".
 *
 * NOTHING HERE MOCKS APPLICATION CODE. The setup file mocks native modules only. A screen whose own
 * logic has to be stubbed out to render has not been shown to render, and this suite would then be
 * measuring the stubs.
 */
import React from 'react';
import { readdirSync, writeFileSync, mkdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { renderScreen } from '../../../tools/p2/jest/renderScreen';

const SCREENS_DIR = join(__dirname, '..');
const REPORT_DIR = join(__dirname, '..', '..', '..', 'reports', 'p2');

/** Walk src/screens for every .tsx that is not itself a test. */
const collectScreens = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__') continue;
      collectScreens(p, acc);
    } else if (entry.endsWith('.tsx') && !entry.includes('.test.')) {
      acc.push(p);
    }
  }
  return acc;
};

const screenFiles = collectScreens(SCREENS_DIR).sort();

/**
 * THE ONE THING A DERIVED POPULATION CANNOT DECIDE FOR ITSELF.
 *
 * A screen that reads `route.params.verdict` cannot render without a verdict, and a verdict is an
 * ENGINE OUTPUT — P2 renders facts and refusals rather than computing judgements (contract §1). The
 * harness manufacturing one would be inventing precisely the thing P2 is forbidden to derive.
 *
 * So such a screen is REPORTED, with the input it needs, the reason, and the criterion that will
 * clear it. It is never skipped and never hidden, the register is printed on every gate run, and an
 * entry is cleared by committing a real fixture rather than by deleting the line.
 *
 * Everything NOT in this register that fails to render is a FAILURE.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const REGISTER = require('./render-fixtures.json') as {
  requiresFixture: readonly { screen: string; needs: string; why: string; clearedBy: string }[];
};
const requiresFixture = new Map(REGISTER.requiresFixture.map((e) => [e.screen, e]));

/**
 * A screen's declared render fixture, if it has one.
 *
 * Derived from the filename — `DecisionScreen.tsx` looks for
 * `__tests__/fixtures/DecisionScreen.params.json` — so a fixture is picked up by existing, not by
 * being added to a list here. `default` is what the screen is rendered with.
 */
const fixtureFor = (screenFile: string): Record<string, unknown> | null => {
  const name = screenFile.split(/[\\/]/).pop()!.replace(/\.tsx$/, '');
  const p = join(__dirname, 'fixtures', name + '.params.json');
  if (!existsSync(p)) return null;
  const parsed = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  return (parsed['default'] as Record<string, unknown>) ?? null;
};

type Outcome = {
  screen: string; export: string | null; rendered: boolean; error: string | null;
  requiresFixture: boolean; needs?: string; clearedBy?: string;
};
const outcomes: Outcome[] = [];

describe('every screen on disk', () => {
  it('has at least one screen to attempt — a suite over zero screens is not a suite', () => {
    expect(screenFiles.length).toBeGreaterThan(0);
  });

  for (const file of screenFiles) {
    const rel = relative(join(__dirname, '..', '..', '..'), file).replace(/\\/g, '/');
    it('mounts: ' + rel, () => {
      let exportName: string | null = null;
      let error: string | null = null;
      let rendered = false;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const mod = require(file) as Record<string, unknown>;
        const candidates = Object.keys(mod).filter((k) => typeof mod[k] === 'function');
        // Prefer the default export, then a component-shaped named export.
        exportName = candidates.includes('default')
          ? 'default'
          : candidates.find((k) => /^[A-Z]/.test(k)) ?? null;
        if (!exportName) throw new Error('no component export found (exports: ' + Object.keys(mod).join(', ') + ')');
        const Component = mod[exportName] as React.ComponentType<Record<string, unknown>>;
        // Rendered inside the providers App.tsx supplies — not stubbed. A component calling
        // useAuth() outside AuthProvider throws BY DESIGN, and that throw is the provider working,
        // not the screen failing.
        const fixture = fixtureFor(file);
        const tree = renderScreen(Component, fixture ?? {});
        // toJSON() being non-null is the proof a tree was actually produced; a component that
        // returns null renders "successfully" and shows nothing, which is not what E2 is asking.
        rendered = tree.toJSON() !== null;
        if (!rendered) error = 'mounted but produced an empty tree (returned null)';
        tree.unmount();
      } catch (e) {
        error = e instanceof Error ? (e.message.split('\n')[0] ?? e.message) : String(e);
      }
      const registered = requiresFixture.get(rel);
      outcomes.push({
        screen: rel,
        export: exportName,
        rendered,
        error,
        requiresFixture: Boolean(registered) && !rendered,
        ...(registered ? { needs: registered.needs, clearedBy: registered.clearedBy } : {}),
        ...(fixtureFor(file) ? { fixture: 'declared' } : {}),
      });
      /**
       * THE ASSERTION HAS TO BE THE CLAIM. The first version of this line asserted only that
       * `typeof rendered === 'boolean'` — a tautology, written so that one broken screen would not
       * hide the others. The suite then printed "22 passed" while NINETEEN OF TWENTY-ONE SCREENS
       * HAD FAILED TO RENDER. A tautology is not an assertion, and a green suite over a broken
       * harness is the exact defect E2 exists to end.
       *
       * Every screen now asserts that it rendered. The report still records every outcome, so the
       * full picture survives even when the suite is red — which is how one broken screen is kept
       * from hiding the state of the rest, without the suite lying about it.
       */
      if (registered && !rendered) {
        // Reported, not asserted away. The gate prints this entry every run and the count of
        // screens that render is stated against the size of the population, so a registered screen
        // can never be mistaken for one that works.
        expect(registered.clearedBy).toBeTruthy();
        return;
      }
      if (registered && rendered) {
        throw new Error(
          rel + ' renders without a fixture, but render-fixtures.json still says it needs '
          + registered.needs + '. Remove the entry: a register that keeps a screen it no longer '
          + 'describes is how a stale exemption survives.',
        );
      }
      if (error) throw new Error(rel + ' did not render: ' + error);
      expect(rendered).toBe(true);
    });
  }

  afterAll(() => {
    const passed = outcomes.filter((o) => o.rendered);
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(
      join(REPORT_DIR, 'render-harness.json'),
      JSON.stringify(
        {
          $comment:
            'Written by src/screens/__tests__/screens.render.test.tsx. The population is derived '
            + 'from disk; every screen attempted is listed with its outcome, including the ones '
            + 'that could not mount. `rendered` counts screens that produced a non-empty tree.',
          generatedAt: new Date().toISOString(),
          population: outcomes.length,
          rendered: passed.length,
          requiresFixture: outcomes.filter((o) => o.requiresFixture).length,
          failed: outcomes.filter((o) => !o.rendered && !o.requiresFixture).length,
          outcomes: outcomes.sort((a, b) => a.screen.localeCompare(b.screen)),
        },
        null,
        2,
      ) + '\n',
    );
    // eslint-disable-next-line no-console
    const needing = outcomes.filter((o) => o.requiresFixture);
    console.log('RENDER-HARNESS — ' + passed.length + ' of ' + outcomes.length + ' screens rendered'
      + (needing.length ? ' · ' + needing.length + ' await a fixture: '
        + needing.map((o) => o.screen.replace('src/screens/', '') + ' (' + o.clearedBy + ')').join(', ') : ''));
  });
});
