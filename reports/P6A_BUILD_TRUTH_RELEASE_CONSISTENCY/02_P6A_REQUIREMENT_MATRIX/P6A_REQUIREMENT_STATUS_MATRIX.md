# P6-A Requirement Status Matrix

Authority: accepted P5→P6 handoff §2, current product spec, applicable Owner rulings, then legal evidence targets.

| ID | Requirement | Authority | Before | Work performed | Test/evidence | After | Residual blocker |
|---|---|---|---|---|---|---|---|
| P6-1 | Local billing and fee-waiver notifications | Handoff §2; spec feature 24 | PARTIAL | Explicit opt-in, generic payloads, billing/waiver/annual scheduling, decline-safe behavior, reset cancellation; removed Firebase remote entry points | `notificationScheduler.test.ts`; release source/manifest audit | SATISFIED | Physical notification delivery belongs to WP3 |
| P6-2 | Encrypted export/import | Handoff §2 | MISSING | User-selected encrypted `.scvault`, Argon2id + AES-GCM, schema/version checks, rollback on write failure, no plaintext file | `vaultBackup.test.ts`; release build | SATISFIED | OS picker/share observation belongs to WP3 |
| P6-3 | Learn | Handoff §2 | MISSING | HE/AR/EN Learn surface backed by canonical bundled signed content | `learnContent.test.ts`; typecheck/build | SATISFIED | No legal localization performed |
| P6-4 | Data & Privacy | Handoff §2 | MISSING | Local-storage truth, notification control, encrypted export/import, Full Reset limitations | Data & Privacy source; vault/reset suites; release build | PARTIALLY_SATISFIED | Final legal navigation/acceptance text is intentionally deferred pending English reconciliation/localization |
| P6-5 | Signed pack update E2E | Handoff §2; OD-25 | PARTIAL | Expo filesystem staging/backup/promote/recovery; startup LKG recovery; existing signature/hash/schema/min-version/downgrade refusals retained | `expoPackSetStore.test.ts`, `updateRefusals.test.ts`, `ob4Refusals.test.ts`, `releaseGate.test.ts` | PARTIALLY_SATISFIED | Device application/rollback proof and release signing custody remain open; production delivery topology is WP2 |
| P6-6 | Full offline pass | Handoff §2 | PARTIAL | Removed hidden production BOI route, retained bundled FX/LKG, added local Learn/privacy/backup/reset paths | P3 BOI offline gate, cold-start/lane tests, offline report | PARTIALLY_SATISFIED | End-to-end network-off emulator/physical pass is WP3 |
| P6-7 | Accessibility audit | Handoff §2 | NOT STARTED | Existing static tests run; no certification claim | P5 static gates only | DEFERRED_TO_LATER_WORK_PACKAGE | WP4 end-to-end audit |
| P6-8 | RTL audit | Handoff §2 | PARTIAL | HE/AR/EN adapter validation; existing RTL controls/typecheck/build | RTL tests and P5 gates | DEFERRED_TO_LATER_WORK_PACKAGE | WP4 wider emulator/physical audit |
| P6-9 | Performance | Handoff §2 | MISSING | Release build timing recorded only | Gradle build report | BLOCKED_BY_OWNER_RULING | `MDC-PERF-BUDGETS` and physical-device measurement |
| P6-10 | Stale-data behavior | Handoff §2; OD-31 | PARTIAL | Pinned as-of date, >7 calendar-day rule, Stale propagated to FX quotes and Verdict/FX chips; missing calendar fails toward Stale | `fxStalePropagation.test.ts`; BOI staleness gate | PARTIALLY_SATISFIED | Whole-app pack-field stale audit and device observation remain open |
| P6-11 | Cross-surface conflict audit and §11-A gate | Handoff §2; spec §11-A | PARTIAL | Audited release surfaces; confirmed Card DNA full candidates and Wallet Estimate-only; preserved accepted W5/N9 split | Conflict matrix; Card DNA/Wallet gates | PARTIALLY_SATISFIED | Check/Verdict/FX have no production conflict-input path; do not invent candidate mapping |
| WP1-R1 | Release excludes dev-only UI/network probes | Product/release truth and legal evidence | PARTIAL | Promo + EngineProbe dev-gated; remote Firebase manifest entries removed; release bundle/APK inspected | `releaseConsistency.test.ts`; APK manifest and bundle audit | SATISFIED | Debug signing is not production custody |
| WP1-R2 | Financial-format truth | OQ-P5-003 family | PARTIAL | Split ratio-to-percent from percent-unit formatting; fixed Home/Card DNA/Plan callers | `money.test.ts`; render suites | SATISFIED | No visual redesign or physical bidi certification claimed |

`SATISFIED` above is application-side Work Package 1 status only and always names evidence. It is not P6 completion, store readiness, legal approval, accessibility conformance, or public-release authority.

