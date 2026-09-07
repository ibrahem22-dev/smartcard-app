# TREVIK — ARTIFACT #9 TECHNICAL CLOSURE — FINAL REPORT

**Artifact #9** · APK `c4f790d846f6c1c6a5d7e919a7ace7e15f25d5df6b55cc40b569442a11c559c8` ·
bundle `8a95adfb0eac3bf5723d649430859851c1b57da2f6e828ca0767c7b6bebdb688` ·
app `b57378c666fb7b71fe5efdeb4fbc233fee657d8c` · branch `mdc/execution` · 2026-09-07

The unified product upgrade shipped as artifact #8 and left four technical questions open. Two are
now answered in code, one is answered by measurement and hands a decision to the Owner, and one is
partly done with the remainder named. Nothing was restarted and no capability was rebuilt.

---

## 1. THE HEADLINE

| item | artifact #8 | artifact #9 |
|---|---|---|
| cold start to interactive Home | 19,284 ms | **13,213 ms** — still RED against a 4,000 ms budget |
| the cause of it | *"not attributed"* | **isolated: 14,710 ms of a 14,906 ms unlock is the Argon2id derivation** |
| wallet dropped frames | 5.02% — RED | **2.71% — GREEN**, five passes spanning 0.02 points |
| home dropped frames | 4.57% | 2.61% |
| input → verdict | 2,073 ms | 1,881 ms |
| what statically polices pack text | nothing (OQ-MDC-033 open) | **a census, a projection, a gate and two adversarial suites** |
| PD-MDC-084 | flagged provisional | **superseded** |
| the screen the app opens on in Hebrew | More | **Home** |
| tests | 1,489 / 188 suites | **1,507 / 191 suites** |

**Verdict: `TREVIK V3 PERFORMANCE — OWNER/ARCHITECTURE DECISION REQUIRED`.** Everything technically
resolvable in this session is resolved. What remains is a conflict between two clauses of the
security contract, and a session may not rule it.

---

## 2. §B–§D — THE PERFORMANCE ROOT CAUSE, MEASURED AND ISOLATED

### 2.1 How it was measured

A **measurement build** was made from artifact #8's source with twenty monotonic marks along the
whole start-and-unlock path, emitted to logcat and rendered on screen so the reading did not depend
on a channel that might not exist in a release build. It is not an artifact: it appears in no
registry, it was never a candidate, and the instrumentation was reverted before artifact #9 was
built. `adb root` is refused by this emulator and `run-as` is refused by a non-debuggable release, so
the on-screen panel is why the trace was readable at all.

### 2.2 The waterfall

One representative cold start, milliseconds since the bundle's first mark:

```
pack.taxonomy / benefits / content / catalog materialise      0 → 26     26 ms TOTAL
boot (App.tsx module body)                                   27
app.render (first React render)                              30
ui.show (language hydrated + 12 Plex faces loaded)           90
gate.LOCK (the lock branch mounts)                          219
ctx.evaluate.start → end                               227 → 304
── lock screen up; PIN typed; user time, excluded ──
ui.unlock.tap                                             7,548
kv.lockout.read                                           7,558   +10
kv.securestore.read                                       7,598   +40
kv.kdf.start                                              7,598
kv.kdf.end                                               22,307   +14,710   ← 98.6% of the unlock
kv.unwrap.end                                            22,308   +0
kv.mmkv.open                                             22,308   +0
kv.unlock.ok                                             22,389   +81
ctx.evaluate → hydrate → gate.AUTHENTICATED              22,452   +63
nav.authenticated.render → nav.tabs.render               22,454   +2
nav.authenticated.effect                                 22,493   +39
```

**From the Unlock tap to a mounted, interactive Home is 14,906 ms, of which the key derivation is
14,710 ms.** The lockout read, three SecureStore reads, the GCM unwrap, opening MMKV, the
failure-counter reset, the auth re-evaluation, store hydration and mounting the entire tab shell cost
**196 ms together**.

### 2.3 §E and §F — the canonical data is not the problem, and the #8 record's own hypothesis is refuted

The artifact #8 record wondered whether Home's new benefits entry explained a residual of one to two
seconds. It does not.

**All four shipped packs — 4.0 MB of catalog, 0.9 MB of benefits, 0.56 MB of content, 0.2 MB of
taxonomy — materialise in 26 ms in total, before `App.tsx`'s module body runs.** Hermes emits a
constant object literal as a bytecode buffer, so building the graph is close to a copy. Merchant
Radar's index, the benefit eligibility layer and the card catalog cost single-digit milliseconds
each.

**No optimisation was made there, because none was warranted.** Precomputing an index, adding a lazy
initialiser or moving a memo would have been work aimed at a number rather than at a cause, and it
would have added risk to ten working capabilities for a saving of milliseconds. The directive's list
of suspects — merchant maps, the 266-merchant search index, Benefits Hub eligibility, the fee index,
programme relationships, legacy reconciliation, Home's benefits count — was checked and each is on
the far side of the decimal point.

### 2.4 §D — the security cost, isolated and characterised

| what was measured | result |
|---|---|
| algorithm | **Argon2id**, RFC 9106, `@noble/hashes` — a pure-JavaScript implementation |
| parameters | t = 2 · m = 19,456 KiB · p = 1 · 32-byte output · 16-byte salt · device-bound 16-byte pepper as Argon2's secret key |
| elapsed, in situ | **14,710 ms** (a later instrumented run on a freshly restarted emulator: 10,095 ms) |
| does it block the JS/UI path? | **effectively yes.** `argon2idAsync` yields with `nextTick = async () => {}` — a bare MICROTASK. It returns control to the promise queue and never to the event loop, so the JS thread is occupied throughout. |
| how often does it run? | **once** per PIN unlock, measured. Once more at enrolment. |
| is it repeated unnecessarily? | **no.** One `kdf.start` / `kdf.end` pair per unlock. |
| can session reuse avoid it? | it already does — AUTH-07's five-minute in-process grace avoids re-derivation on foreground. And **`unlockWithBiometric` does not run the KDF at all**: it reads the DEK from the hardware keychain behind the OS prompt (KGET-1), and PIN-7 requires both paths to yield the same DEK. |

Characterised on the device, same build, same emulator:

| case | ms |
|---|---:|
| `argon2idAsync`, shipped params, asyncTick 16 | 13,192 |
| `argon2idAsync`, shipped params, asyncTick 2000 | 13,036 |
| `argon2id` **synchronous**, shipped params | 10,764 |
| `argon2id` synchronous, m = 4096 — *characterisation only, not a proposal* | 2,268 |
| `argon2id` synchronous, t = 1 — *characterisation only, not a proposal* | 5,513 |

Three conclusions, each a fact rather than a preference:

* **`asyncTick` is not a lever.** 13,192 against 13,036 ms is 1%. Tuning it would read like an optimisation and measure like noise.
* **The async wrapper costs ~2.3 s.** Making it synchronous would take a fifth off and freeze the JS thread for 10.8 s with no yields at all — a worse product, still 2.7× the budget. **Not proposed.**
* **The cost is linear in the security parameter, and the parameter may not move.** The two reduced cases are in the table to show the shape of the curve, not as options.

### 2.5 The honest diagnosis, and the contract clause nobody had re-read

Argon2id is memory-hard by design: it mixes 64-bit words across a 19 MiB buffer, 38,912 block
compressions at t = 2. JavaScript has no 64-bit integer, so `@noble/hashes` emulates each with a pair
of 32-bit halves, and **Hermes is a bytecode interpreter with no JIT**. The parameters are correct;
the language and the engine make them expensive. A native Argon2id at these exact parameters would
compute the same key in a few hundred milliseconds.

**And the security contract already says what the number should be.** `docs/SEC-CONTRACT-001.md` §6,
PIN-3, verbatim:

> *"Argon2id params **MUST** be tuned to ~250–500 ms on a mid-range target device. Starting point:
> `m = 19456 KiB (19 MiB)`, `t = 2`, `p = 1`, 16-byte random salt, 32-byte output."*

The shipped values **are** that starting point. The tuning step the clause asks for was never
completed — and in pure JavaScript on Hermes it cannot be, at any parameter PIN-2's strength intent
accepts. So V3's 4 s budget and PIN-3's 250–500 ms target were both written against a derivation this
implementation cannot deliver. **That is a tension between two clauses of the contract, not a defect
in either, and it is the Owner's to rule.**

### 2.6 What was NOT done, deliberately

No security parameter was changed. `KDF_PARAMS` in artifact #9 is byte-identical to artifact #8's. No
KDF was swapped, no work factor lowered, no vault protection weakened, and Home is not faked ready
before the vault is open. **A native Argon2 implementation is the one repair that preserves the
algorithm and the parameters exactly — and `keyVault.ts`'s own header records the rule that forbids
it (*"react-native-argon2 would violate project Rule 6"*). Changing that rule is an architecture
decision, not a session's.**

### 2.7 One measurement attempted and not obtained

The biometric unlock leg was to be timed beside the PIN leg. It was not: biometric is not enrolled on
the rebuilt fixture, and **Settings offers no control to enable it** — although the onboarding copy
says *"אפשר להוסיף זיהוי ביומטרי אחר כך מההגדרות"* ("you can add biometric identification later from
Settings"). That copy-versus-capability mismatch is a real finding, reported in §7 and **not
repaired**: the fix is either a new security control or a change to a product promise, and neither is
a closure item.

---

## 3. §G — THE WALLET FRAME RATE: PROFILED FIRST, THEN RE-MEASURED GREEN

**2.71% of 443 frames**, over five passes reading 2.71 / 2.71 / 2.71 / 2.73 / 2.72. Budget 5%. Home:
2.61% of 460, passes 2.17–2.63.

Artifact #8 read 5.02% over three passes of 7.09 / 5.02 / 4.33 — a spread 140× the overage it was
reported for. **This run uses six passes, discards the warm one and takes the median of five**,
because three passes cannot separate a 0.02-point overage from the noise of a software-rendered
emulator.

The Wallet was profiled before the re-measure, as §G asks, and **no rendering defect was found**:

* the Cards segment is a scroll view over a `.map` of two tiles behind a memoised view model;
* `merchantById` is a Map lookup over a memoised index, not a scan over 266 rows;
* the Benefits Hub builds its per-card index once, on first ask;
* the one per-render cost that exists — `WalletTile` calling `readCardCost` during render, which reaches the pack store — is a prepared SQLite read, tens of microseconds, at two tiles.

**No speculative change was made.** The artifact #8 record said *"whoever picks this up should
re-measure before concluding anything from it"*, and it was right.

---

## 4. §H AND §I — THE PACK-TEXT BOUNDARY

### 4.1 The problem, restated from the data

A canonical pack is a research artefact as well as a product one. Beside the Hebrew title a reader is
meant to see, the shipped packs carry the analyst's English note about how a row was extracted, the
provenance quote it came from, and — in `catalog.interest.appTreatment` — **an instruction addressed
to this app, in English, in the data**: *"Show no issuer band for this institution."*

Two leaks of that material shipped: PD-MDC-082 on the Learn screen (removed in artifact #7) and
`benefit.description` on the Benefits Hub (removed during the unified upgrade). Both had the same
shape — an adapter type aliased straight to the pack row:

```ts
export type BenefitView = AdapterBenefit;   // ← the whole row, research notes included
```

A surface handed that alias holds every field the estate ships, and nothing in the type system
distinguishes `titleHe` from `description`.

### 4.2 What was built

**RAW CANONICAL DATA → CONSUMER-SAFE PROJECTION → UI**, in four parts:

| part | what it is |
|---|---|
| `src/data/adapter/packTextRegister.json` | a census of **all 157 prose paths** in the four shipped packs: **61 consumer-safe**, each with the rule that makes it safe (LOCALIZED_TRIPLE, DISPLAY_NAME, PUBLISHED_SOURCE_TEXT); **96 internal-only**, each with the reason (ANALYST_COMMENTARY, PROVENANCE_COMMENTARY, ESTATE_INSTRUCTION_TO_THE_APP, INTERNAL_IDENTIFIER) |
| `src/data/adapter/consumerProjection.ts` | explicit field lists and a **copy**. Five raw-row aliases are gone: `BenefitView`, `MerchantView`, `LearnContact`, `LearnGlossaryTerm`, `LearnRight` (and `IssuerContactRow`). A `SourcedValue` is reduced to the published value and its citation; the research record beside it is dropped at the boundary |
| `tools/mdc/gates/pack-text-boundary.mjs` | census completeness · no dead register entries · **no raw alias** · a projection cross-check against the register · a distinctive-name reach sweep over 262 modules · **four negative controls** · 15 jest cases |
| two adversarial suites | `consumerProjection.test.ts` walks every projected row to its leaves; `packTextSurfaces.render.test.tsx` renders the six canonical surfaces and searches the tree — both using the **SHIPPED** pack's own values, re-read on every run |

**Nothing was deleted.** The research material stays in the packs, where the pipeline, the audits and
`DataPrivacyScreen` still read it. This is a boundary on what reaches a reader.

### 4.3 Two instruments were tried and rejected, by measurement

* **A text scan for research-shaped or login-shaped words.** It fires on `content.contacts.disputeChannelUrl.note` — "the dispute flow requires an authenticated personal area", a true sentence about an ISSUER's website that no reader ever sees — and it is silent on `benefit.description`, which reads like consumer copy and was the actual leak. **Shape is not the signal.**
* **A scan for field NAMES in source.** It produced 60 hits, **every one a false positive**: `obligation.description` on a cashflow row, `entry.quote` on an FX quote, and two comments explaining why the pack's `description` is *not* rendered. What survives is narrowed to names the app's own types never declare, with `text` and `sourceLabel` exempted in the register with their reasons.

### 4.4 What the boundary found

**Zero live leaks on artifact #8.** The Card DNA §B path that renders a `description` is fed
`EMPTY_BENEFITS_DB` by construction, so it renders nothing — a structural hazard rather than a
defect, and the projection removes it. One estate duplication was found and handled as a rule rather
than an exception: `content.glossary.definitionSource.quote` is a verbatim substring of the
`definitionHe` the Learn screen is *meant* to render, so an internal value that also appears as a
consumer value is not evidence of a leak.

### 4.5 §I — PD-MDC-084 is SUPERSEDED

The U5 walk keeps following `.ts`/`.tsx` only. It is **no longer provisional** — not because it was
re-argued, but because the hole it left is now covered by an instrument built for the question. The
division is the point: **U5 asks what a SURFACE OFFERS and reads code, because an affordance is a
fact about code; the pack-text boundary asks what a READER SEES and reads data and the projection
between them.** One gate answering both questions is what produced the false alarm. The reasoning is
recorded in the gate's own header, where the exception lives.

---

## 5. §J — OQ-MDC-033, FOR THE OWNER. **NOT ANSWERED HERE.**

**The question, verbatim from the queue:**

> *Pack TEXT can now reach a reader: what should statically police it, now that P5 surfaces bind
> canonical data?*

**Its options, verbatim:**

1. **A DEDICATED CHECK** — a new gate owns "no surface renders a pack annotation field", with the annotation fields named in the data contract rather than guessed by a regex, and every existing surface audited against it once.
2. **TESTS ONLY** — the guarantee stays where it is: a per-surface render test asserting the shipped pack's own annotation values do not appear in the tree, added whenever a surface binds a new pack, and no gate reads data.
3. **WIDEN THE EXISTING GATES** — each surface-walking gate learns to read data files, with a per-field allowlist of what a pack may legitimately carry, accepting that a data update can then turn a code gate red.

**Recommended answer: option 1**, with one amendment the evidence forces.

**The technical evidence for it:**

* **Option 3 was tried and measured, and it is the worst of the three.** Widening the surface-walking gates to read data is exactly what happened by accident on artifact #8: P5's `no-account-surface` gate reached a `pack.json` and failed on the estate's true sentences about an issuer's login-gated website. A data update turning a CODE gate red is not a theoretical cost — it is a red gate that says the wrong thing about the wrong artefact, and the session that meets it has to decide whether the alarm is real. This one was, but for a different reason than the gate gave.
* **Option 2 is where the guarantee already was, and it is not enough by itself.** A per-surface render test can only assert about surfaces somebody remembered to write a test for. It cannot say anything about a pack field nobody has looked at, and the leak that started this was a field nobody had looked at.
* **Option 1 works, and it is built and running.** `tools/mdc/gates/pack-text-boundary.mjs` is green over 157 censused paths, 4 projections, 262 modules and 15 jest cases, with four negative controls.

**The amendment: the fields are named in a REGISTER, not in the data contract.** Option 1 says "named
in the data contract". The register is in the app repo (`src/data/adapter/packTextRegister.json`)
because it must be read by three things — the app, jest and a plain-Node gate — and because it is a
statement about what THIS APP shows, not about what the pipeline publishes. If the Owner wants the
classification to live in the data contract instead, that is a pipeline change and a bigger one; the
register would then be generated from it rather than hand-maintained.

**A second decision the Owner may want to take at the same time:** the gate currently runs but is
**not required** by the completion contract, because adding a required gate means editing the
criteria fence, which is Owner authority. `mdc:all` reports it as *"present but NOT required by the
contract"*. Binding it to a criterion would make it a gate the campaign cannot go green without.

**The exact command:**

```
node campaign-master/bin/mc.mjs decide --answer OQ-MDC-033 --by owner \
  --ruling "1 - A DEDICATED CHECK: tools/mdc/gates/pack-text-boundary.mjs owns it, with the field
   classification in src/data/adapter/packTextRegister.json rather than in the data contract"
```

*(run from `C:\Users\ebrah\smartcard-data-pipeline`; `--ruling` on one line)*

---

## 6. §M — V3 ON THE FINAL ARTIFACT

| | measured | budget | |
|---|---|---|---|
| cold start to interactive Home | **13,213 ms** median (13,114 / 13,213 / 13,249) | 4,000 ms | **RED** |
| launch → lock form | 971 ms median | — | — |
| unlock → interactive Home | 12,245 ms median | — | — |
| input → verdict | 1,881 ms median | 10,000 ms | green |
| engine upper bound | 110 ms median | 500 ms | green |
| dropped frames — home | 2.61% of 460 | 5% | green |
| dropped frames — wallet | **2.71% of 443** | 5% | **green** |

**Cold start now ends at HOME'S OWN CONTENT, not at the tab bar.** The artifact #8 method waited for
the tab bar, which is part of the tab shell and exists as soon as any tab screen mounts — and on #8
the screen that mounted was More. This run waits for a string only Home renders, records whether
Home's hero and the tab bar are both present, and reports how many Home-tab taps were needed. All
three runs: **zero**. It also refuses to record at all unless the host and device APK hashes match.

**Where the 6.1 s came from, split honestly:** ~1.1 s is the repair (the Home-tab leg is gone), ~2.4 s
is the KDF running faster on a freshly restarted emulator (device load, not code), and the remainder
is the tighter frame window. **None of it is a security change.**

---

## 7. FINDINGS FROM EXERCISING THE PRODUCT

### 7.1 The app opened on the wrong screen in Hebrew and Arabic *(found on the device, repaired)*

React Navigation defaults `initialRouteName` to a tab navigator's **first child**, and
`getTabsForDirection` reverses the IA order under RTL so the bar reads right-to-left. In Hebrew and
Arabic that made **More** the first child: every unlock landed the reader on the More list instead of
the Command Center. Confirmed on artifact #8 — after unlocking, the screen read *"עוד · הגדרות ·
לומדים: מילון, זכויות ואנשי קשר"*. `initialRouteName="Home"` separates the ORDER of the bar from the
SCREEN the app opens on. Guarded by `src/navigation/__tests__/tabInitialRoute.test.ts`, which pins
both halves: the reversal (correct, must stay) and the explicit initial route.

### 7.2 Onboarding promises a Settings control that does not exist *(found on the device, NOT repaired)*

The security step offers *"הפעל זיהוי פנים או טביעת אצבע"* and its copy says biometric identification
can be added later from Settings. **Settings has no such control** — its sections are Account,
Language, Preferences and Information & privacy. Not repaired here: the fix is either a new security
control or a change to a product promise, and choosing between them is a product decision, not
closure. It is also why §2.7's biometric measurement could not be taken.

### 7.3 The `uiautomator` probe reports a rendered screen as empty *(a probe defect, not a product defect)*

The guided picker's issuer step dumped as an empty screen — header and tab bar, nothing between —
and `AccessibilityNodeInfoDumper` logged hundreds of *"Skipping invisible child"* lines. **It was
checked rather than reported:** tapping where the buttons should be advanced the flow correctly
through issuer → product → review, and artifact #8 reproduced the same empty dump. Every device
script in this session now retries a thin dump and reads the view tree over `adb exec-out` rather
than through a `pull` that intermittently produces no file at all.

### 7.4 The device fixture was lost once and rebuilt *(a device event, not a build regression)*

The emulator restarted mid-session; afterwards the app's vault would not unlock with its enrolled PIN
and the UI came up in English. **The mechanism was not isolated and is not claimed** — a lost Android
Keystore and a snapshot restoring an older disk state both fit. It is **not a regression in artifact
#9**, and that was checked rather than assumed: artifact #8 was reinstalled and reproduced the same
refusal. One thing learned that matters for anyone repeating this work: the emulator carries a
screen-lock PIN (`1234`) and demands it after every restart, and while that keyguard is up every view
dump returns the lock screen rather than the app.

---

## 8. §N — DEVICE CURRENT ASSURANCE

| row | state |
|---|---|
| **T5** (no dev chrome) | **RE-OBSERVED on artifact #9.** `NO-DEV-CHROME OK`, bound to APK `c4f790d846f6`, host == device == on-disk. Settings and the lock screen captured from the release build |
| **T8** (skinned re-measure) | **RE-OBSERVED on artifact #9.** `SKINNED-REMEASURE OK` — 3 languages × 6 surfaces proven from **21 captured view trees**, each asserted by that language's own anchor |
| **C4** (notifications) | **NOT re-observed.** Its assurance needs the device clock moved with `cmd alarm set-time`, the runtime notification permission cycled through both arms, a card created with billing day 31, and a real alarm firing — a destructive fixture that would also displace the wallet the Owner is meant to inspect |
| **C9** (offline) | **NOT re-observed.** Its assurance needs a vault wipe and an offline first-launch walk with pinned figures (16,200 · 19,500 · 8,500 · 6,300) |

Both un-re-observed rows carry a **green MDC gate on the evidence they hold**; what is missing is the
re-binding to the new artifact, exactly as it was before this session. Attempting half of either and
recording partial evidence would be worse than not attempting it. Under OQ-MDC-030 option 3 the
STAGE-2 receipts are untouched either way.

---

## 9. §O — X1 / X2 / X3, AND THE NINETEEN OTHER ROWS

| row | command | state at artifact #9 |
|---|---|---|
| **X2** | `mc.mjs boundary` | **RE-RECEIPTED** — `MDC-BOUNDARY OK`, closed-campaign records byte-stable against the intake baseline |
| **X3** | `mc.mjs rulings --verify` | **RE-RECEIPTED** — `MDC-RULINGS OK`, record intact |
| **X1** | `mc.mjs regression --run` | **BLOCKED, and the block is V3.** The regression requires every ladder green; the MDC ladder is red on `performance`. X1 cannot be re-receipted until OQ-MDC-034 is ruled. That is the honest state, not a failure to run it |

**Nineteen stale rows carry a CURRENT ASSURANCE at artifact #9**: I2, C1, C2, C3, C5, C6, C7, C10,
C11, T1, T2, T3, T4, T5, T6, T7, T8, X2, X3 — each re-run at the current dependencies with its own
gate, each recorded beside a receipt that is not touched. `I4` is refused by design (its command
re-records a baseline).

---

## 10. §P–§S — THE HUMAN AND EXTERNAL PACKS

| pack | what was done | what was NOT done |
|---|---|---|
| **V1** (TalkBack) | re-based on artifact #9, with a table of the **nine surfaces added since the pack was written** — Command Center, Merchant Radar, Benefits Hub, guided onboarding, Card DNA Bottom Line, calculator, Negotiation Hub, Settings, and the changed landing screen | no walk was performed, no finding recorded, **no attestation**. An automated emulator exercise is not a screen-reader walkthrough and is not offered as one |
| **V2** (RTL) | the same re-basing and the same added-surface table | no human RTL pass, **no attestation** |
| **V5** (sessions) | re-based on artifact #9; the ruled scope restated **unchanged** — five real independent participants, at least one Arabic locale, counsel-reviewed consent, the Owner may moderate but is not a participant | no session run, recruited, consented or observed; **nothing fabricated** |
| **V7** (counsel) | **a new factual annex, `RECONCILIATION-2026-09-07.md`** — the thirteen capabilities with what each reads, writes and sends; three rows of the 2026-09-05 annex corrected as stale; the pack-text boundary described. `SEND_MANIFEST.md` regenerated over **52 files**. `STATUS.md` re-based | **nothing sent**, no draft adopted, no counsel review recorded, **no legal conclusion drawn** |
| **V9** (store) | `ARTIFACT9_ADDENDUM.md` — which **five of the eight** chosen screenshots now depict a superseded screen, the listing facts that moved, and the Data Safety re-read | no screenshot re-taken (the plan requires the build V8 signs), **nothing submitted**, the privacy-policy URL still blocks submission |

### The one new matter V7 raises for counsel

**The Negotiation Hub can hand `https://wa.me/<E.164>` to WhatsApp.** Until artifact #7 the annex
could say the app's only external effect was the Contact screen's `tel:` dialer; that is no longer
true. The app makes no request and learns nothing about what follows — Android opens the dialer or
WhatsApp and the user leaves — but it is **the first time this product puts a third party in the path
of a user action**. Whether that needs a recipient disclosure, a "you are leaving the app" statement,
or an optional route **is counsel's question and is not answered anywhere in this campaign's files**.

---

## 11. §T — FULL VALIDATION AT THE FINAL SHA

| | result |
|---|---|
| typecheck | **OK** |
| lint (`--max-warnings=0`) | **OK** |
| app test suite | **1,507 tests / 191 suites — all green** |
| **P2** | `P2-ALL OK` — 46 gates over 44 required, 0 failed |
| **P3** | `P3-ALL OK` — every step green |
| **P4** | `P4-ALL OK` — every step green |
| **P5** | `P5-ALL OK` — every step green |
| **MDC** | 20 required gates ran · **19 green** · `performance` RED: *"cold start to interactive Home: median 13213 ms over 3 runs is not under the 4000 ms budget"* |
| pack-text-boundary (new) | **OK** — present, running, and reported as *not yet required by the contract* (see §5) |
| X2 / X3 | re-receipted · X1 blocked by the MDC red |

Every verdict above was read from the ladder's own **sentinel line**, not from an exit code.

---

## 12. §U — EMULATOR STATE

**EMULATOR READY FOR OWNER VISUAL INSPECTION**

| | |
|---|---|
| serial | **emulator-5554** (AVD `Pixel_API36_stable`, Android 16, airplane mode on) |
| artifact | **#9** |
| APK sha256 | `c4f790d846f6c1c6a5d7e919a7ace7e15f25d5df6b55cc40b569442a11c559c8` |
| app source sha | `b57378c666fb7b71fe5efdeb4fbc233fee657d8c` |
| package | `app.trevik.mobile` · versionName 1.1.0 |
| locale | **Hebrew** |
| screen | **Home — the Command Center**, unlocked |
| device PIN (Android keyguard, demanded after a restart) | `1234` |
| app PIN (the vault) | `246810` |
| wallet | **max SKYMAX ••7739** (guided path: non-bank → מקס איט פיננסים → SKYMAX → SKYMAX Points) and **Leumi United Airlines ••4821** (guided path: bank → בנק לאומי → United Airlines card) |
| monthly target | ₪12,000 · income ₪18,000 · payday 10 |

On screen now: *בטוח להתחייב החודש* ₪16,200.00 with an ESTIMATE chip · *יעד הוצאה חודשי* ₪12,000.00
with *בתוך היעד* · *ההטבות שלי — 18 הטבות זמינות, 3 מסתיימות בקרוב* · the load bar · the seven-day
risk strip · the five-item tab bar.

### The inspection route (§L) — walk it whenever you like; nothing waits on it

1. **Home** — the Command Center: the safe-to-commit figure, the monthly target, the billing cluster, *ההטבות שלי*, the settings gear.
2. **Gear → Settings** — profiles, language (Hebrew / العربية / English), the monthly target, Information & privacy.
3. **Wallet → + הוסף כרטיס → בחירה מודרכת של כרטיס**.
4. Choose **כרטיס בנקאי** → 13 real banks by published legal name.
5. Pick **בנק לאומי לישראל בע"מ** → its real products, each with its network → *כרטיס אשראי United Airlines של לאומי* (ויזה) → review → details.
6. Repeat with **כרטיס חוץ בנקאי** → the four card companies, including *"אמריקן אקספרס ישראל (מונפק ע"י ישראכרט)"* → **מקס** → **SKYMAX** → the **programme step**: three real SKYMAX programmes with their enrolment kind.
7. **Wallet → הטבות** → the Benefits Hub.
8. Inspect it — 18 available, 3 ending soon, family filters with real counts.
9. **Wallet → כרטיסים → SKYMAX** → Card DNA.
10. Inspect *השורה התחתונה* — five candidate card fees, the reason none is singular, the four accordions.
11. Open **מחשבון ריבית** from the Bottom Line.
12. **בדיקה → Merchant Radar**.
13. Tap **שופרסל**.
14. Read the evidenced absence — *"אין הטבה מתועדת לבית העסק הזה כרגע"* — and the offer to continue.
15. A card with a fee waiver shows the **WaiverBadge**; tapping it opens the **Negotiation Hub**. Neither saved card carries a waiver on its own data, so the badge does not appear on this fixture; the sheet is exercised by `issuerNegotiation.render.test.tsx` and by the boundary suite.

**Note on step 4/6:** the picker's issuer list is a screen `uiautomator` sometimes reports as empty
(§7.3). It is not — the buttons are there and tappable. This affects automation, not you.

---

## 13. WHAT WAS NOT DONE

**Every prohibition observed.** No production signing. No publication. No Google Play submission. No
DNS, R2 or provider change. **No physical device was contacted** — the Samsung S24 Ultra and the
Galaxy Tab are foreign to this campaign and were not touched. STAGE-4 was not entered. V8 signing
custody untouched. No Owner attestation written, no Owner question answered, no budget moved, no
cryptography weakened, no performance fabricated, no financial, merchant or benefit data invented.

**Remaining Owner actions**

1. **OQ-MDC-034** — V3's cold start. The evidence it was missing is now in `evidence/external/V3/EVIDENCE.txt`: the cause is isolated to the Argon2id derivation, and SEC-CONTRACT-001 PIN-3's own 250–500 ms target cannot be met in pure JavaScript on Hermes at any parameter PIN-2 accepts. **X1 is blocked until this is ruled.**
2. **OQ-MDC-033** — §5 above: the question, the options, the recommendation, the evidence and the exact command.
3. **PD-MDC-084** — superseded by the boundary contract; the Owner may confirm the supersession or ask for a different instrument.
4. Whether `pack-text-boundary` becomes a **required** gate (a criteria-fence edit, Owner authority).
5. §7.2 — biometric enrolment: add the Settings control, or change the onboarding promise.

**Remaining external actions**

* V1 (TalkBack), V2 (RTL), V5 (moderated sessions) — human acts on artifact #9; the packs are re-based and ready.
* V7 — send the packet to counsel; record the review. **READY_TO_SEND_TO_COUNSEL.**
* V9 — the privacy-policy URL, then the screenshot set from the build V8 signs.
* V8 — signing custody.
* C4 and C9 device re-observations on artifact #9 (§8).

**Repo state**

| repo | branch | HEAD | state |
|---|---|---|---|
| `smartcard-app-mdc` | `mdc/execution` | `8c34f7e` | clean, pushed |
| `smartcard-data-pipeline` | `main` | `ddb65ba` | clean, pushed |

---

## 14. VERDICT

**TREVIK V3 PERFORMANCE — OWNER/ARCHITECTURE DECISION REQUIRED**

Every technically resolvable item in the closure directive is resolved: the pack-text boundary is
built and enforced, PD-MDC-084 is superseded, the wallet frame rate is green on a protocol that can
tell a real overage from noise, the app opens on the right screen, nineteen stale rows carry a
current assurance, two of the four DEVICE rows are re-bound, X2 and X3 are re-receipted, and the V
packs and the counsel packet describe the artifact that ships.

V3's cold start is not one of those items. It is **12.2 seconds of Argon2id, computed in JavaScript
by an interpreter with no JIT**, at parameters the security contract requires and this session may
not touch. The only repair that keeps the algorithm and the parameters exactly as they are is a
native implementation, and the rule forbidding one is the Owner's to revisit.

**Technical closure is not printed, because it would not be true.**
