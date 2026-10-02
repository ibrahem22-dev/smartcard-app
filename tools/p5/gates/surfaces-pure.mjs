/**
 * GATE: surfaces-pure — criterion B1.  →  `SURFACES-PURE OK`
 *
 *   > **B1.** *"No P5 surface holds recommendation logic in either direction: every number a
 *   > surface shows came from an engine call, and no media asset or artwork reference appears in
 *   > any engine input or output, enforced at build time."*
 *
 * MEASURES: 'source'. B1 is a build-time claim about what the code CAN do, and the contract says so
 * in as many words. The runtime half — that four components rendering the same figure agree — is
 * group A, and B1 explicitly cannot see it: *"it proves no component computes; it says nothing
 * about whether four components agree."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE POPULATION IS WALKED, NOT LISTED — and that is P5's difference from P4's version
 *
 * `P5_VALIDATION_PLAN.md` §2: *"B1's population must be walked, not listed. P3's `engines-pure`
 * gate needed its resolver taught to follow exact-path `.json` imports mid-campaign, because a
 * module graph that stops at the first thing it does not understand reports purity it never
 * checked."*
 *
 * So the five entry modules are **derived from the navigation declaration** — the same two
 * declarations intake requirement I12 reads, `src/navigation/ia.ts` for the tabs and segments and
 * `src/navigation/stacks/*.tsx` for the components each renders — and the module graph is then
 * walked transitively from them through relative imports. **A specifier the resolver cannot resolve
 * is a failure, not a skip**: that is exactly the hole P3 found, and a walker that shrugs at what it
 * does not understand reports a purity it never measured.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS POLICED, AND WHAT IS DELIBERATELY SOMEBODY ELSE'S
 *
 * A P5 surface legitimately reaches P4 modules — criterion `N8` requires Card DNA's FX row to open
 * **the sheet P4 built**, and the Verdict is a named participant in `A2` and `A4`. So the walk
 * crosses into P4's code, and this gate does **not** police what it finds there: `src/check/**` and
 * `src/screens/check/**` are P4's, `tools/p4/gates/surfaces-pure.mjs` measures them, and P5
 * re-measuring them would be a phase re-litigating a closed one (contract §1.2). It says which
 * modules it skipped and why, so the scope is visible rather than assumed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE THREE THINGS IT ASSERTS
 *
 *   1. **No P5-owned module value-imports an engine.** Every number reaches a surface through
 *      `src/surfaces/`. A `import type` is fine — a type carries no computation.
 *   2. **No P5-owned module computes a rendered figure.** Threshold comparisons, division by
 *      income, and the load-ratio vocabulary, exactly as P4's version reads them.
 *   3. **No engine names a media or artwork field**, in either direction — the half of B1 that is
 *      about what engines must NOT carry.
 *
 * And the seam is checked for the property that makes group A possible at all: **exactly one call
 * per engine**, in one place. Two calls are two computations, and a property comparing surfaces
 * across them would be comparing two engine results rather than two renders of one.
 *
 * NEGATIVE CONTROL (contract §5 B1): compute a load ratio inside a P5 surface and watch this fail.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['B1'];
export const SENTINEL = 'SURFACES-PURE OK';
export const MEASURES = 'source';

const IA = 'src/navigation/ia.ts';
const STACKS = 'src/navigation/stacks';
const SEAM = 'src/surfaces/surfaceEngines.ts';
const SEAM_DIR = 'src/surfaces/';
const ENGINE_ROOT = 'src/engines';

/** P4's, and measured by P4's own gate. Named so the scope of this one is visible. */
const NOT_OURS = ['src/check/', 'src/screens/check/', 'src/screens/fx/', 'src/screens/addCard/', 'src/screens/onboarding/'];

/**
 * WHAT COUNTS AS A SURFACE, AND WHY THE TWO RULES HAVE DIFFERENT POPULATIONS.
 *
 * B1 is two claims, and the first run of this gate proved they are not the same claim:
 *
 *   · *"every number a surface shows came from an engine call"* — this is about SURFACES. A screen
 *     or a component may not reach an engine itself. A **hook** that calls an engine is not a
 *     violation of it; it is the shape the sentence asks for, and `useCashflowCalendar` has had
 *     exactly that shape since M3. Reading the rule as *"no module may import an engine"* would
 *     have made P5 re-litigate a three-phase-old architecture under a criterion that never said it.
 *
 *   · *"no P5 surface holds recommendation logic"* — this is about EVERY module in the P5 graph
 *     except the engines. A threshold comparison in a hook is the same defect as one in a
 *     component: the number still was not computed by an engine. So the recommendation rules run
 *     wider than the import rule, and deliberately.
 *
 * Engines are excluded from both, because recommendation logic is what an engine IS. The first run
 * of this gate flagged `verdict.ts` for holding `safeRatio` — a gate policing the engine for being
 * an engine. They are measured instead by the media rule, which is B1's other direction.
 */
const SURFACE_ROOTS = ['src/screens/', 'src/components/'];
const ENGINE_PREFIX = 'src/engines/';

/** The engine calls the seam makes, and the number of times each may appear in it. */
const SEAM_ENGINE_CALLS = ['evaluateFinancialLoad', 'evaluateRiskPlanning', 'scoreCards'];

const RECOMMENDATION_IN_SURFACE = [
  /\bsafeRatio\b/,
  /\bhardRatio\b/,
  /\bprojectedLoad\b/,
  /\bthresholdMath\b/,
  /\bloadAfter\b/,
  /[><]=?\s*0\.35\b/,
  /[><]=?\s*0\.50?\b/,
  /\/\s*(monthlyIncome|income)\b/,
];

const ENGINE_VALUE_IMPORT = /import\s+(?!type\b)[^;]*from\s+'([^']*\/engines\/[^']*)'/;
const MEDIA_IN_ENGINE = /\b(artworkUrl|imageUrl|logoUrl|mediaAsset|sourceUrl)\b/;

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const relOf = (root, abs) => relative(root, abs).replace(/\\/g, '/');

const walkDir = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const next = join(abs, entry.name);
    if (entry.isDirectory()) walkDir(next, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(next);
  }
  return acc;
};

/** Resolve a relative specifier to a real file, or report that it could not be resolved. */
const resolveSpecifier = (fromFile, spec) => {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [base, base + '.ts', base + '.tsx', base + '.json', join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try { if (statSync(candidate).isFile()) return candidate; } catch { /* next */ }
  }
  return null;
};

/**
 * THE FIVE ENTRY MODULES, DERIVED FROM THE TWO DECLARATIONS THE NAVIGATOR ITSELF BUILDS FROM.
 *
 * `ia.ts` gives the tabs and the segments; the stacks give the component each renders. Card DNA is
 * not in the tab list and correctly so — it is contextual, route `CardDetail` in `WalletStack`,
 * which is what assumption A21 established.
 */
const deriveEntryModules = (root) => {
  const iaSrc = readFileSync(join(root, IA), 'utf8');
  const stackDir = join(root, STACKS);
  if (!existsSync(stackDir)) return { error: STACKS + ' does not exist — the route declaration cannot be read' };

  /* Which components the stacks render, and where each is imported from. */
  const imports = new Map();
  const rendered = new Set();
  const routes = new Map();
  for (const file of readdirSync(stackDir).filter((f) => f.endsWith('.tsx'))) {
    const abs = join(stackDir, file);
    const src = readFileSync(abs, 'utf8');
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        const target = resolveSpecifier(abs, m[2]);
        if (target) imports.set(name, target);
      }
    }
    for (const m of src.matchAll(/component=\{([A-Za-z0-9_]+)\}/g)) rendered.add(m[1]);
    /* name="X" component={Y} in either order, so a route can be resolved to what renders it. */
    for (const m of src.matchAll(/<Stack\.Screen\b([^>]*)\/>/g)) {
      const attrs = m[1];
      const name = (attrs.match(/name="([^"]+)"/) ?? [])[1];
      const comp = (attrs.match(/component=\{([A-Za-z0-9_]+)\}/) ?? [])[1];
      if (name && comp) routes.set(name, comp);
    }
    for (const m of src.matchAll(/<([A-Z][A-Za-z0-9_]*)\s*\/>/g)) rendered.add(m[1]);
  }

  /* The tabs and segments P5 owns, read from the declaration rather than listed here. */
  const tabs = [...iaSrc.matchAll(/key:\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
  /*
   * CARD DNA IS FOUND BY ITS ROUTE, NOT BY THE NAME OF WHATEVER RENDERS IT.
   *
   * Corrected 2026-08-28, the moment N1 shipped. This list used to name 'CardDetailScreen', and
   * PD-P5-011 replaced that component with CardDnaScreen at the same route — so B1, a SATISFIED
   * criterion, went red for a change that was the plan working. A gate that names an implementation
   * where the criterion names a surface will break every time the surface is built, which is the
   * one thing it can be relied on to do.
   *
   * The route comes from src/surfaces/__tests__/derivedPopulation.ts, which already declares
   * CARD_DNA_ROUTE for the agreement population. Reading it here rather than repeating it means the
   * contextual surface has ONE declared identity that both the population and this walk resolve
   * against — and if that file stops declaring it, this fails rather than guessing.
   *
   * The four tab-and-segment surfaces are still keyed by component, and correctly: ia.ts declares
   * them as navigation, and their components are what the stacks render inline inside a segment
   * callback, with no route name of their own to key on.
   */
  const POPULATION = 'src/surfaces/__tests__/derivedPopulation.ts';
  let cardDnaRoute = null;
  if (existsSync(join(root, POPULATION))) {
    cardDnaRoute = (readFileSync(join(root, POPULATION), 'utf8').match(/CARD_DNA_ROUTE\s*=\s*'([^']+)'/) ?? [])[1] ?? null;
  }
  if (!cardDnaRoute) {
    return { error: POPULATION + ' declares no CARD_DNA_ROUTE — Card DNA is contextual and has no tab, so without that declaration there is nothing to resolve it against' };
  }
  const routeComponent = routes.get(cardDnaRoute);
  if (!routeComponent) {
    return { error: 'no stack registers a component for route "' + cardDnaRoute + '" — Card DNA is declared and unreachable' };
  }

  const wanted = [
    { surface: 'Home', component: 'HomeScreen' },
    { surface: 'Wallet/Cards', component: 'CardsScreen' },
    { surface: 'Card DNA', component: routeComponent },
    { surface: 'Plan/Calendar', component: 'CalendarScreen' },
    { surface: 'Plan/Commitments', component: 'CommitmentsScreen' },
  ];
  const entries = [];
  const missing = [];
  for (const w of wanted) {
    if (!rendered.has(w.component)) { missing.push(w.surface + ' → ' + w.component + ' is not rendered by any stack'); continue; }
    const abs = imports.get(w.component);
    if (!abs) { missing.push(w.surface + ' → ' + w.component + ' is rendered but its import could not be resolved'); continue; }
    entries.push({ surface: w.surface, abs });
  }
  return { entries, missing, tabs };
};

export const run = async ({ root }) => {
  for (const rel of [IA, SEAM]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — B1 has nothing to be about');
  }

  const { entries, missing, tabs, error } = deriveEntryModules(root);
  if (error) return fail(error);
  if (missing && missing.length) {
    return fail('the five P5 surfaces could not all be derived from the navigation declaration: ' + missing.join(' · '));
  }
  if (!entries || entries.length !== 5) {
    return fail('derived ' + (entries?.length ?? 0) + ' P5 entry module(s) from ' + IA + ' and ' + STACKS + ', expected 5 — a purity check over the wrong population proves nothing');
  }
  if (!tabs || tabs.length === 0) {
    return fail(IA + ' yielded no navigation keys — the declaration was not read as data');
  }

  /* THE TRANSITIVE WALK. An unresolvable relative specifier is a FAILURE, not a skip. */
  const seen = new Set();
  const unresolved = [];
  const queue = entries.map((e) => e.abs);
  while (queue.length) {
    const file = queue.pop();
    const key = relOf(root, file);
    if (seen.has(key)) continue;
    seen.add(key);
    if (/\.json$/.test(file)) continue;
    let src;
    try { src = readFileSync(file, 'utf8'); } catch { unresolved.push(key + ' could not be read'); continue; }
    for (const m of stripComments(src).matchAll(/from\s+'(\.[^']*)'/g)) {
      const target = resolveSpecifier(file, m[1]);
      if (!target) { unresolved.push(key + ' imports "' + m[1] + '", which resolves to no file'); continue; }
      queue.push(target);
    }
  }
  if (unresolved.length) {
    return fail('the module walk could not resolve ' + unresolved.length + ' import(s), so the graph it checked is not the graph that ships: '
      + unresolved.slice(0, 5).join(' · '));
  }
  if (seen.size === 0) return fail('the walk reached zero modules — a purity check over nothing is not a check (§2 rule 5)');

  /* WHAT IS OURS TO POLICE. P4's modules are P4's, and its own gate measures them. */
  const ours = [...seen].filter((p) => !NOT_OURS.some((n) => p.startsWith(n)));
  const theirs = [...seen].filter((p) => NOT_OURS.some((n) => p.startsWith(n)));
  if (ours.length === 0) return fail('every reachable module belongs to another phase — this gate would then assert nothing');

  const problems = [];
  const policed = ours.filter((p) => !p.startsWith(ENGINE_PREFIX) && !p.startsWith(SEAM_DIR));
  const surfaces = policed.filter((p) => SURFACE_ROOTS.some((r) => p.startsWith(r)));
  if (surfaces.length === 0) {
    return fail('the walk reached no module under ' + SURFACE_ROOTS.join(' or ') + ' — the first half of B1 would then assert nothing');
  }

  /* Rule 1 — SURFACES only. A hook calling an engine is the shape B1 asks for, not a breach of it. */
  for (const path of surfaces) {
    const src = stripComments(readFileSync(join(root, path), 'utf8'));
    const engineImport = src.match(ENGINE_VALUE_IMPORT);
    if (engineImport) {
      problems.push(path + ' is a surface and value-imports an engine (' + engineImport[1] + ') — surfaces read through ' + SEAM_DIR + ', so every number they show came from one engine call');
    }
  }

  /* Rule 2 — EVERY P5 module that is not an engine. A threshold in a hook is the same defect as a
     threshold in a component: the number still was not computed by an engine. */
  for (const path of policed) {
    const src = stripComments(readFileSync(join(root, path), 'utf8'));
    for (const re of RECOMMENDATION_IN_SURFACE) {
      if (re.test(src)) problems.push(path + ' holds recommendation logic matching ' + re);
    }
  }

  /* THE OTHER DIRECTION: no engine may name a media or artwork field. */
  const engines = walkDir(join(root, ENGINE_ROOT)).map((p) => relOf(root, p));
  if (engines.length === 0) return fail('no engine files under ' + ENGINE_ROOT + ' — the other half of B1 has nothing to measure');
  for (const path of engines) {
    const src = stripComments(readFileSync(join(root, path), 'utf8'));
    if (MEDIA_IN_ENGINE.test(src)) {
      problems.push(path + ' names a media/artwork field — engines must not carry assets (B1, other direction)');
    }
  }

  /* THE SEAM: exactly one call per engine, so group A compares renders and not computations. */
  const seamSrc = stripComments(readFileSync(join(root, SEAM), 'utf8'));
  for (const call of SEAM_ENGINE_CALLS) {
    const n = (seamSrc.match(new RegExp('\\b' + call + '\\s*\\(', 'g')) ?? []).length;
    if (n !== 1) {
      problems.push(SEAM + ' contains ' + n + ' ' + call + '( call(s); it must contain exactly one. Two calls are two computations, and an agreement property across them would compare two engine results rather than two renders of one');
    }
  }

  if (problems.length) return fail('B1 broken:\n    ' + problems.join('\n    '));

  return ok(SENTINEL, [
    'Population WALKED from the five P5 surfaces, derived from ' + IA + ' and ' + STACKS + ':',
    ...entries.map((e) => '  · ' + e.surface + ' → ' + relOf(root, e.abs)),
    seen.size + ' module(s) reachable, every relative import resolved to a real file.',
    '  ' + policed.length + ' of them are P5 modules and were policed (' + surfaces.length + ' under ' + SURFACE_ROOTS.join(', ') + '); ' + theirs.length + ' belong to P4 and are measured by',
    '  tools/p4/gates/surfaces-pure.mjs — N8 requires Card DNA to open the sheet P4 built, so the',
    '  walk crosses into P4 by design and re-measuring it would be P5 re-litigating a closed phase.',
    'No P5 SURFACE value-imports an engine, and no P5 module outside ' + ENGINE_PREFIX + ' holds a',
    'threshold, a load ratio or a division by income — the two halves have different populations',
    'on purpose: a hook that calls an engine is the B1 shape, a hook that computes a ratio is not.',
    engines.length + ' engine file(s) carry no media or artwork field.',
    SEAM + ' calls each of ' + SEAM_ENGINE_CALLS.join(', ') + ' exactly once.',
  ].join('\n'));
};
