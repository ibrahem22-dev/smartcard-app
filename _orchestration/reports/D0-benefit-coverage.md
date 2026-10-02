# D0 — BENEFIT COVERAGE PER INSTITUTION

**Date:** 2026-08-19 · **Method:** the 83 shippable benefit-reached cards were located via the
`relationships.jsonl` graph (`CARD_GRANTS_BENEFIT` ∪ `CARD_INHERITS_BENEFIT_VIA_PROGRAMME`,
card-side endpoints) — the join verified exact in P0-B §3 — then grouped by `issuerOrgId` against
the 378 shippable-per-institution counts in `FINAL_METRICS.json`. No benefit→card link was created;
no similarity matching was run. All numbers below are read, not inferred.

---

## 1. PER-INSTITUTION COVERAGE (all 17 institutions)

| Institution | Shippable cards | Cards with ≥1 benefit | Coverage |
|---|---:|---:|---:|
| `org:amex-il` (Amex Israel) | 20 | 20 | **100%** |
| `org:max` | 16 | 15 | **93.8%** |
| `org:cal` | 24 | 21 | **87.5%** |
| `org:isracard` | 15 | 10 | **66.7%** |
| `org:one-zero` | 2 | 1 | 50% |
| `org:hapoalim` | 42 | 16 | 38.1% |
| `org:fibi` | 38 | 0 | **0%** |
| `org:otsar-hahayal` | 38 | 0 | **0%** |
| `org:pagi` | 31 | 0 | **0%** |
| `org:mizrahi-tefahot` | 31 | 0 | **0%** |
| `org:massad` | 26 | 0 | **0%** |
| `org:discount` | 22 | 0 | **0%** |
| `org:mercantile` | 21 | 0 | **0%** |
| `org:yahav` | 18 | 0 | **0%** |
| `org:jerusalem` | 13 | 0 | **0%** |
| `org:leumi` | 13 | 0 | **0%** |
| `org:postal-bank` | 8 | 0 | **0%** |
| **Total** | **378** | **83** | **22.0%** |

Coverage is bimodal, not evenly thin: **6 institutions are well-to-fully covered; 11 have
literally zero benefit-carrying shippable cards today.** There is no institution in between.

## 2. MAJOR ISSUERS, CALLED OUT

The four card *companies* the brief named are the best-covered institutions in the catalog:
**Amex Israel 100%, max 93.8%, CAL 87.5%, Isracard 66.7%.** These four operate a large share of
all Israeli cards regardless of which bank's logo is on the plastic, and their own directly-issued
products are the strongest part of this dataset.

**The "large bank card lines" are the opposite story, and it is not evenly bad — it is a sharp
split even among the big four retail banks:** Hapoalim (Israel's largest bank) sits at a partial
38.1% — real coverage, not zero. But **Leumi, Discount, and Mizrahi-Tefahot — the other three of
Israel's "big four" banks — are all at exactly 0%,** as are every other bank and cooperative in the
estate (FIBI, Otsar Hahayal, Pagi, Massad, Mercantile, Yahav, Jerusalem, Postal Bank). A user
holding a directly bank-issued card from 11 of the 17 institutions in this catalog will see a
literal, guaranteed empty Card DNA §B today — not "usually," always, because the estate holds zero
benefit rows for that institution's cards.

## 3. TYPICAL WALLET — one bank card + one club card + one non-bank-issuer card

Modeled as three independent draws from three real, disjoint-enough populations in the catalog
(a club/programme-attached card can itself be bank-issued — the categories describe *how the card
was selected*, not a partition of the catalog):

| Card in the wallet | Population | Cards with ≥1 benefit | Rate |
|---|---:|---:|---:|
| Plain bank-issued card (not club/programme-attached; excludes the 5 card-company issuers) | 301 | 16 | **5.3%** |
| Club/programme-attached card (via a `shipToApp` `CARD_ATTACHED_TO_PROGRAMME` edge — `clubIds` on the card record itself is empty for every row, so this can only be found via the relationship graph, not the card's own field) | 72 | 71 | **98.6%** |
| Card issued directly by a card company (max / CAL / Isracard / Amex Israel / ONE ZERO) | 77 | 67 | **87.0%** |

**P(at least one of the three wallet cards shows a populated Card DNA §B) = 1 −
(1−.053)(1−.986)(1−.870) ≈ 99.8%.** A realistically diversified wallet is very unlikely to be
*entirely* empty, because club-affiliated and card-company-issued cards carry benefits almost
without exception.

**This is a different question from what any one card shows**, and the difference matters:
**P(that specific plain bank card's own Card DNA §B is empty) = 94.7%.** A user who opens the
Card DNA screen for their Leumi debit card, their Discount Visa, or their Mizrahi-Tefahot
Mastercard — none of which are club-attached — sees an empty §B regardless of what else is in
their wallet, because §B is rendered per card, not per wallet.

## 4. VERDICT: **HIGH** user-visible impact

Not because the aggregate 83/378 = 22% figure is alarming on its own (a per-institution average
would understate how concentrated the gap is), but because of what the split actually is:

- **A single, large, sharply-defined segment — 11 of 17 institutions, 259 of 378 shippable products
  (68.5% of the catalog) — has zero benefit data, full stop**, not "thin" data. Any user whose card
  falls in this segment gets a guaranteed-empty §B, every time, with no near-term fix visible in
  this generation (G06b re-extraction is deferred to P5c under OD-6).
- The segment includes **3 of Israel's 4 largest retail banks** (Leumi, Discount, Mizrahi-Tefahot),
  which by real-world market share almost certainly issue a large fraction of actual installed-base
  cards, independent of how many *SKUs* they contribute to this 378-product catalog.
- The wallet-aggregate softening (§3, ~99.8% "something is populated somewhere") is real and worth
  keeping in view for overall product-empty-state frequency, but it does not change what any
  individual card screen shows, and Card DNA is a per-card surface.

**Consequence for design (reaffirming OD-1's own conclusion):** the empty §B state is not an edge
case to default away — for the majority of individual bank-issued cards in the catalog it is *the
expected state*, and it needs to be designed as deliberately as the populated one: what to show,
whether to suggest checking the issuer's own app/site, and how to avoid implying "this card has no
benefits" when the honest fact is "this generation hasn't extracted this issuer's benefits yet."

## 5. WHAT WAS NOT DONE (explicitly, per scope)

No card→benefit link was created or modified. No similarity matching, name-based inference, or
manual patching of the zero-coverage institutions was attempted — that is explicitly G06b's job
(P5c, OD-6), not this task's. No canonical file was read-modified; all figures were computed by a
throwaway script reading the (now read-only) estate.
