/**
 * GATE: no-magic-numbers — criterion G11.  →  `NO-MAGIC-NUMBERS OK`
 *
 *   > *"No numeric literal that looks like a rate, fee or threshold exists outside the adapter
 *   > and the engine's own declared, cited constants."*  (P2 criterion D5, widened to the
 *   > engine by this contract.)
 *
 * Delegates DETECTION to P2's scanner (tools/p2/lib/financial-literals.mjs — flag broadly on
 * name and shape, require every exception to be written down). This gate then classifies each
 * finding under the WIDENED P3 rule:
 *
 *   1. allowlisted in tools/p2/financial-literals.allow.json with file+literal (the human-
 *      reviewed exceptions, each carrying a reason) — unchanged from D5;
 *   2. inside src/engines/** or src/benefits/** AND the line DECLARES a named constant AND the
 *      module cites its authority somewhere (ADR-n / roadmap § / spec §): exactly what the
 *      contract means by "the engine's own declared, cited constants" — SMALL_AMOUNT_ADVISORY_
 *      THRESHOLD_ILS and VERDICT_*_LOAD_DEFAULT_RATIO live this way;
 *   3. a §-SECTION NUMBER inside a citation string ('roadmap §7.3') is documentation about a
 *      number, not a number about money, and is ignored — while a rate written inside a string
 *      would still be flagged, preserving the scanner's own discipline.
 *
 * Anything else is a violation. Negative control: write an uncited magic threshold into a
 * screen file and watch this gate fail.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';
import { scanRuleFour } from '../../p2/lib/financial-literals.mjs';

export const CRITERIA = ['G11'];
export const SENTINEL = 'NO-MAGIC-NUMBERS OK';

const ALLOW = 'tools/p2/financial-literals.allow.json';
const ENGINE_AREAS = ['src/engines/', 'src/benefits/'];
const DECLARED = /^\s*(?:export\s+)?(?:const|let)\s+[A-Z][A-Z0-9_]*\s*=\s*-?\d/;
const CITED = /ADR-\d+|roadmap §|spec §|MVP_SCOPE §|§\d/;

const isEngineArea = (file) => ENGINE_AREAS.some((area) => file.replace(/\\/g, '/').startsWith(area));

export const run = async ({ root }) => {
  if (!existsSync(join(root, ALLOW))) {
    return fail(ALLOW + ' does not exist - D5\'s reviewed exceptions are part of this check');
  }
  const allow = JSON.parse(readFileSync(join(root, ALLOW), 'utf8')).allow ?? [];

  const { findings } = scanRuleFour(root);
  const violations = [];
  let declaredCited = 0;
  let allowlisted = 0;
  let citationsIgnored = 0;

  for (const finding of findings) {
    const rel = finding.file.replace(/\\/g, '/');

    // 1. The human-reviewed exceptions.
    if (allow.some((a) => a.file.replace(/\\/g, '/') === rel && String(a.literal) === String(finding.literal)
      && (a.identifier === undefined || a.identifier === null || a.identifier === finding.identifier))) {
      allowlisted += 1;
      continue;
    }

    // 3. A section number inside a citation string: documentation, not money.
    const literalEscaped = String(finding.literal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('§\\s*' + literalEscaped + '(?!\\d)').test(finding.text)) {
      citationsIgnored += 1;
      continue;
    }

    // 2. The engine's own declared, cited constants.
    if (isEngineArea(rel)) {
      const lines = readFileSync(join(root, finding.file), 'utf8').split('\n');
      const line = lines[finding.line - 1] ?? '';
      const fileText = lines.join('\n');
      if (DECLARED.test(line) && CITED.test(fileText)) {
        declaredCited += 1;
        continue;
      }
    }

    violations.push(`${rel}:${finding.line} ${JSON.stringify(String(finding.literal))}`
      + (finding.identifier ? ` (${finding.identifier})` : '') + ' — ' + finding.text.trim().slice(0, 90));
  }

  if (violations.length > 0) {
    return fail('numeric literals that look like rates, fees or thresholds outside config/, '
      + 'the packs, and the engines\' declared cited constants:\n    '
      + violations.join('\n    '));
  }

  return ok(SENTINEL, [
    'scanned        every runtime src file through P2 rule-4 detection',
    'allowlisted    ' + allowlisted + ' human-reviewed exception(s) with reasons on file',
    'engines        ' + declaredCited + ' declared, cited constant(s) — the widened allowance',
    'citations      ' + citationsIgnored + ' §-section number(s) in strings, not figures',
  ].join('\n'));
};
