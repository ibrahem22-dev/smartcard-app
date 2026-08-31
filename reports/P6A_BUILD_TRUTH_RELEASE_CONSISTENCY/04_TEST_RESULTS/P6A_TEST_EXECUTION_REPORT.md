# WP1 Evidence Recovery — Test Execution Report

Environment: Windows; Node `v20.20.2`; npm `10.8.2`; Java `21.0.10`; HEAD `d0f0c0d0d473097900cdf3ab2c42e1dbad2a2eff`.

| Exact command | Result |
|---|---|
| `npm test -- --runInBand --silent` | PASS — 157/157 suites, 1,226/1,226 tests, 0 snapshots; 1,335.625s. |
| `npm run typecheck` | PASS — `tsc --noEmit`, exit 0. |
| `npm run lint` | PASS — ESLint with `--max-warnings=0`, exit 0. |
| `npm run p2:controls` | PASS — 5/5 rules fired across 7 controls; tree restored. |
| `npm run p3:controls` | PASS — 6/6 BOI controls fired. |
| `npm run p3:scenarios` | PASS — 23/23 scenarios; 1 suite/23 tests. |
| `node tools/p3/gates/boi-staleness.mjs` | PASS — exit 0. |
| `node tools/p3/gates/boi-offline.mjs` | PASS — exit 0. |
| `node tools/p3/gates/honesty-engine.mjs` | PASS — exit 0. |
| `node tools/p4/gates/fx-compare-honesty.mjs` | PASS — exit 0. |
| `node tools/p4/gates/verdict-fx-block.mjs` | PASS — exit 0. |
| `node tools/p5/gates/wallet-render-discipline.mjs` | PASS — exit 0. |
| `node tools/p5/gates/conflicted-value.mjs` | PASS — exit 0. |
| `$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleRelease` from `android` | PASS — 2m44s; 1,032 tasks, 100 executed and 932 up-to-date. |

## Reconciliation with the previous claim

The former claim of 163 suites and 1,249 tests was **not reproduced**. The current source has six fewer suites and 23 fewer tests: the absent WP1-specific suites are `learnContent`, `expoPackSetStore`, `fxStalePropagation`, `releaseConsistency`, `vaultBackup`, and `money`.

Passing baseline tests do not prove missing P6-A behavior. Existing notification tests, for example, pass while production notification bodies still contain card last-four digits.
