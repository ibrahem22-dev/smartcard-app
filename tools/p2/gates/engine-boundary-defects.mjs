/**
 * GATE: engine-boundary-defects — criterion D6.  →  `ENGINE-BOUNDARY OK — 0 hardcoded scores`
 *
 * *"The two known engine-boundary defects are gone from **every P2 surface**: `DecisionScreen`'s
 * hardcoded 84/100 and 71/100, and `VERDICT_FALLBACK_REASONS` used as primary copy."*
 *
 * THE CONTRACT NAMES TWO INSTANCES; THE GATE CHECKS THE TWO CLASSES.
 *
 * A gate that searched for the literals `84/100` and `71/100` would pass the moment someone wrote
 * `82/100`, and would have nothing to say about the third one. Both defects are instances of a
 * kind, and the kind is what P2 is actually forbidden to ship:
 *
 *   CLASS 1 — A SCORE WITH NO COMPUTATION BEHIND IT. Any `N/100` rendered as text. A card score is
 *             an engine output; contract §1 puts every derivation in P3. Two of these were on
 *             screen in bold, beside real card labels, dimmed behind a "coming soon" badge that
 *             does not make a fabricated number honest.
 *
 *   CLASS 2 — A CANNED FINDING SUBSTITUTED FOR AN ENGINE'S OWN. `VERDICT_FALLBACK_REASONS` held
 *             four sentences keyed by verdict — statements about the user's money, in the voice of
 *             an engine that did not produce them. A reader cannot tell a real finding from a
 *             plausible stand-in, and the stand-in reads exactly like the real thing.
 *
 * COMMENTS ARE STRIPPED BEFORE SEARCHING. The D3 gate learned this the hard way: once the defect is
 * actually removed, what remains is the documentation explaining the removal, and a gate that fails
 * on its own explanation pushes the campaign toward deleting them. Both counts are reported, so
 * "not in code" is never confused with "never mentioned".
 *
 * THE POPULATION IS DERIVED from `src/**` on disk, so a defect in a file written tomorrow is caught
 * without this gate being edited.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['D6'];
export const SENTINEL = 'ENGINE-BOUNDARY OK — 0 hardcoded scores';

/** Comments out, code in. A symbol that no longer exists cannot be used. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const sourceFiles = (dir, acc = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) sourceFiles(p, acc);
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

/**
 * A score-shaped literal: `84/100`, `71 / 100`. Deliberately NOT matched inside a string that is
 * obviously a ratio in prose — the search runs on stripped code, so what is left is JSX text and
 * expressions, which is exactly where a rendered score would be.
 */
const SCORE_LITERAL = /(?<![\w.])(\d{1,3})\s*\/\s*100(?![\w.])/g;

/** The named symbol from the contract, plus the shape it belongs to. */
const CANNED_FINDING_SYMBOLS = ['VERDICT_FALLBACK_REASONS'];

export const run = async ({ root }) => {
  const srcDir = join(root, 'src');
  if (!existsSync(srcDir)) return fail('no src/ directory — nothing to scan');
  const files = sourceFiles(srcDir);
  if (files.length === 0) {
    return fail('no source files under src/ — a scan over nothing is a vacuous pass');
  }

  const problems = [];
  const lines = [];
  let scoreHits = 0;
  let symbolHits = 0;
  let scoreMentions = 0;
  let symbolMentions = 0;

  for (const f of files) {
    const rel = relative(root, f).replace(/\\/g, '/');
    const raw = readFileSync(f, 'utf8');
    const code = stripComments(raw);

    // --- class 1: a score with nothing behind it -----------------------------------
    const inCode = [...code.matchAll(SCORE_LITERAL)].map((m) => m[0].trim());
    const inRaw = [...raw.matchAll(SCORE_LITERAL)].length;
    scoreMentions += inRaw;
    if (inCode.length) {
      scoreHits += inCode.length;
      problems.push(rel + ' renders a score literal with no computation behind it: ' + inCode.join(', '));
    }

    // --- class 2: a canned finding in place of an engine's own ----------------------
    for (const sym of CANNED_FINDING_SYMBOLS) {
      if (raw.includes(sym)) symbolMentions += 1;
      if (code.includes(sym)) {
        symbolHits += 1;
        problems.push(rel + ' still uses ' + sym + ' — a canned per-verdict finding substituted for the engine\'s own');
      }
    }
  }

  lines.push('scanned         ' + files.length + ' source files under src/, derived from disk');
  lines.push('score literals  ' + scoreHits + ' in code · ' + scoreMentions + ' including comments');
  lines.push('canned findings ' + symbolHits + ' in code · ' + symbolMentions + ' file(s) mentioning the symbol');

  /**
   * THE TWO INSTANCES THE CONTRACT NAMES, checked by name as well as by class.
   *
   * The class checks above would catch them, but D6 names these two specifically and a reader of
   * the gate output should be able to see those two answered rather than inferring it from a zero.
   */
  const decision = join(root, 'src', 'screens', 'DecisionScreen.tsx');
  if (existsSync(decision)) {
    const code = stripComments(readFileSync(decision, 'utf8'));
    for (const named of ['84/100', '71/100']) {
      const present = code.includes(named);
      if (present) problems.push('DecisionScreen still renders ' + named);
      lines.push('  named defect  ' + (present ? 'PRESENT' : 'gone   ') + ' · DecisionScreen ' + named);
    }
    const canned = code.includes('VERDICT_FALLBACK_REASONS');
    if (canned) problems.push('DecisionScreen still uses VERDICT_FALLBACK_REASONS');
    lines.push('  named defect  ' + (canned ? 'PRESENT' : 'gone   ') + ' · VERDICT_FALLBACK_REASONS');
  } else {
    lines.push('  named defect  DecisionScreen.tsx does not exist — the two named instances cannot be present');
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'ENGINE-BOUNDARY OK — 0 hardcoded scores in ' + files.length
      + ' source files, 0 canned findings',
  };
};
