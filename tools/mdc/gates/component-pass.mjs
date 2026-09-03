/**
 * GATE: component-pass — criterion T4.  →  `COMPONENT-PASS OK`
 *
 *   > **T4.** *"COMPONENTS: chips, pills, tiles and navigation are re-laid to the frozen system;
 *   > the provenance chip sits on the value line; render tests are updated, never weakened, and
 *   > semantic color law holds"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * TOKEN PRESENCE IS NOT CORRECT USAGE, WHICH IS THE WHOLE REASON THIS GATE EXISTS
 *
 * A8 already asserts that no colour literal lives outside the token module. That is a statement
 * about where colours are DEFINED. It says nothing about whether a component reaches them through
 * the shared roles or invents a local arrangement of its own that happens to use token names. So
 * this gate asks the questions A8 cannot: does every component that colours anything reach it by
 * NAME through the shared module, and does every role application resolve to one of the four roles
 * the contract declares rather than to a string somebody assembled.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "SITS ON THE VALUE LINE" — AND WHAT MY FIRST READING OF IT GOT WRONG
 *
 * The first version required every `ProvenanceChip` to be inside an `RtlRow` that also carried a
 * formatted figure. It reported 8 of 21 chips as misplaced, and every one of the eight was the
 * check being wrong rather than the screen:
 *
 *   · a chip qualifies an image ATTRIBUTION in CardTile, and a card FIELD in AddCardScreen —
 *     neither is a number, and both chips sit directly beside the thing they qualify;
 *   · DaySheet, FxCompareSheet and HomeUpcomingBilling put the chip as a direct SIBLING of the
 *     value in a column container rather than inside a row, which is the same attachment written
 *     a different way;
 *   · FxCompareSheet's estimate frame carries ONE shared chip for a whole column, under its heading.
 *
 * So the checkable claim is ATTACHMENT, not row membership: a chip is never orphaned from what it
 * qualifies. It must share a parent with something that renders text. A chip alone in a container
 * with no text beside it is a badge floating free of its subject, and that is the defect the
 * sentence is about — a reader cannot tell which figure the estimate applies to.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NEVER WEAKENED" IS MEASURED AS A FLOOR, NOT AS A FEELING
 *
 * A test suite is weakened in three ordinary ways: a case is skipped, a case is focused so the rest
 * stop running, or suites quietly disappear. All three are checked, and the render-suite count
 * carries a floor for the same reason T3's pairing count does — a check that only refuses zero will
 * happily report OK over a shrinking population.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { fail, okOverPopulation } from '../lib/report.mjs';

export const SENTINEL = 'COMPONENT-PASS OK';
export const FAILURE_SENTINEL = 'COMPONENT-PASS FAILED';
export const MEASURES = 'source';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const TOKENS = join(ROOT, 'src', 'theme', 'tokens.ts');

/** The four component families T4 names, and where each lives. */
const FAMILIES = {
  chip: ['src/components/ProvenanceChip.tsx'],
  pill: ['src/components/ConflictedValue.tsx', 'src/components/NotYetSurface.tsx'],
  tile: ['src/components/CardTile.tsx'],
  navigation: ['src/navigation/TabNavigator.tsx', 'src/navigation/SegmentedTab.tsx'],
};

/** The roles the contract declares. A fifth is a contract change, not a design tweak. */
const ROLES = ['danger', 'advisory', 'positive', 'neutral'];

/** Measured floors. A DROP is not a pass — see the header. */
const CHIP_FLOOR = 21;
const RENDER_SUITE_FLOOR = 70;

const SKIPPED = /(^|[^A-Za-z0-9_])(?:it|test|describe)\.(?:skip|todo|only)\(|(^|[^A-Za-z0-9_])(?:xit|xdescribe|fit|fdescribe)\(/;

const walk = (d, o = [], ext = /\.tsx?$/) => {
  if (!existsSync(d)) return o;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, o, ext);
    else if (ext.test(e)) o.push(p);
  }
  return o;
};

export const run = async () => {
  const problems = [];
  const clauses = [];
  let ts;
  try {
    ts = createRequire(join(ROOT, 'package.json'))('typescript');
  } catch (err) {
    return fail(`typescript is not resolvable, so the component tree can only be guessed at: ${err?.message ?? err}`);
  }
  if (!existsSync(TOKENS)) return fail('src/theme/tokens.ts is missing — there is no shared system to be re-laid to');

  const rel = (p) => relative(ROOT, p).split('\\').join('/');
  const srcFiles = walk(join(ROOT, 'src'));
  const product = srcFiles.filter((f) => !/__tests__|__snapshots__/.test(rel(f)));

  /* 1. THE NAMED FAMILIES EXIST AND REACH COLOUR BY NAME. */
  let familyCount = 0;
  for (const [family, files] of Object.entries(FAMILIES)) {
    for (const f of files) {
      const abs = join(ROOT, ...f.split('/'));
      if (!existsSync(abs)) { problems.push(`${family}: ${f} does not exist — a named family has no component`); continue; }
      familyCount += 1;
      const src = readFileSync(abs, 'utf8');
      if (/#[0-9A-Fa-f]{6}\b/.test(src)) problems.push(`${family}: ${f} names a raw colour value`);
      const colours = /\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/.test(src);
      if (colours) problems.push(`${family}: ${f} names a Tailwind hue directly instead of a shared role`);
      if (!/from '.*theme\/tokens'/.test(src) && !/from '\.\.\/theme\/tokens'/.test(src)) {
        // A component may legitimately carry no colour at all; only complain if it clearly styles one.
        if (/className=/.test(src) && /(?:bg|text|border)-/.test(src)) {
          problems.push(`${family}: ${f} styles colour without importing the token module`);
        }
      }
    }
  }
  clauses.push(`${familyCount} named component(s) across ${Object.keys(FAMILIES).length} famil(y/ies), each reaching colour by name`);

  /* 2. EVERY ROLE APPLICATION RESOLVES TO A DECLARED ROLE. */
  const roleUses = new Map();
  for (const f of product) {
    for (const m of readFileSync(f, 'utf8').matchAll(/ROLE_[A-Z_]+\.(\w+)/g)) {
      roleUses.set(m[1], (roleUses.get(m[1]) ?? 0) + 1);
    }
  }
  const undeclared = [...roleUses.keys()].filter((r) => !ROLES.includes(r));
  if (undeclared.length > 0) {
    problems.push(`role application(s) naming something the contract does not declare: ${undeclared.join(', ')}. `
      + `The four roles are ${ROLES.join(', ')}; a fifth is a contract change.`);
  }
  if (roleUses.size === 0) problems.push('no role is applied anywhere — an empty population proves nothing');
  /*
   * EVERY ROLE MAP MUST CARRY ALL FOUR ROLES — not "the word appears somewhere in the file".
   *
   * The first version asked whether `positive:` occurred anywhere in tokens.ts. Deleting the
   * positive entry from ROLE_MEANING left it present in four other maps, so the check passed over
   * a module that had genuinely lost a declaration. That is the wrong question: these maps are
   * INDEXED BY ROLE at the call site — `ROLE_TEXT[role]`, `ROLE_SURFACE[pill.role]` — so a role
   * missing from one map does not fail loudly. It yields `undefined`, which lands in a template
   * literal as the characters "undefined" inside a className, and the element renders with no
   * colour at all while every other role still works. Per-map completeness is the checkable form
   * of "the four roles are intact".
   */
  const tokenSrc = readFileSync(TOKENS, 'utf8');
  const roleMaps = [...tokenSrc.matchAll(
    /export const (ROLE_[A-Z_]+)[^=]*=\s*\{([\s\S]*?)\n\};/g,
  )];
  if (roleMaps.length === 0) problems.push('the token module declares no ROLE_* map — the shared system has no roles to apply');
  for (const [, mapName, body] of roleMaps) {
    for (const r of ROLES) {
      if (!new RegExp('(^|[\\s{,])' + r + '\\s*:').test(body)) {
        problems.push(`${mapName} no longer declares the ${r} role. Every site that indexes it by `
          + 'role would resolve to undefined for that role, which renders as no colour rather than '
          + 'as an error.');
      }
    }
  }
  clauses.push(`${[...roleUses.values()].reduce((a, b) => a + b, 0)} role application(s), all four declared roles intact`);

  /* 3. THE PROVENANCE CHIP IS ATTACHED TO WHAT IT QUALIFIES. */
  let chips = 0;
  const orphans = [];
  for (const f of product.filter((p) => /\.tsx$/.test(p))) {
    const r = rel(f);
    const sf = ts.createSourceFile(r, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const nameOf = (n) => {
      const tag = ts.isJsxElement(n) ? n.openingElement.tagName
        : ts.isJsxSelfClosingElement(n) ? n.tagName : null;
      return tag && ts.isIdentifier(tag) ? tag.text : null;
    };
    const jsxKids = (p) => (p?.children ?? []).filter((c) =>
      ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c) || ts.isJsxExpression(c));
    const saysWhat = (s) => /<AppText|\bt\(|accessibilityLabel|accessibilityValue/.test(s.getText(sf));

    const visit = (n, chain) => {
      if (nameOf(n) === 'ProvenanceChip') {
        chips += 1;
        /*
         * A PURE WRAPPER IS NOT A SEPARATION, and two real screens proved it.
         *
         * The first rule looked only at immediate siblings and flagged AddCardScreen and
         * FxCompareSheet. Neither was misplaced. AddCardScreen wraps its chip in a `<View
         * testID=…>` so a harness can find it, and that View's own sibling is the field's label.
         * FxCompareSheet draws a dashed frame round the shared Estimate chip, and the frame's
         * sibling is the heading it qualifies. In both, the chip's subject is one structural step
         * away because something decorative sits between them.
         *
         * So the walk climbs OUT of containers that hold nothing but this chip — a wrapper whose
         * only JSX child is the chip's own subtree adds no content and therefore no distance — and
         * asks for the value at the first level that actually has other children. A chip that is
         * genuinely alone, with no text anywhere among its real siblings, still fails.
         */
        let node = n;
        let idx = chain.length - 1;
        let attached = false;
        while (idx >= 0) {
          const parent = chain[idx];
          const sibs = jsxKids(parent).filter((c) => c !== node);
          if (sibs.length > 0) { attached = sibs.some(saysWhat); break; }
          node = parent; idx -= 1;             // a lone child: climb out of the wrapper
        }
        if (!attached) orphans.push(`${r}:${lineOf(n)} is alone in its container — nothing beside it says which value it qualifies`);
      }
      ts.forEachChild(n, (c) => visit(c, (ts.isJsxElement(n) || ts.isJsxFragment(n)) ? [...chain, n] : chain));
    };
    visit(sf, []);
  }
  if (orphans.length > 0) problems.push(`provenance chip(s) off the value line: ${orphans.slice(0, 4).join('; ')}`);
  if (chips < CHIP_FLOOR) {
    problems.push(`the chip population SHRANK: ${chips} where ${CHIP_FLOOR} were measured. `
      + 'This gate may not report OK over fewer chips than it was written against.');
  }
  clauses.push(`${chips} provenance chip(s), every one attached to what it qualifies`);

  /* 4. RENDER TESTS UPDATED, NEVER WEAKENED. */
  const renderSuites = walk(join(ROOT, 'src'), [], /\.render\.test\.tsx$/);
  const weakened = [];
  for (const f of walk(join(ROOT, 'src'), [], /\.(test|spec)\.tsx?$/)) {
    if (SKIPPED.test(readFileSync(f, 'utf8'))) weakened.push(rel(f));
  }
  if (weakened.length > 0) {
    problems.push(`test file(s) carrying a skipped, focused or todo case: ${weakened.slice(0, 5).join(', ')}. `
      + 'A suite with a case switched off is a suite that stopped asserting it.');
  }
  if (renderSuites.length < RENDER_SUITE_FLOOR) {
    problems.push(`render suites SHRANK: ${renderSuites.length} where ${RENDER_SUITE_FLOOR} were measured`);
  }
  const registerPath = join(ROOT, 'src', 'screens', '__tests__', 'render-fixtures.json');
  if (!existsSync(registerPath)) problems.push('the render-fixture register is gone — an absent register and an empty one are different claims');
  else {
    const reg = JSON.parse(readFileSync(registerPath, 'utf8'));
    if (!Array.isArray(reg.requiresFixture)) problems.push('render-fixtures.json no longer declares requiresFixture');
    else for (const e of reg.requiresFixture) {
      if (!e.clearedBy) problems.push(`a screen waits on a fixture with nothing named to clear it: ${e.screen}`);
    }
  }
  clauses.push(`${renderSuites.length} render suite(s), none carrying a skipped or focused case`);

  const population = chips + renderSuites.length + familyCount;
  if (problems.length > 0) return fail(problems.join(' · '), { population });
  return okOverPopulation({
    population,
    unit: 'chip(s), render suite(s) and named component(s)',
    detail: clauses.join(' · '),
  });
};
