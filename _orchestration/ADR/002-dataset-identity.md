# ADR-002 — Canonical Dataset Identity (P0-A)

**Status:** Accepted
**Date:** 2026-08-19

## Context

The canonical data estate at `C:\Users\ebrah\All application data\smartcard-canonical-v1\`
self-identifies as generation **v2**: `README.md` line 4-5 states "Generation:
smartcard-canonical-v2, built 2026-08-18/19 over the archived v1 generation", and
`canonical/DELIVERY_MODEL.json` carries `"datasetId": "canonical.delivery-model",
"datasetVersion": "2.0.0"`. The containing folder is still named for the prior
generation. `archive/v1/` inside the same folder holds the discredited previous
generation, and `_work/scripts/v2_build_all.py` deliberately reads from `archive/v1/`
for several of its 21 build steps (documented at the top of that script) — a session or
adapter that resolves the dataset by folder name alone can silently consume the wrong
generation, or mistake the deliberate archive/v1/ reads for a bug.

## Decision

**Do not rename the folder. Pin identity with an immovable `DATASET_ID` marker file at
the estate root plus a frozen `INPUT_MANIFEST.json`, both committed as read-only
identity artifacts.**

## Why not rename

Renaming was the preferred option per the task brief, evaluated first. It was rejected
on evidence, not preference:

- `grep -r "smartcard-canonical-v1"` across the estate root matches the literal path
  string in **hundreds of files**, not only `_work/scripts/` build tooling.
- Critically, the match set includes **canonical/ deliverable data** —
  `canonical/content-pack/issuer-contacts.json`, `canonical/merchants/merchants.jsonl`,
  `canonical/clubs/clubs.jsonl` — and **registers/ data** —
  `registers/PROGRAMME_RESOLUTION.json`, `registers/V1_VERIFICATION_REPORT.json`.
- Inspecting one hit directly: `canonical/content-pack/issuer-contacts.json` embeds
  absolute `file:///C:/Users/ebrah/All%20application%20data/smartcard-canonical-v1/...`
  URLs as `sourceUrl` provenance citations, baked directly into shipped data records.
- A rename would break those citations, or require editing canonical/register data to
  fix them — and T2's own constraint (and this session's constraints generally)
  explicitly forbid modifying canonical or register data. There is no rename path that
  respects both "identity must be unambiguous" and "data must not be touched."
- This is exactly the contingency the task brief anticipated: "hardcoded absolute paths
  you cannot fully enumerate."

## What was done instead

1. `DATASET_ID` — a plain-text marker at the estate root stating the true
   `datasetId: smartcard-canonical-v2`, `datasetVersion: 2.0.0`, the real folder path,
   an explicit `folderNameIsStale: true`, and an explanation of why `archive/v1/` reads
   inside the v2 build scripts are expected and not a defect.
2. `INPUT_MANIFEST.json` — datasetId/version, frozen-at date, file counts and byte
   totals for `canonical/` (29 files, 20,746,033 bytes) and `registers/` (15 files,
   1,419,094 bytes), a SHA-256 checksum for every file in `registers/`, the headline
   metrics from `registers/FINAL_METRICS.json` (378 shippable products / 17
   institutions, 1,175 fee terms, 843 benefits, 49/49 validations, 23/23 scenarios,
   83/378 G06b benefit reach as an accepted non-blocking residual per OD-6), and an
   explicit note that `archive/v1/` is the superseded generation.
3. Verified `archive/v1/README.md` still resolves after adding these two files, and that
   no timestamp under `canonical/` or `registers/` changed.

## Consequences

- Any future session, script, or application adapter must read `DATASET_ID` before
  trusting folder-name-based identification of this estate. This is a soft convention,
  not a filesystem-enforced one — a future P1-A/P1-C task (contract-agnostic
  infrastructure / adapter) should have its ingest path assert
  `datasetId == "smartcard-canonical-v2"` at load time, per the Execution Model §15.4
  P1 note on `DisabledDataAuthorityAdapter`.
- `canonical/` was not individually checksummed file-by-file in `INPUT_MANIFEST.json`
  (only counted/sized) because it is larger and its integrity is already evidenced by
  `registers/VALIDATION_REPORT.json` (49 PASS) and `registers/ENGINE_SCENARIOS.json` (23
  PASS), which ARE checksummed. If a future session needs canonical/-level checksums,
  that is a cheap follow-up, not a redo of this decision.
- The folder itself remains named `smartcard-canonical-v1` indefinitely unless a future
  session does the full reference-by-reference audit this session judged out of scope
  for a 4-hour P0-A task. Recorded as a residual, not silently accepted — see final
  report findings.
