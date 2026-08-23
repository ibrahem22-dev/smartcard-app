/**
 * GATE: colour-semantics — criterion A8.  →  `COLOUR-SEMANTICS OK`
 *
 *   > **A8.** *"Semantic colour discipline enforced at token level: **red = danger only**, amber =
 *   > advisory/estimate, green = positive verdict only; **no raw colour literal outside the token
 *   > module**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FOUR CHECKS, AND THE FIRST TWO ARE THE ONES A8 ACTUALLY ASKS FOR
 *
 *   1. **No hue outside the token module.** Not "no hex" — a Tailwind class like `text-red-600` is
 *      a colour literal in every sense that matters, and a check that only looked for `#` would
 *      have found 53 sites while 102 others went on naming hues in className strings.
 *   2. **One role per hue, one hue per role.** This is how "red = danger only" becomes checkable.
 *      A static check cannot read intent out of `text-red-600`; it CAN assert that exactly one
 *      named role maps to red and that the role is called danger. The meaning moves into the name,
 *      where a machine can reach it.
 *   3. **The three roles A8 names are all present**, and no fourth SEMANTIC role has appeared.
 *      `neutral` is permitted and is not a fourth judgement: it is the absence of one.
 *   4. **`tailwind.config.js` and the token module agree.** The config defines `app-dark` and
 *      `dark-surface`; CHROME mirrors both. One fact, two homes — so they are compared here, in the
 *      same run, rather than trusted to stay equal.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY NOT CHECKED, said rather than left to be discovered
 *
 * This gate cannot tell whether a `danger` token is applied to something genuinely dangerous. No
 * static check can. It asserts that the only way to reach red is to ask for danger by name — which
 * turns a wrong colour into a wrong WORD in a diff, where a reviewer can see it. A8's other half,
 * that the cue is never colour alone, is criterion A9 and has its own gate.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A8'];
export const SENTINEL = 'COLOUR-SEMANTICS OK';

/** The one module permitted to name a colour. */
export const TOKEN_MODULE = 'src/theme/tokens.ts';

/** Every hue family Tailwind ships. A surface naming ANY of them has named a colour. */
const TAILWIND_HUES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose',
];

const COLOUR_PROPS = 'bg|text|border|ring|shadow|from|to|via|decoration|placeholder|divide|outline|accent|caret|fill|stroke';

const HUE_CLASS = new RegExp('\\b(?:' + COLOUR_PROPS + ')-(?:' + TAILWIND_HUES.join('|') + ')-\\d{2,3}\\b', 'g');
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGBA = /\brgba?\(\s*\d+[^)]*\)/g;
/** `bg-white`, `text-black` and friends — hueless, but still raw colour. */
const BARE_COLOUR = new RegExp('\\b(?:' + COLOUR_PROPS + ')-(?:white|black)\\b', 'g');

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e) && !/\.d\.ts$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

/** Parse a `Readonly<Record<...>>` / `const X = { ... }` map of role → string out of the tokens file. */
const parseMap = (src, name) => {
  const m = src.match(new RegExp('export const ' + name + '[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}'));
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*'([^']*)'/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  const tokensPath = join(root, TOKEN_MODULE);
  if (!existsSync(tokensPath)) {
    return fail(TOKEN_MODULE + ' does not exist. A8 requires colour to have one home, and a gate '
      + 'that passed without one would be asserting discipline over nothing');
  }
  const tokens = readFileSync(tokensPath, 'utf8');

  // ── 1. one role per hue, one hue per role ────────────────────────────────────────
  const roleHue = parseMap(tokens, 'ROLE_HUE');
  const roleMeaning = parseMap(tokens, 'ROLE_MEANING');
  if (!roleHue) return fail('could not read ROLE_HUE out of ' + TOKEN_MODULE);
  if (!roleMeaning) return fail('could not read ROLE_MEANING out of ' + TOKEN_MODULE);

  const roles = Object.keys(roleHue);
  if (roles.length === 0) return fail('ROLE_HUE is empty — a token module defining no roles cannot enforce anything');

  const byHue = new Map();
  for (const [role, hue] of Object.entries(roleHue)) {
    if (!byHue.has(hue)) byHue.set(hue, []);
    byHue.get(hue).push(role);
  }
  for (const [hue, rs] of byHue) {
    if (rs.length > 1) {
      problems.push('the hue ' + hue + ' is claimed by ' + rs.length + ' roles (' + rs.join(', ')
        + ') — A8 says each colour means one thing, and two roles sharing a hue means neither is checkable');
    }
  }
  for (const role of roles) {
    if (!roleMeaning[role]) problems.push('role ' + role + ' has no entry in ROLE_MEANING — a role nobody wrote a meaning for is a hue with a nicer name');
  }

  // ── 2. A8's three roles are present, and no fourth judgement has appeared ─────────
  const REQUIRED = { danger: 'red', advisory: 'amber', positive: 'green' };
  for (const [role, hue] of Object.entries(REQUIRED)) {
    if (!roleHue[role]) problems.push('A8 names the role "' + role + '" and the token module does not define it');
    else if (roleHue[role] !== hue) {
      problems.push('A8 says ' + hue + ' = ' + role + ', and the token module maps ' + role + ' to ' + roleHue[role]);
    }
  }
  const extra = roles.filter((r) => !REQUIRED[r] && r !== 'neutral');
  for (const r of extra) {
    problems.push('the token module defines a fourth semantic role "' + r + '" (' + roleHue[r]
      + '). A8 names three, each with the word "only". A fourth is a contract change, not a design tweak');
  }

  lines.push('roles           ' + roles.length + ' (' + roles.join(', ') + ')');
  for (const r of roles) lines.push('  ' + r.padEnd(9) + roleHue[r].padEnd(7) + roleMeaning[r]);
  lines.push('');

  // ── 3. no colour named outside the token module ──────────────────────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files under src/ — an empty population proves nothing about discipline');

  const offenders = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (rel === TOKEN_MODULE) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const [re, what] of [[HUE_CLASS, 'a Tailwind hue'], [HEX, 'a hex literal'], [RGBA, 'an rgb()/rgba() literal'], [BARE_COLOUR, 'a bare colour class']]) {
      for (const m of code.matchAll(re)) {
        offenders.push({ file: rel, line: lineAt(code, m.index), what, text: m[0] });
      }
    }
  }

  const byFile = new Map();
  for (const o of offenders) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
  lines.push('population      ' + files.length + ' files under src/**, ' + TOKEN_MODULE + ' exempt');
  lines.push('raw colour      ' + offenders.length + ' outside the token module, in ' + byFile.size + ' file(s)');
  for (const [f, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    lines.push('    ' + String(n).padStart(4) + '  ' + f);
  }
  if (byFile.size > 12) lines.push('    … and ' + (byFile.size - 12) + ' more file(s)');

  for (const o of offenders.slice(0, 6)) {
    problems.push(o.file + ':' + o.line + ' names ' + o.what + ' (' + o.text + ') outside ' + TOKEN_MODULE);
  }
  if (offenders.length > 6) problems.push('… and ' + (offenders.length - 6) + ' more raw colour site(s)');

  // ── 4. the tailwind config and the token module agree ────────────────────────────
  const twPath = join(root, 'tailwind.config.js');
  if (!existsSync(twPath)) {
    problems.push('tailwind.config.js is missing — the custom colours it defines have no counterpart to compare against');
  } else {
    const tw = readFileSync(twPath, 'utf8');
    const declared = [...tw.matchAll(/'([a-z-]+)':\s*'(#[0-9a-fA-F]{3,8})'/g)].map((m) => ({ name: m[1], hex: m[2].toUpperCase() }));
    if (declared.length === 0) {
      problems.push('tailwind.config.js declares no custom colours — either it moved or this check is reading the wrong file, and both are worth stopping for');
    }
    const chrome = [...tokens.matchAll(/^\s*([A-Za-z][\w]*):\s*'(#[0-9a-fA-F]{3,8})'/gm)].map((m) => m[2].toUpperCase());
    for (const d of declared) {
      if (!chrome.includes(d.hex)) {
        problems.push('tailwind.config.js defines ' + d.name + ' = ' + d.hex + ' and no CHROME token carries that value — '
          + 'one fact with two homes and nothing comparing them');
      }
    }
    lines.push('');
    lines.push('tailwind        ' + declared.length + ' custom colour(s) declared, all mirrored in CHROME');
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'COLOUR-SEMANTICS OK — ' + roles.length + ' roles, 1 definition, 0 raw colour outside it',
  };
};
