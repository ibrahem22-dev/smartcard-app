/**
 * GATE: analytics-boundary — criterion B6.  →  `ANALYTICS-BOUNDARY OK`
 *
 *   > **B6.** *"All instrumentation passes through **one** provider-agnostic `track(event, props)`
 *   > boundary; **no vendor SDK is reachable from a screen, hook or engine** (OD-5)."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NO VENDOR SDK IS REACHABLE" IS CHECKED TWICE, BECAUSE THERE ARE TWO WAYS TO FAIL IT
 *
 *   1. **A vendor SDK is a dependency.** Then it is in the bundle whether or not a screen imports
 *      it, and a native analytics module initialises itself from the app delegate — no JavaScript
 *      involved. The gate reads `package.json`, because a scan of `src/` cannot see this at all.
 *   2. **A screen imports something that sends.** The gate walks the runtime graph and refuses any
 *      module outside `src/analytics/**` that names a transport, a vendor, or an outbound primitive
 *      in an analytics context.
 *
 * The first is the one a code review misses. `expo-firebase-analytics` in a dependency list is one
 * line nobody reads, and it collects on launch.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "ONE BOUNDARY" IS A COUNT
 *
 * Exactly one module may export `track`. Two would mean two allowlists, two consent checks, and one
 * of them eventually falling behind — which is the shape B7's prohibition is really about.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['B6'];
export const SENTINEL = 'ANALYTICS-BOUNDARY OK';

const BOUNDARY_DIR = 'src/analytics/';
const TRACK_MODULE = 'src/analytics/track.ts';
const SUITE = 'src/analytics/__tests__/analyticsBoundary.test.ts';

/**
 * Analytics and crash-reporting SDKs, by package name.
 *
 * A list rather than a pattern, because the names have nothing in common — and it is checked
 * against the DECLARATION rather than `node_modules`, which is the lesson Phase 3 paid for: a
 * polluted install made every "clean" measurement a measurement of the wrong tree.
 */
const VENDOR_SDKS = [
  'firebase', '@react-native-firebase/analytics', 'expo-firebase-analytics',
  'amplitude-js', '@amplitude/analytics-react-native', 'mixpanel-react-native',
  'posthog-react-native', 'posthog-js', '@segment/analytics-react-native',
  '@sentry/react-native', 'sentry-expo', 'bugsnag-react-native', '@bugsnag/react-native',
  'react-native-google-analytics-bridge', '@datadog/mobile-react-native',
  'appcenter-analytics', 'react-native-mixpanel', 'countly-sdk-react-native-bridge',
  'matomo-tracker-react-native', '@aptabase/react-native',
];

/** How a module reaches the network. Outside the boundary directory, in an analytics context. */
const OUTBOUND = [
  [/\bfetch\s*\(/, 'fetch('],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bsendBeacon\s*\(/, 'sendBeacon('],
  [/\bnew\s+WebSocket\b/, 'new WebSocket'],
];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => {
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, b, c) => b + blank(c));
};

const lineAt = (code, i) => code.slice(0, i).split('\n').length;
const escapeForRegExp = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, TRACK_MODULE))) {
    return fail(TRACK_MODULE + ' does not exist. B6 asks for ONE boundary, and a criterion satisfied '
      + 'by having no instrumentation at all would be satisfied by an app that cannot measure '
      + 'anything — which is not what OD-5 permitted');
  }

  // ── 1. no vendor SDK is a dependency ─────────────────────────────────────────────
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const vendors = VENDOR_SDKS.filter((v) => Object.prototype.hasOwnProperty.call(declared, v));
  for (const v of vendors) {
    problems.push('"' + v + '" is a declared dependency. A native analytics module initialises '
      + 'itself from the app delegate with no JavaScript involved, so a scan of src/ cannot see it '
      + 'and no screen has to import it for it to collect on launch');
  }
  // The Expo config's plugin list is the other place a native module gets linked.
  for (const configFile of ['app.config.js', 'app.json']) {
    const p = join(root, configFile);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const v of VENDOR_SDKS) {
      if (text.includes(v)) problems.push(configFile + ' names "' + v + '" — an Expo plugin links a native module into the binary');
    }
  }

  // ── 2. exactly one module exports track ──────────────────────────────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');

  const exporters = [];
  const outbound = [];
  const vendorImports = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));

    if (/export\s+(async\s+)?function\s+track\b|export\s+const\s+track\s*[=:]/.test(code)) {
      exporters.push(rel);
    }
    for (const v of VENDOR_SDKS) {
      if (new RegExp("['\"]" + escapeForRegExp(v) + "(/|['\"])").test(code)) {
        vendorImports.push({ file: rel, vendor: v });
      }
    }
    if (rel.startsWith(BOUNDARY_DIR)) continue;
    // Outside the boundary: an outbound primitive in a file that also talks about analytics.
    if (!/analytic|telemetr|\btrack\b|beacon|collect/i.test(code)) continue;
    for (const [re, what] of OUTBOUND) {
      const m = re.exec(code);
      if (m) outbound.push({ file: rel, line: lineAt(code, m.index), what });
    }
  }

  if (exporters.length === 0) {
    problems.push('nothing exports track(). B6 asks for one boundary and there is none');
  } else if (exporters.length > 1) {
    problems.push('track() is exported from ' + exporters.length + ' modules: ' + exporters.join(', ')
      + '. Two boundaries mean two allowlists and two consent checks, and one of them eventually '
      + 'falls behind');
  } else if (exporters[0] !== TRACK_MODULE) {
    problems.push('track() is exported from ' + exporters[0] + ' and not ' + TRACK_MODULE);
  }

  for (const v of vendorImports.slice(0, 4)) {
    problems.push(v.file + ' imports the vendor SDK "' + v.vendor + '". OD-5 requires the '
      + 'architecture not to assume analytics is local-only — which cuts both ways: it must not '
      + 'assume a particular remote one either');
  }
  for (const o of outbound.slice(0, 4)) {
    problems.push(o.file + ':' + o.line + ' uses ' + o.what + ' in a file that talks about '
      + 'analytics, outside ' + BOUNDARY_DIR + '. Every instrumentation path goes through one '
      + 'boundary or the boundary is decorative');
  }

  // ── 3. the boundary is provider-agnostic ─────────────────────────────────────────
  const trackSource = stripComments(readFileSync(join(root, TRACK_MODULE), 'utf8'));
  for (const v of VENDOR_SDKS) {
    if (trackSource.includes(v)) {
      problems.push(TRACK_MODULE + ' names "' + v + '". The boundary is PROVIDER-AGNOSTIC: the day '
        + 'a vendor is chosen the change must be one module, and that module is the transport');
    }
  }
  if (!/transport/i.test(trackSource)) {
    problems.push(TRACK_MODULE + ' has no transport seam. Without one, choosing a provider means '
      + 'editing the boundary rather than the thing behind it');
  }

  // ── run the suite ────────────────────────────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(join(root, SUITE))) problems.push(SUITE + ' does not exist');
  else if (!existsSync(jest)) problems.push('no jest binary');
  else {
    const r = spawnSync(process.execPath, [jest, SUITE, '--verbose', '--ci'], {
      cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
    const out = String(r.stdout ?? '') + String(r.stderr ?? '');
    for (const name of [
      'SENDS a declared event with declared props — the control',
      'REFUSES an event that is not on the allowlist',
      'ships a transport that sends nothing, and says why',
    ]) {
      const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(name)).test(out);
      const skipped = new RegExp('(○|skipped)\\s+' + escapeForRegExp(name)).test(out);
      if (skipped) problems.push('SKIPPED: "' + name + '"');
      else if (!passed) problems.push('did not pass: "' + name + '"');
    }
    lines.push('suite           ' + (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim());
  }

  lines.push('boundary        ' + (exporters[0] ?? '(none)') + ' · ' + exporters.length + ' module(s) export track()');
  lines.push('vendor SDKs     ' + vendors.length + ' declared of ' + VENDOR_SDKS.length + ' checked · '
    + vendorImports.length + ' imported anywhere in src/');
  lines.push('outbound        ' + outbound.length + ' site(s) outside ' + BOUNDARY_DIR + ' in an analytics context');
  lines.push('population      ' + files.length + ' source file(s)');
  lines.push('');
  lines.push('NO PROVIDER HAS BEEN SELECTED, and that is the current state rather than an oversight.');
  lines.push('  OD-5 permits an external privacy-safe service; choosing one carries a data-processing');
  lines.push('  agreement that is not a campaign\'s to sign. The shipped transport sends nothing, which');
  lines.push('  makes B8\'s zero true by construction as well as by policy.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
