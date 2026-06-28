# Android Build Blocker — Windows Path-Length (Gradle cache)

Status: **environment issue, NOT app code.** `gradlew installDebug` / `app:assembleDebug`
fails with a Windows MAX_PATH (>260 char) error inside the Gradle cache. The RTL fix
does not affect this and must be verified separately once the build runs.

## 1. Get the real error (confirm it is path length, not code)

```powershell
cd android
.\gradlew.bat app:assembleDebug --stacktrace --info
```

Look for `java.io.IOException`, `Filename too long`, or a path beginning
`C:\Users\...\.gradle\caches\...` exceeding 260 characters.

## 2. Apply environment fixes (run PowerShell as Administrator for step 1)

```powershell
# (a) Enable Win32 long paths globally
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force

# (b) Enable Git long paths
git config --global core.longpaths true

# (c) Move the Gradle cache to a short root (shortens every cached path)
setx GRADLE_USER_HOME C:\g
```

Then **close and reopen** the terminal (so `GRADLE_USER_HOME` is picked up).

## 3. Clean rebuild

```powershell
cd android
.\gradlew.bat clean
cd ..
npx expo start -c
# then, with a device/emulator attached:
npx expo run:android --device
```

## 4. If it still fails

- Move the whole project closer to the drive root, e.g. `C:\SmartCard` (shortens the
  base path that every nested file inherits).
- Confirm Android Studio / JDK are on a short path too.
- Re-run step 1 and capture the full stacktrace before changing any app code.

## Verification gate

Do not mark the RTL fix as device-verified until this build completes and the app
launches on a real device. See `docs/RTL_RECOVERY_AUDIT.md` for the on-device checklist.
