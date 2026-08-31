# P6-A Build Truth Baseline

Recorded: 2026-08-31 (Asia/Jerusalem). Owner-authorized Work Package 1 only.

## Repositories

| Repository | Absolute path | Branch | Starting HEAD | Upstream | Starting state |
|---|---|---|---|---|---|
| App | `C:\Users\ebrah\smartcard-app` | `wip/expo-57-working-tree` | `d0f0c0d0d473097900cdf3ab2c42e1dbad2a2eff` | `origin/wip/expo-57-working-tree` | Two pre-existing untracked reports only: `reports/p4/d0f0c0d0d473.json`, `reports/p5/d0f0c0d0d473.json`; no staged files |
| Data pipeline | `C:\Users\ebrah\smartcard-data-pipeline` | `main` | `9cc63da7556e9b6a5949ed4358131b99420f3532` | `origin/main` | Clean; no staged or untracked files |

`C:\Users\ebrah\SmartCard-P5-Staging` and `C:\Users\ebrah\All application data\SmartCard-MasterDev-Campaign-Staging` are not Git repositories. The MDC staging package declares itself inert/draft/unaccepted; it was read for pending-decision provenance, not edited.

## Authority reconstructed

1. Owner rulings and queues on disk.
2. `C:\Users\ebrah\smartcard-data-pipeline\authority\SMARTCARD_FINAL_PRODUCT_SPEC.md`, especially §11-A.
3. Accepted `C:\Users\ebrah\smartcard-data-pipeline\campaign-p5\closure\P5_TO_P6_HANDOFF.md`, §2 P6-1…P6-11.
4. Existing P1–P5 contracts and gates.
5. Current active legal evidence targets under `C:\Users\ebrah\SmartCard-Terms of Use and Legal`.

The current Legal Requirements Map, Release Readiness Checklist, Validation Report, Operator Final Determination, and Operator Reconciliation Report were treated as evidence targets. `Israeli Laws/**`, `_archive/**`, all active legal drafts, and both Legal Operator reports were not modified.

## Starting implementation truth

| Area | Before |
|---|---|
| Notifications | Scheduling helpers existed, but authenticated navigation requested permission/scheduled automatically; billing was not wired to explicit opt-in; payloads included card last-four digits. |
| Export/import | No user-controlled encrypted vault transfer flow. |
| Learn | No release Learn surface. |
| Data & Privacy / Reset | Cryptographic terminal reset existed; no consolidated user surface; OS notification schedules were not cancelled before key destruction. |
| Signed pack update | Signature/hash/schema/refusal/atomic memory logic existed; no Expo filesystem persistence/restart recovery integration. |
| Offline/stale | Bundled FX fallback existed; stale calculation existed but was not propagated through FX engine/surfaces. |
| Conflict | Card DNA exposed conflicts and Wallet correctly carried them as Estimate per spec §11-A; no Check/Verdict/FX production conflict-input path. |
| Release | EngineProbe route was dev-gated; inherited promo UI was not; release manifest merged Firebase remote-messaging entry points. |
| Financial display | Ratio values were sent to a formatter for percent-unit values, producing truth-risking output. |

## Scope boundaries held

No public release, store submission, production signing, legal publication/localization, rename, analytics activation, CDN/BOI topology choice, Cloudflare/DNS/email/social change, paid service, Open Banking, payment execution, device-evidence claim, accessibility certification, or trademark claim was made.

