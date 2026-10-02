# ADR-009 — Contract v1.2: the three on-disk states of a value field (DISCOVERY)

**Status:** Accepted — contract **FROZEN at v1.2**
**Date:** 2026-08-20 · **Session:** 06, T2
**Classification:** **DISCOVERY AMENDMENT, not an incident** (Execution Model §20.1.3)

## Why this is not an incident, and why the distinction matters

ADR-008 recorded a genuine incident: v1.0 was frozen against an authority set that did not contain
the ruling, so three structural revisions were simply missing. Something had gone wrong in the
process.

**Nothing went wrong here.** The v1.1 freeze held. What happened is that running one entity family
end to end against real data surfaced a shape the schema had not modelled — which is *precisely
what the tracer bullet exists to do*. Labelling this an incident would punish the process for
working, and would make future sessions reluctant to surface findings.

The distinction is worth keeping sharp:

| | Incident | Discovery |
|---|---|---|
| Cause | the process failed | the process worked |
| Example | v1.0 frozen without the ruling (ADR-008) | v1.2's three-state rule |
| Response | fix the process, state that the freeze did not hold | fold the finding in, bump the version |

## What was discovered

The cards projection threw on 34 real rows:

```
ProjectionBuildError: row=card:postal-bank:gift-card-plus path=costs.atmSameCurrencyFee.value
  verificationStatus "VERIFIED_OFFICIAL" claims a verified figure but no value is recorded
```

The schema modelled a value field as either **present with a number** or **absent**. The estate has
a third state — **present with `value: null`** — and it carries meaning. Measured across the 474
shippable card rows and their 1,422 cost fields:

| State | Count |
|---|---:|
| present with a value | 1,388 |
| absent entirely | 394 |
| **present with `value: null`** | **34** |

Of those 34, **14 carry `verificationStatus: VERIFIED_OFFICIAL`** — all `CURRENT` rows, all on
`atmSameCurrencyFee`. Verbatim:

```json
{"value": null, "unit": "ILS", "verificationStatus": "VERIFIED_OFFICIAL", "resolution": "ISSUER_X_OPERATOR"}
```

That is **not a contradiction.** It is an **evidenced absence**: the issuer's tariff was read, and it
publishes no separate figure for that field.

## The change (contract §2.7)

A `value: null` field projects as `chip: UNKNOWN` — there is no number to show — with the `reason`
carrying what was actually established:

| Layer-A grade | `reason` | Meaning |
|---|---|---|
| `VERIFIED_OFFICIAL` / `CORROBORATED` / `SINGLE_SOURCE` | **`NOT_PUBLISHED`** | we looked, officially; there is none |
| `UNKNOWN_AFTER_RESEARCH` | `UNKNOWN_AFTER_RESEARCH` | documented search, terminal |
| `UNKNOWN` / none | `UNKNOWN` | nobody has looked yet |
| `CUSTOMER_SPECIFIC` / `LOGIN_GATED` | that status, `obtainable: true` | the user can supply it |

**And a `null` MUST NOT become `0`.** "No separate same-currency ATM fee is published" and "the fee
is ₪0" are different claims; only the first is evidenced. This is §6.2's magnitude prohibition
applied to absence rather than scale.

## The part worth noticing

**Contract v1.1's `reason` field — added hours earlier as R3 — was already exactly the right
shape.** No new field was needed; the amendment is a mapping rule, not a structural change.

Under v1.0's `WITHHELD`-with-no-`reason` model those 14 rows would have been indistinguishable from
"nobody has looked yet", and the app would have discarded evidence someone actually gathered. R3 was
argued on the strength of the "Add yours" affordance; it turned out to earn its keep on a case
nobody had in mind when it was written. That is an argument for accepting well-reasoned structure
slightly ahead of its demonstrated need.

## The second change (contract §2.8) — the standing pre-schema census

The transferable lesson is not about `null`. It is that **the schema was written from an assumption
about the data's shape rather than a census of it.**

§2.8 now requires, before any family's schema is written: enumerate from the real corpus the
distinct on-disk shapes of every field in scope, count them, and write the schema against that.
The census must cover the three states, union-typed fields (cards had two), and
empty-but-present collections (cards' `clubIds` is `[]` on every shippable row).

**And it must flow into delegation.** Cards' single repair was a **packet defect, not an executor
defect**: the fixture I supplied contained no present-with-null example, so the executor's two-state
assumption was reasonable and its code threw on 34 real rows. An executor cannot handle a case it
has never been shown.

## Consequences

- Every remaining family (Batch 1's four, then Batch 2's graph families, then the rest) gets a
  shape census **before** its schema. This is now a contract rule, not a habit.
- `SMARTCARD_DATA_CONTRACT_CARDS.md` v1.2 already states the cards-specific version; it remains
  correct and is now the worked example of the general rule.
- Cost of having found this on family one rather than family thirteen: one repair cycle, versus
  re-projecting and re-goldening thirteen families.
