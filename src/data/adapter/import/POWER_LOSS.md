# POWER LOSS — what the import trial proves, and what it does not

**Criterion C3**, third clause. `P1_TO_P2_HANDOFF.md` §OB-4:

> *"Three things P1 did NOT prove, and P2 must not assume: **a real power-loss crash** (the
> interruptions are injected exceptions); concurrent importers; and a rename failing for lack of
> disk space."*

This document is the characterisation C3 asks for. It is not a claim that the gap is closed.

---

## THE TRIAL

`ob4Refusals.test.ts` interrupts an import at each of the eight named steps by throwing from
`policy.onStep`, and asserts what a device would find at startup afterwards.

| interrupted at | on disk afterwards | what `recoverAtStartup` does |
|---|---|---|
| `VERIFY_BEGIN`, `VERIFY_EACH` | nothing written at all | `NOTHING_TO_DO` — there is no backup, because the verify phase has no write verb available to it |
| `STAGE_BEGIN`, `STAGE_EACH`, `STAGE_COMPLETE` | a partial staging directory beside the installed set | `NOTHING_TO_DO`, then staging is cleared. The installed set was never touched |
| `COMMIT_BACKUP` | the backup rename either happened or did not | if it did: `ROLLED_BACK`. If it did not: `NOTHING_TO_DO` and the installed set is untouched |
| `COMMIT_PROMOTE` | **backup present, installed set absent or partial** | `ROLLED_BACK` — the known-good set returns |
| `COMMIT_CLEANUP` | the new set is installed and a stale backup remains | `ROLLED_BACK` **to the previous set** |

The last row is the one worth arguing about, and the handoff already decided it:

> *"**Roll back at startup when a backup is present** — the staged set is exactly the one whose
> promotion failed; rolling forward would promote it again."*

A crash at `COMMIT_CLEANUP` therefore costs a successful update, and the device returns to data it
was running correctly on. The alternative — inferring from the installed directory's contents that
the promote had in fact succeeded — requires trusting a directory whose write may have been
interrupted, which is the one thing a power loss makes untrustworthy.

---

## WHAT THIS DOES NOT PROVE

**An injected exception is not a power loss.** The difference is not a detail:

1. **A throw unwinds a stack. A power cut does not.** Every `finally` in this module runs on the
   injected path — including the one that releases the import lock. On a real device, nothing runs.
   The lock is in memory and dies with the process, so this happens to be safe here; a lock on disk
   would not have been, and that is the reason there is no lock file.

2. **A throw happens between two of our statements. A power cut happens inside one.** The rename is
   the step this whole shape is built around, and an injected failure models "the rename returned an
   error", not "the rename was interrupted mid-flight". The claim that a rename is close to atomic
   is a claim about the filesystem — ext4, APFS, F2FS — and it is not tested here.

3. **Nothing here tests flush ordering.** A file written and not `fsync`ed can be absent after a
   power cut even though every write returned success. `expo-file-system` exposes no `fsync`, so
   the staging directory's durability before the first rename is **unverified**, on both platforms.

**Consequence:** the failure mode this trial cannot rule out is a staged set that appears complete,
is promoted, and is missing bytes that were never flushed. The manifest sha would catch it at the
next read — as a refusal, on a device, with no obvious cause.

---

## WHAT WOULD CLOSE IT

A physical device, an import driven to `COMMIT_PROMOTE`, and the battery removed. That is
**criterion C2**, it needs hardware this campaign does not have, and it is Phase 11.

Until then the honest statement is the one at the top: the sequencing is proven, the recovery is
proven, and **the durability of a write before a power cut is assumed**.
