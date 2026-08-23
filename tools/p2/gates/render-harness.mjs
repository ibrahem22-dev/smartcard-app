/**
 * GATE: render-harness — criterion E2.
 *
 * *"Screens render in tests. The harness is extended past `testEnvironment: node` /
 * `testMatch: *.test.ts`; a rendering suite exists and runs."*  →  `RENDER-HARNESS OK — N screens render`
 *
 * THE GATE RUNS THE SUITE ITSELF AND THEN READS WHAT THE SUITE MEASURED. It does not trust a
 * committed report file: a report the gate did not cause is a report of some earlier tree, and
 * "generated output never validates itself" is one of this campaign's standing rules. The run is
 * fresh, and the file it reads was written by that run.
 *
 * IT ALSO CHECKS THE CONFIGURATION E2 IS ABOUT. The criterion is not "some test renders something";
 * it is that the harness was extended past `testEnvironment: node` and `testMatch: *.test.ts`. Both
 * of those made rendering IMPOSSIBLE, not merely absent, so the gate asserts they are gone. A suite
 * that happened to render one component under a config that still said `node` would be a
 * coincidence, not a harness.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['E2'];
export const SENTINEL = 'RENDER-HARNESS OK — N screens render';

export const run = async ({ root }) => {
  const lines = [];
  const problems = [];

  // --- 1. the configuration E2 names -------------------------------------------------
  const cfgPath = join(root, 'jest.config.cjs');
  if (!existsSync(cfgPath)) return fail('no jest.config.cjs');
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const cfg = (await import('file://' + cfgPath.replace(/\\/g, '/'))).default;
  const projects = cfg.projects ?? [cfg];
  const renderProjects = projects.filter((p) => Array.isArray(p.testMatch)
    && p.testMatch.some((m) => /tsx/.test(m)));
  if (renderProjects.length === 0) {
    problems.push('no jest project matches a .tsx test file — `testMatch: *.test.ts` made rendering impossible and it is still impossible');
  }
  for (const p of renderProjects) {
    if (p.testEnvironment === 'node') {
      problems.push('project "' + (p.displayName ?? '?') + '" matches .tsx but still runs testEnvironment: node, which cannot host a renderer');
    }
  }
  lines.push('jest projects   ' + projects.map((p) => (p.displayName ?? 'default') + '[' + (p.testEnvironment ?? p.preset ?? '?') + ']').join(' · '));

  // --- 2. run the suite --------------------------------------------------------------
  const reportPath = join(root, 'reports', 'p2', 'render-harness.json');
  const before = existsSync(reportPath) ? statSync(reportPath).mtimeMs : 0;

  const r = spawnSync('npx', ['jest', '--selectProjects', 'render', '--silent'], {
    cwd: root, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  const suitePassed = /Tests:\s+\d+ passed/.test(out) && !/Tests:.*failed/.test(out);
  lines.push('suite           ' + ((out.match(/Tests:\s+.*$/m) ?? [])[0] ?? '(no jest summary printed)').trim());
  if (!suitePassed) problems.push('the render suite did not pass');

  // --- 3. read what THIS run measured ------------------------------------------------
  if (!existsSync(reportPath)) return fail('the render suite wrote no report at reports/p2/render-harness.json', lines.join('\n'));
  const after = statSync(reportPath).mtimeMs;
  if (after <= before) {
    problems.push('reports/p2/render-harness.json was not rewritten by this run — it describes an earlier tree, and a report the gate did not cause is not evidence about the tree the gate is checking');
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const { population, rendered, failed } = report;
  const awaiting = report.requiresFixture ?? 0;

  lines.push('population      ' + population + ' screens, derived from src/screens/**/*.tsx');
  lines.push('rendered        ' + rendered);
  lines.push('awaiting fixture ' + awaiting);
  lines.push('failed          ' + failed);

  // --- 4. the rules the contract cares about -----------------------------------------
  if (!population || population === 0) problems.push('the population is zero — a rendering suite over no screens is a vacuous pass');
  if (!rendered || rendered === 0) problems.push('zero screens rendered — the harness exists but nothing mounts, which is the state E2 was written to end');
  if (failed > 0) problems.push(failed + ' screen(s) failed to render and are not in the fixture register');

  for (const o of (report.outcomes ?? []).filter((x) => x.requiresFixture)) {
    lines.push('  awaits a fixture: ' + o.screen + ' — needs ' + o.needs + ' — cleared by ' + o.clearedBy);
  }

  if (problems.length) return fail(problems.join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    // The sentinel carries the real number, and the population beside it, so "N screens render"
    // can never be read as "all screens render".
    sentinelOverride: 'RENDER-HARNESS OK — ' + rendered + ' screens render'
      + (awaiting ? ' (of ' + population + '; ' + awaiting + ' awaiting a declared fixture)' : ' (of ' + population + ')'),
  };
};
