import {
  KEY_CUSTODY,
  releaseEligible,
  TRUST_STORE,
  type KeyCustody,
  type SignatureEnvelope,
} from '@smartcard/data-authority-adapter';

/**
 * THE RELEASE GATE — criterion C7, obligation OB-8, Owner Decision OD-25.
 *
 *   > **C7.** *"**No pack reaches a real device while `release: false`.** A release-eligibility
 *   > check refuses delivery until OD-25's `HARDWARE_BACKED` custody exists."*
 *
 *   > **OB-8.** *"The development key is retired and **no release custody exists**."*
 *
 * And the campaign's own hard prohibition: *"Do not ship a pack to a real device while
 * `release: false`."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS GATE REFUSES EVERYTHING IN THIS REPOSITORY TODAY, AND THAT IS THE CORRECT ANSWER
 *
 * Every envelope under `src/data/adapter/packs/**` carries `release: false`, signed by
 * `DEV-KEY-NOT-FOR-RELEASE-owner-local-…` whose custody is `OWNER_LOCAL_DEV_NOT_FOR_RELEASE`. There
 * is no `HARDWARE_BACKED` key anywhere, because OD-25 has not been taken.
 *
 * So a check that passed would be describing a state nobody has reached. **A green C7 is a red
 * delivery**, and the two are not in tension: the criterion is that delivery is REFUSED, and the
 * evidence is the refusal happening.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE CUSTODY AND NOT THE FLAG
 *
 * `envelope.release` is a boolean IN the artifact. Trusting it alone would let a pack assert its
 * own release-eligibility — the same defect `EXPECTED_DATASET_ID` exists to avoid. So delivery asks
 * two independent questions and requires both:
 *
 *   1. does the envelope claim `release: true`?
 *   2. does the key that signed it have a custody the ADAPTER says may release?
 *
 * The second is `releaseEligible`, whose own documentation says an unruled custody *"is a compile
 * error here and a throw at runtime — never a silent `true`"*. A forged `release: true` beside a
 * development key fails question 2, and a real release key that somebody forgot to mark fails
 * question 1. Neither alone is the check.
 */

/** Why a delivery was refused. Distinct codes, because they have different fixes. */
export type DeliveryRefusalCode =
  /** The envelope says so itself. */
  | 'ENVELOPE_NOT_RELEASE'
  /** The signing key's custody may not produce a release-marked pack. */
  | 'CUSTODY_MAY_NOT_RELEASE'
  /** The key is not in the compiled-in trust store at all. */
  | 'UNKNOWN_KEY'
  /** No key with a release-capable custody exists anywhere in this build. */
  | 'NO_RELEASE_CUSTODY_EXISTS';

export interface DeliveryRefusal {
  readonly code: DeliveryRefusalCode;
  readonly packId: string;
  readonly message: string;
}

export type DeliveryVerdict =
  | { readonly deliverable: true; readonly packIds: readonly string[] }
  | { readonly deliverable: false; readonly refusals: readonly DeliveryRefusal[] };

/**
 * Does this build hold ANY key that could sign a release pack?
 *
 * Derived from the compiled-in trust store and the adapter's custody ruling — never a constant
 * somebody sets to `true` on the day they think it should be. OD-25 is what changes this: a
 * `HARDWARE_BACKED` key entering the trust store, and nothing else.
 */
export function releaseCustodyExists(): boolean {
  return TRUST_STORE.some((key) => releaseEligible(key.custody));
}

/** The custodies this build would accept, for a report that names them rather than counting them. */
export function releaseCapableCustodies(): readonly KeyCustody[] {
  return KEY_CUSTODY.filter((custody) => releaseEligible(custody));
}

/**
 * May these packs be delivered to a real device?
 *
 * `isRealDevice` is the caller's answer to "is this a phone, or a build tool?". A build tool
 * inspecting a dev-signed pack is not delivery and is not refused — that is the adapter's own
 * documented use of `requireRelease`. **Delivery to a device is.**
 */
export function checkDelivery(
  envelopes: readonly SignatureEnvelope[],
  isRealDevice: boolean,
): DeliveryVerdict {
  const packIds = envelopes.map((e) => e.packId);

  if (!isRealDevice) {
    // Not delivery. Inspecting, importing in a test, building — none of it puts a pack on a phone.
    return { deliverable: true, packIds };
  }

  const refusals: DeliveryRefusal[] = [];

  if (!releaseCustodyExists()) {
    refusals.push({
      code: 'NO_RELEASE_CUSTODY_EXISTS',
      packId: packIds.join(', ') || '(none)',
      message:
        'this build holds no key whose custody may produce a release-marked pack. OD-25 has not ' +
        'been taken: the development key is retired and no HARDWARE_BACKED custody exists, so ' +
        'there is nothing that could sign a deliverable pack and no pack may reach a device. ' +
        `The custodies that would qualify are ${releaseCapableCustodies().join(', ') || '(none)'}.`,
    });
  }

  for (const envelope of envelopes) {
    const key = TRUST_STORE.find((k) => k.keyId === envelope.keyId);
    if (!key) {
      refusals.push({
        code: 'UNKNOWN_KEY',
        packId: envelope.packId,
        message:
          `"${envelope.packId}" is signed by key "${envelope.keyId}", which is not in the ` +
          'compiled-in trust store. A key a pack introduces answers "is this signed by whoever ' +
          'signed it?".',
      });
      continue;
    }

    // TWO INDEPENDENT QUESTIONS. A forged `release: true` beside a development key fails the
    // second; a real release key somebody forgot to mark fails the first.
    if (!envelope.release) {
      refusals.push({
        code: 'ENVELOPE_NOT_RELEASE',
        packId: envelope.packId,
        message:
          `"${envelope.packId}" carries release: false. It was signed for development and says so.`,
      });
    }
    if (!releaseEligible(key.custody)) {
      refusals.push({
        code: 'CUSTODY_MAY_NOT_RELEASE',
        packId: envelope.packId,
        message:
          `"${envelope.packId}" is signed by a key with custody ${key.custody}, which may not ` +
          'produce a release-marked pack. The envelope\'s own flag is not consulted for this: a ' +
          'pack asserting its own release-eligibility is not a check.',
      });
    }
  }

  return refusals.length > 0 ? { deliverable: false, refusals } : { deliverable: true, packIds };
}
