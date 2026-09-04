/**
 * GATE: performance — criterion V3.  →  `PERFORMANCE OK`
 *
 *   > **V3.** *"PERFORMANCE: cold start, first-verdict time and frame statistics are measured on
 *   > the device against the MDC-PERF-BUDGETS budgets, results recorded with the measuring method"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE BUDGETS COME FROM THE RULING, NOT FROM THIS FILE
 *
 * MDC-PERF-BUDGETS option 1 (recorded on the Owner queue under PD-MDC-066) fixes the bar: cold start
 * to interactive Home under 4 s on the qualified emulator; input-to-verdict under 10 s including
 * typing, with engine time under 500 ms; no dropped-frame rate above 5 percent on surface scrolls.
 * This gate reads the ruling from the campaign's own files and REFUSES if it is not option 1 — a
 * different option carries different numbers and this gate would not know them.
 *
 * WHAT IS MEASURED, AND HOW HONESTLY. The evidence is `measurements.json`, written by the
 * emulator-only driver whose method is recorded inside it. Times are read from the framework's own
 * frame timeline (`dumpsys gfxinfo framestats`): the completion of the last frame of the first dense
 * render run after an action, at frame (~16 ms) resolution; what rendered is confirmed afterwards by
 * a view-tree dump outside the timed window (the lock screen is a secure window, so pixels are not
 * used). The engine figure is the first frame completed after the Check tap — a sound upper bound
 * only because the verdict route computes the verdict synchronously in its first render, which this
 * gate verifies in source. Frame statistics are the framework's own janky-frame count over the
 * scrolled surface, median of three passes after a warm pass, on a software-rendering emulator. The
 * figures are printed with their method so a reader can disagree with the method rather than with a
 * number.
 *
 * BINDING. The APK on disk, the APK the driver hashed on the host and the APK the device reported
 * must be the same bytes, and the device must be the qualified emulator — the physical devices are
 * foreign to this campaign and are never measured.
 *
 * MEASURES: device. NEGATIVE CONTROL: V3's row declares none; each clause was falsified by mutating
 * the recorded figures (see the campaign log).
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, okOverPopulation } from '../lib/report.mjs';

export const SENTINEL = 'PERFORMANCE OK';
export const FAILURE_SENTINEL = 'PERFORMANCE FAILED';
export const MEASURES = 'device';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const CAMPAIGN_DIR = join(ROOT, '..', 'smartcard-data-pipeline', 'campaign-master');
const EVIDENCE_DIR = join(CAMPAIGN_DIR, 'evidence', 'external', 'V3');
const MEASUREMENTS = join(EVIDENCE_DIR, 'measurements.json');
const APK = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const PACKAGE = 'app.trevik.mobile';
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

/** Option 1 of MDC-PERF-BUDGETS, transcribed from the ruling text; the ruling itself is verified below. */
const BUDGETS = { coldStartInteractiveHomeMs: 4000, inputToVerdictMs: 10000, engineMs: 500, jankyPct: 5 };

const rulingOf = (id) => {
  const rulingsPath = join(CAMPAIGN_DIR, 'OWNER_RULINGS.json');
  const queuePath = join(CAMPAIGN_DIR, 'state', 'OWNER_QUEUE.jsonl');
  if (existsSync(rulingsPath)) {
    const row = (JSON.parse(readFileSync(rulingsPath, 'utf8')).rulings || []).find((r) => r.id === id);
    if (row && row.ruling && row.ruling !== 'PENDING') return { ruling: String(row.ruling).trim(), source: 'rulings' };
  }
  if (existsSync(queuePath)) {
    const answers = readFileSync(queuePath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      .filter((e) => e.kind === 'OWNER_ANSWER' && e.id === id && e.by === 'owner');
    const last = answers[answers.length - 1];
    if (last && String(last.ruling || '').trim() && String(last.ruling).trim() !== 'PENDING') return { ruling: String(last.ruling).trim(), source: 'queue' };
  }
  return null;
};
const median = (xs) => { const a = xs.filter((x) => typeof x === 'number').sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null; };

export const run = async () => {
  const problems = [];
  const clauses = [];
  if (!existsSync(MEASUREMENTS)) return fail(`no V3 measurement record at ${rel(MEASUREMENTS)} — a DEVICE criterion is not satisfiable without a measured run`);
  let m;
  try { m = JSON.parse(readFileSync(MEASUREMENTS, 'utf8')); } catch (e) { return fail('measurements.json is unreadable: ' + e.message); }

  /* 1. the budgets are ruled, and they are option 1 */
  const r = rulingOf('MDC-PERF-BUDGETS');
  if (!r) problems.push('MDC-PERF-BUDGETS is not ruled — there is no bar to measure against');
  else if (r.ruling !== '1') problems.push(`MDC-PERF-BUDGETS was ruled '${r.ruling}', not option 1 — this gate carries option 1's numbers only`);
  else clauses.push(`budgets: MDC-PERF-BUDGETS option 1 (${r.source})`);

  /* 2. binding — same bytes on host and device, the qualified emulator, the ruled package */
  if (!existsSync(APK)) problems.push(`no release APK at ${rel(APK)} to bind the measurement to`);
  else {
    const now = createHash('sha256').update(readFileSync(APK)).digest('hex');
    const host = m.apk?.hostSha256, device = m.apk?.deviceSha256;
    if (!host || !device) problems.push('the record does not carry both the host and the on-device APK sha256');
    else if (host !== device) problems.push(`the driver measured a device APK (${device.slice(0, 12)}) that is not the host artifact (${host.slice(0, 12)})`);
    else if (now !== host) problems.push(`the release APK on disk (${now.slice(0, 12)}) is no longer the artifact the run measured (${host.slice(0, 12)})`);
    else clauses.push(`bound to APK ${now.slice(0, 12)}, host == device`);
  }
  if (m.package !== PACKAGE) problems.push(`the record measured package '${m.package}', not ${PACKAGE}`);
  const d = m.device || {};
  if (d.serial !== 'emulator-5554') problems.push(`measured on '${d.serial}', not the qualified emulator-5554`);
  if (!/sdk_gphone|emu64/.test(String(d['ro.build.fingerprint'] || ''))) problems.push('the device fingerprint is not an emulator build');
  clauses.push(`device ${d.serial} · ${d['ro.boot.qemu.avd_name'] || '?'} · sdk ${d['ro.build.version.sdk'] || '?'} · locale ${d['persist.sys.locale'] || '?'} · airplane ${d.airplaneModeOn}`);

  /* 3. cold start to interactive Home */
  const cold = (m.coldStart || []).filter((c) => typeof c.coldStartInteractiveHomeMs === 'number');
  if (cold.length < 3) problems.push(`only ${cold.length} complete cold-start run(s) recorded — at least 3 are needed for a median`);
  else {
    const med = median(cold.map((c) => c.coldStartInteractiveHomeMs));
    const max = Math.max(...cold.map((c) => c.coldStartInteractiveHomeMs));
    if (med >= BUDGETS.coldStartInteractiveHomeMs) problems.push(`cold start to interactive Home: median ${med} ms over ${cold.length} runs is not under the ${BUDGETS.coldStartInteractiveHomeMs} ms budget`);
    else clauses.push(`cold start to interactive Home: median ${med} ms, max ${max} ms over ${cold.length} runs (frame-timeline resolution, ~16 ms), budget ${BUDGETS.coldStartInteractiveHomeMs} ms`);
  }

  /* 4. input to verdict, and the engine bound */
  const v = (m.inputToVerdict || []).filter((x) => typeof x.inputToVerdictMs === 'number');
  if (v.length < 3) problems.push(`only ${v.length} complete input-to-verdict run(s) recorded — at least 3 are needed`);
  else {
    const med = median(v.map((x) => x.inputToVerdictMs));
    if (med >= BUDGETS.inputToVerdictMs) problems.push(`input to verdict: median ${med} ms including typing is not under the ${BUDGETS.inputToVerdictMs} ms budget`);
    else clauses.push(`input to verdict: median ${med} ms including typing, budget ${BUDGETS.inputToVerdictMs} ms`);
    /*
     * THE ENGINE BOUND IS THE FIRST FRAME AFTER THE TAP, AND THE SOURCE MUST EARN THAT READING.
     * The Check button only navigates with the draft; the verdict route computes the verdict
     * synchronously in its render body (verdictPropsFromDraft, no effect), and that render completes
     * before the transition's first frame is committed. If the route ever moved the computation into
     * an effect, the first frame would no longer contain the verdict and this bound would be false —
     * so the gate reads CheckStack.tsx and refuses the reading unless the call is still synchronous.
     */
    const stack = join(ROOT, 'src', 'navigation', 'stacks', 'CheckStack.tsx');
    const stackSrc = existsSync(stack) ? readFileSync(stack, 'utf8') : '';
    const verdictRoute = stackSrc.slice(stackSrc.indexOf('function CheckVerdictRoute'));
    const syncVerdict = /const props = verdictPropsFromDraft\(/.test(verdictRoute) && !/useEffect\([^)]*verdictPropsFromDraft/.test(verdictRoute);
    if (!syncVerdict) problems.push('CheckStack.tsx no longer computes the verdict synchronously in the verdict route render — the first-frame bound cannot be read as the engine bound');
    const eng = v.map((x) => x.firstFrameAfterTapMs).filter((x) => typeof x === 'number');
    if (eng.length < 3) problems.push('the engine bound (first frame completed after the Check tap) is missing from the record');
    else {
      const emed = median(eng);
      if (emed > BUDGETS.engineMs) problems.push(`engine time could not be shown under ${BUDGETS.engineMs} ms: the tap-to-first-frame bound is ${emed} ms (median) — UNKNOWN below that bound, and this gate does not guess`);
      else clauses.push(`engine + verdict render ≤ ${emed} ms (median first frame completed after the tap; verdict computed synchronously in the route render), budget ${BUDGETS.engineMs} ms`);
    }
    if (!v.every((x) => x.verdictConfirmed === true)) problems.push('a run settled on a screen that was not the verdict — the view-tree confirmation failed');
  }

  /* 5. frames on scrolled surfaces */
  const frames = m.frames || {};
  const surfaces = Object.keys(frames);
  const scrolled = surfaces.filter((s) => typeof frames[s]?.framesRendered === 'number' && frames[s].framesRendered >= 60);
  const still = surfaces.filter((s) => frames[s]?.framesRendered === 0);
  if (scrolled.length < 2) problems.push(`frame statistics with at least 60 frames recorded for ${scrolled.length} surface(s) — at least two scrolled surfaces are needed`);
  for (const s of surfaces) {
    const f = frames[s] || {};
    if (typeof f.jankyPct !== 'number' || typeof f.framesRendered !== 'number') { problems.push(`surface ${s}: no janky-frame figure`); continue; }
    if (f.framesRendered === 0) continue; // no scrollable content: reported, never counted as a pass
    if (f.framesRendered < 60) problems.push(`surface ${s}: only ${f.framesRendered} frame(s) rendered during the scroll — too few to judge`);
    if (f.jankyPct > BUDGETS.jankyPct) problems.push(`surface ${s}: ${f.jankyPct}% janky frames over ${f.framesRendered} frames is above the ${BUDGETS.jankyPct}% budget`);
  }
  if (surfaces.length) clauses.push('frames: ' + scrolled.map((s) => `${s} ${frames[s]?.jankyPct}% janky of ${frames[s]?.framesRendered}`).join(', ') + `, budget ${BUDGETS.jankyPct}%` + (still.length ? ` · no scrollable content on ${still.join(', ')} (0 frames, not counted)` : ''));
  if (!/screencap|gfxinfo/.test(String(m.method || ''))) problems.push('the record does not describe its measuring method');
  if (typeof m.summary?.probeMs !== 'number') problems.push('the record does not state its probe latency, so its bounds have no stated resolution');

  const population = cold.length + v.length + surfaces.length;
  if (problems.length) return fail(problems.join(' · '), { population });
  return okOverPopulation({ population, unit: 'measured run(s) and surface(s)', detail: clauses.join(' · ') });
};
