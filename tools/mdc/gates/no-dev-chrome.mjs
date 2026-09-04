/**
 * GATE: no-dev-chrome — criterion T5.  →  `NO-DEV-CHROME OK`
 *
 *   > **T5.** *"NO DEV CHROME: the release build carries no probe screens, debug tints, floating
 *   > dev controls or development-only affordances, proven on the device build, not the dev client"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PROVEN ON THE DEVICE BUILD, NOT THE DEV CLIENT" IS THE WHOLE INSTRUCTION
 *
 * The dev affordances this app carries are real and named: an EngineProbe diagnostics screen under
 * `src/dev/`, its entry row in Settings, its route in MoreStack, and a debug-unlock button on the
 * LockScreen with a `debugUnlock` action in the auth context. Every one of them is guarded by
 * `__DEV__`, which React Native's release minifier resolves to `false` and then dead-code-eliminates
 * the guarded branch. This gate does not take that on faith. It proves the elimination three ways,
 * on the ARTIFACT and on the DEVICE, not on the dev client where `__DEV__` is true and all of it is
 * present by design.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FOUR CLAUSES, EACH FALSIFIABLE ON ITS OWN
 *
 *   1. BIND. The evidence records the on-device APK sha256 equal to the host artifact, the package
 *      is app.trevik.mobile, and the variant is the release build. The APK on disk is re-hashed and
 *      must still be that artifact (the offline gate's clause 6, for the same reason: a claim about
 *      a build is only a claim about the build still on disk).
 *
 *   2. NO STATIC DEV IMPORT (source). A static `import … from '…/dev/…'` bundles that module
 *      unconditionally, `__DEV__` or not. The one legitimate reference is the `require()` inside
 *      MoreStack's `{__DEV__ ? … : null}` block, which the release build eliminates. So: zero static
 *      imports of `src/dev/**` anywhere in `src`, and the guarded require present in MoreStack.
 *      Add a static import and this clause names the file.
 *
 *   3. NOT IN THE SHIPPED BUNDLE (artifact — the primary proof). The gate opens the release APK,
 *      extracts `assets/index.android.bundle`, and asserts the dev-affordance MARKER strings are
 *      absent from the bytes that actually ship: `ENGINE PROBE`, `devProbeInputs`,
 *      `retry live BOI fetch`. These are code identifiers and unique UI text of the dev screen, not
 *      translation data, so their absence proves the `__DEV__` branch was eliminated rather than
 *      merely not rendered. React Native's own runtime strings (`DevMenu`, `__DEV__`,
 *      `localhost:8081`) are NOT asserted absent — they ship inert in every release bundle and
 *      asserting their absence would be a check that can never pass, which is its own defect.
 *
 *   4. ABSENT ON THE DEVICE (device). The captured Settings view tree does not carry the
 *      `ENGINE PROBE (dev)` row, and the captured Lock view tree does not carry the dev-unlock
 *      control. Behavioural confirmation on the artifact itself.
 *
 * T5's row declares `negativeControl: null`. None is invented. Each clause above is falsified
 * during validation by a deliberate mutation of its own subject, never by a control in the ledger.
 *
 * MEASURES: device — a captured run on the release artifact, cross-checked against the shipped bundle.
 */
import { existsSync, readFileSync, readdirSync, openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

import { fail, okOverPopulation } from '../lib/report.mjs';
import { bindToRecordedArtifact } from '../lib/artifacts.mjs';
import { stripComments } from '../lib/source.mjs';

export const SENTINEL = 'NO-DEV-CHROME OK';
export const FAILURE_SENTINEL = 'NO-DEV-CHROME FAILED';
export const MEASURES = 'device';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const CAMPAIGN_DIR = join(ROOT, '..', 'smartcard-data-pipeline', 'campaign-master');
const EVIDENCE_DIR = join(CAMPAIGN_DIR, 'evidence', 'external', 'T5');
const CAPTURES_DIR = join(EVIDENCE_DIR, 'captures');
const EVIDENCE_FILE = join(EVIDENCE_DIR, 'EVIDENCE.txt');
const APK = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

/* The dev-affordance markers that MUST NOT reach the shipped bundle. Code identifiers and unique
   UI text of the dev screen — never translation data, so their absence means the code went. */
const FORBIDDEN_IN_BUNDLE = ['ENGINE PROBE', 'devProbeInputs', 'retry live BOI fetch'];

const rel = (p) => relative(ROOT, p).split('\\').join('/');
const read = (p) => readFileSync(p, 'utf8');
const textOf = (xml) => (xml.match(/text="([^"]*)"/g) || []).join('\n')
  + '\n' + (xml.match(/content-desc="([^"]*)"/g) || []).join('\n');

/**
 * Extract one entry from a ZIP (the APK) by name, self-contained so the gate proves the artifact
 * rather than trusting a recorded grep. Reads only the ranges it needs (the file is ~114 MB): the
 * End-Of-Central-Directory tail, the central directory, and the one local entry.
 */
const extractZipEntry = (apkPath, wantName) => {
  const fd = openSync(apkPath, 'r');
  try {
    const size = fstatSync(fd).size;
    // EOCD: signature 0x06054b50, within the last 64 KiB + 22 bytes.
    const tailLen = Math.min(size, 65557);
    const tail = Buffer.alloc(tailLen);
    readSync(fd, tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('no EOCD record — not a zip');
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    const cd = Buffer.alloc(cdSize);
    readSync(fd, cd, 0, cdSize, cdOffset);
    // Walk central directory entries (signature 0x02014b50).
    let p = 0;
    while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const localOffset = cd.readUInt32LE(p + 42);
      const name = cd.toString('utf8', p + 46, p + 46 + nameLen);
      if (name === wantName) {
        const method = cd.readUInt16LE(p + 10);
        const compSize = cd.readUInt32LE(p + 20);
        // Local header: read 30 bytes for its own name/extra lengths.
        const lh = Buffer.alloc(30);
        readSync(fd, lh, 0, 30, localOffset);
        if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error('bad local header for ' + wantName);
        const lhNameLen = lh.readUInt16LE(26);
        const lhExtraLen = lh.readUInt16LE(28);
        const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
        const comp = Buffer.alloc(compSize);
        readSync(fd, comp, 0, compSize, dataStart);
        if (method === 0) return comp; // stored
        if (method === 8) return inflateRawSync(comp); // deflate
        throw new Error('unsupported compression method ' + method + ' for ' + wantName);
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  } finally {
    closeSync(fd);
  }
};

/** Every .ts/.tsx under src (skipping tests), plus App.tsx. */
const sourceFiles = () => {
  const out = [join(ROOT, 'App.tsx')];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const q = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(q); }
      else if (/\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(q);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
};

export const run = async () => {
  const problems = [];
  const clauses = [];

  if (!existsSync(EVIDENCE_DIR) || !existsSync(EVIDENCE_FILE)) {
    return fail(`no T5 device evidence at ${rel(EVIDENCE_DIR)} — a DEVICE criterion is not satisfiable without a captured run`);
  }
  const evidence = read(EVIDENCE_FILE);

  /* 1. BIND — the run is tied to exactly one release artifact, and that artifact is still on disk. */
  const deviceSha = (evidence.match(/sha256 on device\s+([0-9a-f]{64})/) || [])[1];
  const hostSha = (evidence.match(/sha256 host artifact\s+([0-9a-f]{64})/) || [])[1];
  if (!deviceSha || !hostSha) problems.push('evidence does not record both the on-device and host APK sha256');
  else if (deviceSha !== hostSha) problems.push(`the APK on the device (${deviceSha.slice(0, 12)}) is not the host artifact (${hostSha.slice(0, 12)})`);
  if (!/package\s+app\.trevik\.mobile/.test(evidence)) problems.push('evidence does not record package app.trevik.mobile');
  if (!/RELEASE build variant/i.test(evidence)) problems.push('evidence does not record that the artifact is the RELEASE build variant, not a dev client');
  if (!/ro\.serialno/.test(evidence) || !/avd\s+Pixel_API36_stable/.test(evidence)) {
    problems.push('evidence does not record the authorised emulator identity (serialno + AVD)');
  }
  // PD-MDC-070: bound to STAGE-2's committed artifact record; the APK on disk may be a later stage's recorded build.
  const artifact = bindToRecordedArtifact({ campaignDir: CAMPAIGN_DIR, apkPath: APK, hostSha, stage: 'STAGE-2' });
  problems.push(...artifact.problems); clauses.push(...artifact.clauses);

  /* 2. NO STATIC DEV IMPORT — a static import bundles the dev screen unconditionally. */
  const files = sourceFiles();
  const staticDevImports = files.filter((f) => /(^|\n)\s*import[^\n]*from\s*['"][^'"]*\/dev\/[^'"]*['"]/.test(stripComments(read(f))));
  if (staticDevImports.length > 0) {
    problems.push(`static import(s) of src/dev/** would bundle dev chrome unconditionally: ${staticDevImports.map(rel).join(', ')}`);
  }
  const moreStack = join(ROOT, 'src', 'navigation', 'stacks', 'MoreStack.tsx');
  if (existsSync(moreStack)) {
    const src = read(moreStack);
    const guarded = /\{__DEV__\s*\?[\s\S]{0,600}?require\(\s*['"][^'"]*dev\/EngineProbeScreen['"]\s*\)/.test(src);
    if (!guarded) problems.push('MoreStack.tsx does not register EngineProbe through a __DEV__-guarded require — the one legitimate dev path is missing or ungated');
    else clauses.push('the only dev-screen reference is a __DEV__-guarded require in MoreStack; no static dev import anywhere');
  } else {
    problems.push('src/navigation/stacks/MoreStack.tsx is absent — cannot confirm how the dev route is registered');
  }

  /* 3. NOT IN THE SHIPPED BUNDLE — the primary proof, read from the APK itself. */
  if (!existsSync(APK)) {
    problems.push('no release APK on disk to inspect the shipped bundle');
  } else {
    let bundle;
    try { bundle = extractZipEntry(APK, 'assets/index.android.bundle'); }
    catch (e) { problems.push(`could not read the shipped bundle from the APK: ${e.message}`); bundle = null; }
    if (bundle === null && !problems.some((p) => p.includes('shipped bundle'))) {
      problems.push('assets/index.android.bundle is not present in the release APK');
    }
    if (bundle) {
      const bundleSha = createHash('sha256').update(bundle).digest('hex');
      // The bundle on disk belongs to whichever artifact is on disk: the frozen one must match the
      // evidence; a later recorded build must match ITS record's bundle sha (PD-MDC-070).
      const expectedBundle = artifact.status === 'frozen' ? null : (Object.values(artifact.records).find((r) => r.apk === artifact.now) || {}).bundle;
      if (artifact.status === 'frozen' && !evidence.includes(bundleSha)) {
        problems.push(`the shipped bundle sha256 ${bundleSha.slice(0, 12)} is not recorded in the evidence — the run did not bind the bundle it now ships`);
      } else if (artifact.status !== 'frozen' && expectedBundle && expectedBundle !== bundleSha) {
        problems.push(`the bundle on disk (${bundleSha.slice(0, 12)}) is not the bundle its artifact record names (${expectedBundle.slice(0, 12)})`);
      }
      const present = FORBIDDEN_IN_BUNDLE.filter((s) => bundle.includes(Buffer.from(s, 'utf8')));
      if (present.length > 0) {
        problems.push(`dev-affordance marker(s) reached the shipped bundle: ${present.join(', ')} — the __DEV__ branch was not eliminated`);
      } else {
        clauses.push(`shipped bundle ${bundleSha.slice(0, 12)} (${bundle.length} bytes) carries none of [${FORBIDDEN_IN_BUNDLE.join(', ')}]`);
      }
    }
  }

  /* 4. ABSENT ON THE DEVICE — captured view trees confirm the chrome does not render on the artifact. */
  if (!existsSync(CAPTURES_DIR)) {
    problems.push(`no captures at ${rel(CAPTURES_DIR)}`);
  } else {
    const settings = join(CAPTURES_DIR, '01-settings.xml');
    const lock = join(CAPTURES_DIR, '02-lock.xml');
    if (!existsSync(settings)) problems.push('capture 01-settings.xml is missing');
    else {
      const t = textOf(read(settings));
      if (!/Settings|Language|Financial glossary/.test(t)) problems.push('01-settings.xml does not look like the Settings screen — the surface did not render');
      else if (/ENGINE PROBE/i.test(t)) problems.push('01-settings.xml carries an ENGINE PROBE row — dev chrome reached the release build');
      else clauses.push('Settings rendered on the release build with no ENGINE PROBE row');
    }
    if (!existsSync(lock)) problems.push('capture 02-lock.xml is missing');
    else {
      const t = textOf(read(lock));
      const looksLikeLock = /PIN|נעילה|Unlock|קוד|קיים|כספת/.test(t);
      if (!looksLikeLock) problems.push('02-lock.xml does not look like the Lock screen — the surface did not render');
      else if (/DEBUG: Unlock|פתיחת נעילה לצורכי פיתוח/.test(t)) problems.push('02-lock.xml carries the dev-unlock control — dev chrome reached the release build');
      else clauses.push('Lock screen rendered on the release build with no dev-unlock control');
    }
  }

  const captureCount = existsSync(CAPTURES_DIR) ? readdirSync(CAPTURES_DIR).filter((f) => f.endsWith('.xml')).length : 0;
  if (problems.length > 0) return fail(problems.join('; '), { population: captureCount + 1 });
  return okOverPopulation({
    population: captureCount + 1,
    unit: 'device capture(s) plus the shipped bundle',
    detail: clauses.join(' · '),
  });
};
