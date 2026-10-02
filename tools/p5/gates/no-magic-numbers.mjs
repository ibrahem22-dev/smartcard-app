/**
 * GATE: no-magic-numbers — criterion B3.  →  `NO-MAGIC-NUMBERS OK`
 *
 *   > **B3.** *"No numeric literal that looks like a rate, fee, threshold or ratio exists outside
 *   > the adapter and the engines' declared, cited constants."*
 *
 * MEASURES: 'source'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SAME DETECTION, THE SAME EXCEPTIONS, AND ONE RULE THAT IS P5's
 *
 * Detection is `scanRuleFour` from `tools/p2/lib/financial-literals.mjs`, and the classification is
 * the one P2 D5 established, P3 G11 widened and P4 B3 carried: an allowlisted exception with a
 * reason on file, a §-section or work-package number inside a string, or a declared constant in an
 * engine area whose file cites its source. Rewriting any of that here would be a second opinion
 * about a fixed question, which is how two checks start disagreeing.
 *
 * What is P5's is the population — its five surfaces are inside `src/**` and were in this scan the
 * moment they were written — and one rule about the exceptions themselves.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A CAMPAIGN MAY NOT ALLOWLIST ITS OWN LITERALS
 *
 * The allowlist is the honest way to carry a reviewed exception, and it is also the easiest way to
 * turn this criterion green without changing any code: add the file and the number, and the gate
 * agrees. Thirty-three entries are on file and **none** points at anything P5 created, which is the
 * state this rule keeps.
 *
 * So the files P5 created are derived from git — the same derivation U3 uses — and an allowlist
 * entry naming one of them fails, whoever added it. An exception carried from an earlier campaign is
 * a reviewed decision with a reason; an exception a campaign writes for its own new code is that
 * campaign marking its own homework, and B3 is a claim about the code rather than about the list.
 *
 * NEGATIVE CONTROL: put a rate literal on a P5 surface and watch this fail; then allowlist it and
 * watch it fail differently.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, fail } from '../lib/report.mjs';
import { scanRuleFour } from '../../p2/lib/financial-literals.mjs';

export const CRITERIA = ['B3'];
export const SENTINEL = 'NO-MAGIC-NUMBERS OK';
export const MEASURES = 'source';

const ALLOW = 'tools/p2/financial-literals.allow.json';
const ENGINE_AREAS = ['src/engines/', 'src/benefits/'];
const DECLARED = /^\s*(?:export\s+)?(?:const|let)\s+[A-Z][A-Z0-9_]*\s*=\s*-?\d/;
const CITED = /ADR-\d+|roadmap §|spec §|MVP_SCOPE §|§\d/;

const isEngineArea = (file) => ENGINE_AREAS.some((area) => file.replace(/\\/g, '/').startsWith(area));

/** The app sha P5 started from, read from the intake rather than guessed. */
const intakeAppSha = (root) => {
  for (const rel of [
    join(root, '..', 'smartcard-data-pipeline', 'campaign-p5', 'state', 'INTAKE.json'),
    join(root, '..', 'campaign-p5', 'state', 'INTAKE.json'),
  ]) {
    try {
      const sha = JSON.parse(readFileSync(rel, 'utf8'))?.accepted?.shas?.app;
      if (sha) return String(sha);
    } catch { /* next */ }
  }
  return null;
};

export const run = async ({ root }) => {
  if (!existsSync(join(root, ALLOW))) {
    return fail(ALLOW + " does not exist — D5's reviewed exceptions are part of this check");
  }
  const allow = JSON.parse(readFileSync(join(root, ALLOW), 'utf8')).allow ?? [];

  /* ── the files P5 created, derived from git ────────────────────────────────────────────── */
  const pin = intakeAppSha(root);
  if (!pin) {
    return fail('the intake app sha could not be read, so the files P5 created cannot be derived — and '
      + 'without that this gate cannot tell a carried exception from a campaign excusing its own code');
  }
  const listed = spawnSync('git', ['diff', '--name-only', '--diff-filter=A', pin + '..HEAD', '--', 'src/'],
    { cwd: root, encoding: 'utf8' });
  if (listed.status !== 0) return fail('git could not list the files P5 created since ' + pin.slice(0, 12));
  const p5Created = new Set(String(listed.stdout).split('\n').map((l) => l.trim()).filter(Boolean));
  if (p5Created.size === 0) {
    return fail('no file under src/ was created after the intake pin — P5 built five surfaces, so an empty '
      + 'set means the derivation is broken rather than that the work is absent');
  }

  /* ── a campaign may not allowlist its own literals ─────────────────────────────────────── */
  const selfExcused = allow.filter((a) => p5Created.has(String(a.file).replace(/\\/g, '/')));
  const problems = selfExcused.map((a) => ALLOW + ' carries an exception for ' + a.file + ' (' + a.literal
    + '), a file P5 created. An exception carried from an earlier campaign is a reviewed decision; one a '
    + 'campaign writes for its own new code is that campaign marking its own homework, and B3 is a claim '
    + 'about the code rather than about the list');

  /* ── the scan, classified exactly as D5 / G11 / B3 established ─────────────────────────── */
  const { findings } = scanRuleFour(root);
  const violations = [];
  let declaredCited = 0;
  let allowlisted = 0;
  let citationsIgnored = 0;
  let onP5Surfaces = 0;

  for (const finding of findings) {
    const rel = finding.file.replace(/\\/g, '/');

    if (allow.some((a) => a.file.replace(/\\/g, '/') === rel && String(a.literal) === String(finding.literal)
      && (a.identifier === undefined || a.identifier === null || a.identifier === finding.identifier))) {
      allowlisted += 1;
      continue;
    }

    const literalEscaped = String(finding.literal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('§\\s*' + literalEscaped + '(?!\\d)').test(finding.text)) { citationsIgnored += 1; continue; }
    if (finding.text.includes('WP-' + String(finding.literal))) { citationsIgnored += 1; continue; }

    if (isEngineArea(rel)) {
      const lines = readFileSync(join(root, finding.file), 'utf8').split('\n');
      if (DECLARED.test(lines[finding.line - 1] ?? '') && CITED.test(lines.join('\n'))) {
        declaredCited += 1;
        continue;
      }
    }

    if (p5Created.has(rel)) onP5Surfaces += 1;
    violations.push(rel + ':' + finding.line + ' ' + JSON.stringify(String(finding.literal))
      + (finding.identifier ? ' (' + finding.identifier + ')' : '') + ' — ' + finding.text.trim().slice(0, 90)
      + (p5Created.has(rel) ? '  ← a file P5 created' : ''));
  }

  if (violations.length) {
    problems.push('numeric literals that look like rates, fees, thresholds or ratios outside the adapter and '
      + "the engines' declared cited constants"
      + (onP5Surfaces ? ' (' + onP5Surfaces + ' of them on files P5 created)' : '') + ':\n    '
      + violations.join('\n    '));
  }
  if (problems.length) return fail(problems.join('\n  '));

  return ok(SENTINEL, [
    'CRITERION B3 — no magic financial literals, over every runtime src file.',
    'Detection and classification are P2\'s, from tools/p2/lib/financial-literals.mjs — the rule D5',
    '  established, G11 widened and P4 carried. A second opinion here about a fixed question is how',
    '  two checks start disagreeing; what is P5\'s is the population and the rule below.',
    'allowlisted    ' + allowlisted + ' human-reviewed exception(s) with reasons on file',
    'engines        ' + declaredCited + ' declared, cited constant(s)',
    'citations      ' + citationsIgnored + ' §-section / WP-id number(s) in strings, not figures',
    'self-excused   0 — of ' + allow.length + ' exception(s) on file, none names any of the ' + p5Created.size,
    '               file(s) P5 created (derived from git at the intake pin, not hand-listed).',
    '               The allowlist is the honest way to carry a reviewed exception and also the',
    '               easiest way to turn this criterion green without touching a line of code, so a',
    '               campaign writing one for its own new code fails here.',
  ].join('\n'));
};
