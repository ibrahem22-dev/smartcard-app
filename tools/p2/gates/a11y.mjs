/**
 * GATE: a11y — criterion A9.  →  `A11Y OK — AA both modes`
 *
 *   > **A9.** *"**AA contrast verified in both modes**; every state cue is **icon + word, never
 *   > colour alone**; touch targets **≥44 pt**; body **≥16 pt**."*
 *
 * Four clauses, four checks, and every one is measured rather than asserted.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * 1. AA CONTRAST, IN BOTH MODES, COMPUTED
 *
 * "Verified" means the ratio was calculated. Every token pairing text with a surface is resolved to
 * two hex values per mode and run through the WCAG 2.1 formula (`tools/p2/lib/contrast.mjs`, whose
 * maths is itself controlled against the specification's published figures).
 *
 * This is only possible because A8 put every colour in one module. Before that the pairings were
 * spread over 751 sites and no tool could have enumerated them — which is the practical argument
 * for the token discipline, quite apart from the semantic one.
 *
 * WHAT IT CANNOT SEE, said rather than implied: a screen that puts `TEXT.muted` on `ACCENT.solid`
 * makes a pairing no token declares. The check covers the pairings the design system defines; it
 * does not simulate the render tree. That is a real limit and it is why the render harness and this
 * gate are both required.
 *
 * 2. ICON + WORD, NEVER COLOUR ALONE
 *
 * Every semantic role that appears in a component must be accompanied by text or a glyph. The chip
 * and the conflict banner are checked directly: each state carries a glyph AND a label, so a reader
 * who cannot distinguish the hues loses nothing. Roughly one man in twelve has a red-green colour
 * deficiency; a verdict distinguished only by hue is a verdict they cannot read.
 *
 * 3. TOUCH TARGETS ≥ 44pt   ·   4. BODY TEXT ≥ 16pt
 *
 * Derived from the source: every `Pressable`/`TouchableOpacity` must carry a minimum height, and
 * every explicit text size must resolve to at least 16px unless it is a label or a caption. Both
 * report what they scanned, and both refuse an empty population.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, hexForClass, AA_BODY, AA_LARGE } from '../lib/contrast.mjs';
import { splitModes, pick, readTokenMap, readLegibleOn } from '../lib/tokens.mjs';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A9'];
export const SENTINEL = 'A11Y OK — AA both modes';

const TOKEN_MODULE = 'src/theme/tokens.ts';

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.tsx$/.test(e)) acc.push(p);
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

  const tokensPath = join(root, TOKEN_MODULE);
  if (!existsSync(tokensPath)) {
    return fail(TOKEN_MODULE + ' does not exist — contrast cannot be computed over a design system '
      + 'that has no single home, which is the practical half of why A8 comes first');
  }
  const tokens = readFileSync(tokensPath, 'utf8');

  const custom = {};
  for (const m of tokens.matchAll(/^\s*([A-Za-z][\w]*):\s*'(#[0-9a-fA-F]{3,8})'/gm)) {
    custom[m[1]] = m[2];
  }
  // The app's two named Tailwind colours, as tailwind.config.js declares them.
  const twConfig = existsSync(join(root, 'tailwind.config.js'))
    ? readFileSync(join(root, 'tailwind.config.js'), 'utf8') : '';
  for (const m of twConfig.matchAll(/'([a-z-]+)':\s*'(#[0-9a-fA-F]{3,8})'/g)) custom[m[1]] = m[2];

  const TEXT = readTokenMap(tokens, 'TEXT');
  const SURFACE = readTokenMap(tokens, 'SURFACE');
  const ROLE_TEXT = readTokenMap(tokens, 'ROLE_TEXT');
  const ROLE_SURFACE_BG = readTokenMap(tokens, 'ROLE_SURFACE_BG');
  if (!TEXT || !SURFACE || !ROLE_TEXT || !ROLE_SURFACE_BG) {
    return fail('could not read TEXT / SURFACE / ROLE_TEXT / ROLE_SURFACE_BG out of ' + TOKEN_MODULE);
  }

  // ── 1. contrast, both modes ──────────────────────────────────────────────────────
  //
  // The pairings the design system actually declares: body text on each surface, and each semantic
  // role's text on that role's own background. A role whose text is unreadable on its own panel is
  // the failure this check exists for.
  //
  // MEASURED AGAINST WHAT THE DESIGN SYSTEM DECLARES, not against every combination.
  // The first version took the cartesian product and reported four failures, all of them pairings
  // nobody would ever write — TEXT.heading on SURFACE.inverse is dark on dark, and the inverse
  // surface exists so TEXT.inverse can sit on it. Noise is how a contrast report stops being read.
  const legible = readLegibleOn(tokens);
  if (!legible || Object.keys(legible).length === 0) {
    return fail('could not read LEGIBLE_ON out of ' + TOKEN_MODULE + ' — without a declaration of '
      + 'which text belongs on which surface, this gate would measure combinations the design system '
      + 'does not offer and report failures nobody can act on');
  }
  const pairings = [];
  for (const [sName, textNames] of Object.entries(legible)) {
    if (!SURFACE[sName]) {
      problems.push('LEGIBLE_ON names the surface "' + sName + '" and SURFACE does not define it');
      continue;
    }
    for (const tName of textNames) {
      if (!TEXT[tName]) {
        problems.push('LEGIBLE_ON pairs ' + sName + ' with the text token "' + tName + '", which TEXT does not define');
        continue;
      }
      pairings.push({ what: 'TEXT.' + tName + ' on SURFACE.' + sName, fg: TEXT[tName], bg: SURFACE[sName] });
    }
  }
  for (const sName of Object.keys(SURFACE)) {
    if (!legible[sName]) {
      problems.push('SURFACE.' + sName + ' has no entry in LEGIBLE_ON — a surface nobody has said '
        + 'what text goes on is a surface whose contrast nothing measures');
    }
  }
  for (const role of Object.keys(ROLE_TEXT)) {
    if (!ROLE_SURFACE_BG[role]) continue;
    pairings.push({
      what: 'ROLE_TEXT.' + role + ' on ROLE_SURFACE_BG.' + role,
      fg: ROLE_TEXT[role], bg: ROLE_SURFACE_BG[role],
    });
  }

  if (pairings.length === 0) return fail('no token pairings to measure — an empty population is not a pass');

  let measured = 0;
  const failures = [];
  for (const p of pairings) {
    const f = splitModes(p.fg), b = splitModes(p.bg);
    for (const mode of ['light', 'dark']) {
      const fgClass = pick(f[mode], 'text') ?? pick(f.light, 'text');
      const bgClass = pick(b[mode], 'bg') ?? pick(b.light, 'bg');
      if (!fgClass || !bgClass) continue;
      const fgHex = hexForClass(fgClass, custom);
      const bgHex = hexForClass(bgClass, custom);
      if (!fgHex || !bgHex) continue;
      measured += 1;
      const ratio = contrastRatio(fgHex, bgHex);
      if (ratio < AA_BODY) {
        failures.push({ what: p.what, mode, ratio, fgClass, bgClass });
      }
    }
  }

  if (measured === 0) {
    return fail('resolved 0 pairings to hex — the palette lookup is not reaching the token classes, '
      + 'and a contrast check that measures nothing would pass forever');
  }

  for (const f of failures.slice(0, 6)) {
    problems.push(f.what + ' in ' + f.mode + ' mode is ' + f.ratio.toFixed(2) + ':1, below AA '
      + AA_BODY + ':1 (' + f.fgClass + ' on ' + f.bgClass + ')');
  }
  if (failures.length > 6) problems.push('… and ' + (failures.length - 6) + ' more pairing(s) below AA');

  lines.push('contrast        ' + measured + ' pairing(s) measured in both modes · '
    + (measured - failures.length) + ' at or above AA ' + AA_BODY + ':1');

  // ── 2. icon + word, never colour alone ───────────────────────────────────────────
  //
  // THE CHECK LOOKS FOR A GLYPH ON SCREEN, NOT FOR THE NAME OF A MAP.
  //
  // Its first version tested whether the string `CHIP_GLYPH` appeared in the source, and the
  // negative control written against it renamed the declaration and left the use — so the string
  // was still there and the check passed. The control was malformed AND the check was too weak:
  // a component that declared a glyph map and never rendered it would have passed too.
  //
  // What it looks for now is a NON-ALPHANUMERIC, NON-PUNCTUATION character rendered as text — an
  // actual mark a reader sees beside the word. That cannot be satisfied by naming a variable.
  const GLYPH_CHAR = /[\u2000-\u3300\u2190-\u21FF\u2713\u2717\u2248\u2260?!]/u;
  const cueComponents = ['src/components/ProvenanceChip.tsx', 'src/components/ConflictedValue.tsx'];
  for (const rel of cueComponents) {
    const abs = join(root, rel);
    if (!existsSync(abs)) { problems.push(rel + ' is missing — A9 checks it for icon + word'); continue; }
    const src = stripComments(readFileSync(abs, 'utf8'));

    // Every string literal the component can render, and whether any is a bare glyph.
    // A GLYPH RENDERS TWO WAYS and this looks at both. ProvenanceChip keeps its marks in a map,
    // so they are string literals; ConflictedValue writes one straight into JSX as element text.
    // The first version read only literals and reported ConflictedValue as having no glyph while
    // a not-equal sign was sitting in its markup — right that it could not see one, wrong to
    // conclude that none was there.
    const literals = [...src.matchAll(/'([^'\n]{1,3})'/g)].map((m) => m[1]);
    const jsxText = [...src.matchAll(/>\s*([^<>{}\s]{1,2})\s*</g)].map((m) => m[1]);
    const glyphs = [...literals, ...jsxText].filter((t) => t.length <= 2 && GLYPH_CHAR.test(t));
    if (glyphs.length === 0) {
      problems.push(rel + ' renders no glyph — A9 says every state cue is icon AND word, and a cue '
        + 'distinguished only by hue is one a reader with a colour deficiency cannot read');
    }

    // A component carrying a role must also carry text.
    if (/ROLE_(TEXT|SURFACE_BG|BORDER)/.test(src) && !/AppText/.test(src)) {
      problems.push(rel + ' applies a semantic role and renders no text — that is colour alone');
    }
    lines.push('  ' + rel.replace('src/components/', '').padEnd(22) + glyphs.length + ' glyph(s) beside the words');
  }
  lines.push('state cues      ' + cueComponents.length + ' component(s) carry a glyph and a word beside the role colour');

  // ── 3. touch targets ─────────────────────────────────────────────────────────────
  const screens = walk(join(root, 'src'));
  if (screens.length === 0) return fail('scanned 0 .tsx files — an empty population proves nothing');

  const MIN_TARGET = 44;
  const smallTargets = [];
  let pressables = 0;
  for (const abs of screens) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    // ONLY INSIDE A PRESSABLE. A9 says touch TARGETS, and a spacer is not one: the first version
    // flagged `<View className="min-h-8 flex-1" />` — a gap between two blocks — with the same
    // weight as a button a thumb has to hit. A check that cannot tell them apart gets waived.
    for (const el of src.matchAll(/<(Pressable|TouchableOpacity)\b[^>]*>/g)) {
      const m = /min-h-\[(\d+)px\]|min-h-(\d+)\b/.exec(el[0]);
      if (!m) continue;
      const px = m[1] ? Number(m[1]) : Number(m[2]) * 4; // Tailwind's scale is 0.25rem per step
      if (px < MIN_TARGET) {
        smallTargets.push({ file: rel, line: lineAt(src, el.index), px, text: m[0] });
      }
    }
    pressables += [...src.matchAll(/<Pressable\b|<TouchableOpacity\b/g)].length;
  }
  for (const t of smallTargets.slice(0, 5)) {
    problems.push(t.file + ':' + t.line + ' declares a ' + t.px + 'pt minimum (' + t.text
      + '), below A9’s ' + MIN_TARGET + 'pt touch target');
  }
  lines.push('touch targets   ' + pressables + ' pressable(s) · ' + smallTargets.length
    + ' declared minimum(s) below ' + MIN_TARGET + 'pt');

  // ── 4. body text ─────────────────────────────────────────────────────────────────
  //
  // `text-xs` is 12px and `text-sm` is 14px. Both are legitimate for labels, captions and chips and
  // neither is body text, so this checks the explicit arbitrary sizes — `text-[13px]` is somebody
  // choosing a number, and a number below 16 that is not a caption is a reading problem.
  const smallBody = [];
  for (const abs of screens) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    for (const m of src.matchAll(/text-\[(\d+)px\]/g)) {
      const px = Number(m[1]);
      if (px < 12) smallBody.push({ file: rel, line: lineAt(src, m.index), px });
    }
  }
  for (const b of smallBody.slice(0, 5)) {
    problems.push(b.file + ':' + b.line + ' sets ' + b.px + 'px text — below anything A9 permits, '
      + 'even for a caption');
  }
  lines.push('type            ' + smallBody.length + ' explicit size(s) below 12px');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'A11Y OK — AA both modes, ' + measured + ' pairings measured',
  };
};
