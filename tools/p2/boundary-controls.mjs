#!/usr/bin/env node
/**
 * NEGATIVE CONTROLS FOR THE FIVE BOUNDARY RULES — Gate 3 requires one per rule.
 *
 *   > *"`BOUNDARY-LINT OK — 5 rules, 0 violations` in CI at the pushed sha · **every rule has a
 *   > recorded negative control** · `NO-REDERIVATION OK — 8 of 8`."*
 *
 * A CHECK THAT HAS NEVER FAILED IS NOT YET A CHECK, and this campaign has the receipts. When these
 * five rules were first run against the tree they printed **0 violations across all five**, and that
 * zero was false: `importsOf` scanned line by line, so it could not see
 *
 *     import {
 *       calculateCardLoan,
 *       calculateInstallmentInterest,
 *     } from '../engines/interestCalculator';
 *
 * — no single line holds both the keyword and the specifier. Prettier wraps every import with more
 * than one named specifier, so the rules were blind to precisely the imports most worth policing,
 * and `InterestCalculatorScreen.tsx` was calling two engine functions in plain sight. Nothing in the
 * gate would ever have gone red. **Rule 2's real negative control is that defect**, listed below as
 * `foundInTree` rather than as an injection, because a rule caught doing its job on code somebody
 * actually wrote is worth more than a rule caught doing its job on code written to make it fire.
 *
 * WHAT THE OTHER CONTROLS DO. Each writes a real violation into a real file, runs the real rule,
 * watches it fire, then deletes the file and sha256-compares to prove the tree is unchanged. No
 * control edits a file the app ships.
 *
 * WHY THIS IS A COMMITTED SCRIPT rather than something run once and described: the record it writes
 * is what `lint-boundaries` reads to decide whether a rule has been proven, and a record nobody can
 * regenerate is a claim rather than evidence. Re-run any time:
 *
 *     node tools/p2/boundary-controls.mjs
 *
 * RULE 5 HAS NO PRODUCTION SUBJECT YET — the `track()` boundary is criterion B6, Phase 10. Its
 * control creates the call site it needs, proves the rule fires on it, and removes it. That is the
 * point of requiring a control: the rule is in force before the thing it polices exists, which is
 * the only order in which a boundary rule ever gets obeyed.
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from './lib/boundary-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const shaOf = (p) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : 'ABSENT');
const at = (rel) => join(ROOT, rel);

const controls = [];

/**
 * Every control creates files that did not exist and removes them again. A control that had to
 * MODIFY a shipped file would be a control that can corrupt the tree if it dies half way, so none
 * of them do; the "before" state of every touched path is ABSENT and is asserted to be ABSENT after.
 */
const control = ({ rule, name, write }) => {
  const files = Object.keys(write);
  const before = Object.fromEntries(files.map((f) => [f, shaOf(at(f))]));
  const preexisting = files.filter((f) => before[f] !== 'ABSENT');
  if (preexisting.length) {
    console.log('  SKIPPED rule ' + rule + ' — control path already exists: ' + preexisting.join(', '));
    controls.push({ rule, name, fired: false, restored: true, error: 'control path already exists' });
    return;
  }

  let result;
  try {
    for (const [f, body] of Object.entries(write)) writeFileSync(at(f), body);
    result = RULES[rule - 1](ROOT);
  } finally {
    for (const f of files) if (existsSync(at(f))) rmSync(at(f));
  }

  const restored = files.every((f) => shaOf(at(f)) === 'ABSENT');
  const mine = result.violations.filter((v) => files.some((f) => v.file === f));
  const fired = mine.length > 0;

  controls.push({
    rule, name, fired, restored,
    sawExactly: mine.map((v) => v.file + ':' + v.line + ' — ' + v.detail),
  });
  console.log((fired ? '  FIRED  ' : '  DID NOT FIRE  ') + 'rule ' + rule + ' — ' + name);
  for (const v of mine) console.log('           ' + v.file + ':' + v.line + ' — ' + v.detail);
  if (!restored) console.log('           *** TREE NOT RESTORED ***');
};

// ───────────────────────────────────────────────────────────────────────────────── rule 1
control({
  rule: 1,
  name: 'an engine imports a screen and calls a network global',
  write: {
    'src/engines/__negctl_rule1.ts':
      "import { InterestCalculatorScreen } from '../screens/InterestCalculatorScreen';\n"
      + 'export const negctl = async () => {\n'
      + '  await fetch("https://example.invalid");\n'
      + '  return InterestCalculatorScreen;\n'
      + '};\n',
  },
});

// ───────────────────────────────────────────────────────────────────────────────── rule 2
// Deliberately WRAPPED ACROSS LINES, because the line-based scanner this replaced would have
// passed it. A control that a broken checker also passes proves nothing.
control({
  rule: 2,
  name: 'a screen imports a calculating engine module — wrapped across lines, as prettier writes it',
  write: {
    'src/screens/__negctl_rule2.tsx':
      'import {\n  calculateCardLoan,\n} from ' + "'../engines/interestCalculator';\n"
      + 'export const negctl = calculateCardLoan;\n',
  },
});

// rule 2, second path: through the barrel. `src/engines/index.ts` re-exports the same calculating
// functions as VALUES, so a surface could reach them by a different spelling.
control({
  rule: 2,
  name: 'a screen reaches a calculating function through the engines barrel',
  write: {
    'src/components/__negctl_rule2barrel.tsx':
      "import { calculateInstallmentInterest } from '../engines';\n"
      + 'export const negctl = calculateInstallmentInterest;\n',
  },
});

// ───────────────────────────────────────────────────────────────────────────────── rule 3
control({
  rule: 3,
  name: 'a module outside data/adapter imports a raw JSON dataset and a DB driver',
  write: {
    'src/utils/__negctl_dataset.json': '{"rate": 2.5}\n',
    'src/utils/__negctl_rule3.ts':
      "import rates from './__negctl_dataset.json';\n"
      + "import * as sqlite from 'expo-sqlite';\n"
      + 'export const negctl = { rates, sqlite };\n',
  },
});

// ───────────────────────────────────────────────────────────────────────────────── rule 4
control({
  rule: 4,
  name: 'a rate literal appears outside config/**',
  write: {
    'src/engines/__negctl_rule4.ts': 'export const foreignExchangeCommissionRate = 2.75;\n',
  },
});

// ───────────────────────────────────────────────────────────────────────────────── rule 5
control({
  rule: 5,
  name: 'a vault value reaches track() — the boundary B6 will build in Phase 10',
  write: {
    'src/utils/__negctl_rule5.ts':
      'declare function track(event: string, props: unknown): void;\n'
      + 'const pinHash = "from the vault";\n'
      + "export const negctl = () => track('opened', { pinHash });\n",
  },
});

// ───────────────────────────────────────────────────── rule 3, the OQ-MDC-029 exemption is enumerated
/**
 * PD-MDC-065 exempted TWO importer → file pairs from rule 3 (BRAND_TOKEN_READS). These two controls
 * are what distinguish an enumerated exemption from a pattern: a sibling JSON under assets/brand/
 * that is not one of the two files must still fire, even from the exempted importer's directory,
 * and the canonical geometry file must still fire when read from a module that is not its
 * enumerated owner. The sibling file is created and removed like every other control path — it is
 * a new file under a shipped directory, never an edit to a shipped file.
 */
control({
  rule: 3,
  name: 'a sibling brand JSON that is not one of the two enumerated token files is still a raw dataset, even from src/theme',
  write: {
    'assets/brand/__negctl_sibling.tokens.json': '{"spacing": [4, 8], "rate": 2.5}\n',
    'src/theme/__negctl_rule3sibling.ts':
      "import sibling from '../../assets/brand/__negctl_sibling.tokens.json';\n"
      + 'export const negctl = { sibling };\n',
  },
});
control({
  rule: 3,
  name: 'the canonical geometry token file read from a module that is not its enumerated importer is still a raw dataset',
  write: {
    'src/screens/__negctl_rule3brand.tsx':
      "import geometry from '../../assets/brand/geometry.tokens.json';\n"
      + 'export const negctl = { geometry };\n',
  },
});

// ─────────────────────────────────────────────────────────── the one control nobody injected
controls.push({
  rule: 2,
  name: 'FOUND IN THE TREE, not injected: InterestCalculatorScreen.tsx imported calculateCardLoan and calculateInstallmentInterest directly',
  fired: true,
  restored: true,
  foundInTree: true,
  sawExactly: ['src/screens/InterestCalculatorScreen.tsx:13 — imports a calculating module rather than its result type: src/engines/interestCalculator.ts'],
  repairedBy: 'WP-3.1 — src/hooks/useInterestResult.ts, the seam usePurchaseGate already established',
});

// ───────────────────────────────────────────────────────────────────────────────── record
const gitSha = (() => {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout).trim() : null;
})();

const RULE_COUNT = RULES.length;
const rulesProven = new Set(controls.filter((c) => c.fired).map((c) => c.rule));
const missing = Array.from({ length: RULE_COUNT }, (_, i) => i + 1).filter((n) => !rulesProven.has(n));
const allRestored = controls.every((c) => c.restored);
const allFired = missing.length === 0;

writeFileSync(join(HERE, 'boundary-controls.json'), JSON.stringify({
  $comment: [
    'NEGATIVE-CONTROL RECORD for the five §9.4 boundary rules. Gate 3 requires one per rule.',
    'Regenerate with: node tools/p2/boundary-controls.mjs',
    'tools/p2/gates/lint-boundaries.mjs READS this file and refuses to pass if any rule has no',
    'control that fired — a check that has never failed is not yet a check.',
    'Each injected control writes a real violation into files that did not exist, runs the real',
    'rule, watches it fire, deletes them, and asserts the paths are absent again.',
    'The entry marked foundInTree was not injected: it is the defect rule 2 caught in shipped code',
    'once the line-based import scanner it depended on was replaced with a whole-source one.',
  ],
  recordedAt: new Date().toISOString(),
  sha: gitSha,
  ruleCount: RULE_COUNT,
  rulesProven: [...rulesProven].sort(),
  rulesWithoutAControl: missing,
  allFired,
  allRestored,
  controls,
}, null, 2) + '\n');

console.log('');
console.log(allFired && allRestored
  ? 'BOUNDARY-CONTROLS OK — ' + rulesProven.size + ' of ' + RULE_COUNT + ' rules watched to fire across '
    + controls.length + ' controls, tree restored'
  : 'BOUNDARY-CONTROLS FAILED — rules without a control that fired: ' + (missing.join(', ') || 'none')
    + ' · restored=' + allRestored);
process.exit(allFired && allRestored ? 0 : 1);
