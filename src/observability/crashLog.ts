/**
 * THE LOCAL CRASH LOG — criterion V9, MDC-OBSERVABILITY option 1 (PD-MDC-066).
 *
 *   > *"NO remote telemetry — local crash log the user can inspect and manually share; R4's window
 *   > reads store consoles and user reports only."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NOTHING LEAVES THE DEVICE, AND NOTHING ABOUT MONEY GETS IN
 *
 * This module imports one thing that persists — react-native-mmkv — and nothing that talks to a
 * network. It records the NAME, a REDACTED message and a bounded stack of an uncaught JavaScript
 * error, with a timestamp and the app version, into its own MMKV instance on the device. That is
 * the whole design: a user who hits a crash can open Settings → Crash log, read what the app
 * recorded, copy it, and hand it to whoever they choose. No provider, no upload, no consent
 * question, because there is no transmission to consent to (OD-5 local-only stance).
 *
 * WHY MMKV AND NOT A FILE. The global handler runs while the process is dying: the write has to be
 * synchronous or it does not happen. MMKV's set() is a synchronous native call; a file write
 * through expo-file-system is a promise the process may never resolve. The register entry
 * ALLOW-CRASH-LOG-MMKV in tools/p2/e1-backlog.json names this file for that reason, and
 * tools/mdc/gates/observability-local.mjs proves this module imports no network module and no
 * vault type, and that the redaction below cannot be removed without the gate going red.
 *
 * WHAT REDACTION MEANS HERE. An error message can quote a value — "limit 20000 exceeded by 1200".
 * Every run of three or more digits is replaced before storage, so an amount, a card's last four
 * digits or a date can never be in the log. Stack frames keep their file paths and line numbers
 * (those are the app's, not the user's). A message longer than MESSAGE_CHARS or a stack longer than
 * STACK_CHARS is cut, and the log keeps the newest MAX_ENTRIES only.
 */
import { MMKV } from 'react-native-mmkv';

import { APP_IDENTITY } from '../config/identity';

export type CrashKind = 'fatal' | 'non-fatal';

export interface CrashEntry {
  readonly at: string;
  readonly kind: CrashKind;
  readonly name: string;
  readonly message: string;
  readonly stack: string;
  readonly appVersion: string;
}

export const MAX_ENTRIES = 20;
export const MESSAGE_CHARS = 300;
export const STACK_CHARS = 2000;
const STORAGE_ID = 'crash-log';
const KEY = 'entries';

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler | undefined;
  setGlobalHandler(handler: GlobalHandler): void;
}

let storage: MMKV | null = null;
const store = (): MMKV => {
  if (storage === null) storage = new MMKV({ id: STORAGE_ID });
  return storage;
};

/** Every run of three or more digits becomes '###' — no amount, last-four or date survives. */
export const redact = (text: string): string => text.replace(/\d{3,}/g, '###');

const clip = (text: string, limit: number): string => (text.length > limit ? `${text.slice(0, limit)}…` : text);

const toEntry = (error: unknown, kind: CrashKind, now: Date): CrashEntry => {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    at: now.toISOString(),
    kind,
    name: redact(clip(err.name || 'Error', 80)),
    message: redact(clip(err.message ?? '', MESSAGE_CHARS)),
    stack: redact(clip(err.stack ?? '', STACK_CHARS)),
    appVersion: APP_IDENTITY.version,
  };
};

export function readCrashLog(): readonly CrashEntry[] {
  try {
    const raw = store().getString(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CrashEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordCrash(error: unknown, kind: CrashKind, now: Date = new Date()): CrashEntry {
  const entry = toEntry(error, kind, now);
  const next = [entry, ...readCrashLog()].slice(0, MAX_ENTRIES);
  try {
    store().set(KEY, JSON.stringify(next));
  } catch {
    // A crash log that cannot write must never itself throw inside the crash handler.
  }
  return entry;
}

export function clearCrashLog(): void {
  try {
    store().delete(KEY);
  } catch {
    // nothing to do: an unreadable store is reported as empty by readCrashLog
  }
}

/** Plain text a user can paste into a message. Already redacted at storage time. */
export function formatCrashLog(entries: readonly CrashEntry[] = readCrashLog()): string {
  if (entries.length === 0) return '';
  return entries
    .map((e) => `${e.at} · ${e.kind} · v${e.appVersion}\n${e.name}: ${e.message}\n${e.stack}`)
    .join('\n\n');
}

let installed = false;

/**
 * Installs the recording handler in front of the platform's own, exactly once. The previous
 * handler is called afterwards so the platform still terminates a fatal error the way it always
 * did — this module observes, it does not swallow.
 */
export function installCrashLog(errorUtils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils): boolean {
  if (installed || !errorUtils) return false;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean): void => {
    recordCrash(error, isFatal ? 'fatal' : 'non-fatal');
    if (previous) previous(error, isFatal);
  });
  installed = true;
  return true;
}

/** Test seam: forget the installed state and the store handle. Not used by the app. */
export function __resetCrashLogForTests(): void {
  installed = false;
  storage = null;
}
