/**
 * GATE: consent — criterion B8.  →  `CONSENT OK — 0 outbound with consent off`
 *
 *   > **B8.** *"Consent is **opt-in, default off**, requested only **after the first successful
 *   > verdict**, stored as vault data; with analytics off the release-gate network trace shows
 *   > **zero** outbound analytics requests (OD-8)."*
 *
 *   > **OD-8.** *"**OPT-IN.** External analytics never begins by default… **nothing collected,
 *   > buffered or queued before consent**; consent requested after the first successful verdict,
 *   > **never during onboarding**… turning off stops collection immediately."*
 *
 *   > `P2_CAMPAIGN_PLAN.md` Gate 10: *"`CONSENT OK — 0 outbound with consent off`, **measured by an
 *   > actual network trace**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ZERO IS READ OUT OF A TRACE THAT PROVED IT CAN COUNT
 *
 * A trace reporting zero is worthless without a control showing it records anything at all — the
 * campaign has already found four checks that could not fail. So the gate requires the trace's own
 * control case to have passed: a `fetch`, a `sendBeacon` and a tracking-pixel `Image` are issued
 * and all three are caught, and only then does a zero mean something.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NOTHING COLLECTED, BUFFERED OR QUEUED" IS SCANNED FOR, NOT TAKEN ON TRUST
 *
 * The ordinary implementation of opt-in analytics buffers events and flushes them when consent
 * arrives, so the first upload contains everything the user did before they agreed. OD-8 forbids it
 * in as many words, and the way to check is to look for the buffer: an array, a queue, a pending
 * list anywhere in the analytics directory.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE TRACE'S LIMIT IS PRINTED RATHER THAN IMPLIED
 *
 * It is a JS-level trace. It proves nothing leaves the JavaScript runtime; it cannot prove a native
 * module made a request. The reason it does not have to is measured by `analytics-boundary`: **no
 * analytics SDK is a dependency**, so there is no native module to make one. A packet capture on
 * hardware is C2, and Phase 11.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['B8'];
export const SENTINEL = 'CONSENT OK — 0 outbound with consent off';

const ANALYTICS_DIR = join('src', 'analytics');
const CONSENT_MODULE = 'src/analytics/consent.ts';
const TRACK_MODULE = 'src/analytics/track.ts';
const TRACE_SUITE = 'src/analytics/__tests__/networkTrace.test.ts';
const CONSENT_SUITE = 'src/analytics/__tests__/analyticsBoundary.test.ts';

const TRACE_CASES = [
  ['the trace itself catches a request — the control that makes every zero below mean something',
    'without it, "0 outbound" is indistinguishable from a trace that records nothing'],
  ['EVERY declared event, with consent UNASKED, makes ZERO outbound requests', 'default off'],
  ['EVERY declared event, with consent DENIED, makes ZERO outbound requests', 'a decline is honoured'],
];

const CONSENT_CASES = [
  ['defaults to UNASKED, which is not GRANTED and not DENIED', 'opt-in, default off'],
  ['DROPS a refused event — nothing is collected, buffered or queued', 'OD-8, in as many words'],
  ['turning consent off stops collection immediately, with nothing in flight', 'OD-8'],
  ['NEVER during onboarding', 'OD-8'],
  ['NOT before a verdict has succeeded', 'after the FIRST SUCCESSFUL verdict'],
  ['MAY be requested once onboarding is done and a verdict has succeeded — the control',
    'without it, "never asks" would pass every timing test'],
];

/** The shape of a buffer. Any of these inside the analytics directory is a queue by another name. */
const BUFFER_SHAPES = [
  [/\b(queue|buffer|pending|backlog|outbox)\b\s*[:=]/i, 'a queue by name'],
  [/\.push\s*\(/, 'an array being appended to'],
  [/setTimeout|setInterval/, 'a deferred send'],
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

  for (const rel of [CONSENT_MODULE, TRACK_MODULE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist');
  }

  // ── opt-in, default off, three states, vault-stored ──────────────────────────────
  const consent = stripComments(readFileSync(join(root, CONSENT_MODULE), 'utf8'));
  const states = (consent.match(/CONSENT_STATES\s*=\s*\[([^\]]*)\]/) ?? [])[1] ?? '';
  const members = (states.match(/'([A-Z_]+)'/g) ?? []).map((s) => s.replace(/'/g, ''));
  const defaultState = (consent.match(/DEFAULT_CONSENT[^=]*=\s*'([A-Z_]+)'/) ?? [])[1];
  const vaultKey = (consent.match(/CONSENT_VAULT_KEY\s*=\s*'([^']+)'/) ?? [])[1];

  if (defaultState !== 'UNASKED') {
    problems.push('the default consent state is "' + defaultState + '". OD-8: OPT-IN, default off — '
      + 'and the default is UNASKED rather than DENIED because a user who has never been asked has '
      + 'not declined');
  }
  for (const required of ['UNASKED', 'GRANTED', 'DENIED']) {
    if (!members.includes(required)) {
      problems.push('the consent domain does not declare ' + required + '. Collapsing "never asked" '
        + 'and "said no" makes "have you asked?" and "did they say yes?" one question with one '
        + 'wrong answer');
    }
  }
  if (!vaultKey) problems.push(CONSENT_MODULE + ' declares no vault key — B8 says consent is stored as VAULT DATA');
  else if (!/^(app:|profile_)/.test(vaultKey)) {
    problems.push('the consent key "' + vaultKey + '" is outside the vault\'s namespaces (app:, profile_)');
  }

  // ── no buffer anywhere in the analytics directory ────────────────────────────────
  const files = walk(join(root, ANALYTICS_DIR));
  if (files.length === 0) return fail(ANALYTICS_DIR + ' holds no source — an empty population proves nothing');
  const buffers = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const [re, what] of BUFFER_SHAPES) {
      const m = re.exec(code);
      if (m) buffers.push({ file: rel, line: lineAt(code, m.index), what, text: m[0].trim() });
    }
  }
  for (const b of buffers.slice(0, 4)) {
    problems.push(b.file + ':' + b.line + ' looks like ' + b.what + ' ("' + b.text + '"). OD-8: '
      + 'NOTHING COLLECTED, BUFFERED OR QUEUED before consent. The usual opt-in implementation '
      + 'flushes on grant, so the first upload contains everything the user did before they agreed');
  }

  // ── the trace, and the timing rules, proven by running them ──────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(jest)) return fail('no jest binary — the trace cannot be measured by running it');

  let traceOut = '';
  for (const [suite, cases] of [[TRACE_SUITE, TRACE_CASES], [CONSENT_SUITE, CONSENT_CASES]]) {
    if (!existsSync(join(root, suite))) { problems.push(suite + ' does not exist'); continue; }
    const r = spawnSync(process.execPath, [jest, suite, '--verbose', '--ci'], {
      cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
    const out = String(r.stdout ?? '') + String(r.stderr ?? '');
    if (suite === TRACE_SUITE) traceOut = out;
    for (const [name, why] of cases) {
      const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(name)).test(out);
      const skipped = new RegExp('(○|skipped)\\s+' + escapeForRegExp(name)).test(out);
      if (skipped) problems.push('SKIPPED: "' + name + '" (' + why + ')');
      else if (!passed) problems.push('did not pass: "' + name + '" (' + why + ')');
    }
    lines.push('suite           ' + suite.split('/').pop() + ' · ' + (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim());
  }

  const traceFailed = /Tests:.*?\d+ failed/.test(traceOut);
  if (traceFailed) problems.push('the network trace suite has failing cases');

  lines.push('consent         default ' + defaultState + ' · ' + members.length + ' states: ' + members.join(', '));
  lines.push('stored at       ' + vaultKey + ' (vault data)');
  lines.push('buffers         ' + buffers.length + ' queue-shaped construct(s) in ' + files.length + ' analytics file(s)');
  lines.push('outbound        0 with consent off, across every declared event');
  lines.push('');
  lines.push('WHAT THE TRACE IS. Every way JavaScript starts a request is replaced before the');
  lines.push('  analytics path runs: fetch, XMLHttpRequest, WebSocket, sendBeacon, and Image —');
  lines.push('  the last because a tracking pixel uses none of the others and is exactly how');
  lines.push('  analytics has historically evaded a fetch spy. Its control issues three and catches');
  lines.push('  all three, so the zero is a measurement rather than a silence.');
  lines.push('');
  lines.push('WHAT IT IS NOT. A packet capture. It proves nothing leaves the JavaScript runtime; it');
  lines.push('  cannot prove a native module made a request. The reason it does not have to is');
  lines.push('  measured by analytics-boundary: NO ANALYTICS SDK IS A DEPENDENCY, so there is no');
  lines.push('  native module to make one. Hardware is C2, and Phase 11.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
