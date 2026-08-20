# T6 — RETROACTIVE L13 SWEEP: EVERY GATE AGAINST THE REAL CORPUS

**Date:** 2026-08-20 · **Session:** 04, T6
**Method:** every implemented and specified gate run against the checksum-pinned canonical estate —
**282,899 strings** across 16 families — not against fixtures. Includes the L13a script breakdown.

> L13 exists because Session 03's path detector passed all 13 of its own fixtures while
> false-positiving on 196 of 2,156 real Hebrew tariff notes. Fixtures written by the implementer
> test the implementer's understanding of the problem, not the problem.

---

## 1. SUMMARY

| Gate | Status | Real-corpus result | FP rate |
|---|---|---|---|
| **Path detector** (P1-A, shipped) | ⚠️ **residual defect** | 3,756 TP · **33 FP** | **0.0117%** |
| **Gate 11** — PERCENT range | 🔴 **specification defect** | catches **0 of 5** real violations | n/a |
| **Gate 12** — benefits `value.kind` | ✅ clean | 206 rows classified, **0 unrecognised** | 0% |
| **Gate 5** — conflict resolution | ✅ clean | 97 conflicts, **0** violations | 0% |
| **Gate 1** — no legacy rows | ✅ clean | partition exact: 603 + 474 = 1,077 | 0% |

Two findings. One is a residual false-positive rate; the other is a gate that does not fire on the
defect it was written for.

---

## 2. PATH DETECTOR — 0.0117% FP, and the Hebrew rate is 10× the Latin rate

Patterns transcribed verbatim from the shipped
`smartcard-data-pipeline/src/gates/path-detector.ts` (post-R2 repair).

```
  strings scanned      282,899
  true positives         3,756   (hits on the 7 known real leak field shapes)
  FALSE positives           33
  false-positive RATE   0.0117%
```

### L13a — by script

| Script | Strings | TP | FP | **FP rate** |
|---|---:|---:|---:|---:|
| Latin/other | 243,518 | 1,918 | 13 | 0.0053% |
| **Hebrew** | 36,714 | 1,838 | **20** | **0.0545%** |
| Arabic | 2,667 | 0 | 0 | 0.0000% |

**Hebrew's false-positive rate is 10.3× Latin's.** A Latin-only fixture set would have reported this
gate as clean. This is the second time in two sessions that measuring by script changed the verdict.

Arabic content (2,667 strings) produced zero false positives — but note it also produced zero true
positives, so the Arabic result demonstrates *absence of harm*, not detector competence on Arabic.

### The cause — one pattern, one shape

All 33 come from the **`absolute filesystem path`** pattern, and every one is prose that **quotes a
URL path fragment**:

| Field | FPs | Script | Example fragment |
|---|---:|---|---|
| `benefits.programmeResolutionNote` | 21 | Latin | `…a bank ACCOUNT type under /fibiaccount/accounttypes/…` |
| `billing.notes` | 3 | Hebrew | Hebrew tariff prose citing a site path |
| `issuerContacts…officialWebsite.quote` | 3 | Latin | `…bankotsar.co.il/ redirects to /private/.` |
| `clubs.classificationBasis` | 1 | Latin | `…carries a /types/beyond/ entry…` |
| `merchants.nameArEvidence.quote` | 1 | Latin | `…locale paths tried (/ae/ar, /us/ar, /ar) return HTTP 410/404` |
| `merchants.evidence[].quote` | 1 | Hebrew | `…both /ar/ and /ar/contact-us/ deliver the Hebrew home document…` |
| `issuerContacts…arabicSiteUrl.quote` | 1 | Hebrew | `عربي → /ar/homeAR` |
| `issuerContacts…disputeChannelUrl.{note,quote}` | 2 | Hebrew | `…FAQ page /faq/loss-of-credit-card/ routes to…` |

Session 03's R2 repair fixed the *space-slash-word* case (`text / annex`). It did not fix the
*quoted-URL-path-fragment* case (`/private/`), because the R2 validation sampled only
`fees[].notes`. Widening to all 16 families surfaced it.

### Severity: LOW, and structurally mitigated — but fix it anyway

**All 33 fields are internal derivation prose or evidence quotes.** Under Tier-1 Rule E (allowlist
projection) none of them appears in any entity schema's field list, so none reaches a pack and the
effective FP rate **on actual pack content is 0%**.

That is mitigation, not correctness. `SMARTCARD_GATE10_PROJECTION.md` §4 explicitly requires the
detector to be correct when run against intermediate build artifacts too. **Recorded as a backlog
item, not fixed this session** — it does not block anything, because T4 is deferred.

### The fix, verified

Restrict the rule to **known POSIX filesystem roots** rather than any two-segment slash path.
Deterministic, and it infers nothing from magnitude (constraint 11):

```js
/(?:^|["'\s:])\/(?:home|Users|var|opt|etc|srv|tmp|usr|mnt|media|root)\/[A-Za-z0-9._~%+=,@-]+(?:\/|$)/
```

| Case | Current | Proposed |
|---|---|---|
| 6 real FP strings (incl. Hebrew and Arabic-bearing) | HIT ❌ | silent ✅ |
| `/var/data/pack.json` | HIT ✅ | HIT ✅ |
| `/opt/smartcard/build/out.json` | HIT ✅ | HIT ✅ |
| `/home/ebrah/data.json` | HIT ✅ | HIT ✅ |
| `https://www.bankhapoalim.co.il/contact-us` | silent ✅ | silent ✅ |

`/home` and `/Users` retain their own dedicated pattern regardless, so user-home detection does not
depend on this rule.

---

## 3. GATE 11 — IT DOES NOT CATCH THE DEFECT IT WAS CREATED FOR 🔴

Tier-1 contract §6.3 scopes the range gate to *"any field with `unit: "PERCENT"`"*.

| | |
|---|---:|
| PERCENT-united values checked corpus-wide | 2,693 |
| …that would fail the build (`<0` or `>100`) | **0** |
| benefits rows with `value.kind === "PERCENT"` | 206 |
| …that carry `value.unit` matching PERCENT | **20** |
| …whose value exceeds 100 | 5 |
| …**of those, how many carry `unit: "PERCENT"`** | **0** |

All five offending rows have `unit: undefined`:

```
ben-mr-bonus-benefit-3000              3000   BONUS_BENEFIT
ben-wonder-spend-tier-low               400   POINTS_PER_SPEND
ben-wonder-spend-tier-high              200   POINTS_PER_SPEND
ben-fly-matmid-earn-2019-regulation     190   POINTS_PER_SPEND
ben-mr-excluded-sector-earn             180   POINTS_PER_SPEND
```

**Gate 11 as frozen would catch 0 of 5.** The gate written specifically to stop `"3000%"` reaching a
user does not see the row that renders it, because that row is typed by `kind`, not `unit` — and
only 20 of 206 benefits percentage rows carry a `unit` field at all.

The defect remains covered **end-to-end** because gate 12 is `kind`-based and remaps
`POINTS_PER_SPEND` → `SPEND_PER_UNIT` and `BONUS_BENEFIT` → `THRESHOLD_AMOUNT` before any rendering.
So nothing ships wrong today. But §6.3's stated purpose — *"the range gate is what catches the next
instance without anyone having to notice it"* — is unmet for the only family where the overload
occurs.

**Recommended amendment (queue with R0–R6):** gate 11 keys on `unit: "PERCENT"` **OR**
`kind: "PERCENTAGE"`.

---

## 4. THE CLEAN GATES

**Gate 12 — benefits `value.kind`.** 206 rows: 67 classify as `PERCENTAGE`, 9 remap to another kind,
130 project `WITHHELD` (null `valueTypeRaw`), **0 unrecognised**. The contract's mapping is
exhaustive over the real corpus — the enum was specified correctly.

**Gate 5 — conflict resolution.** All 97 conflicts carry `PRESERVED_NOT_ARBITRATED`. Zero
violations. OD-3's "never arbitrate" invariant holds in the data as written.

**Gate 1 — no legacy rows.** 603 `UNVERIFIED_LEGACY_CANDIDATE` + 474 admitted by the OD-19 filter =
1,077 exactly. The partition is total and non-overlapping, so the gate cannot be satisfied by
accident.

---

## 5. GATES NOT YET TESTABLE

Gates 2, 3, 4, 6, 7, 8, 9 and 10's round-trip assertion require a **built pack**, which P1-B has not
produced. They are specified but unexercised. Each must get its own L13 run the moment a pack
exists — that is an acceptance criterion for P1-B, not an optional follow-up.

---

## 6. FINDINGS RECORDED, NOT FIXED

| # | Finding | Rate | Blocking? | Disposition |
|---|---|---|---|---|
| 1 | Path detector false-positives on quoted URL path fragments | 0.0117% overall; **0.0545% Hebrew** | No — Rule E excludes all 33 fields from packs | Backlog, with verified fix above |
| 2 | Gate 11 misses `kind`-typed percentages | catches 0 of 5 | No — gate 12 covers it today | Amend with R0–R6 |
| 3 | Arabic detector competence is unproven | 0 TP / 0 FP on 2,667 strings | No | Note for P1-B: add Arabic positives to the fixture set |
