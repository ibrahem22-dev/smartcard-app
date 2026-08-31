# P6-A Negative Control Matrix — Recovered State

| Control | Actual result | Evidence | Status |
|---|---|---|---|
| Notification contains no last-four digits | Production source interpolates `card.last4` into expiry and annual reminder bodies. | `src/services/notificationScheduler.ts` | FAIL |
| Notification permission is explicit user opt-in | Scheduler calls `requestPermissionsAsync()` during scheduling; authenticated navigation triggers annual scheduling. | Scheduler + `AuthenticatedNavigator.tsx` | FAIL |
| No remote-push release entry points | Rebuilt merged manifest lacks Firebase messaging service/receiver/provider entries. | Release manifest inspection | PASS |
| Plaintext export impossible; corrupt/version failures safe | Export/import service and tests are absent. | Filesystem and dependency search | NOT IMPLEMENTED |
| Full Reset destroys vault and onboarding state | Fail-closed vault wipe and onboarding deletion exist. Notification schedule cancellation is absent. | `authContext.tsx`, key-vault tests | PARTIAL |
| Bad pack signature/hash/version refused | Existing importer refusal suites pass. | Full suite and P2/P3 gates | PASS IN MEMORY |
| Previous installed pack survives persistent failure | Only memory store exists; it explicitly says no device implementation exists. | `memoryPackSetStore.ts` | NOT IMPLEMENTED ON DEVICE STORAGE |
| Core BOI path remains honest offline | Focused `boi-offline` gate exits 0. Whole-app network-off pass was not performed. | Focused gate | PARTIAL |
| Conflict remains visible | ConflictedValue and Wallet focused gates exit 0. No recovered whole-app matrix exists. | P5 gates | PARTIAL |
| Dev probe/live BOI excluded from release bundle | Rebuilt JS bundle lacks `ENGINE PROBE`, `fetchBoiRates`, and `dev-engine-probe-entry`. | Bundle string audit | PASS |

Repository negative-control harnesses themselves passed: boundary 5/5 and BOI 6/6.
