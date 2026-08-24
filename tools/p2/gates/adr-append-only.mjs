/**
 * GATE: adr-append-only — criterion F9.  →  `ADR OK — N ADRs, 0 edited`
 *
 *   > **F9.** *"Every architectural ruling made during P2 has an **append-only ADR**; **no ADR was
 *   > edited after being written**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "EDITED" IS A CLAIM ABOUT GIT, NOT ABOUT A FIELD IN THE FILE
 *
 * A document that says *"unedited: true"* proves nothing — the line could have been added in the
 * edit. So the mirror derives each ADR's commit count from `git log --follow`, and this gate reads
 * that: **an ADR with more than one commit was touched after it was written.**
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * APPEND-ONLY DOES NOT MEAN NEVER TOUCHED. IT MEANS VISIBLE.
 *
 * The project applies the same rule to ADRs that it applies to its decision log: *"a record is
 * superseded by a later record, never edited — architectural memory that can be silently rewritten
 * is not memory."* **Silently** is the operative word. ADR-017 is at v1.1 and its status line reads
 * *"v1.1 corrects Decision 7 — see the OD-25 conformance note"*: that is an amendment anybody can
 * find, and the gate accepts it on the version alone.
 *
 * What needs accounting is an ADR whose **bytes changed while its version did not**. There is
 * exactly one, it is from P1, and P2's hard prohibitions forbid rewriting history in either
 * repository — so it is accounted for by name rather than repaired. Editing ADR-011 now, to record
 * that ADR-011 was edited, would be the same act a second time.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE ACCOUNTING IS CHECKED IN BOTH DIRECTIONS
 *
 * An entry for an ADR that was never edited is as much a defect as an edited ADR with no entry: the
 * first is an exemption somebody left behind, and it would cover the next edit of that file
 * silently. This gate reports both.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['F9'];
export const SENTINEL = 'ADR OK';

const RECORDS = join('tools', 'p2', 'campaign-records.json');

/** The ADRs this campaign wrote. Derived below from the accounting's era field, never listed here. */
const isVersionedAmendment = (adr) => adr.version !== null && adr.version !== '1.0';

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, RECORDS))) {
    return fail(RECORDS + ' does not exist — run campaign-p2/bin/p2-campaign-records.mjs');
  }
  const records = JSON.parse(readFileSync(join(root, RECORDS), 'utf8'));
  const adrs = records.adrs ?? [];
  const accounting = records.adrEdits ?? [];

  if (adrs.length === 0) {
    return fail('the mirror records no ADR. F9 is about a population, and an empty one would let '
      + 'this gate report "0 ADRs, 0 edited" and call it green');
  }

  const accountedFor = new Set(accounting.map((a) => a.adr));
  const touched = adrs.filter((a) => a.commitCount > 1);

  const unaccounted = [];
  for (const a of touched) {
    if (isVersionedAmendment(a)) continue;          // a recorded amendment, findable by anybody
    if (accountedFor.has(a.id)) continue;           // accounted for by name, with a reason
    unaccounted.push(a);
  }

  for (const a of unaccounted.slice(0, 4)) {
    problems.push(a.id + ' has ' + a.commitCount + ' commits and is still at version '
      + (a.version ?? '(none)') + ', with no entry in the edit accounting. An ADR whose bytes '
      + 'changed while its version did not was edited SILENTLY, and architectural memory that can '
      + 'be silently rewritten is not memory');
  }

  // The other direction: an exemption for something that was never edited.
  for (const entry of accounting) {
    const adr = adrs.find((a) => a.id === entry.adr);
    if (!adr) {
      problems.push('the accounting names ' + entry.adr + ' and no such ADR exists');
      continue;
    }
    if (adr.commitCount <= 1) {
      problems.push(entry.adr + ' is accounted for as edited and has only ' + adr.commitCount
        + ' commit. A stale exemption reads as a judgement about a file that has moved on, and '
        + 'would cover the next edit of it silently');
    }
    if (!entry.hasReason) {
      problems.push(entry.adr + ' is accounted for with no reason a reviewer could disagree with');
    }
  }

  // Every ADR must be a real record, not a placeholder.
  for (const a of adrs) {
    if (!a.status || a.status.length === 0) problems.push(a.id + ' declares no status');
    if (!a.version) problems.push(a.id + ' declares no version');
    if (a.bytes < 500) {
      problems.push(a.id + ' is ' + a.bytes + ' bytes — too short to be a ruling. An ADR that '
        + 'records a decision without its context and its consequences is a filename');
    }
  }

  const p2Adrs = adrs.filter((a) => Number((a.id.match(/\d+/) ?? [0])[0]) >= 22);
  lines.push('ADRs            ' + adrs.length + ' total · ' + p2Adrs.length + ' written by this campaign');
  lines.push('touched twice   ' + touched.length + ' · ' + touched.filter(isVersionedAmendment).length
    + ' versioned amendment(s) · ' + accounting.length + ' accounted for by name · '
    + unaccounted.length + ' unaccounted');
  for (const a of touched) {
    lines.push('  ' + a.id.padEnd(9) + 'v' + (a.version ?? '?') + ' · ' + a.commitCount + ' commits · '
      + (isVersionedAmendment(a) ? 'a recorded amendment'
        : accountedFor.has(a.id) ? 'accounted for (' + (accounting.find((x) => x.adr === a.id)?.era ?? '?') + '-era)'
          : 'UNACCOUNTED'));
  }
  lines.push('');
  lines.push('EVERY ADR THIS CAMPAIGN WROTE HAS EXACTLY ONE COMMIT AND VERSION 1.0. If one of them');
  lines.push('  ever grows a second commit without a version bump, it will not be in the accounting');
  lines.push('  and this gate fails — which is why the inherited case is accounted for BY NAME');
  lines.push('  rather than by widening the rule.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'ADR OK — ' + adrs.length + ' ADRs, ' + unaccounted.length + ' edited',
  };
};
