import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow, RtlScreen, RtlScrollView } from '../../components/rtl';
import { useAppDirection } from '../../hooks/useAppDirection';
import { useTranslation } from '../../hooks/useTranslation';
import { useCardsStore } from '../../store/useCardsStore';
import {
  benefitTitle,
  type BenefitFamily,
  type EligibleBenefit,
  type HeldCard,
} from '../../authority/benefitAuthority';
import {
  merchantById,
  merchantName,
  type MerchantNameLanguage,
} from '../../authority/merchantAuthority';
import { BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';
import { benefitsHubReading, type BenefitFilter } from './benefitsHub';

/**
 * THE BENEFITS HUB — one screen that answers "what do my cards actually give me?".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT SHOWS THIS WALLET'S BENEFITS, NEVER THE CORPUS
 *
 * Every row reaches the screen because the estate pinned that benefit to a card product this
 * person holds. Nothing arrives because the issuer publishes it, because the merchant exists, or
 * because a programme might apply — those are three ways of showing somebody a benefit they do not
 * have, and the addendum names all three.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE FILTERS ARE THE ESTATE'S, NOT A WISHLIST
 *
 * Only families with something behind them are offered, so a chip never teaches a user that the
 * app has nothing. The consumer sectors the directive sketches — restaurants, cinema, fuel — are
 * MERCHANT categories, and the corpus links a benefit to a merchant on six rows out of seven
 * hundred; those live in Merchant Radar, where the merchant evidence is. See `benefitsHub.ts`.
 *
 * B1: this screen renders `benefitsHubReading`. It performs no eligibility test of its own.
 */

export interface BenefitsHubScreenProps {
  readonly route?: {
    readonly params?: {
      /** Opened from one card: the Hub scopes to it and says so. */
      readonly cardId?: string;
    };
  };
  /** Controlled clock, so validity is testable on any day. */
  readonly todayIso?: string;
}

const FAMILY_ORDER: readonly BenefitFamily[] = [
  'cashback',
  'points',
  'travel',
  'lounge',
  'insurance',
  'fees',
  'foreign-currency',
  'merchant',
  'credit',
  'other',
];

function nameLanguage(language: string): MerchantNameLanguage {
  return language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'he';
}

/** Every family label is a literal `t()` call — see the note in `MerchantRadar.tsx`. */
function FamilyLabel({ family }: { readonly family: BenefitFilter }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <AppText className={`text-xs font-bold ${TEXT.body}`}>
      {family === 'all'
        ? t('הכול')
        : family === 'cashback'
          ? t('החזר כספי')
          : family === 'points'
            ? t('נקודות ומועדון')
            : family === 'travel'
              ? t('נסיעות וטיסות')
              : family === 'lounge'
                ? t('טרקלין נמל תעופה')
                : family === 'insurance'
                  ? t('ביטוח')
                  : family === 'fees'
                    ? t('עמלות ופטורים')
                    : family === 'foreign-currency'
                      ? t('מטבע חוץ')
                      : family === 'merchant'
                        ? t('הנחות בבתי עסק')
                        : family === 'credit'
                          ? t('אשראי ותשלומים')
                          : t('אחר')}
    </AppText>
  );
}

function ValidityLine({ row }: { readonly row: EligibleBenefit }): React.ReactElement | null {
  const { t } = useTranslation();

  /* THE UNKNOWN CASE WEARS THE ONE SHARED CHIP, NOT A SENTENCE THIS SCREEN INVENTED.
     `isCurrentlyShowable` admits ACTIVE, EXPIRING_SOON and UNKNOWN only, so this branch is exactly
     "the pack published no dates for this benefit" — the UNKNOWN provenance state. A2 says that
     state has one definition, and a second wording of it here would be a second badge. */
  if (row.validity === 'UNKNOWN') {
    return (
      <ProvenanceChip
        testID={`benefits-hub-validity-${row.benefit.benefitId}`}
        view={{ chip: 'UNKNOWN', stale: false }}
      />
    );
  }

  return (
    <AppText
      className={`text-xs ${row.validity === 'EXPIRING_SOON' ? ROLE_TEXT.advisory : TEXT.muted}`}
      testID={`benefits-hub-validity-${row.benefit.benefitId}`}
    >
      {row.validity === 'EXPIRING_SOON' ? t('מסתיימת בקרוב') : t('בתוקף')}
    </AppText>
  );
}

export function BenefitsHubScreen({
  route,
  todayIso,
}: BenefitsHubScreenProps = {}): React.ReactElement {
  const { t, language } = useTranslation();
  const { textAlign, writingDirection } = useAppDirection();
  const cards = useCardsStore((state) => state.cards);
  const [filter, setFilter] = React.useState<BenefitFilter>('all');
  const [query, setQuery] = React.useState<string>('');
  const [openId, setOpenId] = React.useState<string | null>(null);

  const onlyUserCardId = route?.params?.cardId;
  const clock = todayIso ?? new Date().toISOString().slice(0, 10);
  const held: readonly HeldCard[] = React.useMemo(
    () =>
      cards.map((card) => ({
        cardId: card.cardId,
        cardProductId: card.cardProductId ?? card.cardId,
      })),
    [cards],
  );

  const reading = React.useMemo(
    () =>
      benefitsHubReading({
        held,
        todayIso: clock,
        filter,
        query,
        language: nameLanguage(language),
        ...(onlyUserCardId === undefined ? {} : { onlyUserCardId }),
      }),
    [clock, filter, held, language, onlyUserCardId, query],
  );

  const cardName = React.useCallback(
    (userCardId: string): string =>
      cards.find((c) => c.cardId === userCardId)?.displayName ?? userCardId,
    [cards],
  );

  const orderedFilters = React.useMemo(
    () =>
      [...reading.filters].sort((a, b) => {
        if (a.filter === 'all') return -1;
        if (b.filter === 'all') return 1;
        return (
          FAMILY_ORDER.indexOf(a.filter as BenefitFamily)
          - FAMILY_ORDER.indexOf(b.filter as BenefitFamily)
        );
      }),
    [reading.filters],
  );

  return (
    <RtlScreen className={SURFACE.page} testID="benefits-hub">
      <RtlScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>{t('ההטבות שלי')}</AppText>

        {/* THE SUMMARY. Counts, and each is a count of something the estate evidenced. */}
        <RtlRow className="mt-3 flex-wrap gap-4" testID="benefits-hub-summary">
          <View className="gap-1">
            <AppText className={`text-xs ${TEXT.secondary}`}>{t('הטבות זמינות')}</AppText>
            <AppText
              accessibilityValue={{ text: String(reading.summary.showableCount) }}
              className={`text-h1 font-black ${TEXT.heading}`}
              style={TABULAR_NUMERALS}
              testID="benefits-hub-count"
            >
              {String(reading.summary.showableCount)}
            </AppText>
          </View>
          <View className="gap-1">
            <AppText className={`text-xs ${TEXT.secondary}`}>{t('כרטיסים שמעניקים הטבות')}</AppText>
            <AppText
              accessibilityValue={{ text: String(reading.summary.contributingCardCount) }}
              className={`text-xl font-extrabold ${TEXT.heading}`}
              style={TABULAR_NUMERALS}
              testID="benefits-hub-contributing-cards"
            >
              {String(reading.summary.contributingCardCount)}
            </AppText>
          </View>
          {reading.summary.expiringSoonCount > 0 ? (
            <View className="gap-1">
              <AppText className={`text-xs ${TEXT.secondary}`}>{t('מסתיימות בקרוב')}</AppText>
              <AppText
                accessibilityValue={{ text: String(reading.summary.expiringSoonCount) }}
                className={`text-xl font-extrabold ${ROLE_TEXT.advisory}`}
                style={TABULAR_NUMERALS}
                testID="benefits-hub-expiring"
              >
                {String(reading.summary.expiringSoonCount)}
              </AppText>
            </View>
          ) : null}
        </RtlRow>

        {onlyUserCardId === undefined ? null : (
          <AppText className={`mt-2 text-xs ${TEXT.secondary}`} testID="benefits-hub-card-scope">
            {`${t('מסונן לכרטיס')}: ${cardName(onlyUserCardId)}`}
          </AppText>
        )}

        <TextInput
          accessibilityLabel={t('חיפוש בהטבות')}
          className={`mt-3 min-h-[48px] rounded-lg border p-3 text-base ${SURFACE.sunken} ${BORDER.hairline}`}
          onChangeText={setQuery}
          placeholder={t('חיפוש לפי בית עסק, שם הטבה או קטגוריה')}
          style={{ textAlign, writingDirection }}
          testID="benefits-hub-search"
          value={query}
        />

        {orderedFilters.length > 0 ? (
          <RtlRow className="mt-3 flex-wrap gap-2" testID="benefits-hub-filters">
            {orderedFilters.map((option) => {
              const selected = option.filter === filter;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`min-h-[48px] items-center justify-center rounded-full border px-3 ${
                    selected ? `${SURFACE.raised} ${BORDER.subtle}` : `${SURFACE.sunken} ${BORDER.hairline}`
                  }`}
                  key={option.filter}
                  onPress={(): void => setFilter(option.filter)}
                  testID={`benefits-hub-filter-${option.filter}`}
                >
                  <RtlRow className="items-center gap-1">
                    <FamilyLabel family={option.filter} />
                    <AppText
                      className={`text-xs ${TEXT.secondary}`}
                      style={TABULAR_NUMERALS}
                    >
                      {String(option.count)}
                    </AppText>
                  </RtlRow>
                </Pressable>
              );
            })}
          </RtlRow>
        ) : null}

        {reading.emptiness !== undefined ? (
          <View className="mt-4 gap-1" testID="benefits-hub-empty">
            <AppText className={`text-sm font-bold ${TEXT.body}`} testID="benefits-hub-empty-headline">
              {reading.emptiness === 'NO_CARDS'
                ? t('הוסיפו כרטיס כדי לראות אילו הטבות מגיעות לכם')
                : reading.emptiness === 'NO_EVIDENCED_BENEFITS'
                  ? t('לא נמצאה במאגר הטבה מתועדת לכרטיסים שלכם')
                  : t('אין הטבות בקטגוריה הזאת')}
            </AppText>
            {reading.emptiness === 'NO_EVIDENCED_BENEFITS' ? (
              <AppText className={`text-xs ${TEXT.muted}`} testID="benefits-hub-empty-note">
                {t('זו קביעה על המאגר ולא על הכרטיס — ייתכן שמנפיק הכרטיס משווק הטבות שאין להן עדות כאן')}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {reading.rows.map((row) => {
          const open = openId === row.benefit.benefitId;
          const merchants = (row.benefit.eligibleMerchantIds ?? [])
            .map(merchantById)
            .filter((m): m is NonNullable<typeof m> => m !== undefined);
          return (
            <View
              className={`mt-3 gap-2 rounded-lg border p-3 ${SURFACE.card} ${BORDER.hairline}`}
              key={row.benefit.benefitId}
              testID={`benefits-hub-row-${row.benefit.benefitId}`}
            >
              <Pressable
                accessibilityLabel={benefitTitle(row.benefit, nameLanguage(language))}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                className="min-h-[48px] justify-center"
                onPress={(): void => setOpenId(open ? null : row.benefit.benefitId)}
                testID={`benefits-hub-row-${row.benefit.benefitId}-toggle`}
              >
                <AppText className={`text-sm font-extrabold ${TEXT.heading}`}>
                  {benefitTitle(row.benefit, nameLanguage(language))}
                </AppText>
              </Pressable>

              <RtlRow className="flex-wrap items-center gap-2">
                <ValidityLine row={row} />
                <ProvenanceChip
                  testID={`benefits-hub-chip-${row.benefit.benefitId}`}
                  view={{
                    chip: row.benefit.provenanceChip === 'VERIFIED' ? 'VERIFIED' : 'UNKNOWN',
                    stale: false,
                  }}
                />
              </RtlRow>

              {/* WHICH OF YOUR CARDS. One row per offer, every reaching card named inside it. */}
              <AppText
                className={`text-xs ${TEXT.secondary}`}
                testID={`benefits-hub-cards-${row.benefit.benefitId}`}
              >
                {row.viaUserCardIds.length > 1
                  ? `${t('זמין עם')} ${row.viaUserCardIds.length} ${t('מהכרטיסים שלך')}: ${row.viaUserCardIds.map(cardName).join(' · ')}`
                  : row.viaUserCardIds.map(cardName).join('')}
              </AppText>

              {open ? (
                <View className="gap-1" testID={`benefits-hub-detail-${row.benefit.benefitId}`}>
                  {row.benefit.description === undefined ? null : (
                    <AppText className={`text-xs ${TEXT.body}`}>{row.benefit.description}</AppText>
                  )}
                  {row.benefit.value === undefined ? (
                    <AppText className={`text-xs ${TEXT.muted}`}>
                      {t('לא פורסם שווי מספרי להטבה הזאת')}
                    </AppText>
                  ) : (
                    <AppText
                      className={`text-xs ${TEXT.body}`}
                      style={TABULAR_NUMERALS}
                      testID={`benefits-hub-value-${row.benefit.benefitId}`}
                    >
                      {`${t('שווי')}: ${row.benefit.value.value ?? ''} ${row.benefit.value.unit ?? row.benefit.value.kind}`}
                    </AppText>
                  )}
                  {merchants.length === 0 ? null : (
                    <AppText className={`text-xs ${TEXT.body}`}>
                      {`${t('בתי עסק')}: ${merchants.map((m) => merchantName(m, nameLanguage(language))).join(' · ')}`}
                    </AppText>
                  )}
                  {row.benefit.validUntil === undefined ? (
                    <AppText className={`text-xs ${TEXT.muted}`}>
                      {t('לא פורסם תאריך סיום')}
                    </AppText>
                  ) : (
                    <AppText className={`text-xs ${TEXT.body}`}>
                      {`${t('בתוקף עד')} ${row.benefit.validUntil}`}
                    </AppText>
                  )}
                  {row.benefit.stacking.rule === 'UNKNOWN' ? null : (
                    <AppText className={`text-xs ${TEXT.muted}`}>
                      {`${t('שילוב הטבות')}: ${row.benefit.stacking.rule}`}
                    </AppText>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </RtlScrollView>
    </RtlScreen>
  );
}
