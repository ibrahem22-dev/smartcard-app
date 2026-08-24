/**
 * THE ESTATE THIS BUILD IS WILLING TO READ — compiled in, never read from a pack.
 *
 *   > **C5.** *"…with `EXPECTED_DATASET_ID` and the trust store **compiled in** and provably not
 *   > loadable from a pack."*
 *
 * The adapter's `openVerifiedPack` takes this as an input and its own comment is blunt about why:
 * *"§5 / R0: the app's COMPILED-IN constant. Never read from the pack."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A PACK THAT NAMES ITS OWN DATASET IS A PACK THAT CANNOT BE WRONG
 *
 * If the app took the dataset id from the manifest it was checking, the check would compare a
 * value against itself and pass for every pack ever made, including one built from a different
 * estate by somebody who should not have. The whole point of the comparison is that one side of it
 * was decided before the pack arrived.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT THE PRODUCT'S NAME
 *
 * `smartcard-canonical-v2` is the id of the data estate, owned by the pipeline repository and
 * stamped into every manifest it builds. It reads like the product slug and it is a different
 * fact: OD-2 renaming the product would not rename an estate whose packs are already signed, and
 * chasing this string during a rename would break every signature at once.
 *
 * That is why `identity-config` names this file explicitly rather than exempting the string.
 */
export const EXPECTED_DATASET_ID = 'smartcard-canonical-v2';
