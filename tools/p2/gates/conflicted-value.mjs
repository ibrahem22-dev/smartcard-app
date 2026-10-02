/**
 * GATE: conflicted-value — criterion A3, Owner Decision OD-9.  →  `CONFLICTED-VALUE OK`
 *
 *   > **A3.** *"`ConflictedValue` is one shared component rendering **every** competing reading with
 *   > its scope and its source, **amber never red**, **no winner and no default selection**."*
 *
 *   > **OD-9.** *"A **shared component** (`ConflictedValue`), **not per-screen bespoke logic**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE TESTS PROVE AND WHAT THIS GATE PROVES
 *
 * `ConflictedValue.render.test.tsx` mounts both `conflictRenderPlan` members and asserts what
 * appears: every candidate, in input order, with source and scope, amber, and — for
 * `DISPUTED_WITHOUT_CANDIDATES` — one sentence and nothing further.
 *
 * What it cannot assert is A3's and OD-9's real subject: that **no other file in the tree renders a
 * conflict**. A screen doing it locally does so in a file the component's test never imports. So
 * this gate looks at the whole tree, and at the component's own source for the four things it must
 * never learn to do:
 *
 *   · **sort or rank** — putting the cheapest first is a ranking, and a reader takes the top row as
 *     the answer;
 *   · **preselect** — a highlighted row is a winner wearing different clothes;
 *   · **truncate** — "…and 2 more" hides exactly the reading that might have been the user's;
 *   · **compute** — an average or an interval collapses a disagreement OD-24 says must stay one,
 *     and `conflictRenderPlan` belongs to the adapter (handoff §2, IF-4) which D4 forbids
 *     re-deriving.
 *
 * A source check is a blunt instrument and this gate says so: it reads the component's code for the
 * SHAPE of those operations. It cannot prove the absence of a clever equivalent, and it is not the
 * only defence — the tests assert the observable behaviour, and this asserts nobody wrote the
 * obvious version of it.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A3'];
export const SENTINEL = 'CONFLICTED-VALUE OK';

const COMPONENT = 'src/components/ConflictedValue.tsx';

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

/** Operations the component must never perform on candidates. */
const FORBIDDEN_IN_COMPONENT = [
  [/\.sort\s*\(/g, 'sorts — ordering candidates is ranking them, and the top row reads as the answer'],
  [/\.slice\s*\(/g, 'truncates — every candidate must render; the hidden one may be the reader’s'],
  [/\bMath\.(min|max|abs)\s*\(/g, 'computes across candidates — a spread or an interval collapses a disagreement OD-24 says must stay one'],
  [/\breduce\s*\(/g, 'folds the candidates into one value — that is naming a winner by arithmetic'],
  [/\b(selected|isSelected|defaultSelected|recommended)\b/g, 'preselects — a highlighted row is a winner wearing different clothes'],
];

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  const abs = join(root, COMPONENT);
  if (!existsSync(abs)) {
    return fail(COMPONENT + ' does not exist. A3 and OD-9 both name it, and a gate that passed '
      + 'without it would be asserting that no screen duplicates a component nobody wrote');
  }
  const code = stripComments(readFileSync(abs, 'utf8'));

  // ── 1. the component does not decide ─────────────────────────────────────────────
  for (const [re, why] of FORBIDDEN_IN_COMPONENT) {
    for (const m of code.matchAll(re)) {
      problems.push(COMPONENT + ':' + lineAt(code, m.index) + ' ' + why + ' (' + m[0].trim() + ')');
    }
  }

  // ── 2. amber, never red ──────────────────────────────────────────────────────────
  if (!/\badvisory\b/.test(code)) {
    problems.push(COMPONENT + ' does not use the advisory role. A3 requires amber, and the role is '
      + 'how amber is reached now that A8 forbids naming a hue in a component');
  }
  for (const m of code.matchAll(/\bdanger\b|\bred-\d{2,3}\b/g)) {
    problems.push(COMPONENT + ':' + lineAt(code, m.index) + ' reaches for danger (' + m[0] + '). '
      + 'A3 says amber never red: a disagreement between sources is not a hazard to the reader, and '
      + 'painting it red spends the weight the next real hazard needs');
  }

  // ── 3. it renders EVERY candidate ────────────────────────────────────────────────
  if (!/candidates\.map\s*\(/.test(code)) {
    problems.push(COMPONENT + ' does not map over every candidate — A3 says every competing reading');
  }

  // ── 4. scope AND source both reach the screen ────────────────────────────────────
  for (const field of ['sourceId', 'scope']) {
    if (!new RegExp('\\bcandidate\\.' + field + '\\b').test(code)) {
      problems.push(COMPONENT + ' never reads candidate.' + field + ' — A3 requires every reading to '
        + 'show its scope AND its source, and two figures without scope turn a difference in coverage '
        + 'into an apparent contradiction');
    }
  }

  // ── 5. nobody else renders a conflict ────────────────────────────────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files under src/ — an empty population proves nothing');

  const locals = [];
  for (const f of files) {
    const rel = relative(root, f).replace(/\\/g, '/');
    if (rel === COMPONENT) continue;
    const src = stripComments(readFileSync(f, 'utf8'));
    // Reading a conflict's candidates outside the component is per-screen conflict logic, whether
    // or not it looks like rendering. Importing the TYPE is fine; touching `.candidates` is not.
    for (const m of src.matchAll(/\.candidates\b/g)) {
      // The authority layer itself constructs and folds them — that is its job.
      if (/^src\/authority\//.test(rel)) break;
      locals.push({ file: rel, line: lineAt(src, m.index) });
      break;
    }
  }
  for (const l of locals) {
    problems.push(l.file + ':' + l.line + ' reads a conflict’s candidates outside ' + COMPONENT
      + ' — OD-9 says a shared component, not per-screen bespoke logic');
  }

  lines.push('component       ' + COMPONENT);
  lines.push('decides         nothing — no sort, no slice, no fold, no preselection');
  lines.push('role            advisory (amber). A3: amber never red');
  lines.push('shows           value · source · scope, for every candidate in the order given');
  lines.push('population      ' + files.length + ' files scanned for per-screen conflict logic · found ' + locals.length);
  lines.push('members         DISPUTED_WITH_CANDIDATES and DISPUTED_WITHOUT_CANDIDATES, both covered by');
  lines.push('                src/components/__tests__/ConflictedValue.render.test.tsx');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
