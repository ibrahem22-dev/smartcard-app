# CURRENT PHASE PLAN

Source of sequencing truth: `SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md` v2.5 §15–§19.

## The tracer bullet flew

```
✅ P-1 · P0-A · P0-B · D0 · E1 · P0-C1 · P0-C2 · gate-#10 spec · P1-A
✅ S05 T1  contract v1.0 → v1.1 RE-FROZEN, R0–R7 applied (INCIDENT, ADR-008)
✅ S05 T2  path detector 33 → 0 false positives; gate 11 built and proven BY ID
✅ S05 T3  P1-B CARDS TRACER BULLET — every acceptance criterion passed on real data
✅ S05 T4  conflict path proven by synthetic fixture
```

**`catalog.pack`: 474 rows · 378 displayed-current · deterministic · 979,069 bytes ·
sha256 `c48e9120…`** — built from all 1,077 canonical rows, with zero paths, zero `lineage` keys,
zero legacy rows and zero bare counts.

**The pattern is proven. Twelve more families may now follow it.**

## Next — two lanes, genuinely parallel

### Lane C — P0-C3+ per-entity schemas
Fees first: it is the largest path-leak surface (1,676 of 1,951) and the tracer bullet's cost values
resolve through it. Then FX · waivers · billing · interest · clubs/programmes · relationships ·
benefits · stacking · merchants · content · conflicts.

> **⚠️ Carry this forward — it is the session's most transferable finding.**
> Cards revealed that a value field has **three** on-disk states, not two: present-with-a-number,
> absent, and **present with `value: null`**. On cards that was 34 rows, 14 of them carrying
> `VERIFIED_OFFICIAL` — an *evidenced absence*, not a contradiction. **Check every remaining family
> for the same pattern before writing its schema.** A schema that models only present/absent will
> throw on first contact, exactly as this one did.

### Lane I — P1-C adapter
`src/adapter/read-cards.ts` in the pipeline repo is the **reference implementation of the public
shape**, proven end to end. P1-C ports that shape into the application. Its two load-bearing
properties:
- **Provenance is a first-class return value, never a side channel.** There is deliberately no
  `getFxCommission(cardId): number` — you cannot obtain a number without the chip that qualifies it.
- **`src/lattice.ts` is the only place a result chip may be produced**, behind a type-only brand. An
  engine that tries to construct one by hand does not typecheck. That is contract §2.5's
  "implemented exactly once" made structural rather than aspirational.

### Lane D — G06b (OD-17 approved, its own data session)
Note contract **§6.4-B**: G06b's output spec now owns the benefits `value.kind` enum split. Doing it
separately would mean touching the same records twice.

## What the Owner should decide before P0-C3 / P1-C

| # | Item | Why now |
|---|---|---|
| 1 | Update the register: **OD-18 → APPROVED** with the v1.1 content (`UNKNOWN` + `reason` + `obtainable`), **OD-19 → APPROVED** | Both are ruled and implemented; the register still shows OD-18 as "RULED IN-SESSION — VERIFY" |
| 2 | **Where does the P1-C adapter live** — port into `app/SmartCard/src/`, or keep the pipeline reference and wire later? | Touching app `src/` puts the 410-test suite in play; worth a deliberate call rather than drift |
| 3 | **A remote for `smartcard-data-pipeline`** | It is local-only. Everything built in Sessions 03–05 exists on one disk. |
| 4 | The **33 uncorroborated sub-1 percentages** gate 11 flags | They need a human read before any is rendered as a percentage. None was rescaled. |

None blocks Lane C.

## Standing state

- **Frozen:** `SMARTCARD_DATA_CONTRACT.md` **v1.1** · `SMARTCARD_DATA_CONTRACT_CARDS.md` **v1.2** ·
  `SMARTCARD_GATE10_PROJECTION.md` v1.0. Changes are incidents requiring an ADR.
- Estate and archive are filesystem read-only (ADR-003), re-verified.
- App repo: `wip/expo-57-working-tree` is the interim integration branch (ADR-004). **No application
  source was touched in Session 05** — the whole tracer bullet lives in the pipeline repo per OD-10.
- Pipeline repo at `C:\Users\ebrah\smartcard-data-pipeline`, `main` @ `9daa985`, **no remote**.
- `C:\Users\ebrah\wt-P1A` is a stale directory git could not delete; harmless.

## Executor capability — new, fold into EXECUTOR_CAPABILITIES.md

**A task packet passed as a command-line argument fails on Windows past ~8 KB.** `cursor-agent`
exits immediately with `The command line is too long.`, writes no JSON error event, and creates
nothing — it looks exactly like a hang. Deliver packets as a **file in the worktree** plus a short
"read and execute" prompt. Verified with an 8,132-byte packet.

## The lesson this session actually paid for

Session 04 refused to amend the contract from reconstructed authority, and was right to. The fix was
not better drafting — it was **delivering the authority inline in the prompt** instead of by
reference to a file that might not exist. Preconditions passed for the first time in four sessions.

And the tracer bullet did its job: the contract survived contact with implementation, but the
schema's *prose* did not, and one field added hours earlier (`reason`, R3) turned out to be exactly
what the real data needed. That is the argument for running one family end to end before writing
twelve more schemas, and it paid for itself on the first day.
