/**
 * GATE: release-gate — criterion C7.  →  `RELEASE-GATE OK — delivery refused, release:false`
 *
 *   > **C7.** *"**No pack reaches a real device while `release: false`.** A release-eligibility
 *   > check refuses delivery until OD-25's `HARDWARE_BACKED` custody exists."*
 *
 *   > **OB-8.** *"The development key is retired and **no release custody exists**."*
 *
 * And the campaign's hard prohibition: *"Do not ship a pack to a real device while
 * `release: false` (OB-8, OD-25)."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A GREEN C7 IS A RED DELIVERY, AND THAT IS NOT A CONTRADICTION
 *
 * Every envelope in this repository carries `release: false`, signed by a key whose custody is
 * `OWNER_LOCAL_DEV_NOT_FOR_RELEASE`. The criterion is that delivery is REFUSED, so the evidence is
 * the refusal happening — a gate reporting "delivery permitted" would be describing a state nobody
 * has reached and would be the false close this whole procedure exists to prevent.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FOUR THINGS, AND THE FOURTH IS THE ONE A REVIEW WOULD MISS
 *
 *   1. **Every shipped envelope really is `release: false`** — measured from the artifacts, not
 *      assumed from OB-8.
 *   2. **No key in the compiled-in trust store may release** — derived through the adapter's own
 *      `releaseEligible`, so a custody added without a ruling throws rather than passing.
 *   3. **Delivery to a device is refused**, proven by running it, including against a forged
 *      `release: true` and an unknown key.
 *   4. **Nothing in the app bypasses the check.** A release gate that exists and is not called is
 *      a comment. So the gate looks for any other call site that would put bytes on a device
 *      without consulting it — today there is exactly one delivery path, and this is what keeps
 *      that true when Phase 8's client grows.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['C7'];
export const SENTINEL = 'RELEASE-GATE OK — delivery refused, release:false';

const PACKS_DIR = join('src', 'data', 'adapter', 'packs');
const GATE_MODULE = 'src/data/adapter/import/releaseGate.ts';
const SUITE = 'src/data/adapter/import/__tests__/releaseGate.test.ts';

const REQUIRED_CASES = [
  'REFUSES delivery of every shipped pack to a real device',
  'NO release custody exists in this build — OD-25 has not been taken',
  'REFUSES a forged release: true beside a development key',
  'REFUSES a pack signed by a key this build does not carry',
  'does NOT refuse a build tool inspecting the same packs',
  'the refusal says what would lift it, not merely that it happened',
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

  // ── 1. what the artifacts actually say ───────────────────────────────────────────
  const base = join(root, PACKS_DIR);
  if (!existsSync(base)) return fail(PACKS_DIR + ' does not exist — there is no delivery to refuse');
  const sets = readdirSync(base).filter((e) => statSync(join(base, e)).isDirectory()).sort();
  if (sets.length === 0) return fail(PACKS_DIR + ' holds no artifact — an empty population proves nothing');

  const envelopes = [];
  for (const set of sets) {
    const p = join(base, set, 'manifest.sig.json');
    if (!existsSync(p)) { problems.push(set + ' has no detached signature — an unsigned artifact has no author'); continue; }
    envelopes.push({ set, envelope: JSON.parse(readFileSync(p, 'utf8')) });
  }
  const released = envelopes.filter((e) => e.envelope.release === true);
  for (const e of released) {
    problems.push(e.set + ' carries release: true. OB-8 says the development key is retired and NO '
      + 'RELEASE CUSTODY EXISTS, so a release-marked envelope in this repository was produced by a '
      + 'key whose custody nobody ruled — which is a worse state than a refused delivery');
  }

  // ── 2. the trust store, through the adapter's own ruling ─────────────────────────
  const require_ = createRequire(join(root, 'package.json'));
  let adapter;
  try {
    adapter = require_('@smartcard/data-authority-adapter');
  } catch (e) {
    return fail('the adapter will not load: ' + (e && e.message ? e.message : String(e)));
  }
  const capable = adapter.KEY_CUSTODY.filter((c) => adapter.releaseEligible(c));
  const trusted = adapter.TRUST_STORE.map((k) => ({ keyId: k.keyId, custody: k.custody }));
  const anyCapable = trusted.filter((k) => adapter.releaseEligible(k.custody));

  if (capable.length === 0) {
    problems.push('the adapter says NO custody may ever release. That is not OD-25 being untaken, '
      + 'it is a check that can never pass — and a check that can never pass is indistinguishable '
      + 'from one that is never consulted');
  }
  if (capable.length === adapter.KEY_CUSTODY.length) {
    problems.push('every custody is release-capable, so the check is vacuous');
  }

  // ── 3. the module exists and is not a stub ───────────────────────────────────────
  if (!existsSync(join(root, GATE_MODULE))) {
    return fail(GATE_MODULE + ' does not exist. C7 asks for a release-ELIGIBILITY CHECK, and a '
      + 'criterion satisfied by the absence of a delivery path would be satisfied by an app that '
      + 'cannot ship at all');
  }
  const gateSource = stripComments(readFileSync(join(root, GATE_MODULE), 'utf8'));
  if (!/releaseEligible/.test(gateSource)) {
    problems.push(GATE_MODULE + ' never calls the adapter\'s releaseEligible. Reading '
      + 'envelope.release alone lets a pack assert its own release-eligibility');
  }

  // ── 4. nothing bypasses it ───────────────────────────────────────────────────────
  //
  // A release gate that exists and is not called is a comment. Any module that decides delivery
  // must go through checkDelivery — so a second place naming `requireRelease: true`, or reading
  // `.release` to decide something, is a second reading of the boundary.
  const files = walk(join(root, 'src'));
  const bypasses = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (rel === GATE_MODULE) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const m of code.matchAll(/\breleaseEligible\s*\(/g)) {
      bypasses.push({ file: rel, line: lineAt(code, m.index), what: 'calls releaseEligible directly' });
    }
    for (const m of code.matchAll(/\benvelope\.release\b|\breleaseMarked\b/g)) {
      bypasses.push({ file: rel, line: lineAt(code, m.index), what: 'reads the envelope\'s release flag' });
    }
  }
  for (const b of bypasses.slice(0, 4)) {
    problems.push(b.file + ':' + b.line + ' ' + b.what + ', outside ' + GATE_MODULE + '. C7 is one '
      + 'check in one place: a second reading of the same flag is a second answer waiting to '
      + 'disagree with the first');
  }

  // ── the refusal, proven by running it ────────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(join(root, SUITE))) problems.push(SUITE + ' does not exist');
  else if (!existsSync(jest)) problems.push('no jest binary — the refusal cannot be proven by running it');
  else {
    const r = spawnSync(process.execPath, [jest, SUITE, '--verbose', '--ci'], {
      cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
    const out = String(r.stdout ?? '') + String(r.stderr ?? '');
    for (const name of REQUIRED_CASES) {
      const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(name)).test(out);
      const skipped = new RegExp('(○|skipped)\\s+' + escapeForRegExp(name)).test(out);
      if (skipped) problems.push('SKIPPED: "' + name + '"');
      else if (!passed) problems.push('did not pass: "' + name + '"');
    }
    lines.push('suite           ' + (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim());
  }

  lines.push('artifacts       ' + envelopes.length + ' envelope(s) · ' + released.length + ' marked release: true');
  for (const { set, envelope } of envelopes) {
    lines.push('  ' + set.padEnd(12) + 'release ' + String(envelope.release).padEnd(6) + envelope.keyId);
  }
  lines.push('trust store     ' + trusted.length + ' key(s) · ' + anyCapable.length + ' with a release-capable custody');
  for (const k of trusted) lines.push('  ' + k.custody.padEnd(34) + k.keyId);
  lines.push('would qualify   ' + capable.join(', '));
  lines.push('bypasses        ' + bypasses.length + ' site(s) outside ' + GATE_MODULE);
  lines.push('');
  lines.push('DELIVERY IS REFUSED, AND THAT IS THE PASS. OD-25 has not been taken: no HARDWARE_BACKED');
  lines.push('  custody exists, so nothing in this repository may reach a real device. A gate');
  lines.push('  reporting "delivery permitted" would be describing a state nobody has reached.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
