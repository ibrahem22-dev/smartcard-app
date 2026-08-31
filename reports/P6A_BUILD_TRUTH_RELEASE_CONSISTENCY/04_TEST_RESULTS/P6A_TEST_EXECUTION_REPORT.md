# P6-A Test Execution Report

Environment: Windows, Node `v20.20.2`, npm `10.8.2`, Java from Android Studio JBR, app HEAD `d0f0c0d0d473097900cdf3ab2c42e1dbad2a2eff` with Work Package changes uncommitted.

| Validation | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, zero warnings |
| First complete Jest pass | 159/163 suites passed; 1,235/1,236 tests passed. Three render suites hit the local adapter junction runtime and the honesty walk found two new age metadata fields. |
| Repair retest | PASS: all three affected render suites and honesty suite; 18 tests total across focused reruns |
| Final complete Jest retest (`--silent`) | PASS: 163/163 suites, 1,249/1,249 tests, 0 snapshots; 841.556s |
| P2 boundary negative controls | PASS, 5/5 rules fired across 7 controls |
| P3 BOI negative controls | PASS, 6/6 |
| P3 scenarios | PASS, 23/23 |
| P3 stale/offline/honesty gates | PASS |
| P4 FX honesty + Verdict FX gates | PASS |
| P5 Wallet render discipline + ConflictedValue | PASS |
| Android `assembleRelease` | PASS after setting existing Android Studio JBR; final rebuild 39s |
| Android lint-vital | PASS as part of release build |
| APK signature verification | PASS; Android debug certificate only |

Warnings preserved as evidence, not hidden: existing React test `act(...)` warnings; Expo Go warning about remote push capability in the SDK; Gradle deprecation notice for future Gradle 10; manifest warning for an unrelated filesystem provider replacement. None failed the suite/build.
