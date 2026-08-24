/**
 * GATE: newarch — criterion F2.  →  `NEWARCH OK`
 *
 *   > **F2.** *"**OD-14 is ruled and recorded**, and **if restored, proven on a device**."*  · DEVICE
 *
 *   > **OD-14** (CLOSED — APPROVED, 2026-08-23). *"Restore `newArchEnabled: true` and then prove it
 *   > on a physical device or emulator. **Restoring the flag without a device run proves nothing:**
 *   > the whole point of the criterion is that the inherited app has never been shown to run
 *   > natively at all."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS GATE CANNOT PASS F2, AND IT SAYS SO
 *
 * F2 is DEVICE-flagged. The ruling's own words rule out the shortcut this gate would otherwise be:
 * a green check that read the flag and stopped. So the gate proves the half that can be proven
 * here — the ruling is recorded, the flag is restored, and the two halves of the build agree — and
 * then reports the device half as **UNPROVEN**, by name, in its own output.
 *
 * A gate that printed `NEWARCH OK` on the strength of a config line would be the false close this
 * whole procedure exists to prevent.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE DISAGREEMENT THAT MADE THIS DANGEROUS
 *
 * OD-14's facts: *"Present in HEAD `app.json`; deleted in the working tree; still `true` in
 * `android/gradle.properties`; MMKV expects the New Architecture."*
 *
 * So the JS config and the Android build disagreed about which architecture the app runs on, and
 * the storage layer had an opinion too. This gate checks all the places the answer is written and
 * requires them to agree — a single restored flag beside a `gradle.properties` that says otherwise
 * is the same defect in the other direction.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['F2'];
export const SENTINEL = 'NEWARCH OK';

const CONFIG = 'app.config.js';
const GRADLE = join('android', 'gradle.properties');
const PODFILE_PROPS = join('ios', 'Podfile.properties.json');
const DECISIONS = join('..', 'smartcard-data-pipeline', 'authority', 'SMARTCARD_OWNER_DECISIONS.md');
/** Where a captured device run would live. Its absence is the honest state, not a failure to hide. */
const DEVICE_EVIDENCE = join('..', 'smartcard-data-pipeline', 'campaign-p2', 'evidence', 'device', 'NEWARCH.md');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── 1. the ruling is recorded, and it is CLOSED ──────────────────────────────────
  const decisions = join(root, DECISIONS);
  let ruled = null;
  if (existsSync(decisions)) {
    const text = readFileSync(decisions, 'utf8');
    const heading = text.split('\n').find((l) => /^#+\s.*\bOD-14\b/.test(l) && /CLOSED/i.test(l));
    if (!heading) {
      problems.push('OD-14 is not recorded as CLOSED in ' + DECISIONS + '. F2 asks first that the '
        + 'ruling EXIST — an unruled decision cannot be complied with, and complying with one '
        + 'nobody made is how a campaign takes a decision on the Owner\'s behalf without saying so');
    } else {
      ruled = heading.replace(/^#+\s*/, '').trim();
    }
  } else {
    lines.push('ruling          NOT VERIFIED HERE — the Owner Decisions live in the pipeline');
    lines.push('                repository and it is not reachable from this checkout. This line');
    lines.push('                says so rather than the check silently passing.');
  }

  // ── 2. the flag is restored ──────────────────────────────────────────────────────
  if (!existsSync(join(root, CONFIG))) return fail(CONFIG + ' does not exist');
  const config = readFileSync(join(root, CONFIG), 'utf8');
  const configEnabled = /newArchEnabled\s*:\s*true/.test(config);
  if (!configEnabled) {
    problems.push(CONFIG + ' does not set newArchEnabled: true. OD-14 ruled RESTORE, and a ruling '
      + 'recorded but not obeyed is worse than one never made — the register says the question is '
      + 'settled and the build says otherwise');
  }
  if (existsSync(join(root, 'app.json'))) {
    problems.push('app.json exists again. OD-2 removed it and A10 keeps it removed; the flag '
      + 'belongs in the generated config beside every other identity value');
  }

  // ── 3. every place the answer is written agrees ──────────────────────────────────
  const declarations = [{ where: CONFIG, enabled: configEnabled }];

  if (existsSync(join(root, GRADLE))) {
    const gradle = readFileSync(join(root, GRADLE), 'utf8');
    const m = gradle.match(/newArchEnabled\s*=\s*(\w+)/);
    declarations.push({ where: GRADLE, enabled: m ? m[1] === 'true' : null });
  } else {
    lines.push('android         not generated in this checkout (gitignored) — nothing to compare');
  }

  if (existsSync(join(root, PODFILE_PROPS))) {
    const props = JSON.parse(readFileSync(join(root, PODFILE_PROPS), 'utf8'));
    const value = props['newArchEnabled'];
    declarations.push({ where: PODFILE_PROPS, enabled: value === undefined ? null : String(value) === 'true' });
  }

  const stated = declarations.filter((d) => d.enabled !== null);
  const disagree = new Set(stated.map((d) => d.enabled));
  if (disagree.size > 1) {
    problems.push('the build disagrees with itself about the architecture: '
      + stated.map((d) => d.where + ' = ' + d.enabled).join(' · ')
      + '. This is OD-14\'s original finding in the other direction, and MMKV expects the New '
      + 'Architecture — so the disagreement is dangerous rather than untidy');
  }

  lines.push('OD-14           ' + (ruled ?? '(not read from this checkout)'));
  lines.push('flag            ' + declarations.map((d) => d.where + ' = ' + String(d.enabled)).join(' · '));

  // ── 4. the device half, named as unproven ────────────────────────────────────────
  const captured = existsSync(join(root, DEVICE_EVIDENCE));
  lines.push('');
  if (captured) {
    lines.push('device run      captured at ' + DEVICE_EVIDENCE.replace(/\\/g, '/'));
  } else {
    lines.push('device run      NOT CAPTURED — and this is why F2 is not satisfied by this gate.');
    lines.push('');
    lines.push('  OD-14: "RESTORING THE FLAG WITHOUT A DEVICE RUN PROVES NOTHING: the whole point of');
    lines.push('  the criterion is that the inherited app has never been shown to run natively at');
    lines.push('  all." The flag is restored and every declaration agrees, which is the half that');
    lines.push('  can be measured in a repository. The other half needs hardware this campaign does');
    lines.push('  not have, and B2, C2, E1 and F2 all sit behind it.');
    problems.push('no device run is captured at ' + DEVICE_EVIDENCE.replace(/\\/g, '/')
      + '. F2 is DEVICE-flagged and OD-14 says restoring the flag without a device run proves '
      + 'nothing — so this gate REFUSES to report the config as the proof');
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 3).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
