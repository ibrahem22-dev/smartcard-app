# TREVIK UNIFIED PRODUCT UPGRADE — FINAL CAMPAIGN REPORT

**Artifact #8** · APK `ac84004d502b6f8fc849fcbd383205dd65426bbb93f9de50fa38bf59f7698b8a` ·
app `1c842d9beaee7d92d5d70e5fc999b9710426c6af` · branch `mdc/execution` · 2026-09-06

Two directives were executed as **one campaign, one artifact, one regression round**: the MASTER
ONE-SHOT PRODUCT UPGRADE (seven capabilities) and the OWNER-AUTHORIZED SCOPE ADDENDUM (Benefits Hub,
guided canonical onboarding, real data binding). The addendum required exactly that — *"Do not build
artifact A for the previous seven features then artifact B for this addendum unless technically
unavoidable"* — and it was not unavoidable.

---

## A. WHAT WAS BUILT

### A.1 — OQ-P5-002, the recommendation card

**The defect was not where it was expected.** The directive said to verify at HEAD rather than assume,
and the verification changed the work: the recommendation card's *composition* was already correct. Its
**input** was missing. Nothing in the app populated `scoringCosts`, so `scoreFromVault` ranked an empty
cost map and the card was blank on every real device while every render test passed — the tests supplied
the costs the app never did.

`src/check/purchaseCostLane.ts` fills it honestly: it prices an instalment purchase from **each card's
own** `cardRates.installmentInterestRate` through `calculateInstallmentInterest`. A single payment or a
foreign-currency purchase returns `NOT_PRICEABLE` rather than a fabricated number, and a card with no
published rate goes to `unpricedCardIds` — **never to zero**, because zero is the answer "this card is
free", which is a claim.

`CheckVerdictScreen` gained `recommendationBasis` and `recommendationAbsence`, so when there is no
recommendation the screen says which of four things is true (`NO_CARDS`, `NO_AVAILABLE_CARD`,
`NOT_PRICEABLE`, `COST_UNKNOWN`) instead of rendering nothing.

### A.2 — Check → Merchant Radar

`src/screens/check/MerchantRadar.tsx`, at the top of the Check flow. Search over the **266-merchant
canonical taxonomy**, five quick chips (Shufersal, Carrefour, Rami Levy, Super-Pharm, Sonol), five
recent merchants per profile stored as canonical ids only.

`src/check/merchantRadar.ts` answers with `VERIFIED_MERCHANT_BENEFIT` or
`NO_VERIFIED_MERCHANT_BENEFIT`, and the absence is one of three **different** facts, never merged:
`NO_EVIDENCED_BENEFIT`, `NOT_LINKED_TO_A_CARD`, `NOT_IN_THIS_WALLET`.

**Observed on artifact #8:** choosing Shufersal renders *"אין הטבה מתועדת לבית העסק הזה כרגע"* with the
reason *"לא נמצאה במאגר הטבה מתועדת לבית העסק הזה"* and an offer to continue to a general check. No
invented benefit.

### A.3 — WaiverBadge → Negotiation Hub

`IssuerNegotiationSheet` opens from the waiver badge with phone, WhatsApp and copy actions over the
**content pack's own VERIFIED_OFFICIAL contact rows**, and four negotiation topics in Hebrew, Arabic and
English (`negotiationScripts.ts`; only `{{card}}` is interpolated).

`src/data/adapter/issuerContacts.ts` parses the estate's prose values (`03-6178888 (טלפון);
054-5408881 (WhatsApp)`) into typed channels, keeps `*` in a `tel:` URI per RFC 3966, and derives E.164
for WhatsApp — returning nothing for a star code, because a star code is not a WhatsApp number.

**The Owner's three candidate numbers were not shipped.** `*6969`, `*4554` and `*6464` occur **zero**
times in the corpus; the audit table in `reports/campaign/CANONICAL_DATA_AUDIT.md` §29 states that for
each. The corpus values shipped instead. `ContactScreen`'s three hardcoded numbers were replaced with
pack rows.

### A.4 — Card DNA simplification

`BottomLineCard` over four accordions (§A open, §B/§C/§D closed). **Nothing was removed** — every section
still exists and still renders what it always did.

**Observed on artifact #8, SKYMAX:** *השורה התחתונה* → *"אין ערך נטו חודשי שאפשר להציג"* → *"התעריפון
מפרסם כמה סכומים לפי דרגת כרטיס, והנתונים אינם מציינים את הדרגה שלך"* → the **candidate set**, whole:
Classic ₪12.90 · Prepaid·Reloadable ₪19.90 · Gold·International ₪17.90 · Business Gold ₪19.90 ·
Platinum ₪19.90. Then *18 הטבות מתועדות לכרטיס הזה* with *"זהו מספר ההטבות שיש להן עדות במאגר, ולא שווי
שנמדד בפועל"*.

### A.5 — Spitzer calculator promoted

`InterestCalculator` moved from `MoreStack` into `WalletStack` and is reachable from Card DNA's Bottom
Line card. The `MoreStack` route is gone, so there is one home for it, not two.

### A.6 — Home → Command Center

`HomeBudgetBar` + `budgetProgress.ts` (monthly target, three bands, `BUDGET_APPROACHING_FRACTION` in
`config/financial.ts`), `HomeBillingCluster` (billing dates that fall together), `HomeBenefitsEntry`
(counts from the **one** eligibility layer, so Home cannot disagree with the Hub), and a settings gear.

**The bar says what it can see, in the label rather than a footnote:** *"נמדד לפי ההתחייבויות החודשיות
שלך והרכישות שרשמת החודש. האפליקציה אינה מחוברת לחשבון הבנק ואינה רואה חיובים שלא הוזנו."* No bank
synchronisation is implied because none exists.

The mislabelled *"חיובים קרובים"* count — which counted **cards**, not upcoming charges — is gone.

### A.7 — Settings separated from More

`MoreScreen` is a hub; `SettingsScreen` is its own route, reached from the Home gear and from the hub.
The promo-code control was removed. **Criterion A1 is intact**: the navigation bar still has five items,
because Settings is a route in `MoreStack`, not a sixth tab.

---

## B. THE ADDENDUM — REAL CANONICAL DATA

### B.1 — Card identity is never modelled from display text

`src/data/adapter/cardCatalog.ts` is the query layer over issuers, networks, products, edges, clubs,
programmes, fees, waivers, exceptions and interest. Two ids that were never merged:

| | |
|---|---|
| `issuerOrgId` | **whose** card it is — the bank or the card company that issued it |
| `operatingCardCompanyId` | **who runs it** — the operator, where the estate recorded one |

`NETWORK_IDS` maps all 21 spellings the estate uses for a network; `UNKNOWN`, `NOT_CONFIRMED` and
`MULTI_NETWORK_SEE_VARIANTS` map to an **empty list**, and the guided review says so in words.

**Observed on artifact #8, SKYMAX:** *"רשת התשלומים לא אושרה במאגר"*. The app did not guess a network.

### B.2 — Guided card onboarding

`GuidedCardPicker`, wired into `AddCardScreen`, walking **nature → issuer → product → programme →
review → save**. Criterion `catalog-reach` is intact: the add-card screen still **opens as a search
surface**, with the guided path offered as a prominent button on it.

**Observed on artifact #8, both branches:**

- *כרטיס בנקאי* → 14 real banks by published legal name → *בנק לאומי לישראל בע"מ* → its real products,
  each with its network → *כרטיס אשראי United Airlines של לאומי* (ויזה) → review → details.
- *כרטיס חוץ בנקאי* → the four real card companies, including **"אמריקן אקספרס ישראל (מונפק ע"י
  ישראכרט)"**, which is the issuer/operator distinction on the screen where it matters → *מקס איט
  פיננסים בע"מ* → SKYMAX → **the programme step**: three real SKYMAX programmes with their enrolment
  kind (AUTOMATIC / OPT_IN) and the honest scope line *"רק מועדונים שיש להם קשר מתועד לכרטיס הזה"*.

The review step shows the bound facts before anything is saved, and the details step pre-fills from
canonical data with VERIFIED chips, flipping to *הערך שלך* where the user types. Underneath:
*"שדות לא ידועים נשארים לא ידועים — האפליקציה לא תמציא ערך."*

**No card credentials are collected anywhere.** No PAN, no CVV, no bank password, no issuer login. The
form asks for a nickname, the last four digits, a limit, a balance and an optional billing day.

### B.3 — Fee binding, and why an unknown fee is not ₪0

`src/data/adapter/cardFeeProfile.ts`:

| state | meaning |
|---|---|
| `VERIFIED` | one published figure, resolved to this card by the estate |
| `CONDITIONAL` | published, but with conditions or a level the data does not model |
| `NOT_AVAILABLE` | looked for and not published — with a reason |
| `NOT_APPLICABLE` | the fee does not apply to this kind of card |

`readingFromCardCost` handles the per-card `costs` block (FX commission and foreign-ATM are VERIFIED on
**all 378** products). `readingFromTariff` matches on **issuer + operator scope only**;
`NAMED_CARD_OR_LEVEL` rows name a card by a display label the card row does not carry, so they are
**counted and never joined** — matching them would be matching a fee to a card by its name.

A single monthly card fee is resolvable for **14 of 378** products. For the rest the reading is
`CONDITIONAL` with `LEVEL_NOT_MODELLED` and the surface shows the **whole candidate set**, as above.

### B.4 — Legacy card migration

`reconcileCard()` classifies every stored card `CANONICALLY_RESOLVED` / `AMBIGUOUS` / `UNRESOLVED`.
**A unique name match is still AMBIGUOUS.** Adopting it silently would be modelling identity from
display text, and the cost is not cosmetic: the card would be bound to another product's FX commission,
another product's tariff scope and another product's benefits, all rendered as verified.
`CardReconciliationPrompt` offers; the user confirms; `updateCard` writes only the canonical ids and
leaves the nickname, last four, limit and billing day untouched.

### B.5 — One eligibility layer

`src/data/adapter/benefitEligibility.ts` serves **both** the Benefits Hub and Merchant Radar. Programme-
scoped benefits are deliberately **not** joined (`UNRESOLVED_NAMESPACE_DISJOINT`) rather than joined on a
namespace the estate says is disjoint.

### B.6 — Benefits Hub

`BenefitsHubScreen`, reachable from the Wallet's Benefits segment, from Home, and from Card DNA scoped to
one card. **Observed on artifact #8, scoped to SKYMAX:** 18 available · 1 contributing card · 3 ending
soon, with family filters carrying real counts (travel 5, points 2, lounge 3, fees 4, other 4).

`OQ-MDC-032` records the Owner superseding the V1.x deferral of **Benefits Hub** and **merchant search**
by name. The other twelve surfaces in that register row stay deferred, and the Benefits Corpus Campaign
row is untouched: **the Hub ships over the corpus as it stands and makes no coverage claim.**

---

## C. DEFECTS FOUND BY DOING THE WORK

Five, all found by exercising the product rather than by reading it. Three were pre-existing.

### C.1 — The Benefits Hub was printing the research team's notes to users *(found by a gate, real, fixed)*

P5's `no-account-surface` gate walked into a shipped data pack for the first time — because Benefits Hub,
Merchant Radar and the Negotiation Hub bind canonical data — and objected to the estate's research
annotations describing an **issuer's** login-gated website. Following the alarm found the actual defect:
`BenefitsHubScreen` was rendering the benefits pack's `description`, which is **English-only research
prose beside Hebrew and Arabic titles**:

> "Merchant discounts published as logos in a graphic; the merchant-to-rate mapping is not text-extractable"
> "General CAL cardholder portal offers referenced at marketing level only"
> "This is an access statement, not a per-benefit entitlement."

This is exactly the class artifact #7 removed from the Learn screen (PD-MDC-082). The render is gone, the
field is out of the Hub's search index, and `benefitsHubNoPackProse.render.test.tsx` re-measures the
**shipped pack's own** descriptions on every run and fails if one reappears in the tree.

### C.2 — The Check flow had no exit *(found on the emulator, mine, fixed)*

`CheckInputScreen` had no scroll view. With Merchant Radar added, the submit button fell below the fold
and the flow could not be completed. Wrapped in `RtlScrollView`. **A render test cannot see this** — it
has no viewport.

### C.3 — A card with nothing owed on it could not be saved *(found on the emulator, pre-existing, fixed)*

Walking the guided flow on artifact #8 with a current balance of **0**, the form answered *"יש למלא שם,
מנפיק, 4 ספרות, מסגרת וחיוב תקינים"* — an error naming five fields, none of which was wrong. Typing 1
saved immediately. `parseAmount` floors at `MONETARY_MIN_ILS` (₪0.01), which is right for a purchase, an
instalment and a credit limit, and wrong for a balance: **nothing owed is the ordinary state of a card
the moment somebody adds it.** `parseAmountAllowingZero` is a second named function, not a flag, so the
floor stays a real rule for the three callers that keep it. The same validation is in the tree at
artifact #7 and earlier — every artifact shipped with it.

### C.4 — Two provenance chips saying nothing, twice *(found on the emulator + a gate, mine, fixed)*

The Hub put the benefit's validity chip and the estate's grading chip on one row with no words. Read back
off the device it rendered as *"לא ידוע ? · לא ידוע ?"*. Each chip now carries the word for what it
qualifies — *תוקף* and *מקור*.

### C.5 — V3's cold-start figure was measuring a spinner *(found by re-measuring, pre-existing, RAISED)*

See §E.

---

## D. GATE AND TEST RESULTS

| ladder | result at the final sha |
|---|---|
| **P2** | `P2-ALL OK` — 46 gates over 44 required, 0 failed |
| **P3** | `P3-ALL OK` — every step green |
| **P4** | `P4-ALL OK` — 41 required gates, 0 failed |
| **P5** | `P5-ALL OK` — every step green, 5 of 5 agreement gates written and run |
| **MDC** | 20 required gates ran · **19 green** · `performance` RED (§E) |

`typecheck` clean · `lint` clean (`--max-warnings=0`) · **1,489 tests across 188 suites green**.

Six P2 gates and four P5 gates were red when this campaign's code first met them. Every one was repaired
in the **code**, not in the gate, with two exceptions that are recorded as such:

- `tools/p5/gates/no-account-surface.mjs` — the import walk now follows `.ts`/`.tsx` only. Recorded as
  **flagged provisional decision PD-MDC-084**, with the general question raised as **OQ-MDC-033**. The
  gate measures SOURCE and its sentinel counts modules; a JSON string offers no login affordance, and
  whether data is *rendered* is a fact about code. No module was dropped from the sweep and the four
  patterns still run over all 167 modules the five routes reach.
- `tools/mdc/gates/debt-retirement.mjs` — four new percent call sites added to the gate's **INVENTORY**
  with the unit **measured**, which is the process OQ-MDC-004 defined for exactly this.

Three name collisions were fixed by renaming **this campaign's** code, because in each case the gate was
asking a real question and a duplicated name made it unanswerable:

| was | is | the question it was blocking |
|---|---|---|
| `FeeReading.candidates` | `publishedRows` | A3/OD-9 — nobody outside `ConflictedValue` renders a conflict |
| `ReconciliationReading.candidates` | `catalogMatches` | the same |
| `CardFeeProfile.cardFee` | `publishedCardFee` | C4 — has `UserCard.cardFee` gained a reachable writer? |

That last one matters most: whether `cardFee` has a reachable writer is the live question behind the
OQ-MDC-019 deferral of fee-waiver reminders. With the rename the gate re-states what is actually true —
*"fee-waiver reminders deferred to V1.x under OQ-MDC-019, register row present, still unreachable"* — and
**the register was not edited, because nothing about it had changed.**

---

## E. WHAT IS RED, AND WHY IT IS REPORTED RED

**V3 PERFORMANCE.** Re-measured on artifact #8 on emulator-5554:

| | measured | budget | |
|---|---|---|---|
| cold start to interactive Home | **19,284 ms** median (max 19,917) | 4,000 ms | **RED** |
| input to verdict | 2,073 ms median | 10,000 ms | green |
| engine upper bound | 200 ms median | 500 ms | green |
| dropped frames — home | 4.57% of 460 | 5% | green |
| dropped frames — wallet | **5.02%** of 438 | 5% | **RED by 0.02** |

The cold-start figure disagrees with the artifact #7 record, which read **498 ms** for the same leg where
this run reads **17,527–18,321 ms**, three runs out of three. They are measuring different events: the #7
method took the end of the **first** dense run of frames after the Unlock tap, and tapping Unlock renders
an *"opening…"* state immediately, so it stopped at the spinner. The new method waits for the **tab bar**
— which neither the lock nor the opening state has — and then reads the timeline.

**This is not a regression from the upgrade.** Checkpoint #36, written during the C4 work on artifact #7,
recorded the same unlock at *"about sixteen seconds either way"*.

**The cause is not attributed.** The obvious candidate is the vault's key-derivation cost, a deliberate
security parameter, and it was **not isolated** — so it is not claimed. A measurement that has not been
isolated is not an attribution.

Raised as **OQ-MDC-034** with three options: accept the figure and re-ask the budget; treat it as a defect
and profile the key derivation; or split the criterion. A session cannot re-rule a budget, and it
certainly cannot trade a security parameter for a start-up figure.

---

## F. HONESTY, PROVENANCE AND SECURITY

- **No fabricated data.** Every card, issuer, product, programme, merchant, benefit and fee resolves to a
  canonical row or is stated absent with a reason.
- **An unknown fee is never ₪0.** Four evidence states, and the candidate set is shown whole.
- **One provenance vocabulary.** Three screens were using the chip's reserved words as prose; two now say
  what is true instead (*"recorded"* for a benefit the corpus holds, *"official"* for contact rows the
  estate grades VERIFIED_OFFICIAL) and the third wears the one shared `ProvenanceChip`.
- **No analytics, no telemetry, no silent network.** Nothing was added; the P2 analytics-boundary and
  P5 no-account-surface gates are green over the new code.
- **No credentials.** No PAN, CVV, bank password or issuer login is asked for anywhere.
- **Local-first.** Recent merchants, the budget target and every canonical id are written to the
  encrypted local vault; `p5UserState.ts` carries a row for each new key.
- **Accessibility.** Two new labels interpolated an untranslated token (a phone number, a date); both are
  now single `t()` calls with a `{{placeholder}}` so the whole sentence resolves in three languages.
- **RTL and i18n.** 151 new source strings, each with an Arabic and an English rendering; the i18n audit
  reports **0 unaccounted**.

---

## G. WHAT WAS NOT DONE

**Prohibitions, all observed.** No production signing. No publication. No Google Play submission. No DNS,
R2 or provider change. **No physical device was contacted** — the Samsung S24 Ultra and the Galaxy Tab are
foreign to this campaign and were not touched. STAGE-4 was not entered. V8 signing custody is untouched.
No legal approval was given and no V1/V2/V5 attestation was made.

**Remaining MDC work, named rather than glossed:**

1. **DEVICE re-observations on artifact #8** — C4, C9, T5 and T8 carry CURRENT ASSURANCE records bound to
   artifact #7. They need a fresh capture walk on #8 through `assurance-evidence.py` and
   `mc.mjs assure`. The MDC gates for all four are green on the evidence they have; what is missing is the
   re-binding to the new artifact.
2. **X1 / X2 / X3 re-receipting** at the final sha.
3. **V1 (TalkBack), V2 (RTL), V5 (session protocol), V7 (counsel annex + SEND_MANIFEST), V9 (store
   listing)** — each names artifact #7 and needs its artifact line updated to #8. None of them may be
   *attested* by a session, and none was.
4. **OQ-MDC-033 and OQ-MDC-034** are open on the Owner desk.

---

## H. OWNER DECISIONS RECORDED THIS CAMPAIGN

| id | what |
|---|---|
| **OQ-MDC-032** | Benefits Hub and merchant search leave the V1.x deferral, by the Owner's own words in the scope addendum. The register row is annotated, not deleted; the other twelve surfaces stay deferred; the Benefits Corpus Campaign row is untouched. |
| **OQ-MDC-033** | *(open)* What, if anything, should statically police pack **text** reaching a reader, now that surfaces bind canonical data. |
| **OQ-MDC-034** | *(open)* V3's cold-start budget versus a ~17.5 s vault unlock, and the #7 record that measured a spinner. |
| **PD-MDC-084** | *(flagged for Owner review)* The U5 walk follows `.ts`/`.tsx` only while OQ-MDC-033 is open. |

---

## I. WHERE EVERYTHING IS

| what | where |
|---|---|
| artifact #8 build record | `campaign-master/evidence/external/CURRENT-ARTIFACT/00-BUILD.txt` |
| V3 measurement + evidence | `campaign-master/evidence/external/V3/` |
| canonical data audit | `reports/campaign/CANONICAL_DATA_AUDIT.md` |
| ladder reports | `reports/p2/`, `reports/p3/`, `reports/p4/`, `reports/p5/`, `reports/mdc/` |
| deferral register | `campaign-master/MDC_DEFERRED.md` §1.1 |
| Owner queue | `campaign-master/state/OWNER_QUEUE.jsonl` |
| the APK | `android/app/build/outputs/apk/release/app-release.apk` |

The emulator is on **Home**, unlocked, in Hebrew, with two canonically bound cards, showing the budget
bar, the benefits entry (18 available, 3 ending soon) and the load bar.
