import React, { useCallback, useMemo, useState } from 'react';
import { MERCHANT_RADAR_RESULT_LIMIT } from '../../config/lists';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useAppDirection } from '../../hooks/useAppDirection';
import { useTranslation } from '../../hooks/useTranslation';
import {
  merchantById,
  merchantName,
  quickMerchants,
  searchMerchants,
  type MerchantNameLanguage,
  type MerchantView,
} from '../../authority/merchantAuthority';
import type { MerchantAdvice } from '../../check/merchantRadar';
import { ACCENT, BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';

/**
 * MERCHANT RADAR — *"where are you shopping today?"*, at the front of the Check flow.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * BUILT FOR SOMEBODY STANDING AT A TILL
 *
 * The person using this has a queue behind them. So the shop comes first, one tap reaches the five
 * they are most likely to be standing in, and the answer appears **on this screen** rather than
 * behind a navigation — a merchant question that cost five steps and an amount would be a question
 * nobody asks at a checkout.
 *
 * The amount is still optional here and still optional afterwards. Choosing a shop refines nothing
 * about affordability and is not required for anything; the full purchase check is unchanged below.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS COMPONENT HOLDS NO RECOMMENDATION LOGIC — criterion B1, spec §20
 *
 * It renders `advice`, which the route composed with `merchantAdvice()`. It does not join a
 * benefit to a card, does not decide whether a benefit applies, does not rank and does not price.
 * The one thing it decides is which of the estate's published names to show, which is a language
 * question and not a recommendation.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE HONEST ANSWER IS USUALLY "NO", AND IT IS WORDED AS THREE DIFFERENT NOs
 *
 * The shipped corpus links a benefit to a merchant on six rows out of seven hundred. So for every
 * quick chip the truthful answer today is that there is no verified merchant-specific
 * recommendation — and *"nobody recorded a benefit here"*, *"the benefit names no card"* and
 * *"the benefit does not name a card you hold"* are three different sentences. Only the last is
 * about this person's wallet, and a surface that said it about the first would be blaming the user
 * for a gap in the data.
 */

export interface MerchantRadarProps {
  readonly selectedMerchantId: string | null;
  readonly onSelect: (merchantId: string | null) => void;
  /**
   * The composed answer for the selected merchant, from the route. Absent means the route did not
   * supply a resolver — the chips still work and no answer is invented.
   */
  readonly advice?: MerchantAdvice | null;
  /** Canonical ids this profile checked recently, most recent first. */
  readonly recentMerchantIds?: readonly string[];
}

const SEARCH_LIMIT = MERCHANT_RADAR_RESULT_LIMIT;

function nameLanguage(language: string): MerchantNameLanguage {
  return language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'he';
}

export function MerchantRadar({
  selectedMerchantId,
  onSelect,
  advice,
  recentMerchantIds,
}: MerchantRadarProps): React.ReactElement {
  const { t, language } = useTranslation();
  const { textAlign, writingDirection } = useAppDirection();
  const [query, setQuery] = useState<string>('');

  const nameIn = nameLanguage(language);
  const show = useCallback(
    (merchant: MerchantView): string => merchantName(merchant, nameIn),
    [nameIn],
  );

  const selected = useMemo(
    (): MerchantView | undefined =>
      selectedMerchantId === null ? undefined : merchantById(selectedMerchantId),
    [selectedMerchantId],
  );

  const results = useMemo(
    (): readonly MerchantView[] =>
      query.trim() === '' ? [] : searchMerchants(query, { limit: SEARCH_LIMIT }),
    [query],
  );

  /* Recents first, then the Owner's five, with nothing repeated. A chip row that showed the same
     shop twice would spend a scarce tap target on a duplicate. */
  const chips = useMemo((): readonly MerchantView[] => {
    const recents = (recentMerchantIds ?? [])
      .map(merchantById)
      .filter((m): m is MerchantView => m !== undefined);
    const seen = new Set(recents.map((m) => m.merchantId));
    return [...recents, ...quickMerchants().filter((m) => !seen.has(m.merchantId))];
  }, [recentMerchantIds]);

  const choose = useCallback(
    (merchantId: string): void => {
      setQuery('');
      onSelect(merchantId);
    },
    [onSelect],
  );

  return (
    <View className="mt-2" testID="merchant-radar">
      <AppText className={`text-sm font-bold ${TEXT.body}`}>
        {t('איפה קונים היום?')}
      </AppText>

      {selected === undefined ? (
        <>
          <TextInput
            accessibilityLabel={t('חיפוש בית עסק')}
            className={`mt-1 min-h-[48px] rounded-lg border p-3 text-base ${SURFACE.sunken} ${BORDER.hairline}`}
            onChangeText={setQuery}
            placeholder={t('הקלד שם של חנות')}
            style={{ textAlign, writingDirection }}
            testID="merchant-radar-search"
            value={query}
          />

          {query.trim() !== '' && results.length === 0 ? (
            <AppText
              className={`mt-2 text-sm ${TEXT.secondary}`}
              testID="merchant-radar-no-match"
            >
              {t('לא נמצא בית עסק בשם הזה')}
            </AppText>
          ) : null}

          {results.length > 0 ? (
            <View className="mt-2 gap-2" testID="merchant-radar-results">
              {results.map((merchant) => (
                <Pressable
                  accessibilityLabel={show(merchant)}
                  accessibilityRole="button"
                  className={`min-h-[48px] justify-center rounded-lg border p-3 ${SURFACE.sunken} ${BORDER.hairline}`}
                  key={merchant.merchantId}
                  onPress={(): void => choose(merchant.merchantId)}
                  testID={`merchant-radar-result-${merchant.merchantId}`}
                >
                  <AppText className={`text-sm font-bold ${TEXT.body}`}>{show(merchant)}</AppText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {chips.length > 0 ? (
            <RtlRow className="mt-2 flex-wrap gap-2" testID="merchant-radar-chips">
              {chips.map((merchant) => (
                <Pressable
                  accessibilityLabel={show(merchant)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: false }}
                  className={`min-h-[48px] items-center justify-center rounded-full border px-3 py-1 ${SURFACE.sunken} ${BORDER.hairline}`}
                  key={merchant.merchantId}
                  onPress={(): void => choose(merchant.merchantId)}
                  testID={`merchant-radar-chip-${merchant.merchantId}`}
                >
                  <AppText className={`text-xs font-bold ${TEXT.body}`}>{show(merchant)}</AppText>
                </Pressable>
              ))}
            </RtlRow>
          ) : null}
        </>
      ) : (
        <View className="mt-2 gap-2" testID="merchant-radar-selected">
          <RtlRow className="items-center justify-between gap-2">
            <AppText
              className={`flex-1 text-base font-extrabold ${TEXT.heading}`}
              testID="merchant-radar-selected-name"
            >
              {show(selected)}
            </AppText>
            <Pressable
              accessibilityLabel={t('בחירת בית עסק אחר')}
              accessibilityRole="button"
              className={`min-h-[48px] justify-center rounded-lg border px-3 ${SURFACE.sunken} ${BORDER.hairline}`}
              onPress={(): void => onSelect(null)}
              testID="merchant-radar-clear"
            >
              <AppText className={`text-sm font-bold ${TEXT.body}`}>{t('החלף')}</AppText>
            </Pressable>
          </RtlRow>
          <MerchantAnswer advice={advice} />
        </View>
      )}
    </View>
  );
}

/**
 * The answer block. Every branch is a sentence the estate can support, and the three absences are
 * kept apart for the reason the file header gives.
 *
 * EACH BRANCH CALLS `t()` ON A LITERAL, and the ternary chain is the price of that. A helper
 * returning the Hebrew source for `t(variable)` would read better and would be invisible to the
 * i18n coverage suite, which scans `t('…')` call sites — so the string would silently fall back to
 * Hebrew in Arabic and English with every gate still green. The same reason `card-dna-layout`
 * requires its section titles as literals.
 */
function MerchantAnswer({
  advice,
}: {
  readonly advice: MerchantAdvice | null | undefined;
}): React.ReactElement | null {
  const { t, language } = useTranslation();
  if (advice === undefined || advice === null) return null;

  if (advice.kind === 'VERIFIED_MERCHANT_BENEFIT') {
    const nameIn = nameLanguage(language);
    return (
      <View className="gap-1" testID="merchant-radar-answer-verified">
        <AppText className={`text-sm font-extrabold ${ACCENT.text}`}>
          {t('הטבה מתועדת בבית העסק')}
        </AppText>
        {advice.usableBenefits.map((benefit) => (
          <AppText
            className={`text-sm ${TEXT.body}`}
            key={benefit.benefitId}
            testID={`merchant-radar-benefit-${benefit.benefitId}`}
          >
            {benefitTitle(benefit, nameIn)}
          </AppText>
        ))}
      </View>
    );
  }

  return (
    <View className="gap-1" testID="merchant-radar-answer-absent">
      <AppText className={`text-sm font-bold ${ROLE_TEXT.advisory}`} testID="merchant-radar-absent-headline">
        {t('אין הטבה מתועדת לבית העסק הזה כרגע')}
      </AppText>
      <AppText className={`text-xs ${TEXT.secondary}`} testID="merchant-radar-absent-reason">
        {advice.absence === 'NOT_LINKED_TO_A_CARD'
          ? t('קיימת הטבה מתועדת לבית העסק הזה, אך היא אינה משויכת לאף כרטיס במאגר')
          : advice.absence === 'NOT_IN_THIS_WALLET'
            ? t('ההטבה המתועדת לבית העסק הזה אינה חלה על הכרטיסים שברשותך')
            : t('לא נמצאה במאגר הטבה מתועדת לבית העסק הזה')}
      </AppText>
      <AppText className={`text-xs ${TEXT.muted}`} testID="merchant-radar-general-note">
        {t('אפשר להזין סכום ולהמשיך לבדיקה מלאה, וההמלצה תהיה כללית ולא לבית עסק מסוים')}
      </AppText>
    </View>
  );
}

/** The benefit's own published title, in the reader's language, never re-worded. */
function benefitTitle(
  benefit: MerchantAdvice['usableBenefits'][number],
  language: MerchantNameLanguage,
): string {
  if (language === 'ar') return benefit.titleAr ?? benefit.titleEn ?? benefit.titleHe ?? benefit.benefitId;
  if (language === 'en') return benefit.titleEn ?? benefit.titleHe ?? benefit.benefitId;
  return benefit.titleHe ?? benefit.titleEn ?? benefit.benefitId;
}
