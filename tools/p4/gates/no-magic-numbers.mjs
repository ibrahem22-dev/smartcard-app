/**
 * GATE: no-magic-numbers — criterion B3.  →  `NO-MAGIC-NUMBERS OK`
 *
 *   > *"No numeric literal that looks like a rate, fee or threshold exists outside the adapter
 *   * and the engines' declared, cited constants."*
 *
 * Same classification as P3 G11 (which widened P2 D5), plus one P4-only ignore:
 * a work-package id (`WP-1.5`) is documentation, not money — the same class as a
 * §-section number inside a citation string.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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

    if (allow.some((a) => a.file.replace(/\\/g, '/') === rel && String(a.literal) === String(finding.literal)
      && (a.identifier === undefined || a.identifier === null || a.identifier === finding.identifier))) {
      allowlisted += 1;
      continue;
    }

    const literalEscaped = String(finding.literal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('§\\s*' + literalEscaped + '(?!\\d)').test(finding.text)) {
      citationsIgnored += 1;
      continue;
    }

    // A work-package id (WP-1.5) is a citation, not a rate.
    if (finding.text.includes('WP-' + String(finding.literal))) {
      citationsIgnored += 1;
      continue;
    }

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
    'engines        ' + declaredCited + ' declared, cited constant(s)',
    'citations      ' + citationsIgnored + ' §-section / WP-id number(s) in strings, not figures',
  ].join('\n'));
};
