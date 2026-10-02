# ADR-010 — Contract v1.3: the unit domain, and a census that passed while blind (DISCOVERY)

**Status:** Accepted — contract **FROZEN at v1.3**, costmodel schema **v1.1**
**Date:** 2026-08-20 · **Session:** 06, T4
**Classification:** **DISCOVERY AMENDMENT, not an incident** (Execution Model §20.1.3)

## What was discovered

The Batch-1 real-corpus L13 run — the first time the cost-model projections met the estate — failed
the build on its first row:

```
ProjectionBuildError: row=term:yahav|op:isracard:CARD_FEE:14 path=value.unit:
  a value is declared but no unit is: a number without a unit is not a fact (costmodel §1.4)
```

The row is `valueNumeric: 63.31, unit: "USD"`. **The unit is declared.** The error is wrong about its
own subject.

Cause: contract §5 said *"`unit: "ILS"` and `unit: "PERCENT"` are the only two unit values permitted
on a projected cost field."* That was measured on the **cards** family, where it is true, and written
as a rule for **every** family, where it is not. The measured domain across all 1,175 fee terms:

| unit | rows | value present |
|---|---:|---:|
| `ILS` | 748 | |
| `PERCENT` | 248 | |
| `USD` | 117 | 117 |
| `OTHER` | 17 | 1 |
| `null` | 39 | 0 |
| `EUR` | 6 | 6 |

**123 foreign-currency rows, 118 of them `calculationSafe: true`**, were being crashed on rather than
shipped.

## Why the executor is not at fault

Its own docstring cites the authority it was given and documents the failure as intended:

> *"Tier-1 section 5 permits exactly `PERCENT` and `ILS` on a projected cost field, so nothing else
> reaches a pack. Anything else on disk … yields NO unit, and the caller decides what that means:
> with no number it is consistent and the key is simply omitted; **with a number it fails the
> build.**"*

It implemented the stated rule correctly and failed loudly rather than guessing. This is an
**authority defect**. Recording it as an execution defect would teach exactly the wrong lesson.

## The part actually worth keeping

**§2.8's census ran over this family, reported clean, and was blind.**

v1.2 added the standing pre-schema census specifically so a schema would be written against measured
shapes. It ran. It enumerated three shape classes — present/absent/present-with-`null`, union types,
empty-but-present collections — all of which are **structural**. My census script printed JSON
*types*, so `unit` appeared as:

```
unit    present=1136  null=39  absent=0   string:1136
```

A perfectly healthy field. Single type, no union, no empty collection, three states accounted for.
Its actual content — five distinct values, of which the schema named two — was never looked at.

> **A census that checks the shape of a value but not its content will pass while blind, and that is
> worse than not running one, because it certifies the gap.**

§2.8 gains a fourth mandatory clause: **the value domain of every enumerated field** — the distinct
values with counts, not the JSON type. It is the one property of a field that is pure content, which
is precisely why three structural clauses missed it.

### And: sample fixtures by COMBINATION, not by field

The Batch-1 fixture *did* contain a `unit: null` row. It *did* contain value-present rows. It never
contained a value-present row with a foreign unit — the cell where all 123 failures live. One example
per field-level shape is not coverage when two fields interact. §2.8 now requires cross-tabulation of
interacting fields and coverage of the occupied cells.

This is the second consecutive packet defect (ADR-009 was the first, a missing present-with-`null`
example). The pattern is stable enough to name: **the fixture is where a schema's blind spots become
an executor's bugs**, and it is authored by the supervisor.

## The changes

**§5.1 — the projected unit domain.** Four values: `PERCENT`, `ILS`, `USD`, `EUR`. Cards' three
schema-declared facets stay narrow via a separate `CardCostUnit` type; a single shared union would
silently permit a dollar-denominated `foreignAtmPct`.

**`OTHER` is not a unit.** It is the estate stating it could not name one. A value present under
`OTHER` (exactly one row) projects `chip: UNKNOWN`, `reason: UNIT_NOT_DETERMINABLE`,
`obtainable: true`, no `value` key, `valueText` preserved.

**An unrecognised unit fails as `UNIT_NOT_IN_SCHEMA`, naming the value.** It is never narrowed to "no
unit declared". Reporting a present unit as absent is the same species of defect as inferring scale
from magnitude (§6.2): an unknown coerced into a known. The repair carries a synthetic `GBP` fixture
row as the regression guard, because the estate holds no violating row to test against.

**§5.2 — foreign currency is not ILS-calculable.** A `USD`/`EUR` amount is a fully known fact and
ships at its earned chip with its unit, plus `requiresFxConversion: true`, `ilsCalculationSafe:
false`. The row's own `calculationSafe` is preserved verbatim — the two are independent axes, as chip
and `calculationSafe` already are (§4).

What is *not* knowable at build time is the ILS equivalent, and the rows say so themselves:

> *"לסכום העמלה הנקוב בדולר תבוצע המרה לפי השער היציג של הדולר לשקל ותחויב בשקלים"*
> — conversion at the representative rate **on the charge date**.

**What this prevents.** An engine ranking a `63.31 USD` monthly card fee against a `₪64` one
concludes the dollar card is cheaper. It is roughly 3.5× more expensive. Not a display bug — the
product answering its central question wrongly, with a VERIFIED chip beside it.

## An open question in a frozen schema is a defect with a due date

Costmodel v1.0 shipped with open question 2: *"`unit: null` on 39 fee-term rows where a value may
still be present. The build rule is to fail; **whether any real row trips it is not yet
measured.**"*

The measurement closes it at **zero**. But the honest flag was pointed at the wrong cell. Measuring
it when it was written would have required censusing `unit` against `valueNumeric` — which is exactly
the cross-tabulation that would have found the 123.

## Consequences

- OD-23 opened: app-side FX presentation policy (convert-and-show with a live rate, or show in
  currency). A data question is settled here; the product question is not, and must not be settled
  by default in a projection.
- The `auditForeignAtmSources` join the executor built addresses costmodel §3/§5.1's other open
  question; its output is reported once the repair lands.
- Cost of finding this on Batch 1: one repair cycle. Cost of finding it after Batch 2's graph
  families encoded the same unit assumption: re-projection and re-goldening of five more families.
