# pack-custody gate — falsification record (PD-MDC-081), run 2026-09-05

Command per case: `MDC_PACK_CUSTODY_PIPELINE=<case> npm run mdc:gate -- pack-custody` (colour off). Verdict parsed from the `PACK-CUSTODY OK` / `PACK-CUSTODY FAILED` line.

| case | expected | got | reason printed |
|---|---|---|---|
| `main-today-no-roots` | RED | **RED** | NO release-signing custody exists … no custody record |
| `one-root-no-lifecycle-recorded` | GREEN | **GREEN** | release custody: PROD-RELEASE-fixtureaaaaaaaaaaaa; record names it |
| `two-roots-lifecycle-recorded` | GREEN | **GREEN** | ACTIVE_SIGNING + RECOVERY, both named in the record |
| `two-active-signing` | RED | **RED** | 2 HARDWARE_BACKED signing authorities — signingKeyIdFor requires exactly one |
| `recovery-not-in-record` | RED | **RED** | the custody record does not name the hardware-backed key the trust store carries: …bbbb |
| `unknown-lifecycle` | RED | **RED** | lifecycle 'STANDBY' is neither a signing nor a recognised non-signing lifecycle |
| `record-unfilled-field` | RED | **RED** | the custody record still carries 1 unfilled field(s): [CEREMONY DATE] |
| `retired-key-release-eligible` | RED | **RED** | a release-eligible key is a development or retired key |

**8 / 8 as expected.** On `main` today (no MDC_PACK_CUSTODY_PIPELINE): `PACK-CUSTODY FAILED — NO release-signing custody exists … no custody record` — the verdict and its meaning are unchanged by the amendment.
