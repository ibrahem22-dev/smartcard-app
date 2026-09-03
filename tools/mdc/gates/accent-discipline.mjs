/**
 * GATE: accent-discipline — criterion T3.  →  `ACCENT-DISCIPLINE OK`
 *
 *   > **T3.** *"ACCENT DISCIPLINE: the action accent and the advisory amber never appear adjacent
 *   > without shape and label redundancy, measured over the pairings the screens actually compose"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS ASKS THAT A8 AND A9 DO NOT
 *
 * A8 puts every colour in the token module and asserts one role per hue. A9 asserts that each
 * component's state cue is icon plus word rather than colour alone. Neither asks the question T3
 * asks, which is about a RELATIONSHIP BETWEEN TWO THINGS: blue means "act on this", amber means
 * "treat this as unverified", and a reader who cannot separate the hues meets them SIDE BY SIDE.
 * Each component can be individually compliant with A9 and the pair still be unreadable, because
 * A9 never compares two components to each other.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT "ADJACENT" MEANS HERE, AND WHY THE FIRST DEFINITION WAS WRONG
 *
 * First attempt: any two elements sharing a parent. That reported 28 pairings, and it was
 * nonsense — a screen's root `<View>` makes every element on the screen a sibling, so it paired an
 * accent button on line 194 with an advisory panel on line 395. Two things two hundred lines apart
 * are not adjacent to anybody.
 *
 * ADJACENT here means IMMEDIATE NEIGHBOURS: consecutive entries in one parent's child list, or the
 * same relationship with one nested directly in the other. That is the structural reading of "next
 * to", and it reports SEVEN pairings — a number small enough to check by eye, which is how the
 * definition was validated.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SHAPE AND THE LABEL ARE OFTEN NOT AT THE CALL SITE, AND THAT IS THE TRAP
 *
 * A first pass read only the Tailwind classes written beside each element and reported HomeScreen
 * as a failure: an accent panel and an advisory panel, both `rounded-lg border p-[18px]`, differing
 * in nothing but hue. That was wrong, and the reason it was wrong is the whole point of resolving
 * through components. The advisory panel is wrapped in `<FeatureGate feature="InternationalTravel">`,
 * that flag's status is `soon`, and FeatureGate in that state overlays an absolutely-positioned
 * badge with `borderRadius: 999` carrying the word "בקרוב". The pairing wears a pill and a word
 * that the accent panel does not. The redundancy was real and lived one component away.
 *
 * So a side's shape and label are resolved THROUGH the components it composes, to a bounded depth,
 * and shape is read from Tailwind radius classes AND from StyleSheet `borderRadius` values, because
 * this codebase writes both and a reader that knew only one would have failed a compliant screen.
 * Assuming token presence equals correct usage is the failure mode; so is assuming its absence
 * means the opposite.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NO CONTROL IS INVENTED
 *
 * T3's fence declares `negativeControl: null`. No machinery control is armed for it and none is
 * manufactured, exactly as C4 and C9 were handled. The clauses are falsified directly instead, by
 * mutation, and every trial guards that its mutation landed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { fail, okOverPopulation } from '../lib/report.mjs';

export const SENTINEL = 'ACCENT-DISCIPLINE OK';
export const FAILURE_SENTINEL = 'ACCENT-DISCIPLINE FAILED';
export const MEASURES = 'source';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/** The action accent, named. Reaching it any other way is A8's business, not this gate's. */
const ACCENT_RE = /\bACCENT\.\w+/;
/**
 * The advisory amber, however a screen reaches it: named directly, indexed by a role variable, or
 * carried in by one of the components whose own tone can resolve to advisory.
 */
const ADVISORY_RE = /ROLE_\w+\.advisory\b|ROLE_\w+\[[^\]]*\]|ProvenanceChip|ConflictedValue|NotYetSurface/;

const TW_SHAPE = /\brounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?\b/g;
const RN_RADIUS = /borderRadius:\s*(\d+)/g;
/** A glyph is a lone symbol or emoji standing in for an icon — the repo's own A9 idiom. */
const GLYPH = />\s*\{?\s*['"`]?([\u2190-\u2BFF\uFE0F\u{1F300}-\u{1FAFF}✓✎≈≠⌛?])['"`]?\s*\}?\s*</u;

const walk = (d, o = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== '__snapshots__') walk(p, o); }
    else if (/\.tsx$/.test(e)) o.push(p);
  }
  return o;
};

export const run = async () => {
  const problems = [];
  let ts;
  try {
    ts = createRequire(join(ROOT, 'package.json'))('typescript');
  } catch (err) {
    return fail(`typescript is not resolvable, so JSX adjacency can only be guessed at: ${err?.message ?? err}`);
  }

  const files = walk(join(ROOT, 'src'));
  const byName = new Map();
  for (const f of files) byName.set(basename(f, '.tsx'), f);
  const rel = (p) => relative(ROOT, p).split('\\').join('/');

  const shapeOf = (s) => [
    ...new Set(s.match(TW_SHAPE) || []),
    ...new Set([...s.matchAll(RN_RADIUS)].map((m) => 'r' + m[1])),
  ].sort();
  const labelOf = (s) => /accessibilityLabel/.test(s) || /\bt\(/.test(s) || /<AppText/.test(s);
  const glyphOf = (s) => GLYPH.test(s) || /CHIP_GLYPH/.test(s);
  /*
   * PRIMITIVES ARE NOT RESOLVED INTO, AND FALSIFYING THIS GATE IS WHAT SHOWED WHY.
   *
   * The label clause could not fail. `describe` followed every local component reference, and that
   * includes `AppText` — a generic text primitive whose own file naturally contains `t(` and
   * `<AppText`. So resolving into it set `label = true` for essentially every element on every
   * screen, and stripping a panel of all its words still left the pairing "labelled". A clause that
   * cannot fail is not a clause.
   *
   * These wrappers carry layout and direction, never meaning. A label found by descending into one
   * of them is the primitive's own source, not the screen's copy. Components that DO carry meaning
   * — ProvenanceChip, ConflictedValue, NotYetSurface, FeatureGate — are still resolved, which is
   * what makes the FeatureGate badge visible to the shape check.
   */
  const PRIMITIVES = new Set(['AppText', 'View', 'RtlRow', 'RtlScreen', 'RtlScrollView', 'Pressable']);
  const localRefs = (s) => [...new Set([...s.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)].map((m) => m[1]))]
    .filter((n) => byName.has(n) && !PRIMITIVES.has(n));

  /** Shape, glyph and label as the reader meets them — through composed components, bounded depth. */
  const describe = (text, depth = 0, seen = new Set()) => {
    let shapes = shapeOf(text);
    let label = labelOf(text);
    let glyph = glyphOf(text);
    const via = [];
    if (depth < 2) {
      for (const c of localRefs(text)) {
        if (seen.has(c)) continue;
        seen.add(c);
        const d = describe(readFileSync(byName.get(c), 'utf8'), depth + 1, seen);
        shapes = [...new Set([...shapes, ...d.shapes])].sort();
        label = label || d.label;
        glyph = glyph || d.glyph;
        via.push(c);
      }
    }
    return { shapes, label, glyph, via };
  };

  const pairings = [];
  for (const f of files) {
    const r = rel(f);
    const sf = ts.createSourceFile(r, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const visit = (n) => {
      if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
        const kids = n.children.filter((c) =>
          ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c) || ts.isJsxExpression(c));
        for (let i = 0; i + 1 < kids.length; i += 1) {
          const A = kids[i].getText(sf);
          const B = kids[i + 1].getText(sf);
          const pair = (ACCENT_RE.test(A) && ADVISORY_RE.test(B)) ? [kids[i], kids[i + 1], A, B]
            : (ADVISORY_RE.test(A) && ACCENT_RE.test(B)) ? [kids[i + 1], kids[i], B, A] : null;
          if (!pair) continue;
          const [ae, de, at, dt] = pair;
          pairings.push({
            file: r, accentLine: lineOf(ae), advisoryLine: lineOf(de),
            accent: describe(at), advisory: describe(dt),
          });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  /*
   * THE POPULATION IS PINNED, NOT JUST CHECKED FOR ZERO — and falsifying this gate is what forced it.
   *
   * The first version refused only an EMPTY population. Blinding the advisory reader to three
   * component names dropped the count from seven pairings to five, and the gate printed
   * `ACCENT-DISCIPLINE OK` over the smaller number without a word. A sentinel over a shrinking
   * denominator is the exact shape this campaign keeps finding: the check runs, the check passes,
   * and the check is quietly looking at less than it did yesterday.
   *
   * So the floor is declared. Seven is what the screens compose today, measured and checked by eye
   * — the definition of adjacency was validated against these seven. A DROP is not a pass: either
   * a screen stopped composing a pairing, which needs re-measuring, or the reader stopped seeing
   * one, which needs fixing. Both need a person. A RISE is fine and needs no edit here: new
   * pairings are simply held to the same rule.
   */
  const PAIRING_FLOOR = 7;
  if (pairings.length === 0) {
    return fail('no accent/advisory adjacency was found anywhere in src — either the reader has '
      + 'stopped seeing the pairings the screens compose, or the accent and the advisory role no '
      + 'longer meet. Both need a human, and neither is a pass.');
  }
  if (pairings.length < PAIRING_FLOOR) {
    problems.push(
      `the composed population SHRANK: ${pairings.length} adjacent pairing(s) where ${PAIRING_FLOOR} `
      + 'were measured. This gate may not report OK over a smaller population than it was written '
      + 'against — re-measure the screens, or repair the reader, and move the floor deliberately.',
    );
  }

  /*
   * THE READER'S VOCABULARY MUST STILL RESOLVE. Two of the seven pairings reach the advisory role
   * only through a component, so a component that quietly stops carrying an advisory tone would
   * remove a pairing rather than fail one. Each named component is therefore checked to still be
   * advisory-capable, in its own file, where the tone actually lives.
   */
  for (const name of ['ProvenanceChip', 'ConflictedValue', 'NotYetSurface']) {
    const f = byName.get(name);
    if (!f) { problems.push(`${name}.tsx is gone — the advisory reader names a component that no longer exists`); continue; }
    const src = readFileSync(f, 'utf8');
    if (!/advisory/.test(src)) {
      problems.push(`${name}.tsx no longer mentions the advisory role — either it changed meaning, `
        + 'or this gate is still counting it as an advisory carrier when it is not');
    }
  }

  /* THE RULE. A pairing is readable without colour when its two sides differ in FORM — geometry or
     glyph — and each side carries words of its own. Hue is then the third cue rather than the only
     one. Both halves are required, which is what T3's "shape AND label" says. */
  const sig = (d) => d.shapes.join(',') + '|' + (d.glyph ? 'glyph' : '');
  for (const p of pairings) {
    const where = `${p.file} accent@${p.accentLine} beside advisory@${p.advisoryLine}`;
    if (sig(p.accent) === sig(p.advisory)) {
      problems.push(
        `${where}: identical form — both [${p.accent.shapes.join(' ') || 'no shape'}]`
        + `${p.accent.glyph ? ' with glyph' : ' without glyph'}. Hue is the only thing separating `
        + 'them, and roughly one man in twelve cannot use it.',
      );
    }
    if (!p.accent.label) problems.push(`${where}: the accent side carries no words of its own`);
    if (!p.advisory.label) problems.push(`${where}: the advisory side carries no words of its own`);
  }

  const detail = `${pairings.length} adjacent accent/advisory pairing(s) across `
    + `${new Set(pairings.map((p) => p.file)).size} screen(s), each separated by form as well as hue`;
  if (problems.length > 0) return fail(problems.join(' · '), { population: pairings.length });
  return okOverPopulation({
    population: pairings.length,
    unit: 'composed accent/advisory pairing(s)',
    detail,
  });
};
