import {
  ADAPTER_VERSION,
  assertPackCompatible,
  COMPATIBILITY_MATRIX,
  IncompatiblePackError,
  supportedPackFormats,
} from '@smartcard/data-authority-adapter';

import adapterPackage from '@smartcard/data-authority-adapter/package.json';

/**
 * THE ADAPTER SEAM — criteria D1 and D2, Owner Decision OD-20.
 *
 *   > **D1.** *"The app consumes the **published adapter package** at a **pinned version**, with the
 *   > compatibility matrix **enforced at load**."*
 *
 *   > **D2.** *"Nothing outside `data/adapter/**` imports a pack file, a raw JSON dataset, or the
 *   > local DB driver directly."*
 *
 *   > **OD-20.** *"The adapter is PIPELINE-OWNED. The pipeline owns and validates both pack-writing
 *   > and pack-reading semantics against the real corpus, which the app repository can never do. The
 *   > app pins a version of this package and reads through it; **it does not reimplement any of
 *   > it**."*
 *
 * This directory is the only place in the app that names the adapter package. Everything else asks
 * this module. That is what makes D2's claim checkable by a boundary rule rather than by hope.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PINNED" MEANS THE APP DECLARES WHICH BUILD IT EXPECTS
 *
 * A semver range is the usual reading and it is the weaker one: `^1.1.0` accepts a build nobody in
 * this repository has ever seen. And during development the package resolves through a `file:`
 * link, which pins nothing at all — it follows whatever is on disk, so an adapter rebuilt in the
 * pipeline changes the app's behaviour with no diff in the app.
 *
 * So the pin is a DECLARATION, checked: the version and the commit the adapter was built from are
 * written down here, and `adapter-consumption` compares them against the package that actually
 * installed. An adapter rebuilt from a different commit fails the gate instead of arriving silently.
 */

/**
 * The adapter build this app is written against.
 *
 * Changing either line is a deliberate act with a diff. `builtFromCommit` is the stronger half:
 * two builds can carry the same `adapterVersion` and different behaviour, and the commit cannot.
 */
export const PINNED_ADAPTER = {
  adapterVersion: '1.1.0',
  builtFromCommit: '416e4d13597aa45d6f6dbe1d9380d344ccde3da5',
} as const;

/** What actually installed, read from the package rather than assumed. */
export const INSTALLED_ADAPTER = {
  version: adapterPackage.version,
  adapterVersion: adapterPackage.smartcard.adapterVersion,
  builtFromCommit: adapterPackage.smartcard.builtFromCommit,
  supportedPackFormats: adapterPackage.smartcard.supportedPackFormats,
} as const;

export class AdapterPinError extends Error {
  constructor(field: string, expected: string, actual: string) {
    super(
      `the installed adapter's ${field} is "${actual}" and this app is pinned to "${expected}". ` +
        'OD-20 makes the adapter pipeline-owned and the app a consumer of a specific build: an ' +
        'adapter rebuilt from a different commit can read the same packs differently, and a ' +
        'difference that arrives with no diff in this repository is one nobody reviewed.',
    );
    this.name = 'AdapterPinError';
  }
}

/**
 * Assert the installed adapter is the pinned one.
 *
 * Called at load, before any pack is opened — the same discipline the adapter's own compatibility
 * check follows, and for the same reason: *"a compatibility rule that lives in a README is a rule
 * that is true until someone does not read the README."*
 */
/**
 * The adapter disagreeing with ITSELF.
 *
 * Distinct from `AdapterPinError`, which is this app disagreeing with the adapter. A pin error is
 * fixed by changing a line in this file. This one cannot be fixed here at all — it is a defect in
 * the published package, and the app's only correct move is to refuse to run against it.
 */
export class AdapterSelfDisagreementError extends Error {
  constructor(inCode: string, inManifest: string) {
    super(
      `the installed adapter reports adapterVersion "${inCode}" from its code and ` +
        `"${inManifest}" from its package.json. The two homes for one fact have diverged: one is ` +
        'what every refusal REPORTS and the other is what this app PINS against, so a build that ' +
        'updated one and not the other would leave the pin passing while every error message named ' +
        'a version that was not running. The adapter cannot notice this about itself — both homes ' +
        'are inside it — so the consumer checks it.',
    );
    this.name = 'AdapterSelfDisagreementError';
  }
}

export function assertPinnedAdapter(): void {
  if (INSTALLED_ADAPTER.adapterVersion !== PINNED_ADAPTER.adapterVersion) {
    throw new AdapterPinError('adapterVersion', PINNED_ADAPTER.adapterVersion, INSTALLED_ADAPTER.adapterVersion);
  }
  if (INSTALLED_ADAPTER.builtFromCommit !== PINNED_ADAPTER.builtFromCommit) {
    throw new AdapterPinError('builtFromCommit', PINNED_ADAPTER.builtFromCommit, String(INSTALLED_ADAPTER.builtFromCommit));
  }

  // AND THE ADAPTER MUST AGREE WITH ITSELF.
  //
  // `ADAPTER_VERSION` is a literal in the adapter's compiled `compatibility.js`. `smartcard
  // .adapterVersion` is a field in its `package.json`. Two homes for one fact, inside a package
  // that ships both — and until this line, nothing in either repository compared them.
  if (ADAPTER_VERSION !== INSTALLED_ADAPTER.adapterVersion) {
    throw new AdapterSelfDisagreementError(ADAPTER_VERSION, INSTALLED_ADAPTER.adapterVersion);
  }
}

/**
 * Open a pack set through the adapter, with the compatibility matrix enforced FIRST.
 *
 * The adapter's own `assertPackCompatible` throws `IncompatiblePackError` for a pack shape this
 * build cannot read. That throw is the correct behaviour and this module does not soften it: the
 * adapter's documentation is explicit that once an old adapter meets a new pack shape there is no
 * honest behaviour available, and **misreading a financial field is the worse outcome**.
 *
 * So this returns a REFUSAL, never a partial read. A caller gets either a compatible pack or an
 * error naming the two versions that disagree.
 */
export interface PackCompatibilityRefusal {
  readonly ok: false;
  readonly reason: 'incompatible-pack-format';
  readonly packFormatVersion: number;
  readonly adapterVersion: string;
  readonly message: string;
}

export interface PackCompatibilityAccepted {
  readonly ok: true;
  readonly packFormatVersion: number;
  readonly adapterVersion: string;
}

export function checkPackCompatibility(
  packFormatVersion: number,
): PackCompatibilityAccepted | PackCompatibilityRefusal {
  assertPinnedAdapter();
  try {
    assertPackCompatible(packFormatVersion);
    return { ok: true, packFormatVersion, adapterVersion: ADAPTER_VERSION };
  } catch (error) {
    if (error instanceof IncompatiblePackError || (error as Error).name === 'IncompatiblePackError') {
      return {
        ok: false,
        reason: 'incompatible-pack-format',
        packFormatVersion,
        adapterVersion: ADAPTER_VERSION,
        message: (error as Error).message,
      };
    }
    throw error;
  }
}

/**
 * The pack formats this adapter build can read, from the adapter itself.
 *
 * Exported so a surface can say WHICH formats are supported rather than only that one was refused —
 * "this app cannot read that pack" is a worse sentence than "this app reads format 1 and that pack
 * is format 2", and the second one tells somebody what to do.
 */
export function readablePackFormats(): readonly number[] {
  return supportedPackFormats();
}

/** The matrix itself, for a diagnostic surface. Never re-derived here — handoff §2, IF-7. */
export { COMPATIBILITY_MATRIX };
