import React from 'react';

import { AppText } from './AppText';
import { RtlRow } from './rtl';
import { BORDER, SURFACE, TEXT } from '../theme/tokens';
import { useTranslation } from '../hooks/useTranslation';

/**
 * RENDERING AN ORGANISATION KIND THAT HAS NO LABEL — criterion A5, Owner Decisions OD-28 and OD-30.
 *
 *   > **A5.** *"The three organisation kinds shipping `labelState: UNKNOWN_NOT_IN_ESTATE` render
 *   > the key or an own UI string and **switch on `labelState`**; **no key is title-cased into an
 *   > estate-looking label**."*
 *
 *   > **OD-30.** *"The canonical estate provides the authoritative kind identifiers but **no**
 *   > authoritative Hebrew, Arabic or English display labels… P1 must therefore **not invent,
 *   > translate, infer or synthesize display labels**."*
 *
 * The pipeline ships them exactly as ruled:
 *
 *     { "key": "CONSUMER_CLUB", "label": null,
 *       "labelState": "UNKNOWN_NOT_IN_ESTATE", "obtainable": true }
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY TITLE-CASING THE KEY IS THE FORBIDDEN THING
 *
 * `CONSUMER_CLUB` → "Consumer Club" is one line of code, reads perfectly, and is a lie. It looks
 * exactly like a label somebody chose: a reader has no way to tell a rendered enum from an
 * authoritative name, and neither does a screenshot, a support ticket, or the next developer.
 *
 * The estate does not say what these are called. Displaying a formatted key claims it does. That is
 * why OD-30 spells out four verbs — invent, translate, infer, **synthesize** — and title-casing is
 * synthesis.
 *
 * So the key is shown AS A KEY: monospaced, in its own shape, beside a UI string of our own that
 * says the name is not yet known. A reader can see that the app is showing an identifier rather
 * than a name, which is the true state of affairs.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT SWITCHES ON `labelState`, NOT ON `label == null`
 *
 * A5 says so, and the difference matters. `label === null` is one symptom of one state; the field
 * that carries the reason is `labelState`, and a future state — a label withheld for licensing, say
 * — would also have a null label and would need saying differently. Reading the state means the
 * next state is a compile error here rather than a silently wrong sentence.
 */

/** The states the pipeline can ship. Mirrors the pack's own vocabulary; no second one is invented. */
export type LabelState = 'UNKNOWN_NOT_IN_ESTATE' | 'KNOWN';

export interface OrganisationKind {
  readonly key: string;
  readonly label: string | null;
  readonly labelState: LabelState;
}

export interface OrganisationKindLabelProps {
  readonly kind: OrganisationKind;
  readonly testID?: string;
}

export function OrganisationKindLabel({
  kind,
  testID,
}: OrganisationKindLabelProps): React.ReactElement {
  const { t } = useTranslation();

  switch (kind.labelState) {
    case 'KNOWN':
      // An authoritative label exists. Render it, and nothing else.
      return (
        <AppText className={`text-sm ${TEXT.body}`} testID={testID ?? 'organisation-kind-label'}>
          {kind.label ?? ''}
        </AppText>
      );

    case 'UNKNOWN_NOT_IN_ESTATE':
      return (
        // rtl-ok
        <RtlRow
          className="items-center gap-2"
          testID={testID ?? 'organisation-kind-unlabelled'}
        >
          {/*
            THE KEY, SHOWN AS A KEY. Monospaced and in its original casing, so it cannot be mistaken
            for a name somebody chose. This is the whole of A5's "no key is title-cased into an
            estate-looking label".
          */}
          <AppText
            className={`rounded border px-1.5 py-0.5 font-mono text-xs ${SURFACE.sunken} ${BORDER.hairline} ${TEXT.secondary}`}
            testID="organisation-kind-key"
          >
            {kind.key}
          </AppText>
          <AppText className={`text-xs ${TEXT.muted}`} testID="organisation-kind-unknown-note">
            {t('אין שם רשמי במאגר')}
          </AppText>
        </RtlRow>
      );
  }
}
