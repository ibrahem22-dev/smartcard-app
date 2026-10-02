/**
 * Masked digit group from last4 alone (spec §10 / criterion M5).
 * Omitted last4 returns null — that tile is the normal case, not a degraded one.
 * Four digits only. Anything else is not last4 and is refused rather than painted.
 */
export function maskLast4(last4: string | undefined | null): string | null {
  if (last4 === undefined || last4 === null || last4 === '') {
    return null;
  }
  if (!/^\d{4}$/.test(last4)) {
    return null;
  }
  return `•••• •••• •••• ${last4}`;
}
