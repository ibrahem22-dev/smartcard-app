# P6-A Negative Control Matrix

| Area | Negative control | Result | Evidence |
|---|---|---|---|
| Notifications | Last-four, limits, amount, card ID, verdict absent from payload | PASS | `notificationScheduler.test.ts` |
| Notifications | No permission request until explicit enable; decline leaves app usable | PASS | scheduler tests and AuthenticatedNavigator source check |
| Remote push | No application token calls; no Firebase messaging/initializer entry points in final APK | PASS | release consistency test + merged manifest audit |
| Export/import | Corrupt ciphertext, wrong schema/version, unsafe key, duplicate key refused | PASS | `vaultBackup.test.ts` |
| Export/import | Mid-import write failure restores prior vault | PASS | rollback test |
| Reset | Vault key/data/acceptance state removed; terminal failure remains locked | PASS | `keyVault.terminal.test.ts`, auth lifecycle tests |
| Reset | External exports not claimed deleted | PASS | Data & Privacy reset copy |
| Pack update | Bad signature/hash/manifest/min-version/downgrade refused | PASS | existing refusal suites |
| Pack update | Promotion failure/startup recovery preserves prior LKG | PASS | persistent store and existing importer tests |
| Offline | Unknown currency never becomes zero; empty cache resolves bundled fallback | PASS | P3 controls/offline gate |
| Stale | Seven days remains current; day eight is Stale on quote and surfaces | PASS | stale propagation test |
| Conflict | Wallet does not expose candidates; Card DNA exposes all candidates and source | PASS | W5 and N9 gates |
| Release | EngineProbe, dev BOI fetch, promo entry absent from release bundle | PASS | final bundle string audit |

