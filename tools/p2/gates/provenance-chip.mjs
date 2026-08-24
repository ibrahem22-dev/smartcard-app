/**
 * GATE: provenance-chip — criterion A2.  →  `PROVENANCE-CHIP OK — 5 states, 1 definition`
 *
 *   > **A2.** *"The four-state provenance chip (Verified / Your value / Estimate / Unknown) **plus
 *   > the Stale modifier** is one shared primitive; **no screen constructs chip markup locally**."*
 *
 * The sentinel counts FIVE: four states and the Stale modifier.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE HALF A TEST CANNOT PROVE
 *
 * `ProvenanceChip.render.test.tsx` mounts every state and asserts what appears. What it cannot
 * assert is the second clause — *no screen constructs chip markup locally* — because a screen that
 * builds its own badge does so in a file the chip's test never imports. That is a property of the
 * whole tree, so it is checked here:
 *
 *   1. **One definition.** Exactly one module renders chip markup. Any other file containing a
 *      chip-shaped view — a rounded-full bordered pill carrying a provenance word — is a second
 *      definition, and two definitions of one badge is how a user learns that "verified" means
 *      whatever the screen they are on decided.
 *   2. **No second vocabulary** (B5's concern). The four state names come from one place, and a
 *      screen naming a provenance word in its own markup is building the chip by hand.
 *   3. **Five states, all reachable.** The state list is DERIVED from the module, not restated
 *      here, so a fifth state cannot appear without this gate's count changing.
 *   4. **Every state has a glyph and a word.** A9 requires icon + word; a state that lost either
 *      would still render and would fail A9 silently.
 *   5. **Every label is translated.** A chip word with no Arabic entry falls through to Hebrew for
 *      an Arabic reader, which is the silent failure A7 exists to make visible.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A2'];
export const SENTINEL = 'PROVENANCE-CHIP OK — 5 states, 1 definition';

const STATE_MODULE = 'src/components/provenanceChipState.ts';
const CHIP_MODULE = 'src/components/ProvenanceChip.tsx';

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  for (const rel of [STATE_MODULE, CHIP_MODULE]) {
    if (!existsSync(join(root, rel))) {
      return fail(rel + ' does not exist — A2 asks for one shared primitive, and a gate that passed '
        + 'without one would be counting states nobody can render');
    }
  }

  const stateSrc = readFileSync(join(root, STATE_MODULE), 'utf8');
  const chipSrc = readFileSync(join(root, CHIP_MODULE), 'utf8');

  // ── 1. the four states, derived ──────────────────────────────────────────────────
  // THE STATES COME FROM THE ONE VOCABULARY, WHEREVER IT LIVES.
  //
  // This read `CHIP_STATES = ['verified', …]` straight out of the state module, because that is
  // where the states were declared when the gate was written. B5 then moved them: the app's
  // provenance vocabulary is now the Data Contract's, in src/authority/provenanceChip.ts, and the
  // state module re-exports it — `export const CHIP_STATES = PROVENANCE_CHIPS;`.
  //
  // The gate failed with "could not read CHIP_STATES", which is the right failure: a gate that had
  // silently found zero states and passed would have been asserting A2 over an empty list.
  const VOCAB = 'src/authority/provenanceChip.ts';
  const reexports = /export const CHIP_STATES = PROVENANCE_CHIPS;/.test(stateSrc);
  const source = reexports ? readFileSync(join(root, VOCAB), 'utf8') : stateSrc;
  const pattern = reexports
    ? /export const PROVENANCE_CHIPS = \[([^\]]*)\] as const;/
    : /export const CHIP_STATES = \[([^\]]*)\] as const;/;
  const m = source.match(pattern);
  if (!m) {
    return fail('could not read the chip states out of '
      + (reexports ? VOCAB : STATE_MODULE) + ' — A2 counts four plus the Stale modifier, and a gate '
      + 'that read none would be counting to five from nothing');
  }
  const states = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  if (states.length !== 4) {
    problems.push('CHIP_STATES has ' + states.length + ' entries and A2 names four (Verified / Your '
      + 'value / Estimate / Unknown). A fifth state is a contract change, not a design tweak');
  }

  // ── 2. the Stale modifier exists and is a modifier ───────────────────────────────
  const hasStale = /CHIP_STALE_LABEL/.test(stateSrc)
    && (/stale:\s*(true|boolean)/.test(stateSrc) || /stale:\s*(true|boolean)/.test(source));
  if (!hasStale) problems.push('no Stale modifier found — A2 counts it as the fifth thing the chip shows');
  if (states.map((x) => x.toLowerCase()).includes('stale')) {
    problems.push('"stale" appears in CHIP_STATES. A2 makes it a MODIFIER on a state, not a state: '
      + 'as a state it would replace "this was verified and may be out of date" with "we do not know"');
  }

  // ── 3. every state has a glyph and a tone, in the component ──────────────────────
  const glyphs = [...chipSrc.matchAll(/^\s*(\w+):\s*'([^']+)',/gm)].map((x) => x[1]);
  for (const s of states) {
    if (!new RegExp('\\b' + s + ':').test(chipSrc)) {
      problems.push('state "' + s + '" has no entry in ' + CHIP_MODULE + ' — it is declared and cannot render');
    }
  }
  const glyphMap = chipSrc.match(/CHIP_GLYPH[^=]*=\s*\{([^}]*)\}/);
  if (!glyphMap) problems.push('no CHIP_GLYPH map — A9 requires icon AND word, never colour alone');
  else {
    for (const s of states) {
      if (!new RegExp("\\b" + s + ":\\s*'[^']+'").test(glyphMap[1])) {
        problems.push('state "' + s + '" has no glyph. A9: every state cue is icon + word');
      }
    }
  }

  // ── 4. every label is translated ─────────────────────────────────────────────────
  const labelMap = stateSrc.match(/CHIP_LABEL[^=]*=\s*\{([^}]*)\}/);
  const staleLabel = stateSrc.match(/CHIP_STALE_LABEL\s*=\s*'([^']+)'/);
  const labels = labelMap ? [...labelMap[1].matchAll(/:\s*'([^']+)'/g)].map((x) => x[1]) : [];
  if (staleLabel) labels.push(staleLabel[1]);
  if (labels.length !== states.length + 1) {
    problems.push('found ' + labels.length + ' label(s) for ' + states.length + ' states plus Stale — '
      + 'a state without a word cannot satisfy A9');
  }
  if (new Set(labels).size !== labels.length) {
    problems.push('two states share a word — four states that read the same are not four states');
  }
  for (const lang of ['ar', 'en']) {
    const src = readFileSync(join(root, 'src', 'i18n', lang + '.ts'), 'utf8');
    for (const label of labels) {
      if (!src.includes("'" + label + "'")) {
        problems.push('“' + label + '” has no ' + lang + ' entry — it would fall through to Hebrew '
          + 'for that reader, which is the silent failure A7 exists to end');
      }
    }
  }

  // ── 5. ONE definition: nobody builds a chip by hand ──────────────────────────────
  //
  // A chip-shaped view is a rounded-full bordered pill. Looking for that shape alone would flag
  // every avatar and tag in the app, so the test is the SHAPE AND a provenance word in the same
  // file: a pill that says "verified" is a provenance chip whatever it is called.
  const PILL = /rounded-full[^"'`]*\bborder\b|\bborder\b[^"'`]*rounded-full/;
  const WORDS = new RegExp(labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files under src/ — an empty population proves nothing');

  const definitions = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (rel === CHIP_MODULE || rel === STATE_MODULE) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (!PILL.test(code)) continue;
    for (const w of code.matchAll(WORDS)) {
      definitions.push({ file: rel, line: lineAt(code, w.index), word: w[0] });
      break;
    }
  }
  for (const d of definitions) {
    problems.push(d.file + ':' + d.line + ' builds a pill carrying “' + d.word + '” — that is chip '
      + 'markup outside ' + CHIP_MODULE + ', and A2 says one shared primitive');
  }

  lines.push('definition      ' + CHIP_MODULE + ' · decision in ' + STATE_MODULE);
  lines.push('states          ' + states.length + ' (' + states.join(', ') + ') + the Stale modifier');
  lines.push('words           ' + labels.length + ' distinct, each with an ar and an en rendering');
  lines.push('glyphs          ' + (glyphMap ? states.length + ' of ' + states.length : 'MISSING') + ' — A9: icon + word, never colour alone');
  lines.push('population      ' + files.length + ' files scanned for a second definition · found ' + definitions.length);

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'PROVENANCE-CHIP OK — ' + (states.length + 1) + ' states, 1 definition',
  };
};
