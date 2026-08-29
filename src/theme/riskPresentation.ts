/**
 * ONE PRESENTATION FOR ONE RISK LEVEL.
 *
 * `riskPresentation` existed twice — byte-identical, in `screens/calendar/DayMarkers.tsx` and
 * `screens/home/HomeRiskStrip.tsx` — with nothing comparing them. Two copies of one fact agree until
 * somebody edits one, and then the calendar and Home disagree about what `high` looks like while
 * every test and every gate stays green, because nothing was ever asked to compare them.
 *
 * The immediate reason for consolidating is narrower and R4's. Both labels spoke the level as a raw
 * enum:
 *
 *     accessibilityLabel={`${t('סיכון')}: ${level}`}     →  "مخاطر: critical"
 *
 * so a reader in Arabic or English heard their own language and then an English token. Fixing that
 * means adding a level → label mapping, and adding it to both files would have made four copies of
 * the level vocabulary rather than two. The cheapest correct fix was one home.
 *
 * `labelKey` is a Hebrew source string because that is how this app keys its catalogues; `t()`
 * resolves it against ar.ts and en.ts. It is a KEY, not a label — nothing should render it directly.
 */
import { ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT } from './tokens';

export type RiskPresentation = {
  /** A cue that survives the colour being removed — R3's rule, and A9's "icon + word". */
  readonly cue: string;
  readonly className: string;
  /** A Hebrew source key, resolved through t(). Never rendered as-is. */
  readonly labelKey: string;
};

export const riskPresentation = (level: string): RiskPresentation => {
  switch (level) {
    case 'safe':
      return {
        cue: '✓',
        className: `${ROLE_SURFACE_BG.positive} ${ROLE_BORDER.positive} ${ROLE_TEXT.positive}`,
        labelKey: 'בטוח',
      };
    case 'caution':
      return {
        cue: '!',
        className: `${ROLE_SURFACE_BG.advisory} ${ROLE_BORDER.advisory} ${ROLE_TEXT.advisory}`,
        labelKey: 'זהירות',
      };
    case 'high':
      return {
        cue: '▲',
        className: `${ROLE_SURFACE_BG.danger} ${ROLE_BORDER.danger} ${ROLE_TEXT.danger}`,
        labelKey: 'סיכון גבוה',
      };
    case 'critical':
      return {
        cue: '✕',
        className: `${ROLE_SURFACE_BG.danger} ${ROLE_BORDER.danger} ${ROLE_TEXT.danger}`,
        labelKey: 'קריטי',
      };
    default:
      return {
        cue: '?',
        className: `${ROLE_SURFACE_BG.neutral} ${ROLE_BORDER.neutral} ${ROLE_TEXT.neutral}`,
        labelKey: 'לא ידוע',
      };
  }
};

/**
 * THE LOAD BAND, AS A WORD SOMEBODY CAN HEAR.
 *
 * Card DNA §D and Plan Commitments both rendered `{t('רצועת עומס')}: {band}` — a translated label
 * followed by a raw enum — and announced that same enum through `accessibilityValue`. A reader in
 * Arabic heard "نطاق الحمل: strong_warning".
 *
 * It lives beside `riskPresentation` because it is the same kind of thing: a domain enum that must
 * become a user-facing word exactly once. Putting it in either screen would have made two homes for
 * one vocabulary, which is the defect that put `riskPresentation` here in the first place.
 */
export const loadBandLabelKey = (band: string): string => {
  switch (band) {
    case 'safe':
      return 'בטוח';
    case 'warning':
      return 'אזהרה';
    case 'strong_warning':
      return 'אזהרה חזקה';
    case 'blocked':
      return 'חסום';
    default:
      return 'לא ידוע';
  }
};
