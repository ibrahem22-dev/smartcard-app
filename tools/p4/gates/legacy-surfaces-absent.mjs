/**
 * GATE: legacy-surfaces-absent — criterion B2.  →  `LEGACY-SURFACES-ABSENT OK`
 *
 *   > *"The legacy Check flow is unreachable: `CheckModal` renders the P4 flow, and
 *   > `PurchaseGateScreen` and `DecisionScreen` are reachable from no route."*
 *
 * P4_SCOPE_DETERMINATION.md §3 found this by reading the navigator: `CheckModal` — the raised centre
 * action that IS the product's core loop — mounted `PurchaseGateStack`, and through it two screens
 * from the deprecated pre-P2 prototype. P2 rebuilt the route TREE correctly and left the CONTENTS of
 * the Check route to the phase that owns Check. So P4 has a REMOVAL obligation and not only a build
 * one, and this gate is the half of it that cannot be satisfied by writing something new: it is P2's
 * D3 discipline — *"the legacy data path is gone"* — applied to surfaces.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ROUTE TABLE IS DERIVED FROM THE NAVIGATION SOURCE, NOT KEPT BY HAND HERE
 *
 * Every `<X.Screen name=… component={…}>` under `src/navigation/` is parsed out and the assertions
 * run over that table. A hand-kept list of "the routes we have" is complete on the day it is written
 * and silently wrong on the day somebody adds the next navigator — which is exactly how a legacy
 * screen gets re-registered in a stack nobody thought to list, and exactly the defect class this
 * project has now found in a route table, a screen population and a gate population separately.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A GATE THAT FINDS NOTHING MUST NOT PASS
 *
 * The obvious wrong implementation of "these two screens are registered nowhere" is a search that
 * returns zero because it was looking in a directory that no longer exists, or because a rename
 * broke its glob. That reads as a pass and means nothing. So the files this gate expects are
 * asserted to EXIST first, the derived route table is asserted to be NON-EMPTY, and both failures
 * are loud. Absence of a finding is only evidence when the search demonstrably ran.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FIVE CHECKS
 *
 *   1. **The population is real.** The navigation directory, `AuthenticatedNavigator.tsx`,
 *      `stacks/CheckStack.tsx` and `types.ts` all exist, and parsing them yields routes.
 *   2. **Neither legacy screen is any route's component**, anywhere under `src/navigation/`.
 *   3. **Neither legacy screen is even named in navigation code.** Registration is not the only way
 *      to reach a component — a `children` render prop or a `getComponent` mounts one just as well,
 *      and neither carries a `component=` attribute for check 2 to see. Comments are stripped, so a
 *      note EXPLAINING the removal is not mistaken for the removal being undone.
 *   4. **`CheckModal` resolves to the P4 `CheckStack`** — the route's component identifier is traced
 *      through that file's own imports to `src/navigation/stacks/CheckStack.tsx`, and the param list
 *      the route is typed with is `CheckStackParamList`. "Renders the P4 flow" is a claim about what
 *      it mounts, so the mount is what is followed.
 *   5. **`CheckInput` and `CheckVerdict` exist** as routes of that stack, and are declared in
 *      `CheckStackParamList`. Half of B2 is that the new flow is REACHABLE; a gate that only checked
 *      removals would pass over an empty Check modal.
 *
 * NEGATIVE CONTROL (contract §5 B2): re-register the legacy stack on any route and watch this fail.
 * Checks 2 and 3 are what fire — 2 if it is registered with `component=`, 3 by any other route in.
 *
 * MEASURES: 'source'. B2 is a claim about the route tree — about what CAN be reached — and that is a
 * property of the navigation source rather than of any one rendered frame. Contract §2 rule 9 asks
 * screen assertions to be measured against the rendered surface; this is not one. What D1 and the
 * verdict gates assert about what a person SEES is measured on the render, and declaring this gate's
 * basis is what lets the two be told apart in the report.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['B2'];
export const SENTINEL = 'LEGACY-SURFACES-ABSENT OK';
export const MEASURES = 'source';

const NAV_DIR = 'src/navigation';
const AUTH_NAVIGATOR = 'src/navigation/AuthenticatedNavigator.tsx';
const CHECK_STACK = 'src/navigation/stacks/CheckStack.tsx';
const TYPES = 'src/navigation/types.ts';

/** The route that must mount the P4 flow, and the two routes that flow must have. */
const CHECK_ROUTE = 'CheckModal';
const CHECK_STACK_COMPONENT = 'CheckStack';
const CHECK_ROUTES = ['CheckInput', 'CheckVerdict'];
const CHECK_PARAM_LIST = 'CheckStackParamList';

/** The pre-P2 surfaces B2 names. Reachable from no route is the whole criterion. */
const LEGACY_SCREENS = ['PurchaseGateScreen', 'DecisionScreen'];

const posix = (p) => p.split('\\').join('/');

/**
 * CODE, WITH THE COMMENTS TAKEN OUT — the same treatment `tools/p2/gates/legacy-path-absent.mjs`
 * gives its symbol search, and for the reason its header records: once the real removal happened,
 * a raw-text search went on failing on the comments that EXPLAINED it. Forbidding a file from
 * naming what was removed pushes a campaign toward deleting its own explanations to satisfy a gate.
 */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** Every navigation source file, derived from the directory. */
const navFiles = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__') continue;
      navFiles(p, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.')) {
      acc.push(p);
    }
  }
  return acc;
};

/**
 * Every `<Something.Screen …>` in a file, as `{ navigator, name, component }`.
 *
 * ATTRIBUTES ARE SCANNED BY BRACE DEPTH, not matched with a non-greedy `[^>]*`. `options={{ … }}`
 * and a render prop both contain characters a lazy match trips over, and `nav.mjs` records what
 * that costs: its first version stopped at the first `}` it met, found two of five navigation items
 * and would have reported the app's bar as `HOME · [CHECK]`. A tag is closed by the first `>` seen
 * at brace depth zero, and nothing shallower can be fooled by nesting.
 */
const readRegistrations = (code) => {
  const out = [];
  const re = /<([A-Za-z_$][\w$]*)\.Screen\b/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    let depth = 0;
    let end = -1;
    for (let i = re.lastIndex; i < code.length; i += 1) {
      const c = code[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) { end = i; break; }
    }
    if (end === -1) continue;
    const attrs = code.slice(re.lastIndex, end);
    const name = attrs.match(/\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*['"]([^'"]*)['"]\s*\})/);
    const component = attrs.match(/\bcomponent\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/);
    out.push({
      navigator: m[1],
      name: name ? (name[1] ?? name[2] ?? name[3] ?? null) : null,
      component: component ? component[1] : null,
      /**
       * A registration whose name or component is an EXPRESSION rather than a literal — the tab bar
       * maps over `TAB_COMPONENTS`, and the dev-only probe binds its component through `require()`.
       * Both are real registrations this parser cannot resolve statically, and saying so is the
       * point: they are why check 3 exists and is not redundant with check 2.
       */
      dynamic: !name || !component,
    });
  }
  return out;
};

/** Local identifier → module specifier, for every import in a file. */
const readImports = (code) => {
  const map = new Map();
  const re = /import\s+(?:type\s+)?([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const clause = m[1];
    const spec = m[2];
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      for (const part of named[1].split(',')) {
        const bits = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
        const local = (bits[1] ?? bits[0] ?? '').trim();
        if (local) map.set(local, spec);
      }
    }
    const bare = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(bare)) map.set(bare, spec);
  }
  return map;
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── 1. the population is real ────────────────────────────────────────────────────
  const navDirAbs = join(root, NAV_DIR);
  if (!existsSync(navDirAbs)) {
    return fail(NAV_DIR + ' does not exist. B2 is a claim about the route tree, and this gate '
      + 'cannot make it over a directory that is not there — a search that finds nothing because '
      + 'it looked nowhere reads as a pass and means nothing');
  }
  for (const rel of [AUTH_NAVIGATOR, CHECK_STACK, TYPES]) {
    if (!existsSync(join(root, rel))) {
      return fail(rel + ' does not exist. This gate expects it by name, and a missing file must be '
        + 'a loud failure rather than one fewer place to look');
    }
  }

  const files = navFiles(navDirAbs);
  if (files.length === 0) {
    return fail('no source files under ' + NAV_DIR + ' — every check below would pass vacuously');
  }

  const sources = new Map();
  const routes = [];
  for (const abs of files) {
    const rel = posix(relative(root, abs));
    const code = stripComments(readFileSync(abs, 'utf8'));
    sources.set(rel, code);
    for (const r of readRegistrations(code)) routes.push({ ...r, file: rel });
  }
  if (routes.length === 0) {
    return fail('parsed ' + files.length + ' navigation file(s) and DERIVED NO ROUTES. Either the '
      + 'navigators stopped using <Navigator.Screen> or this gate\'s parser broke; both make its '
      + 'findings meaningless, and neither may be reported as a clean tree');
  }

  const dynamic = routes.filter((r) => r.dynamic);
  lines.push('population      ' + files.length + ' navigation file(s) · ' + routes.length
    + ' route registration(s), derived from the source');
  lines.push('routes          ' + routes.filter((r) => !r.dynamic)
    .map((r) => r.name + '→' + r.component).join(' · '));
  lines.push('bound by expr   ' + dynamic.length + ' registration(s) name their route or component '
    + 'through an expression this parser will not guess at ('
    + (dynamic.map((r) => (r.name ?? '?') + '→' + (r.component ?? '?') + ' in ' + r.file).join(', ') || 'none')
    + '). Check 3 is what covers them: a component reached that way still has to be NAMED in the '
    + 'file, and the legacy screens are not.');

  // ── 2. neither legacy screen is any route's component ────────────────────────────
  for (const screen of LEGACY_SCREENS) {
    const hits = routes.filter((r) => r.component === screen || String(r.component).endsWith('.' + screen));
    if (hits.length) {
      problems.push(screen + ' IS REGISTERED as the component of route(s) '
        + hits.map((h) => '"' + (h.name ?? '(unnamed)') + '" in ' + h.file).join(', ')
        + '. B2: it must be reachable from no route');
    }
    lines.push('  legacy route  ' + (hits.length ? 'REGISTERED on ' + hits.length + ' route(s)' : 'no route     ')
      + ' · ' + screen);
  }

  // ── 3. neither legacy screen is named in navigation code at all ──────────────────
  for (const screen of LEGACY_SCREENS) {
    const named = [...sources.entries()]
      .filter(([, code]) => new RegExp('\\b' + screen + '\\b').test(code))
      .map(([rel]) => rel);
    if (named.length) {
      problems.push(screen + ' is still referenced in navigation code: ' + named.join(', ')
        + '. A component reached by a children render prop or getComponent carries no `component=` '
        + 'attribute, so being registered is not the only way to be reachable');
    }
    lines.push('  legacy symbol ' + (named.length ? 'USED in ' + named.join(', ') : 'absent from navigation code')
      + ' · ' + screen);
  }

  // ── 4. CheckModal resolves to the P4 CheckStack ──────────────────────────────────
  const authRel = posix(AUTH_NAVIGATOR);
  const authSrc = sources.get(authRel) ?? '';
  const checkRoutes = routes.filter((r) => r.name === CHECK_ROUTE);
  if (checkRoutes.length !== 1) {
    problems.push(CHECK_ROUTE + ' is registered ' + checkRoutes.length + ' time(s); B2 is about '
      + 'what it renders and there must be exactly one of it to ask');
  } else {
    const route = checkRoutes[0];
    if (route.file !== authRel) {
      problems.push(CHECK_ROUTE + ' is registered in ' + route.file + ' rather than ' + authRel
        + '. Spec §4 puts the raised centre action on the authenticated stack, above the tabs');
    }
    const target = readImports(authSrc).get(String(route.component));
    const resolved = target && target.startsWith('.')
      ? posix(relative(root, resolve(join(root, dirname(route.file)), target)))
      : null;
    if (route.component !== CHECK_STACK_COMPONENT) {
      problems.push(CHECK_ROUTE + ' mounts ' + (route.component ?? '(an inline component)')
        + ', not ' + CHECK_STACK_COMPONENT + ' — B2 requires it to render the P4 flow');
    } else if (resolved === null) {
      problems.push(CHECK_STACK_COMPONENT + ' is not imported from a relative module in ' + authRel
        + ', so this gate cannot follow the mount to a file and will not assume it');
    } else if (resolved !== posix(CHECK_STACK).replace(/\.tsx$/, '')) {
      problems.push(CHECK_ROUTE + ' mounts a ' + CHECK_STACK_COMPONENT + ' imported from '
        + resolved + ', not ' + CHECK_STACK + '. The name is not the evidence; the module is');
    }
    lines.push('  check modal   ' + CHECK_ROUTE + ' → ' + (route.component ?? '(inline)')
      + ' from ' + (resolved ?? '(unresolved)') + ' · in ' + route.file);
  }

  const typesSrc = sources.get(posix(TYPES)) ?? '';
  const paramList = typesSrc.match(
    new RegExp('\\b' + CHECK_ROUTE + '\\s*:\\s*NavigatorScreenParams<\\s*([A-Za-z_$][\\w$]*)\\s*>'),
  );
  if (!paramList) {
    problems.push('could not read the param list ' + CHECK_ROUTE + ' is typed with out of ' + TYPES);
  } else if (paramList[1] !== CHECK_PARAM_LIST) {
    problems.push(CHECK_ROUTE + ' is typed with ' + paramList[1] + ' rather than ' + CHECK_PARAM_LIST
      + '. The route mounting the P4 stack while still typed by the legacy one is the half-done '
      + 'state B2 exists to catch');
  }
  lines.push('  param list    ' + CHECK_ROUTE + ': NavigatorScreenParams<' + (paramList?.[1] ?? '?') + '>');

  // ── 5. the new flow is reachable ─────────────────────────────────────────────────
  const stackRel = posix(CHECK_STACK);
  const stackRoutes = routes.filter((r) => r.file === stackRel).map((r) => r.name);
  for (const name of CHECK_ROUTES) {
    const present = stackRoutes.includes(name);
    if (!present) {
      problems.push('route ' + name + ' is not registered in ' + CHECK_STACK + '. Half of B2 is '
        + 'that the NEW flow is reachable — a gate that only checked removals would pass over an '
        + 'empty Check modal');
    }
    const declared = new RegExp('\\b' + name + '\\s*:').test(
      (typesSrc.match(new RegExp('export type ' + CHECK_PARAM_LIST + ' = \\{([\\s\\S]*?)\\n\\};')) ?? [])[1] ?? '',
    );
    if (!declared) {
      problems.push('route ' + name + ' is not declared in ' + CHECK_PARAM_LIST + ' — a route the '
        + 'param list does not know is a route nothing can navigate to in a typed call');
    }
    lines.push('  check route   ' + (present ? 'registered' : 'MISSING   ')
      + ' · typed: ' + (declared ? 'yes' : 'NO ') + ' · ' + name);
  }
  if (stackRoutes[0] !== CHECK_ROUTES[0]) {
    problems.push(CHECK_STACK + "'s first route is " + (stackRoutes[0] ?? '(none)') + ' rather than '
      + CHECK_ROUTES[0] + '. The root of a task stack is where the task starts');
  }

  if (problems.length) {
    return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));
  }

  return ok(SENTINEL, lines.join('\n'));
};
