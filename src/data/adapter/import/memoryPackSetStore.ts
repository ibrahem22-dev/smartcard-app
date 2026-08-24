import type { InstalledPackSet, PackSetCandidate, PackSetStore } from './packSetImport';

/**
 * A `PackSetStore` in memory, that RECORDS EVERY CALL IN ORDER.
 *
 * The order is the point. *"Verify before writing, always"* is an obligation about sequence, and
 * the only way to prove a sequence is to watch it: a store that merely ended in the right state
 * would pass for an implementation that wrote first and cleaned up after itself, which is exactly
 * the behaviour OB-4 refuses.
 *
 * It can also be made to fail on demand. A rename that fails for lack of disk space is one of the
 * three things P1 could not prove, and the only way to prove it here is to inject it — a device
 * with a full disk is not something CI can arrange.
 *
 * NOT the device implementation. That one is `expoPackSetStore`, over `expo-file-system`, and it is
 * the same interface for the same reason the pack reader is: the sequencing under test is the code
 * that runs on a phone, not a rehearsal of it.
 */
export interface MemoryStoreOptions {
  /** What is installed before the import. */
  readonly installed?: readonly InstalledPackSet[];
  /** Throw from this verb, once, with this error. Injects a disk-full rename, and worse. */
  readonly failOn?: { verb: keyof PackSetStore; error: Error };
}

export interface RecordingPackSetStore extends PackSetStore {
  /** Every verb called, in order. A write verb appearing before verification is the failure. */
  readonly calls: readonly string[];
  /** What a caller would find installed right now. */
  snapshotInstalled(): readonly InstalledPackSet[];
  stagedIds(): readonly string[];
  backupIds(): readonly InstalledPackSet[] | null;
}

const describe = (c: PackSetCandidate): InstalledPackSet => ({
  packId: c.packId,
  packVersion: c.manifest.packVersion,
  packFormatVersion: c.manifest.packFormatVersion,
  datasetVersion: c.manifest.datasetVersion,
});

export function memoryPackSetStore(options: MemoryStoreOptions = {}): RecordingPackSetStore {
  let installed: InstalledPackSet[] = [...(options.installed ?? [])];
  let staged: PackSetCandidate[] = [];
  let backup: InstalledPackSet[] | null = null;
  const calls: string[] = [];
  let failed = false;

  const record = (verb: keyof PackSetStore): void => {
    calls.push(verb);
    if (!failed && options.failOn?.verb === verb) {
      failed = true;
      throw options.failOn.error;
    }
  };

  return {
    calls,
    snapshotInstalled: () => [...installed],
    stagedIds: () => staged.map((c) => c.packId),
    backupIds: () => (backup === null ? null : [...backup]),

    listInstalled: async () => {
      record('listInstalled');
      return [...installed];
    },
    clearStaging: async () => {
      record('clearStaging');
      staged = [];
    },
    stage: async (candidate) => {
      record('stage');
      staged.push(candidate);
    },
    backupInstalled: async () => {
      record('backupInstalled');
      // A rename, not a copy: what was installed IS the backup now, and installed is empty until
      // the promote. A device that crashed here finds a backup and no installed set, which is
      // exactly the state recoverAtStartup is written for.
      backup = [...installed];
      installed = [];
    },
    promoteStaged: async () => {
      record('promoteStaged');
      installed = staged.map(describe);
      staged = [];
    },
    discardBackup: async () => {
      record('discardBackup');
      backup = null;
    },
    restoreBackup: async () => {
      record('restoreBackup');
      if (backup === null) throw new Error('restoreBackup with no backup — the caller did not check hasBackup');
      installed = [...backup];
      backup = null;
    },
    hasBackup: async () => {
      record('hasBackup');
      return backup !== null;
    },
  };
}
