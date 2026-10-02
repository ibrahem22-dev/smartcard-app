#!/usr/bin/env node
/**
 * THE A8 COLOUR MIGRATION — a mapping table, not 751 hand edits.
 *
 *     node tools/p2/migrate-colour.mjs           report what would change, touch nothing
 *     node tools/p2/migrate-colour.mjs --write   apply it
 *
 * WHY THIS IS A SCRIPT AND NOT A SERIES OF EDITS. There are 751 raw colour sites across 22 files.
 * Migrating them by hand produces a diff nobody can review — 751 individually plausible changes, any
 * one of which could be wrong, with no way to check the whole. Migrating them by TABLE produces a
 * diff of one table plus a mechanical application of it: the table is short enough to read, and if
 * the table is right the application is right.
 *
 * The unmapped remainder is REPORTED, never guessed at. A pair this script does not recognise stays
 * exactly as it is and appears in the output, so the human decision it needs is visible rather than
 * silently made by a regex.
 *
 * WHAT IT DOES TO A className. It groups the colour classes in each class string by property, pairs
 * each light class with its `dark:` partner, and looks the pair up. Matched classes are removed and
 * the token reference is appended, turning
 *
 *     className="mt-4 rounded-lg bg-white p-4 dark:bg-dark-surface"
 *  →  className={`mt-4 rounded-lg p-4 ${SURFACE.card}`}
 *
 * Layout classes keep their order. Only colour moves.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const WRITE = process.argv.includes('--write');

// ═══════════════════════════════════════════════════════════════════════════ THE TABLE
//
// Left: the light class and its dark partner, exactly as they appear in the source.
// Right: the token that replaces them.
//
// Every collapse — two spellings of one intent mapping to one token — is a deliberate decision and
// is listed in the WP-4.1 record. The commonest: `dark:text-white` and `dark:text-slate-50` were
// both used for headings; `dark:bg-dark-surface`, `dark:bg-neutral-900`, `dark:bg-neutral-950` and
// `dark:bg-neutral-700` were all used for the card surface.

const PAIRS = {
  // ── text ────────────────────────────────────────────────────────────────────────
  'text-slate-900|text-white': 'TEXT.heading',
  'text-slate-900|text-slate-50': 'TEXT.heading',
  'text-slate-900|text-slate-100': 'TEXT.heading',
  'text-slate-800|text-slate-100': 'TEXT.heading',
  'text-slate-700|text-slate-200': 'TEXT.body',
  'text-slate-700|text-slate-100': 'TEXT.body',
  'text-slate-600|text-slate-300': 'TEXT.secondary',
  'text-slate-500|text-slate-400': 'TEXT.muted',
  'text-slate-500|text-slate-300': 'TEXT.muted',
  'text-slate-400|text-neutral-500': 'TEXT.muted',
  'text-slate-400|text-neutral-600': 'TEXT.muted',
  'text-slate-600|text-slate-200': 'TEXT.secondary',
  'text-white|text-slate-900': 'TEXT.inverse',

  // ── surfaces ────────────────────────────────────────────────────────────────────
  'bg-slate-50|bg-app-dark': 'SURFACE.page',
  'bg-slate-50|bg-neutral-950': 'SURFACE.page',
  'bg-white|bg-dark-surface': 'SURFACE.card',
  'bg-white|bg-neutral-900': 'SURFACE.card',
  'bg-white|bg-neutral-950': 'SURFACE.card',
  'bg-white|bg-neutral-700': 'SURFACE.card',
  'bg-slate-50|bg-neutral-900': 'SURFACE.page',
  'bg-slate-100|bg-neutral-800': 'SURFACE.sunken',
  'bg-slate-100|bg-neutral-900': 'SURFACE.sunken',
  'bg-slate-200|bg-neutral-700': 'SURFACE.raised',
  'bg-slate-200|bg-neutral-800': 'SURFACE.sunken',
  'bg-slate-300|bg-neutral-700': 'SURFACE.raised',
  'bg-slate-900|bg-slate-100': 'SURFACE.inverse',

  // ── borders ─────────────────────────────────────────────────────────────────────
  'border-slate-300|border-neutral-700': 'BORDER.hairline',
  'border-slate-200|border-neutral-800': 'BORDER.subtle',
  'border-slate-100|border-neutral-800': 'BORDER.subtle',

  // ── accent (blue), and sky collapsing into it ───────────────────────────────────
  'text-blue-700|text-blue-200': 'ACCENT.text',
  'text-blue-700|text-blue-300': 'ACCENT.text',
  'text-blue-700|text-blue-400': 'ACCENT.text',
  'text-blue-600|text-blue-300': 'ACCENT.text',
  'text-sky-700|text-sky-200': 'ACCENT.text',
  'bg-blue-50|bg-blue-950': 'ACCENT.surface',
  'bg-sky-50|bg-sky-950': 'ACCENT.surface',
  'bg-blue-100|bg-blue-950': 'ACCENT.surfaceStrong',
  'bg-sky-100|bg-sky-950': 'ACCENT.surfaceStrong',
  'border-blue-600|border-blue-400': 'ACCENT.border',
  'border-blue-400|border-blue-700': 'ACCENT.border',
  'border-blue-200|border-blue-900': 'ACCENT.borderSubtle',
  'border-blue-300|border-blue-900': 'ACCENT.borderSubtle',
  'border-sky-200|border-sky-900': 'ACCENT.borderSubtle',

  // ── semantic: danger ────────────────────────────────────────────────────────────
  'text-red-600|text-red-300': 'ROLE_TEXT.danger',
  'text-red-700|text-red-200': 'ROLE_TEXT.danger',
  'text-red-700|text-red-300': 'ROLE_TEXT.danger',
  'bg-red-50|bg-red-950': 'ROLE_SURFACE_BG.danger',
  'bg-red-100|bg-red-950': 'ROLE_SURFACE_BG.danger',
  'border-red-600|border-red-500': 'ROLE_BORDER.danger',
  'border-red-300|border-red-900': 'ROLE_BORDER.danger',
  'border-red-500|border-red-400': 'ROLE_BORDER.danger',

  // ── semantic: advisory (amber), with orange collapsing into it — PD-006 ─────────
  'text-amber-700|text-amber-300': 'ROLE_TEXT.advisory',
  'text-amber-900|text-amber-100': 'ROLE_TEXT.advisory',
  'text-orange-800|text-orange-200': 'ROLE_TEXT.advisory',
  'bg-amber-50|bg-amber-950': 'ROLE_SURFACE_BG.advisory',
  'bg-amber-100|bg-amber-950': 'ROLE_SURFACE_BG.advisory',
  'bg-orange-50|bg-orange-950': 'ROLE_SURFACE_BG.advisory',
  'bg-orange-100|bg-orange-950': 'ROLE_SURFACE_BG.advisory',
  'border-amber-600|border-amber-500': 'ROLE_BORDER.advisory',
  'border-amber-300|border-amber-800': 'ROLE_BORDER.advisory',
  'border-amber-500|border-amber-400': 'ROLE_BORDER.advisory',
  'border-orange-500|border-orange-400': 'ROLE_BORDER.advisory',
  'border-orange-200|border-orange-900': 'ROLE_BORDER.advisory',

  // ── promo (violet) — chrome, not a semantic role ────────────────────────────────
  'text-violet-800|text-violet-200': 'PROMO.text',
  'text-violet-700|text-violet-300': 'PROMO.textSubtle',
  'bg-violet-50|bg-violet-950': 'PROMO.surface',
  'border-violet-200|border-violet-900': 'PROMO.border',

  // ── semantic: positive ──────────────────────────────────────────────────────────
  'text-green-700|text-green-300': 'ROLE_TEXT.positive',
  'text-green-700|text-green-200': 'ROLE_TEXT.positive',
  'text-green-800|text-green-200': 'ROLE_TEXT.positive',
  'bg-green-50|bg-green-950': 'ROLE_SURFACE_BG.positive',
  'bg-green-100|bg-green-950': 'ROLE_SURFACE_BG.positive',
  'border-green-600|border-green-500': 'ROLE_BORDER.positive',
  'border-green-300|border-green-800': 'ROLE_BORDER.positive',
  'border-green-500|border-green-400': 'ROLE_BORDER.positive',
  // Written light-500 / dark-600 in one screen — the inverse of the usual direction, and still the
  // same intent. Mapping it here is what makes the two spellings stop being two decisions.
  'border-green-500|border-green-600': 'ROLE_BORDER.positive',
};

/** Dark-only classes: a container that re-declares the ground for dark mode and nothing else. */
const DARK_SINGLES = {
  'bg-app-dark': 'SURFACE.pageDarkOnly',
};

/** Classes with no dark partner that still map cleanly on their own. */
const SINGLES = {
  'text-white': 'TEXT.onAccent',
  'bg-blue-600': 'ACCENT.solid',
  'bg-violet-600': 'PROMO.solid',
};

// ═══════════════════════════════════════════════════════════════════════════ mechanics

const HUES = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PROPS = 'bg|text|border|ring|shadow|from|to|via|decoration|placeholder|divide|outline|accent|caret|fill|stroke';
const IS_COLOUR = new RegExp('^(?:dark:)?(?:' + PROPS + ')-(?:(?:' + HUES + ')-\\d{2,3}|white|black|app-dark|dark-surface)$');

const walk = (dir, acc = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
};

/**
 * Rewrite one class string. Returns { classes, tokens, unmapped } where `classes` is what remains
 * and `tokens` are the token references to append.
 */
export const rewriteClassString = (raw) => {
  const parts = raw.split(/\s+/).filter(Boolean);
  const colour = parts.filter((p) => IS_COLOUR.test(p));
  if (colour.length === 0) return null;

  const byProp = new Map();
  for (const c of colour) {
    const bare = c.replace(/^dark:/, '');
    const prop = bare.split('-')[0];
    if (!byProp.has(prop)) byProp.set(prop, { light: [], dark: [] });
    (c.startsWith('dark:') ? byProp.get(prop).dark : byProp.get(prop).light).push(bare);
  }

  const consumed = new Set();
  const tokens = [];
  const unmapped = [];

  for (const [, g] of byProp) {
    if (g.light.length === 1 && g.dark.length === 1) {
      const key = g.light[0] + '|' + g.dark[0];
      if (PAIRS[key]) {
        tokens.push(PAIRS[key]);
        consumed.add(g.light[0]);
        consumed.add('dark:' + g.dark[0]);
      } else unmapped.push(key);
    } else if (g.light.length === 1 && g.dark.length === 0) {
      if (SINGLES[g.light[0]]) { tokens.push(SINGLES[g.light[0]]); consumed.add(g.light[0]); }
      else unmapped.push(g.light[0] + '|(no dark)');
    } else if (g.light.length === 0 && g.dark.length === 1) {
      if (DARK_SINGLES[g.dark[0]]) { tokens.push(DARK_SINGLES[g.dark[0]]); consumed.add('dark:' + g.dark[0]); }
      else unmapped.push('(no light)|' + g.dark[0]);
    } else {
      unmapped.push(g.light.join(',') + '|' + g.dark.join(','));
    }
  }

  if (tokens.length === 0) return { classes: parts, tokens: [], unmapped };
  return { classes: parts.filter((p) => !consumed.has(p)), tokens, unmapped };
};

// ═══════════════════════════════════════════════════════════════════════════ run

const files = walk(join(ROOT, 'src')).filter((f) => !/theme[\\/]tokens\.ts$/.test(f));

/**
 * EVERY CLASS-LIKE STRING LITERAL, not just `className="..."`.
 *
 * The first version only looked at className attributes, and it merged both branches of
 *
 *     className={`… ${isActive ? 'border-blue-600 bg-blue-100 dark:…' : 'border-slate-300 …'}`}
 *
 * into one soup of four background classes, which mapped to nothing and got reported as unmappable.
 * The branches are ordinary string literals; so are the values of class maps like VERDICT_CLASSES.
 * Matching literals directly reaches all three, and each is rewritten on its own terms.
 *
 * A literal qualifies only if EVERY whitespace-separated token in it looks like a utility class and
 * at least one is a colour — so a sentence of Hebrew copy that happens to contain a hyphen is never
 * mistaken for a class list.
 */
const LITERAL = /(['"`])((?:[^'"`\\\n]|\\.)*)\1/g;
const CLASS_TOKEN_SHAPE = /^(?:[a-z]+:)*-?[a-z0-9[\]()#%./_-]+$/i;
const looksLikeClassList = (raw) => {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  if (!parts.some((p) => IS_COLOUR.test(p))) return false;
  return parts.every((p) => CLASS_TOKEN_SHAPE.test(p));
};

let changedFiles = 0, changedSites = 0;
const unmappedAll = new Map();

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  const original = readFileSync(abs, 'utf8');
  const crlf = original.includes('\r\n');
  let src = original.replace(/\r\n/g, '\n');
  const used = new Set();
  let sites = 0;

  const next = src.replace(LITERAL, (whole, quote, raw, offset) => {
    if (!looksLikeClassList(raw)) return whole;
    const r = rewriteClassString(raw);
    if (!r) return whole;
    for (const u of r.unmapped) {
      if (!unmappedAll.has(u)) unmappedAll.set(u, new Set());
      unmappedAll.get(u).add(rel);
    }
    if (r.tokens.length === 0) return whole;
    sites += 1;
    for (const t of r.tokens) used.add(t.split('.')[0]);
    const body = [...r.classes, ...r.tokens.map((t) => '${' + t + '}')].join(' ');
    const literal = '`' + body + '`';

    // A JSX ATTRIBUTE VALUE NEEDS BRACES AND AN EXPRESSION DOES NOT.
    //
    // `className="a b"` becomes `className={\`a b ${TOKEN}\`}`, but the same string appearing as a
    // ternary branch or a map value is already inside an expression and must NOT gain braces. The
    // first version emitted a bare template literal for both, producing
    //
    //     className=\`min-h-[48px] … ${PROMO.solid}\`        ← a syntax error
    //
    // in fifteen files at once. Typecheck caught it immediately, which is the whole reason a
    // mechanical migration is run against a compiler rather than eyeballed.
    const before = src.slice(Math.max(0, offset - 40), offset);
    // THE DISTINGUISHING FEATURE IS THAT A JSX ATTRIBUTE HAS NO WHITESPACE AROUND ITS `=`:
    //
    //     className="…"        an attribute — needs braces
    //     const X =\n  "…"     an assignment — must not get them
    //
    // The previous version tested /=\\s*$/ and swept up every multi-line const initialiser,
    // turning `const INPUT_CLASS =` into an object literal. Typecheck caught it in four files.
    const isJsxAttributeValue = /[A-Za-z_$][\w$]*=$/.test(before);
    return isJsxAttributeValue ? '{' + literal + '}' : literal;
  });

  if (sites === 0) continue;
  changedFiles += 1;
  changedSites += sites;

  let out = next;
  if (used.size) {
    const names = [...used].sort();
    const depth = rel.split('/').length - 1;
    const spec = '../'.repeat(depth - 1) + 'theme/tokens';
    const importLine = 'import { ' + names.join(', ') + " } from '" + spec + "';";
    if (!/from '[^']*theme\/tokens'/.test(out)) {
      const m = out.match(/^(import[\s\S]*?;\n)(?!import)/m);
      const lastImport = [...out.matchAll(/^import[^\n]*;\n/gm)].pop();
      if (lastImport) {
        const at = lastImport.index + lastImport[0].length;
        out = out.slice(0, at) + importLine + '\n' + out.slice(at);
      } else if (m) out = out.slice(0, m[0].length) + importLine + '\n' + out.slice(m[0].length);
      else out = importLine + '\n' + out;
    }
  }

  console.log(String(sites).padStart(4) + '  ' + rel + '   [' + [...used].sort().join(', ') + ']');
  if (WRITE) writeFileSync(abs, crlf ? out.replace(/\n/g, '\r\n') : out);
}

console.log('');
console.log((WRITE ? 'APPLIED' : 'WOULD APPLY') + ' — ' + changedSites + ' className site(s) across ' + changedFiles + ' file(s)');
console.log('');
if (unmappedAll.size === 0) console.log('UNMAPPED — none');
else {
  console.log('UNMAPPED — ' + unmappedAll.size + ' pattern(s) left exactly as they are, for a human to decide:');
  for (const [k, fs] of [...unmappedAll.entries()].sort()) {
    console.log('  ' + k.padEnd(52) + [...fs].slice(0, 3).join(', ') + (fs.size > 3 ? ' … +' + (fs.size - 3) : ''));
  }
}
