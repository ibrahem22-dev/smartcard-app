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
import { stripCommentsAndStrings } from '../../mdc/lib/source.mjs';

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
  /* OQ-MDC-010: matched against RAW source, so a commented-out or documented
     `newArchEnabled: true` satisfied F2 while the real declaration was absent or false — the flag
     read as set because somebody had written about it. Stripping is safe here and does NOT delete
     the rule: what is searched for is a real object property, never string content. */
  const config = stripCommentsAndStrings(readFileSync(join(root, CONFIG), 'utf8'));
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
    /* NOT JavaScript, so the JS stripper is the wrong tool — a .properties file comments with `#`
       and `!`, which stripCommentsAndStrings knows nothing about, and running it here would blank
       quoted values while leaving every `#` comment intact. The narrower fix is to anchor the match
       to a DECLARATION LINE, which excludes comment lines by construction and also stops the old
       first-match-anywhere behaviour from reading a commented example as the setting. */
    const m = gradle.match(/^[ \t]*newArchEnabled[ \t]*=[ \t]*(\w+)/m);
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
  /**
   * THE EVIDENCE IS READ, NOT COUNTED.
   *
   * This was `existsSync(...)` and nothing else — so `touch NEWARCH.md` turned the gate green.
   * Every other gate in this campaign decides on printed output; this one decided on a directory
   * entry, which is the "a check that cannot fail" shape the campaign exists to hunt, in a gate the
   * campaign itself wrote.
   *
   * A device capture has to name four things a `touch` cannot produce:
   *
   *   · the device it ran on, by serial — an artifact that does not say where it came from is not
   *     evidence about anywhere;
   *   · the ABI and Android release, because "it ran" means nothing without "on what";
   *   · the sha256 of the APK that ran, so the artifact is pinned to a binary rather than to a hope;
   *   · a runtime New-Architecture signal, quoted from the process rather than from a config file —
   *     OD-14's whole point is that reading the flag back proves nothing.
   */
  const evidencePath = join(root, DEVICE_EVIDENCE);
  const evidence = existsSync(evidencePath) ? readFileSync(evidencePath, 'utf8') : null;

  const REQUIRED_IN_EVIDENCE = [
    [/emulator-\d+|\b[A-Z0-9]{8,}\b\s+device\b/, 'the device serial it was captured from'],
    [/ro\.product\.cpu\.abi|x86_64|arm64-v8a/, 'the ABI the build ran on'],
    [/ro\.build\.version\.(release|sdk)/, 'the Android version it ran on'],
    [/\b[0-9a-f]{64}\b/, 'the sha256 of the APK that ran'],
    [/BridgelessReact|libreact_newarchdefaults_so|CatalystInstance/, 'a runtime New-Architecture signal quoted from the process'],
  ];

  const missingFromEvidence = evidence === null
    ? []
    : REQUIRED_IN_EVIDENCE.filter(([re]) => !re.test(evidence)).map(([, what]) => what);

  const captured = evidence !== null && missingFromEvidence.length === 0;

  for (const what of missingFromEvidence) {
    problems.push(DEVICE_EVIDENCE.replace(/\\/g, '/') + ' does not state ' + what
      + '. A capture that omits it is a claim about an unnamed device, and `touch` would produce '
      + 'exactly as much');
  }
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
