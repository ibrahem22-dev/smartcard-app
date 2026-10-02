/**
 * GATE: fx-compare-single — criterion X1.  →  `FX-COMPARE-SINGLE OK`
 *
 * Negative control: add a second implementation for one entry point and watch
 * this gate fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['X1'];
export const SENTINEL = 'FX-COMPARE-SINGLE OK';
export const MEASURES = 'render';

const CANONICAL = 'src/screens/fx/FxCompareSheet.tsx';
const FROM_VERDICT = 'src/screens/fx/FxCompareFromCheckVerdict.tsx';
const FROM_DNA = 'src/screens/fx/FxCompareFromCardDna.tsx';
const VERDICT = 'src/screens/check/CheckVerdictScreen.tsx';
const WALLET = 'src/navigation/stacks/WalletStack.tsx';
const SUITE = 'src/screens/fx/__tests__/fxCompare.single.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'both entry points are the canonical FxCompareSheet function',
  'Check Verdict mounts the Check-Verdict entry when a comparison is supplied',
  'omitting fxComparison does not mount the sheet on Check Verdict',
  'the Card DNA entry paints the same sheet for the same comparison',
];

const reexport = (src) =>
  /export\s*\{\s*FxCompareSheet\s+as\s+FxCompareFrom/.test(src)
  && /from\s+['"]\.\/FxCompareSheet['"]/.test(src)
  && !/function\s+FxCompareFrom/.test(src)
  && !/return\s*\(/.test(src);

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === 'render');
  if (!render) return { error: JEST_CONFIG + ' has no "render" project' };
  return { config: { ...render, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  for (const rel of [CANONICAL, FROM_VERDICT, FROM_DNA, VERDICT, WALLET, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist');
  }
  const fromVerdict = readFileSync(join(root, FROM_VERDICT), 'utf8');
  const fromDna = readFileSync(join(root, FROM_DNA), 'utf8');
  if (!reexport(fromVerdict)) {
    return fail(FROM_VERDICT + ' is not a re-export of FxCompareSheet — a second implementation is the X1 defect');
  }
  if (!reexport(fromDna)) {
    return fail(FROM_DNA + ' is not a re-export of FxCompareSheet — a second implementation is the X1 defect');
  }
  const verdict = readFileSync(join(root, VERDICT), 'utf8');
  if (!verdict.includes("from '../fx/FxCompareFromCheckVerdict'") || !verdict.includes('FxCompareFromCheckVerdict')) {
    return fail(VERDICT + ' does not mount the Check Verdict FX Compare entry');
  }
  const wallet = readFileSync(join(root, WALLET), 'utf8');
  if (!wallet.includes('FxCompareFromCardDna') || !wallet.includes('CardDnaFxCompare')) {
    return fail(WALLET + ' does not register the Card DNA FX Compare entry');
  }
  const { config, error } = renderConfigFor(root);
  if (error) return fail(error);
  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }
  return ok(SENTINEL, [
    SUITE + ' · both entries re-export ' + CANONICAL,
    '  · Check Verdict mounts FxCompareFromCheckVerdict; WalletStack registers CardDnaFxCompare',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
