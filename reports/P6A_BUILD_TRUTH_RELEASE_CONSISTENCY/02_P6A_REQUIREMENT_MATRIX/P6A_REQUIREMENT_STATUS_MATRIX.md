# P6-A Requirement Status Matrix — Recovery Pass

Authority: accepted `C:\Users\ebrah\smartcard-data-pipeline\campaign-p5\closure\P5_TO_P6_HANDOFF.md` lines 77–87. Status reflects disk on 2026-08-31, not the earlier chat verdict.

| ID | Requirement | Actual disk evidence | Recovered status | Required next work |
|---|---|---|---|---|
| P6-1 | Local billing and fee-waiver notifications | A local scheduler exists, but it requests permission from the scheduling path and places `card.last4` in notification bodies. No explicit notification preference exists. | PARTIAL / PRIVACY-UNSAFE | Re-execute WP1 notification repair and negative payload tests. |
| P6-2 | Encrypted export/import | `vaultBackup.ts`, document picker/sharing dependencies, UI, and tests are absent. | MISSING | Re-execute WP1 encrypted export/import implementation. |
| P6-3 | Learn | `LearnScreen.tsx`, canonical Learn adapter, route, and tests are absent. | MISSING | Re-execute authorized Learn implementation. |
| P6-4 | Data & Privacy | Dedicated screen/route is absent. Existing local reset is not a complete Data & Privacy surface. | MISSING / PARTIAL RESET BASELINE | Re-execute WP1 surface and reset reconciliation. |
| P6-5 | Signed pack update end to end | Verification/refusal code and memory tests exist. `memoryPackSetStore.ts` explicitly states there is no device implementation; persistent store is absent. | PARTIAL | Re-execute application-side persistent/atomic/LKG work; device proof remains later scope. |
| P6-6 | Full offline pass | BOI offline gate passes, but no whole-app network-off observation/evidence exists. | PARTIAL | Re-execute WP1 application-side offline audit; retain device observation for WP3. |
| P6-7 | Accessibility audit | No audit was executed in this recovery pass. | DEFERRED TO WP4 | Keep open. |
| P6-8 | Wider RTL audit | Existing static RTL checks pass; no whole-app/device audit exists. | DEFERRED TO WP4 | Keep open. |
| P6-9 | Performance | No authoritative performance budgets or measurements were found in this pass. | BLOCKED / OPEN | Owner budget decision and later measurement required. |
| P6-10 | Stale-data behavior | Adapter-level seven-calendar-day logic and gates exist; previously claimed whole-surface propagation files/tests are absent. | PARTIAL | Re-execute WP1 propagation/audit without inventing holiday authority. |
| P6-11 | Whole-app conflict audit and §11-A release gate | Card DNA/Wallet components and focused gates exist; no recovered whole-app audit or Check/Verdict/FX conflict-input closure exists. | PARTIAL | Re-execute WP1 audit/authorized repairs. |

Release-build dev gating is reproducibly satisfied for the rebuilt local artifact. The previously claimed financial ratio-format repair and its focused tests are absent and therefore not verified.
