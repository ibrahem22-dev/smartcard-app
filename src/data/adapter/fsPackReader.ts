import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { PackReader } from './packSet';

/**
 * A `PackReader` over a directory on disk.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT THE DEVICE PATH, AND SAYING SO IS THE POINT
 *
 * It imports `node:fs`, which does not exist in React Native. It is used by tests and by tooling
 * in this repository — the environment where the real packs can actually be read and verified
 * before anybody's phone is involved. **The device's reader is criterion C1's import client, in
 * Phase 8**, and it will implement the same interface over whatever the platform gives it.
 *
 * The seam exists so that sentence can be true: `packSet.ts` never learns where bytes come from,
 * so the code that verifies a pack on a device is the same code a test can run in a second.
 *
 * Gate `node-apis-absent` asserts that nothing in the app's runtime graph reaches this module, by
 * walking the graph from `index.js` and `App.tsx` rather than by trusting this sentence. A reader
 * that quietly became the production path would put a Node API in a mobile bundle and fail at the
 * only moment nobody can attach a debugger to.
 */
export function fsPackReader(root: string): PackReader {
  return {
    /** Derived from the directory. A hand-written list would go stale the day a set is added. */
    sets: () =>
      readdirSync(root)
        .filter((entry) => statSync(join(root, entry)).isDirectory())
        .sort(),

    read: (set, file) => {
      // No try/catch. An unreadable pack must throw where it was asked for, carrying the path — a
      // reader that returned empty bytes on a missing file would hand the adapter an empty pack to
      // verify, and "signature does not match" is a terrible way to learn a file is absent.
      const bytes = readFileSync(join(root, set, file));
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    },
  };
}
