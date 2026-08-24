/**
 * GATE: nav — criterion A1.  →  `NAV-IA OK`
 *
 *   > **A1.** *"Navigation matches Spec §24 exactly: Home · Wallet(Cards|Benefits) · [Check ●] ·
 *   > Plan(Calendar|Commitments) · More; **Check is a raised centre action opening a full-screen
 *   > modal with no tab highlighted**."*
 *
 * The forensic's verdict on the inherited shell was REWRITE, and its reason:
 *
 *   > *"**Check-as-tab is the largest IA mismatch**; every screen's entry points change anyway."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "EXACTLY" IS A CLAIM ABOUT A DOCUMENT, SO THE DOCUMENT IS WHAT IT IS CHECKED AGAINST
 *
 * The five names are not typed into this gate. They come from `tools/p2/nav-spec.json`, generated
 * by `campaign-p2/bin/p2-nav-spec.mjs` out of `authority/SMARTCARD_FINAL_PRODUCT_SPEC.md` §4 and
 * parity-checked in the pipeline preflight. A gate comparing the app against names somebody typed
 * would be comparing it against that person's reading of the spec — which is exactly how an app
 * ends up "matching" a document nobody reread.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FIVE CHECKS
 *
 *   1. **The bar matches, in order.** The IA's items against the spec's, name for name and position
 *      for position. Order is meaningful: the raised action is the centre of five because the spec
 *      puts it there.
 *   2. **Check is NOT a tab.** It must be absent from `TabParamList` and present as a route on the
 *      authenticated stack. This is the criterion's whole subject and the inherited app's largest
 *      mismatch — a tab is somewhere you ARE, a task is something you DO.
 *   3. **It opens a full-screen modal.** The route's presentation says so.
 *   4. **The segmented controls match**, both of them, segment for segment. A control the spec gives
 *      two segments and the app gives one is not the control the spec describes.
 *   5. **The segments register no routes.** A segmented control that pushed routes would make the
 *      route tree say seven where the bar says five, and A1 measures the tree.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A1'];
export const SENTINEL = 'NAV-IA OK';

const SPEC_MIRROR = join(HERE, '..', 'nav-spec.json');
const IA_MODULE = 'src/navigation/ia.ts';
const TYPES_MODULE = 'src/navigation/types.ts';
const AUTH_NAVIGATOR = 'src/navigation/AuthenticatedNavigator.tsx';
const TAB_NAVIGATOR = 'src/navigation/TabNavigator.tsx';

/**
 * Read the ordered `BOTTOM_NAVIGATION` entries out of the IA module.
 *
 * SPLIT BY BRACE DEPTH, not by regex. The first version matched each item with a non-greedy
 * `[\s\S]*?\}`, which stops at the first closing brace it meets — and Wallet's entry contains
 * `segments: [{ key: 'Cards' }, …]`, so the match ended inside a segment. It found TWO of five
 * items and reported the app's navigation bar as `HOME · [CHECK]`, which would have been a
 * spectacular false failure had the app actually been wrong.
 *
 * Depth-tracking is a few more lines and cannot be fooled by nesting.
 */
const readIa = (src) => {
  const m = src.match(/export const BOTTOM_NAVIGATION[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!m) return null;
  const body = m[1];

  // Top-level `{ ... }` groups only.
  const groups = [];
  let depth = 0, start = -1;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '{') { if (depth === 0) start = i; depth += 1; }
    else if (c === '}') { depth -= 1; if (depth === 0 && start !== -1) { groups.push(body.slice(start, i + 1)); start = -1; } }
  }

  return groups.map((g) => {
    const key = g.match(/\bkey:\s*'([^']+)'/);
    const specName = g.match(/\bspecName:\s*'([^']+)'/);
    const raised = /\braised:\s*true\b/.test(g);
    const segBlock = g.match(/segments:\s*\[([\s\S]*)\]/);
    const segments = segBlock ? [...segBlock[1].matchAll(/\bkey:\s*'([^']+)'/g)].map((x) => x[1]) : [];
    return {
      key: key ? key[1] : null,
      specName: specName ? specName[1] : null,
      raised,
      segments,
    };
  }).filter((i) => i.key !== null && i.specName !== null);
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(SPEC_MIRROR)) {
    return fail('tools/p2/nav-spec.json is missing. A1 says the navigation matches the SPEC, and '
      + 'without the spec mirrored here this gate would be comparing the app against nothing');
  }
  const spec = JSON.parse(readFileSync(SPEC_MIRROR, 'utf8'));
  const specItems = spec.items ?? [];
  if (specItems.length === 0) return fail('the spec mirror declares no navigation items — an empty bar clears nothing');

  for (const rel of [IA_MODULE, TYPES_MODULE, AUTH_NAVIGATOR, TAB_NAVIGATOR]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist');
  }
  const iaSrc = readFileSync(join(root, IA_MODULE), 'utf8');
  const typesSrc = readFileSync(join(root, TYPES_MODULE), 'utf8');
  const authSrc = readFileSync(join(root, AUTH_NAVIGATOR), 'utf8');
  const tabSrc = readFileSync(join(root, TAB_NAVIGATOR), 'utf8');

  const ia = readIa(iaSrc);
  if (!ia || ia.length === 0) return fail('could not read BOTTOM_NAVIGATION out of ' + IA_MODULE);

  // ── 1. the bar, in order ─────────────────────────────────────────────────────────
  if (ia.length !== specItems.length) {
    problems.push('the app declares ' + ia.length + ' navigation item(s) and the spec has '
      + specItems.length + ' — ' + ia.map((i) => i.specName).join(' · ') + ' vs '
      + specItems.map((i) => i.name).join(' · '));
  }
  for (let i = 0; i < Math.min(ia.length, specItems.length); i += 1) {
    if (ia[i].specName !== specItems[i].name) {
      problems.push('position ' + (i + 1) + ': the app has ' + ia[i].specName + ' and the spec has '
        + specItems[i].name + '. Order is meaningful — the raised action is the centre of five '
        + 'because the spec puts it there');
    }
    if (ia[i].raised !== specItems[i].raised) {
      problems.push(ia[i].specName + ' is ' + (ia[i].raised ? '' : 'not ') + 'raised in the app and '
        + (specItems[i].raised ? '' : 'not ') + 'raised in the spec');
    }
  }
  lines.push('bar             ' + ia.map((i) => (i.raised ? '[' + i.specName + ']' : i.specName)).join(' · '));
  lines.push('spec            ' + specItems.map((i) => (i.raised ? '[' + i.name + ']' : i.name)).join(' · '));

  // ── 2. Check is not a tab ────────────────────────────────────────────────────────
  const raised = ia.filter((i) => i.raised);
  if (raised.length !== 1) {
    problems.push('the app declares ' + raised.length + ' raised action(s); the spec has exactly one');
  } else {
    const name = raised[0].key;
    const tabList = typesSrc.match(/export type TabParamList = \{([\s\S]*?)\n\};/);
    if (!tabList) problems.push('could not read TabParamList out of ' + TYPES_MODULE);
    else if (new RegExp('^\\s*' + name + ':', 'm').test(tabList[1])) {
      problems.push(name + ' IS REGISTERED AS A TAB. A1 says it is a raised centre action, and the '
        + 'forensic called Check-as-tab the largest IA mismatch in the inherited app: a tab is '
        + 'somewhere you ARE, and a highlighted tab while a modal covers the screen is a lie about '
        + 'where the user is');
    }
    // and it must be a route on the authenticated stack instead
    const routeMatch = iaSrc.match(/RAISED_ACTION_ROUTE\s*=\s*'([^']+)'/);
    const routeName = routeMatch ? routeMatch[1] : null;
    if (!routeName) problems.push('no RAISED_ACTION_ROUTE declared in ' + IA_MODULE);
    else {
      if (!new RegExp('name="' + routeName + '"').test(authSrc)) {
        problems.push(routeName + ' is not registered on the authenticated stack. A route inside the '
          + 'tab navigator cannot cover the tab bar, and whichever tab hosted it would highlight');
      }
      // ── 3. full-screen modal ──────────────────────────────────────────────────
      const around = authSrc.slice(Math.max(0, authSrc.indexOf('name="' + routeName + '"') - 400),
        authSrc.indexOf('name="' + routeName + '"') + 400);
      if (!/fullScreenModal/.test(around)) {
        problems.push(routeName + ' is not presented as a fullScreenModal. Spec §4: it "opens a '
          + 'full-screen modal task flow"');
      }
      lines.push('raised action   ' + raised[0].specName + ' → ' + routeName
        + ' on the authenticated stack, fullScreenModal, not a tab');
    }
    // The tab bar must render it outside Tab.Navigator, or it is a tab by another name.
    if (!/RaisedCheckAction|RAISED_ACTION/.test(tabSrc)) {
      problems.push(TAB_NAVIGATOR + ' does not render the raised action — the bar would have four '
        + 'items and no Check');
    }
  }

  // ── 4. the segmented controls ────────────────────────────────────────────────────
  const specSegments = spec.segments ?? {};
  for (const [specName, segments] of Object.entries(specSegments)) {
    const item = ia.find((i) => i.specName === specName);
    if (!item) { problems.push('the spec gives ' + specName + ' a segmented control and the app has no such item'); continue; }
    const want = segments.join('|');
    const got = item.segments.join('|');
    if (want !== got) {
      problems.push(specName + "'s segmented control is " + (got || '(none)') + ' in the app and '
        + want + ' in the spec');
    }
    lines.push('segments        ' + specName + '  ' + item.segments.join(' | '));
  }
  for (const item of ia) {
    if (item.segments.length > 0 && !specSegments[item.specName]) {
      problems.push('the app gives ' + item.specName + ' a segmented control the spec does not');
    }
  }

  // ── 5. the segments register no routes ───────────────────────────────────────────
  for (const [, segments] of Object.entries(specSegments)) {
    for (const seg of segments) {
      const tabList = typesSrc.match(/export type TabParamList = \{([\s\S]*?)\n\};/);
      if (tabList && new RegExp('^\\s*' + seg + ':', 'm').test(tabList[1])) {
        problems.push('the segment ' + seg + ' is registered as a TAB. Segments swap content inside '
          + 'one tab; a segment that is a tab makes the bar say more than the spec does');
      }
    }
  }

  if (spec.noTabHighlighted !== true) {
    problems.push('the spec mirror does not carry "no tab is highlighted" — the parser lost the '
      + 'sentence that makes Check a task rather than a tab');
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
