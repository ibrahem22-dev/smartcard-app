# CURRENT PHASE PLAN

Source of sequencing truth: `SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md` v2.5 §15–§19.

## Done

```
✅ P-1 · P0-A · P0-B · D0 · E1 · P0-C1 · P0-C2 · gate-#10 spec · P1-A
✅ S05 T1  contract v1.0 → v1.1 RE-FROZEN, R0–R7 applied (INCIDENT, ADR-008)
✅ S05 T2  path detector 33 → 0 false positives; gate 11 built and proven BY ID
✅ S05 T3  P1-B CARDS TRACER BULLET — every acceptance criterion passed on real data
✅ S05 T4  conflict path proven by synthetic fixture
✅ S06 T1  pipeline repo has a REMOTE and is pushed — OD-21 closed
✅ S06 T2  contract v1.2 — the three on-disk states (DISCOVERY, ADR-009)
✅ S06 T4  BATCH 1 — fee terms · FX · waivers, projected and validated on the full corpus
✅ S06 T4  contract v1.3 / costmodel v1.1 — the unit domain (DISCOVERY, ADR-010)
✅ S06 T6  Antigravity probed — Tier 2, GUI handoff only
```

**`catalog.pack`: 474 rows · 378 displayed-current · deterministic · 979,069 bytes ·
sha256 `c48e9120…`**, unchanged through Batch 1.

**Batch 1: 1,090 fee terms · 43 FX pairs · 14 exceptions · 171 waivers** — zero paths, zero
`lineage` keys, zero bare counts, deterministic, Hebrew and Arabic intact, with five ADR-010 target
records asserted **by id**.

**Two families are now proven end to end. Ten to go, and they follow a pattern that has been
corrected twice by contact with real data.**

## Next

### Lane C — Batch 2 and the remaining families
Clubs/programmes · relationships · billing · interest · benefits · stacking · merchants · content ·
conflicts.

> **⚠️ THE PRE-SCHEMA CENSUS IS NOT OPTIONAL, AND IT MUST NOW CHECK CONTENT.**
> Contract §2.8 requires, before any family's schema is written:
> 1. the three on-disk states (present-with-value / present-with-`null` / absent), counted;
> 2. union-typed fields;
> 3. empty-but-present collections;
> 4. **the VALUE DOMAIN of every enumerated field — the distinct values with counts, not the JSON
>    type** *(new in v1.3)*.
>
> Clause 4 exists because the v1.2 census **ran over Batch 1 and reported clean**. It printed types,
> so `unit` read as `string:1136 / null:39` — a healthy-looking field whose real domain was
> `{ILS:748, PERCENT:248, USD:117, OTHER:17, EUR:6}` and whose schema named two of five. 123 real
> VERIFIED amounts were unprojectable and the build died on the first.
>
> **And sample the delegation fixture BY COMBINATION.** The Batch-1 fixture had `unit: null` rows
> and value-present rows and still never had a value-present row with a foreign unit — the single
> cell where every failure lived.

Batch 2 additionally inherits three rulings it must not re-litigate: foreign currency is not
ILS-calculable (§5.2), `OTHER` is not a unit (§5.1), and a conflict declared **by reference** ships
as `UNKNOWN`/`CONFLICTED` with its pointers rather than as a scalar.

### Lane I — P1-C adapter · **BLOCKED**
**OD-20 is open and gates this.** Session 06's T5 was skipped for that reason and nothing was
started. `src/adapter/read-cards.ts` in the pipeline repo remains the reference implementation of
the public shape, proven end to end. Its two load-bearing properties:
- **Provenance is a first-class return value, never a side channel.** There is deliberately no
  `getFxCommission(cardId): number` — you cannot obtain a number without the chip that qualifies it.
- **`src/lattice.ts` is the only place a result chip may be produced**, behind a type-only brand. An
  engine that tries to construct one by hand does not typecheck.

### Lane D — G06b (OD-17 approved, its own data session)
Contract **§6.4-B**: G06b's output spec owns the benefits `value.kind` enum split.

## What the Owner should decide

| # | Item | Why now |
|---|---|---|
| 1 | **OD-20 — where the P1-C adapter lives** | The only thing on the critical path a supervisor session cannot start. Blocked two sessions running. |
| 2 | **OD-23 — how the app presents a foreign-currency fee** *(new)* | 123 USD/EUR fee terms cannot be converted at build time. Recommendation (b): convert with a live BOI rate, labelled, `ESTIMATE`-chipped. **Deferring decides it as (a) by default.** |
| 3 | **`term:max\|op:max:FOREIGN_ATM_FEE:2` reads `22 PERCENT`** against the FX pair's `3 PERCENT` | Almost certainly an ILS amount wearing a PERCENT unit. Canonical data — not corrected, because inferring a unit from a magnitude is forbidden in both directions. Needs a human read against the tariff. |
| 4 | The **33 uncorroborated sub-1 percentages** gate 11 flags | Need a human read before any is rendered. None was rescaled. |
| 5 | OD-22 — Antigravity as a Tier-2 visual-evidence tool | Recommended; no production implementation role. |

Only item 1 blocks a lane.

## Standing state

- **Frozen:** `SMARTCARD_DATA_CONTRACT.md` **v1.3** · `..._CARDS.md` v1.2 · `..._COSTMODEL.md` v1.1 ·
  `SMARTCARD_GATE10_PROJECTION.md` v1.0. Changes are incidents requiring an ADR.
- Estate and archive are filesystem read-only (ADR-003), unaltered.
- Pipeline repo `main` @ **`2e8afd2`**, **pushed and in sync** with
  `github.com/ibrahem22-dev/smartcard-data-pipeline`. No longer single-copy.
- App repo: `wip/expo-57-working-tree` (ADR-004). **No application source touched in Session 06.**
- **The workspace root `C:\Users\ebrah\SmartCard-Agent` still has zero commits and no remote.**
  OD-21 fixed the pipeline, not this.
- `C:\Users\ebrah\wt-P1A` is a stale directory git could not delete; harmless.

## Known tripwire

**`HISTORICAL` alone maps to no chip and fails the build. The corpus contains 85 such fee terms.**
They do not crash it only because every one is `shipToApp: false` (all `org:union`) and the shipping
filter runs first. That is luck, not design — one shippable `HISTORICAL` row stops the build. Left
as a hard stop per §2.3, because the alternatives are inventing a grade or silently discarding a real
number.

## Executor capability

**`cursor-agent` needs a TTY.** Same packet, same model, same flags: foreground it edited files
within 10 minutes; **detached it idled 25 minutes, wrote nothing, and exited 1 while the wrapper
reported exit 0.** Run it in the foreground, split packets into stages that fit inside 10 minutes,
never infer progress from an empty log (JSON output buffers until completion — sample CPU twice
instead), and when the tool cannot deliver inside the window, implement it directly rather than
spending the session on round-trips.

Still true from S05: a packet passed as a **command-line argument** fails past ~8 KB with
`The command line is too long.` and no error event. Deliver packets as a **file**.

## The lesson this session actually paid for

Session 05's lesson was about authority delivery. This one is about **verification that certifies
its own blind spot**.

§2.8 was written *specifically* to stop schemas being built on assumptions about data shape. It ran
on Batch 1. It passed. And it passed because it measured the wrong property — the *type* of a field
rather than its *content* — so the field that broke the build looked healthiest of all.

The repair is one clause. The transferable part is the shape of the failure: **a check that reports
clean is not evidence unless you know what it looked at.** The three original clauses were all
structural, so nothing in the census could ever have seen an enum's domain, and nothing in its
output said so.

Secondary, and cheaper to state: an open question inside a frozen document is a defect with a due
date. Costmodel v1.0 shipped one reading *"whether any real row trips it is not yet measured."* The
measurement turned out to be zero — but taking it would have required cross-tabulating `unit`
against `valueNumeric`, which is exactly the step that would have found the 123 rows that did break.
