# P6-A Release Build Consistency Matrix

| Capability | Dev | Release | Expected | Result |
|---|---|---|---|---|
| EngineProbe route/entry | Available under `__DEV__` | Route, entry ID, and `ENGINE PROBE` string absent from release JS | Dev only | PASS |
| Live BOI fetch probe | Used only by EngineProbe | `fetchBoiRates` absent from release JS | Dev only; production topology deferred | PASS |
| Promo/account UI | Available under `__DEV__` for inherited tooling | Entry ID absent from release JS | Not a V1 release surface | PASS |
| Analytics | No-op transport | No-op transport | Inactive | PASS |
| Local notifications | Scheduler + permission | Scheduler/boot receiver/POST_NOTIFICATIONS retained | Present | PASS |
| Remote push | Expo SDK contains dormant APIs in dependency | No application token call and no Firebase messaging service/receiver/provider in merged manifest | Absent as architecture | PASS |
| Signed packs | Local/test transport and persistent store | Verification/refusal/LKG mechanism bundled | App mechanism present; topology deferred | PASS WITH DEFERRED TOPOLOGY |
| Signing | Debug keystore available | APK signed with Android Debug certificate | Local validation only | PASS FOR LOCAL VALIDATION; NOT STORE SIGNING |

## Artifact

- Command: `$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleRelease`
- Mode: Android Gradle `release`, version `1.1.0`, versionCode `1`
- Source HEAD: `d0f0c0d0d473097900cdf3ab2c42e1dbad2a2eff` plus uncommitted WP1 changes
- APK: `C:\Users\ebrah\smartcard-app\android\app\build\outputs\apk\release\app-release.apk`
- Size: `113185711` bytes
- APK SHA-256: `E0C01AA45FA8BB2BE0F3A73B31BCBE8EFF967EF369E6C93645217F6CE0DA58B7`
- JS bundle SHA-256: `C0437A3D87C20C7894120F6FFA8E68854B293007B3CE11FE567699884D26C4B9`
- Signer: `CN=Android Debug`; SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`

RELEASE SIGNING CUSTODY — OUT OF WORK PACKAGE / STILL OPEN.

