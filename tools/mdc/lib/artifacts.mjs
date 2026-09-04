/**
 * RECORDED ARTIFACTS — which release APK a stage's device evidence is bound to. PD-MDC-070.
 *
 * A DEVICE gate used to require that "the release APK on disk" still hashes to the artifact its
 * evidence measured. Inside a stage that is the right check: evidence taken on a stale build fails.
 * Once a later stage has built (STAGE-3 rebuilt after V9's source change), the same path holds a
 * different artifact and the STAGE-2 gates were failing on a fact about the RECORD, not the code —
 * two stages pinning one path to different facts.
 *
 * So the binding is to the stage's COMMITTED artifact record, and the file on disk is classified:
 *   frozen      it is the artifact the evidence measured                → host == device == on-disk
 *   later       it is a LATER stage's recorded artifact                  → stated, not a problem
 *   unrecorded  it hashes to no recorded artifact at all                 → a problem, everywhere
 *   absent      there is no APK on disk                                  → a problem
 * Nothing here weakens the in-stage check: an unrecorded build still fails every gate, and the
 * evidence must still name exactly the sha the stage froze.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const RECORDS = {
  'STAGE-2': { file: 'STAGE2-ARTIFACT/00-FREEZE-AND-BUILD.txt', apk: /\n\s*sha256\s+([0-9a-f]{64})/, bundle: /index\.android\.bundle[^\n]*?([0-9a-f]{64})/ },
  'STAGE-3': { file: 'STAGE3-ARTIFACT/00-BUILD.txt', apk: /app-release\.apk sha256\s+([0-9a-f]{64})/, bundle: /index\.android\.bundle sha256\s+([0-9a-f]{64})/ },
};

export function recordedArtifacts(campaignDir) {
  const out = {};
  for (const [stage, r] of Object.entries(RECORDS)) {
    const p = join(campaignDir, 'evidence', 'external', r.file);
    const txt = existsSync(p) ? readFileSync(p, 'utf8') : '';
    out[stage] = { file: r.file, apk: (txt.match(r.apk) || [])[1] || null, bundle: (txt.match(r.bundle) || [])[1] || null };
  }
  return out;
}

export function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/**
 * Binds a run's host APK sha to its stage's committed record and classifies the APK on disk.
 * Returns { problems, clauses, status, now, records }.
 */
export function bindToRecordedArtifact({ campaignDir, apkPath, hostSha, stage, label = 'the release APK' }) {
  const records = recordedArtifacts(campaignDir);
  const mine = records[stage];
  const problems = [];
  const clauses = [];
  if (!hostSha) return { problems: ['no host APK sha to bind'], clauses, status: 'unbound', now: null, records };
  if (!mine || !mine.apk) problems.push(`no committed artifact record for ${stage} (evidence/external/${mine ? mine.file : '?'})`);
  else if (hostSha !== mine.apk) problems.push(`the evidence is bound to ${hostSha.slice(0, 12)} but ${stage}'s committed artifact record says ${mine.apk.slice(0, 12)}`);
  let status = 'absent';
  let now = null;
  if (existsSync(apkPath)) {
    now = sha256File(apkPath);
    const later = Object.entries(records).find(([s, r]) => s !== stage && r.apk && r.apk === now);
    if (now === hostSha) { status = 'frozen'; clauses.push(`bound to ${label} ${hostSha.slice(0, 12)}, host == device == on-disk`); }
    else if (later) { status = 'later'; clauses.push(`bound to ${label} ${hostSha.slice(0, 12)} (${stage}'s committed record); the artifact on disk is the recorded ${later[0]} build ${now.slice(0, 12)}`); }
    else { status = 'unrecorded'; problems.push(`the APK on disk (${now.slice(0, 12)}) is not any recorded artifact — an unrecorded build`); }
  } else {
    problems.push('the release APK is not on disk to re-verify the binding');
  }
  return { problems, clauses, status, now, records };
}
