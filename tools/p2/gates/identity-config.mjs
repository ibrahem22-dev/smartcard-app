/**
 * GATE: identity-config — criterion A10.  →  `IDENTITY-CONFIG OK — 1 source`
 *
 *   > **A10.** *"App identifier, bundle id, display name and asset references are configurable in
 *   > **one** place (OD-2 rider)."*
 *
 *   > **OD-2.** *"Final public branding · DEFERRED… Requirement so the deferral stays free: keep
 *   > app identifier, bundle id, display name and asset references configurable in one place from
 *   > P2 onward. The existing app uses `com.smartcard.app` — acceptable as a working value; **do
 *   > not scatter the string through source**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CHECK IS "HOW MANY PLACES", DERIVED
 *
 * Not "does a config file exist" — one existing beside four hardcoded copies is worse than none,
 * because it looks like the problem is solved. So the gate takes each identity VALUE out of
 * `identity.json` and counts where else it appears in the tree.
 *
 * That is why it can fail: it does not look for a pattern somebody might write, it looks for the
 * actual strings. `com.smartcard.app` in a second file is found whatever the file is called and
 * whatever the variable around it is named.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS ALLOWED TO CONTAIN THE NAME, and why each is not a scattering
 *
 *   · `identity.json`      — the source.
 *   · `app.config.js`      — reads it. Expo's loader runs in plain Node before TypeScript exists,
 *                            so this is the only way one file can serve both worlds.
 *   · `src/config/identity.ts` — the app's view, importing the same JSON.
 *   · `package.json`       — npm's own `name` field, which is not the product's display name and
 *                            cannot be, since npm names are lowercase and slug-shaped.
 *   · `src/i18n/*.ts`      — sentences containing `{{app}}`, never the name itself. The gate checks
 *                            that: a translation with the literal name embedded is a scattering
 *                            wearing a translation's clothes.
 *
 * A STATIC `app.json` IS ITSELF A SCATTERING, which is why the gate fails if one exists. It used to
 * hold the display name, slug, scheme, bundle identifier and Android package as literals.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A10'];
export const SENTINEL = 'IDENTITY-CONFIG OK — 1 source';

const SOURCE = 'identity.json';
const EXPO_CONFIG = 'app.config.js';
const VIEW = 'src/config/identity.ts';

/** Files permitted to contain an identity value, and why. */
const PERMITTED = new Map([
  [SOURCE, 'the source'],
  [EXPO_CONFIG, "reads the source; Expo's loader runs before TypeScript exists"],
  [VIEW, "the app's view of the same file"],
  ['package.json', "npm's own name field — lowercase and slug-shaped, not the display name"],
]);

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== 'node_modules') walk(p, acc); }
    else if (/\.(ts|tsx|js|jsx|json)$/.test(e)) acc.push(p);
  }
  return acc;
};

/**
 * A COMMENT IS NOT A SCATTERING — the third time this campaign has met this exact shape.
 *
 * D3's symbol check fired on the comments explaining its own removal. The RTL scan reported the
 * sentence saying why a component avoids a hardcoded row direction. And this gate reported
 *
 *     // Supports deep link: smartcard://purchase?amount=500&category=grocery
 *
 * as the product slug scattered into source. Documentation that names the thing it documents is
 * the most ordinary sentence there is, and a check that punishes it pushes a codebase toward
 * deleting its own explanations.
 */
/**
 * LENGTH-PRESERVING, so the line numbers stay true.
 *
 * The ordinary version replaces a comment with a single space, which shifts every offset after it —
 * and this gate reported `src/security/keyVault.ts:258` for a string that is nowhere near line 258.
 * A finding that points at the wrong line is worse than no finding: somebody opens the file, sees
 * unrelated code, and concludes the gate is noise.
 *
 * Newlines are kept and everything else becomes a space, so offsets and line counts are unchanged.
 */
const blank = (text) => text.replace(/[^\n]/g, ' ');
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, before, comment) => before + blank(comment));

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, SOURCE))) {
    return fail(SOURCE + ' does not exist. A10 asks for ONE place, and a gate that passed without '
      + 'one would be counting to one from zero');
  }
  if (existsSync(join(root, 'app.json'))) {
    problems.push('app.json still exists. A static Expo config holds the display name, slug, scheme '
      + 'and bundle identifier as literals — it is one of the places OD-2 says not to scatter them '
      + 'to. ' + EXPO_CONFIG + ' builds the same config from ' + SOURCE);
  }
  for (const rel of [EXPO_CONFIG, VIEW]) {
    if (!existsSync(join(root, rel))) problems.push(rel + ' is missing — ' + PERMITTED.get(rel));
  }

  const identity = JSON.parse(readFileSync(join(root, SOURCE), 'utf8'));

  // The values A10 names, derived from the source rather than listed here.
  const values = Object.entries(identity)
    .filter(([k, v]) => !k.startsWith('$') && typeof v === 'string' && v.length >= 4)
    .map(([k, v]) => ({ field: k, value: v }));
  if (values.length === 0) {
    return fail(SOURCE + ' declares no identity values — an empty source is not one place, it is none');
  }

  // A10 names four things. Each must actually be in the source.
  for (const required of ['displayName', 'bundleIdentifier', 'androidPackage']) {
    if (!identity[required]) problems.push(SOURCE + ' has no "' + required + '" — A10 names it');
  }
  if (!identity.assets || Object.keys(identity.assets).filter((k) => !k.startsWith('$')).length === 0) {
    problems.push(SOURCE + ' declares no asset references — A10 names them alongside the identifiers');
  }

  // ── where else does each value appear? ───────────────────────────────────────────
  const files = walk(root + '/src').concat(
    ['app.config.js', 'package.json', 'identity.json', 'tailwind.config.js', 'jest.config.cjs']
      .map((f) => join(root, f)).filter((p) => existsSync(p)),
  );
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');

  const scatter = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (PERMITTED.has(rel)) continue;
    // JSON carries no comments, so stripping is only meaningful for source files.
    const raw = readFileSync(abs, 'utf8');
    const src = rel.endsWith('.json') ? raw : stripComments(raw);
    for (const { field, value } of values) {
      let i = src.indexOf(value);
      while (i !== -1) {
        scatter.push({ file: rel, line: lineAt(src, i), field, value });
        break;
      }
    }
  }

  for (const s of scatter.slice(0, 6)) {
    problems.push(s.file + ':' + s.line + ' contains the ' + s.field + ' "' + s.value + '" — OD-2: '
      + 'do not scatter the string through source. Read it from ' + VIEW);
  }
  if (scatter.length > 6) problems.push('… and ' + (scatter.length - 6) + ' more site(s)');

  lines.push('source          ' + SOURCE + ' · ' + values.length + ' identity value(s)');
  for (const { field, value } of values) lines.push('  ' + field.padEnd(20) + value);
  lines.push('');
  lines.push('consumers       ' + [...PERMITTED.keys()].filter((f) => existsSync(join(root, f))).join(', '));
  lines.push('population      ' + files.length + ' file(s) searched for the values themselves · found '
    + scatter.length + ' outside the permitted set');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
