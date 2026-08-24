/**
 * REPORTING A VAULT FAILURE WITHOUT LEAKING WHAT FAILED.
 *
 * `LockScreen` had two bare `catch {}` blocks. On a device they produced *"Try again"* forever with
 * nothing anywhere saying why — P2's device lane hit exactly that, watched a PIN enrolment fail
 * three times, and could not name the cause because the only record of it had been discarded at the
 * moment it was created.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE USER'S SENTENCE DOES NOT CHANGE
 *
 * A keystore error is not something a person can act on, and putting `KeyStoreException` on a lock
 * screen would be worse than the vague sentence, not better. What changes is that the reason reaches
 * a log, where a developer or a support conversation can find it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE MESSAGE ONLY — NEVER THE ERROR OBJECT
 *
 * The value being enrolled is a PIN. An error object can carry it: a stack frame's arguments, a
 * `cause` chain, a native module echoing its input back in a field nobody documented. Logging the
 * object would be a credential-disclosure bug wearing a diagnostic's clothes, and it is exactly the
 * kind of thing that survives review because it looks responsible.
 *
 * So this takes the message, and only the message — and then removes anything that looks like a
 * run of digits, because a message is not a place anybody promised not to interpolate one.
 */

/** Where the failure happened. A closed set: a free string here is a second vocabulary. */
export type VaultOperation = 'enrollPin' | 'unlockWithPin' | 'unlockWithBiometric' | 'wipeVault';

/**
 * Any run of four or more digits becomes `[redacted]`.
 *
 * Four, not six: a PIN is six digits today, and a redactor tuned to exactly today's length is one
 * that stops working the moment the length changes. It costs a little precision in error text about
 * timestamps and version numbers, and that is the right trade in a credential path.
 */
const stripDigitRuns = (text: string): string => text.replace(/\d{4,}/g, '[redacted]');

/**
 * The message of an error, safely, whatever was actually thrown.
 *
 * `throw 'a string'` and `throw {code: 1}` are both legal and both reach here.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error !== null && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'a non-Error value was thrown';
}

/**
 * Report that a vault operation failed, and why, without disclosing the credential.
 *
 * Deliberately `console.error` and not the analytics boundary: `track()` refuses anything but
 * allowlisted primitives, and an error message is a free string — exactly what B7 forbids sending
 * off the device. This stays local, which is where a vault failure belongs.
 */
export function reportVaultFailure(operation: VaultOperation, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error;
  // eslint-disable-next-line no-console -- the whole point of this module is that it reaches a log
  console.error(
    `[vault] ${operation} failed: ${name}: ${stripDigitRuns(messageOf(error))}`,
  );
}
