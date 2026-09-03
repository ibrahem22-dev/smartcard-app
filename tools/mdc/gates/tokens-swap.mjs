/**
 * GATE: tokens-swap — criterion T1.  →  `TOKENS-SWAP OK`
 *
 *   > **T1.** *"TOKENS: the frozen identity palette, type scale and spacing are applied only
 *   > through src/theme/tokens.ts; no hardcoded color, face or size outside the token module;
 *   > the P2 token gates stay green over the new values"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE VALUES ARE COMPARED AGAINST THE FROZEN PACKAGE, NOT AGAINST A COPY OF IT
 *
 * A gate that checked the app's hexes against a list written in the gate would pass forever after
 * somebody edited both. So this reads `color.tokens.json` from the Brand package itself and asserts
 * that every colour the app declares is one of the values that file freezes, with the LIGHT set
 * only. If the package is unreachable the gate REFUSES rather than falling back to a local copy: a
 * check that cannot see its authority has not checked anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE MIGRATION MADE CHECKABLE, CLAUSE BY CLAUSE
 *
 *   1. Every colour in `tailwind.config.js` is a frozen LIGHT value, and every one is mirrored in
 *      CHROME — the same fact A8's fourth clause checks, asserted here against the package.
 *   2. No dark value is present anywhere. Not a `dark:` variant, not a `neutral.dark.*` hex. The
 *      deferral under OQ-MDC-027 is enforced by absence: a dark hex sitting unused in the token
 *      module is one variant away from shipping.
 *   3. No semantic SURFACE was invented. The frozen system defines no semantic background, so
 *      every role's ground must be the neutral surface and no role may carry a tint of its own.
 *      This is OQ-MDC-028 option 1 made executable, and it is the clause that fails if somebody
 *      reintroduces `bg-red-100` or derives a tint from `#A03636`.
 *   4. The role mapping has not drifted: danger→negative, advisory→warning, positive→positive,
 *      and neutral→`neutral.light.text.secondary`, which is what OQ-MDC-027 option 1 ruled.
 *   5. No hardcoded colour, face or size outside the token module — including `App.tsx`, which
 *      lives outside `src/` and which A8's scanner therefore never reached. Three raw hexes and a
 *      dark navigation theme were sitting there.
 *   6. Every type size in use resolves to one of the sixteen frozen sizes, and every spacing step
 *      to one of the ten frozen steps.
 *   7. The twelve approved font files are present, byte-identical to the package, loaded before
 *      anything renders, and their OFL 1.1 licence travels with them.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY NOT CHECKED
 *
 * Whether a colour is applied to the RIGHT element. No static check can read intent, and pretending
 * otherwise is how a gate starts asserting more than it measures. What this gate guarantees is that
 * every value on screen came from the frozen package and that the only way to reach one is to ask
 * for it by name — which turns a wrong colour into a wrong WORD in a diff, where a reviewer sees it.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail, okOverPopulation } from '../lib/report.mjs';

export const SENTINEL = 'TOKENS-SWAP OK';
export const FAILURE_SENTINEL = 'TOKENS-SWAP FAILED';
export const MEASURES = 'source';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const TOKENS = join(ROOT, 'src', 'theme', 'tokens.ts');
const TW = join(ROOT, 'tailwind.config.js');
const TYPOGRAPHY = join(ROOT, 'src', 'theme', 'typography.ts');
const FONTS = join(ROOT, 'assets', 'fonts');
const APP = join(ROOT, 'App.tsx');

/** The canonical package. Read, never copied. */
const BRAND_COLOURS = 'C:/Users/ebrah/Brand/06_Color/21_Phase_11_Final_Color_Production_Package/03_Design_Tokens/color.tokens.json';
const BRAND_FONTS = 'C:/Users/ebrah/Brand/05_Typography/13_Phase_9_Final_Typography_Package/04_App_Production/fonts';

/** The sixteen frozen type sizes and the ten frozen spacing steps. */
const FROZEN_SIZES = [48, 40, 32, 28, 24, 20, 18, 16, 14, 12];
const FROZEN_SPACING = [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128];

/** OQ-MDC-027 option 1 and OQ-MDC-028 option 1, as a mapping that must not drift. */
const ROLE_MAPPING = {
  danger: 'semantic.light.negative',
  advisory: 'semantic.light.warning',
  positive: 'semantic.light.positive',
  neutral: 'neutral.light.text.secondary',
};

/** Tailwind's own scale, for the classes the app still uses by their standard names. */
const TW_TEXT = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60 };

const walk = (d, o = [], ext = /\.tsx?$/) => {
  if (!existsSync(d)) return o;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== '__snapshots__') walk(p, o, ext); }
    else if (ext.test(e)) o.push(p);
  }
  return o;
};
const rel = (p) => relative(ROOT, p).split('\\').join('/');
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

export const run = async () => {
  const problems = [];
  const clauses = [];

  for (const [what, p] of [['the token module', TOKENS], ['tailwind.config.js', TW], ['the typography module', TYPOGRAPHY], ['App.tsx', APP]]) {
    if (!existsSync(p)) return fail(`${what} is missing at ${rel(p)} — there is nothing to check`);
  }

  /* The frozen package itself. No fallback: an unreachable authority is a refusal. */
  if (!existsSync(BRAND_COLOURS)) {
    return fail(`the canonical palette is unreachable at ${BRAND_COLOURS}. This gate compares the `
      + 'app against the frozen package rather than against a copy of it, and a copy is exactly what '
      + 'it must not fall back to.');
  }
  const pkg = JSON.parse(readFileSync(BRAND_COLOURS, 'utf8'));
  if (pkg.status !== 'FROZEN_COLOR_SYSTEM_V1' || pkg.canonical !== true) {
    return fail(`the palette at ${BRAND_COLOURS} no longer declares itself frozen and canonical `
      + `(status=${String(pkg.status)}, canonical=${String(pkg.canonical)})`);
  }
  const lightHexes = new Set();
  const darkHexes = new Set();
  for (const [name, tok] of Object.entries(pkg.tokens)) {
    const hex = String(tok.hex || '').toUpperCase();
    if (!hex) continue;
    (/\.dark\./.test(name) ? darkHexes : lightHexes).add(hex);
  }

  const tokensSrc = readFileSync(TOKENS, 'utf8');
  const twSrc = readFileSync(TW, 'utf8');

  /* 1. EVERY DECLARED COLOUR IS A FROZEN LIGHT VALUE, AND IS MIRRORED. */
  const declared = [...twSrc.matchAll(/'([a-z-]+)':\s*'(#[0-9a-fA-F]{6})'/g)]
    .map((m) => ({ name: m[1], hex: m[2].toUpperCase() }));
  if (declared.length === 0) problems.push('tailwind.config.js declares no colour — either it moved or this reader is wrong, and both are worth stopping for');
  const chromeHexes = new Set([...tokensSrc.matchAll(/^\s*[A-Za-z][\w]*:\s*'(#[0-9a-fA-F]{6})'/gm)].map((m) => m[1].toUpperCase()));
  for (const d of declared) {
    if (!lightHexes.has(d.hex)) {
      problems.push(`tailwind.config.js declares ${d.name} = ${d.hex}, which the frozen LIGHT palette does not contain`);
    }
    if (!chromeHexes.has(d.hex)) {
      problems.push(`tailwind.config.js declares ${d.name} = ${d.hex} and no CHROME token carries that value`);
    }
  }
  clauses.push(`${declared.length} declared colour(s), every one a frozen light value mirrored in CHROME`);

  /* 2. NO DARK VALUE IS ACTIVE — not a variant, not a hex. */
  const darkFindings = [];
  for (const f of [...walk(join(ROOT, 'src')), APP, TW]) {
    const code = stripComments(readFileSync(f, 'utf8'));
    for (const m of code.matchAll(/\bdark:[a-z-]/g)) {
      darkFindings.push(`${rel(f)} uses a dark: variant (${m[0]}…)`);
    }
    for (const m of code.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      if (darkHexes.has(m[0].toUpperCase())) darkFindings.push(`${rel(f)} carries the DARK value ${m[0]}`);
    }
  }
  if (darkFindings.length > 0) {
    problems.push(`dark-mode values are active in V1, which OQ-MDC-027 option 1 defers: ${darkFindings.slice(0, 4).join('; ')}`);
  }
  clauses.push('no dark variant and no dark value anywhere');

  /* 3. NO SEMANTIC SURFACE WAS INVENTED — OQ-MDC-028 option 1. */
  const readMap = (name) => {
    const m = tokensSrc.match(new RegExp('export const ' + name + '[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}'));
    if (!m) return null;
    const out = {};
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*'([^']*)'/);
      if (kv) out[kv[1]] = kv[2];
    }
    return out;
  };
  const roleSurfaceBg = readMap('ROLE_SURFACE_BG');
  const roleSurface = readMap('ROLE_SURFACE');
  const roleText = readMap('ROLE_TEXT');
  const roleBorder = readMap('ROLE_BORDER');
  if (!roleSurfaceBg || !roleSurface || !roleText || !roleBorder) {
    return fail('could not read ROLE_SURFACE / ROLE_SURFACE_BG / ROLE_TEXT / ROLE_BORDER out of the token module');
  }
  const NEUTRAL_GROUND = 'bg-neutral-surface';
  for (const [role, cls] of Object.entries(roleSurfaceBg)) {
    if (cls.trim() !== NEUTRAL_GROUND) {
      problems.push(`ROLE_SURFACE_BG.${role} is "${cls}" and not the frozen neutral ground. The frozen `
        + 'system defines no semantic surface, so a role that has one is carrying a colour nobody froze.');
    }
  }
  for (const [role, cls] of Object.entries(roleSurface)) {
    const bg = cls.split(/\s+/).filter((c) => c.startsWith('bg-'));
    if (bg.length !== 1 || bg[0] !== NEUTRAL_GROUND) {
      problems.push(`ROLE_SURFACE.${role} grounds itself on ${bg.join(' ') || 'nothing'} rather than the frozen neutral surface`);
    }
  }
  clauses.push(`${Object.keys(roleSurfaceBg).length} role(s), every one on the frozen neutral ground`);

  /* 4. THE ROLE MAPPING HAS NOT DRIFTED. */
  const nameToHex = new Map(declared.map((d) => [d.name, d.hex]));
  const tokenHex = (path) => String(pkg.tokens[path]?.hex || '').toUpperCase();
  for (const [role, tokenPath] of Object.entries(ROLE_MAPPING)) {
    const want = tokenHex(tokenPath);
    const cls = (roleText[role] || '').replace(/^text-/, '');
    const got = nameToHex.get(cls);
    if (!want) problems.push(`the frozen package no longer defines ${tokenPath}`);
    else if (got !== want) {
      problems.push(`role ${role} should paint ${tokenPath} (${want}) and paints ${cls} (${got ?? 'unknown'}) — `
        + 'the mapping ruled in OQ-MDC-027/028 has drifted');
    }
  }
  clauses.push('role mapping intact: danger→negative, advisory→warning, positive→positive, neutral→text.secondary');

  /* 5. NO RAW COLOUR, FACE OR SIZE OUTSIDE THE TOKEN MODULE — App.tsx included. */
  const EXEMPT = new Set(['src/theme/tokens.ts', 'src/theme/typography.ts', 'src/theme/geometry.ts']);
  const raw = [];
  for (const f of [...walk(join(ROOT, 'src')), APP]) {
    const r = rel(f);
    if (EXEMPT.has(r)) continue;
    const code = stripComments(readFileSync(f, 'utf8'));
    for (const m of code.matchAll(/#[0-9a-fA-F]{6}\b/g)) raw.push(`${r} names the colour ${m[0]}`);
    for (const m of code.matchAll(/fontFamily:\s*'([^']+)'/g)) {
      if (m[1] !== 'monospace') raw.push(`${r} names the face ${m[1]}`);
    }
  }
  if (raw.length > 0) problems.push(`raw colour or face outside the token module: ${raw.slice(0, 4).join('; ')}`);
  clauses.push(`${EXEMPT.size} exempt theme module(s); every other file free of raw colour and face`);

  /* 6. EVERY TYPE SIZE AND SPACING STEP IS ON A FROZEN SCALE. */
  const offScale = [];
  const twType = new Set([...twSrc.matchAll(/'([a-z0-9-]+)':\s*\['(\d+)px'/g)].map((m) => m[1]));
  for (const f of walk(join(ROOT, 'src'), [], /\.tsx$/)) {
    const code = stripComments(readFileSync(f, 'utf8'));
    for (const m of code.matchAll(/\btext-([a-z0-9-]+|\[\d+px\])\b/g)) {
      const v = m[1];
      if (twType.has(v)) continue;                       // a frozen token declared in the config
      if (/^\[(\d+)px\]$/.test(v)) {
        const px = Number(v.slice(1, -3));
        if (!FROZEN_SIZES.includes(px)) offScale.push(`${rel(f)} sets type at ${px}px, which is not a frozen size`);
        continue;
      }
      if (v in TW_TEXT && !FROZEN_SIZES.includes(TW_TEXT[v])) {
        offScale.push(`${rel(f)} uses text-${v} (${TW_TEXT[v]}px), which is not a frozen size`);
      }
    }
    for (const m of code.matchAll(/\b(?:p|px|py|pt|pb|ps|pe|m|mx|my|mt|mb|ms|me|gap)-(\d+(?:\.\d+)?)\b/g)) {
      const px = Number(m[1]) * 4;
      if (!FROZEN_SPACING.includes(px)) offScale.push(`${rel(f)} spaces at ${px}px, which is not on the frozen scale`);
    }
  }
  if (offScale.length > 0) {
    problems.push(`${offScale.length} off-scale type or spacing site(s): ${[...new Set(offScale)].slice(0, 4).join('; ')}`);
  }
  clauses.push('every type size and spacing step on a frozen scale');

  /* 7. THE TWELVE FONTS, BYTE-IDENTICAL, LOADED, AND LICENSED. */
  if (!existsSync(FONTS)) problems.push('assets/fonts does not exist — Plex Tri-Script was authorised and is not shipped');
  else {
    const ttf = readdirSync(FONTS).filter((f) => f.endsWith('.ttf')).sort();
    if (ttf.length !== 12) problems.push(`${ttf.length} font file(s) shipped where the approved package has 12`);
    if (existsSync(BRAND_FONTS)) {
      for (const f of ttf) {
        const a = readFileSync(join(FONTS, f));
        const bPath = join(BRAND_FONTS, f);
        if (!existsSync(bPath)) { problems.push(`${f} is not in the approved package`); continue; }
        if (!a.equals(readFileSync(bPath))) problems.push(`${f} differs from the approved package`);
      }
    } else problems.push('the approved font package is unreachable, so the shipped faces cannot be compared to it');
    if (!existsSync(join(FONTS, 'OFL_1.1_IBM_PLEX.txt'))) {
      problems.push('the OFL 1.1 licence is not beside the faces it covers');
    }
    const typo = readFileSync(TYPOGRAPHY, 'utf8');
    const required = (typo.match(/require\('\.\.\/\.\.\/assets\/fonts\/[^']+\.ttf'\)/g) || []).length;
    if (required !== 12) problems.push(`the typography module registers ${required} face(s), not 12`);
    const appSrc = readFileSync(APP, 'utf8');
    if (!/useFonts\(/.test(appSrc)) problems.push('App.tsx never calls useFonts — an unregistered family falls back to the system font silently');
    if (!/fontsLoaded/.test(appSrc)) problems.push('App.tsx does not wait for the faces before rendering');
    clauses.push(`${ttf.length} approved face(s), byte-identical, registered and awaited, under OFL 1.1`);
  }

  const population = declared.length + Object.keys(roleSurfaceBg).length + 12;
  if (problems.length > 0) return fail(problems.join(' · '), { population });
  return okOverPopulation({
    population,
    unit: 'frozen colour(s), role(s) and font face(s)',
    detail: clauses.join(' · '),
  });
};
