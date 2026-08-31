# Release-Build Consistency Matrix — Recovery Pass

## Build identity

- Command: `$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleRelease`
- Result: PASS in 2m44s.
- Artifact: `C:\Users\ebrah\smartcard-app\android\app\build\outputs\apk\release\app-release.apk`
- Size: 112,610,903 bytes.
- SHA-256: `CDA2D7F0DA3F93480A00D9AB812502CEC219A41BA8BB7F213E54A28F128B51EC`.
- Package: `com.smartcard.app`; version name `1.1.0`; version code `1`.
- Signing: Android debug certificate, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- JS bundle SHA-256: `815382457A97817196DA6B1F7ABBEBA0FC1498F5D6472AA61AB51F52D803A90F`.

## Old-claim reconciliation

The old APK hash `E0C01AA45FA8BB2BE0F3A73B31BCBE8EFF967EF369E6C93645217F6CE0DA58B7` existed before rebuild but was **not reproduced** from current source. The rebuild produced the hash above and reduced the artifact from 113,185,711 to 112,610,903 bytes.

| Capability | Dev source | Rebuilt release | Expected | Result |
|---|---|---|---|---|
| EngineProbe UI/route | Present behind `__DEV__` | Probe strings absent from bundle | Dev only | PASS |
| Dev BOI live fetch | Dev module exists | `fetchBoiRates` absent from bundle | Dev only | PASS |
| Firebase remote messaging entry points | Expo dependency may contain APIs | Service/receiver/provider entries absent from merged manifest | Absent | PASS |
| Local notification service and boot restore | Present | `NotificationsService` and `BOOT_COMPLETED` present | Present | PASS |
| Learn/Data Privacy/export implementation | Absent from source | Corresponding strings/modules absent | Required by P6-A | FAIL / MISSING |

This is a locally reproducible, debug-signed release-mode APK. Store signing custody and public release remain open and unauthorized.
