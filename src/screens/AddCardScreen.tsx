import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import {
  catalogDisplayName,
  currentCatalogInstitutions,
  searchCatalog,
  type CatalogProductHit,
} from '../data/adapter/catalogSearch';
import type { ClubResolution } from '../data/adapter/clubResolver';
import { ClubResolver } from './addCard/ClubResolver';
import { useAppDirection } from '../hooks/useAppDirection';
import { useTranslation } from '../hooks/useTranslation';
import type { WalletStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import { ACCENT, BORDER, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';
import { CardIssuer } from '../types/card.types';
import { createManualCard } from '../utils/manualCard';
import { parseAmount } from '../utils/parseAmount';

type AddCardNavigation = NativeStackNavigationProp<WalletStackParamList, 'AddCard'>;

type WizardPath = 'search' | 'generic' | 'catalog';

const ISSUER_OPTIONS: readonly { value: CardIssuer; label: string }[] = [
  { value: CardIssuer.Max, label: 'Max' },
  { value: CardIssuer.Isracard, label: 'Isracard' },
  { value: CardIssuer.Cal, label: 'CAL' },
];

function parseDayOfMonth(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null;
}

/** Parses an optional FX-fee percent input into a fraction. Returns:
 *  - a fraction (0-1) when a valid percent is entered,
 *  - undefined when left blank (stays unknown),
 *  - null when the input is present but invalid. */
function parseFeePercent(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number(trimmed.replace(/[%\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed / 100
    : null;
}

function issuerFromCatalogHit(hit: CatalogProductHit): CardIssuer | null {
  const raw = hit.operatingCardCompanyId ?? hit.issuerOrgId;
  if (raw === 'org:max') return CardIssuer.Max;
  if (raw === 'org:cal') return CardIssuer.Cal;
  if (raw === 'org:isracard' || raw === 'org:amex-il') return CardIssuer.Isracard;
  return null;
}

export function AddCardScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { textAlign, writingDirection } = useAppDirection();
  const navigation = useNavigation<AddCardNavigation>();
  const addCard = useCardsStore(state => state.addCard);
  const institutions = currentCatalogInstitutions();

  const [path, setPath] = useState<WizardPath>('search');
  const [query, setQuery] = useState('');
  const [issuerOrgId, setIssuerOrgId] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<CatalogProductHit | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [issuer, setIssuer] = useState<CardIssuer | null>(null);
  const [last4, setLast4] = useState('');
  const [creditLimitText, setCreditLimitText] = useState('');
  const [currentBalanceText, setCurrentBalanceText] = useState('');
  const [billingDayText, setBillingDayText] = useState('');
  const [feePercentText, setFeePercentText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showClubResolver, setShowClubResolver] = useState(false);
  const [clubResolution, setClubResolution] = useState<ClubResolution | null>(null);

  const hits = useMemo(
    () => searchCatalog(query, issuerOrgId === undefined ? undefined : { issuerOrgId }),
    [query, issuerOrgId],
  );

  function resetForm(): void {
    setDisplayName('');
    setIssuer(null);
    setLast4('');
    setCreditLimitText('');
    setCurrentBalanceText('');
    setBillingDayText('');
    setFeePercentText('');
    setFormError(null);
    setShowClubResolver(false);
    setClubResolution(null);
  }

  function openGeneric(): void {
    resetForm();
    setSelected(null);
    setPath('generic');
  }

  function openCatalog(hit: CatalogProductHit): void {
    resetForm();
    setSelected(hit);
    setDisplayName(catalogDisplayName(hit));
    setIssuer(issuerFromCatalogHit(hit));
    setPath('catalog');
  }

  function backToSearch(): void {
    resetForm();
    setSelected(null);
    setPath('search');
  }

  function saveCard(): void {
    const creditLimit = parseAmount(creditLimitText);
    const currentBalance = parseAmount(currentBalanceText);
    const fee = parseFeePercent(feePercentText);
    const billingDay =
      billingDayText.trim() === '' ? undefined : parseDayOfMonth(billingDayText);

    if (
      displayName.trim() === '' ||
      issuer === null ||
      !/^\d{4}$/.test(last4) ||
      creditLimit === null ||
      currentBalance === null ||
      billingDay === null ||
      fee === null
    ) {
      setFormError(
        t(
          'יש למלא שם, מנפיק, 4 ספרות, מסגרת וחיוב תקינים. יום חיוב 1–31 ועמלת מט"ח 0–100% הם אופציונליים.',
        ),
      );
      return;
    }

    const card = createManualCard({
      displayName: displayName.trim(),
      last4,
      issuer,
      creditLimit,
      currentBalance,
      ...(billingDay === undefined ? {} : { billingDayOfMonth: billingDay }),
      ...(fee === undefined ? {} : { foreignTransactionFee: fee }),
      ...(selected === null ? {} : { cardProductId: selected.cardId }),
      ...(clubResolution?.outcome === 'unknown' ? { unknownClub: true } : {}),
    });

    addCard(card);
    navigation.goBack();
  }

  const inputStyle = { textAlign, writingDirection };
  const inputClass = `min-h-[50px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`;
  const labelClass = `text-sm font-bold ${TEXT.body}`;

  const detailsForm = (
    <>
      <AppText className={labelClass}>{t('שם הכרטיס')}</AppText>
      <TextInput
        className={inputClass}
        onChangeText={setDisplayName}
        style={inputStyle}
        testID="add-card-display-name"
        value={displayName}
      />

      <AppText className={labelClass}>{t('חברת האשראי')}</AppText>
      <RtlRow className="flex-wrap gap-2">
        {ISSUER_OPTIONS.map(option => {
          const isSelected = issuer === option.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={`min-h-[46px] min-w-24 items-center justify-center rounded-lg border px-3 ${
                isSelected
                  ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                  : `${BORDER.hairline} ${SURFACE.card}`
              }`}
              key={option.value}
              onPress={(): void => setIssuer(option.value)}
              testID={`add-card-issuer-${option.value}`}
            >
              <AppText className={`text-center text-sm font-extrabold ${TEXT.heading}`}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </RtlRow>

      <AppText className={labelClass}>{t('4 ספרות אחרונות')}</AppText>
      <TextInput
        className={inputClass}
        keyboardType="number-pad"
        maxLength={4}
        onChangeText={setLast4}
        style={inputStyle}
        testID="add-card-last4"
        value={last4}
      />

      <AppText className={labelClass}>{t('מסגרת אשראי (₪)')}</AppText>
      <TextInput
        className={inputClass}
        keyboardType="decimal-pad"
        onChangeText={setCreditLimitText}
        style={inputStyle}
        value={creditLimitText}
      />

      <AppText className={labelClass}>{t('חיוב נוכחי (₪)')}</AppText>
      <TextInput
        className={inputClass}
        keyboardType="decimal-pad"
        onChangeText={setCurrentBalanceText}
        style={inputStyle}
        value={currentBalanceText}
      />

      <AppText className={labelClass}>{t('יום חיוב בחודש (אופציונלי)')}</AppText>
      <TextInput
        className={inputClass}
        keyboardType="number-pad"
        maxLength={2}
        onChangeText={setBillingDayText}
        style={inputStyle}
        value={billingDayText}
      />

      <AppText className={labelClass}>{t('עמלת המרת מט"ח % (אופציונלי)')}</AppText>
      <TextInput
        className={inputClass}
        keyboardType="decimal-pad"
        onChangeText={setFeePercentText}
        style={inputStyle}
        value={feePercentText}
      />
      <AppText className={`text-xs font-bold ${TEXT.muted}`}>
        {t('שדות לא ידועים נשארים לא ידועים — האפליקציה לא תמציא ערך.')}
      </AppText>

      {showClubResolver ? (
        <ClubResolver
          onResolved={(resolution): void => {
            setClubResolution(resolution);
            setShowClubResolver(false);
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          className={`min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
          onPress={(): void => setShowClubResolver(true)}
          testID="add-card-unknown-club"
        >
          <AppText className={`text-center text-sm font-extrabold ${TEXT.heading}`}>
            {clubResolution?.outcome === 'identified'
              ? clubResolution.club.displayName
              : clubResolution?.outcome === 'unknown'
                ? t('מועדון לא ידוע 🔍')
                : t('אני לא יודע את המועדון 🔍')}
          </AppText>
        </Pressable>
      )}

      {formError !== null ? (
        <AppText className={`text-sm font-bold ${ROLE_TEXT.danger}`}>{formError}</AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        className={`mt-2 min-h-[50px] items-center justify-center rounded-lg ${ACCENT.solid}`}
        onPress={saveCard}
        testID="add-card-save"
      >
        <AppText className={`text-center text-base font-extrabold ${TEXT.onAccent}`}>
          {t('שמור כרטיס')}
        </AppText>
      </Pressable>
    </>
  );

  return (
    <RtlScreen className={`${SURFACE.page}`}>
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full gap-3 p-5" testID="add-card-wizard">
          <AppText className={`text-2xl font-black ${TEXT.heading}`}>{t('הוסף כרטיס')}</AppText>

          {path === 'search' ? (
            <View testID="add-card-search-path">
              <AppText className={labelClass}>{t('חפש כרטיס')}</AppText>
              <TextInput
                className={inputClass}
                onChangeText={setQuery}
                style={inputStyle}
                testID="add-card-search"
                value={query}
              />

              <AppText className={`mt-3 ${labelClass}`}>{t('סנן לפי מוסד')}</AppText>
              <RtlRow className="flex-wrap gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: issuerOrgId === undefined }}
                  className={`min-h-[40px] items-center justify-center rounded-lg border px-3 ${
                    issuerOrgId === undefined
                      ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                      : `${BORDER.hairline} ${SURFACE.card}`
                  }`}
                  onPress={(): void => setIssuerOrgId(undefined)}
                  testID="add-card-institution-all"
                >
                  <AppText className={`text-center text-sm font-extrabold ${TEXT.heading}`}>
                    {t('כל המוסדות')}
                  </AppText>
                </Pressable>
                {institutions.map(institution => {
                  const isSelected = issuerOrgId === institution.orgId;
                  const label =
                    institution.nameHe ?? institution.nameEn ?? institution.nameAr ?? institution.orgId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      className={`min-h-[40px] items-center justify-center rounded-lg border px-3 ${
                        isSelected
                          ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                          : `${BORDER.hairline} ${SURFACE.card}`
                      }`}
                      key={institution.orgId}
                      onPress={(): void => setIssuerOrgId(institution.orgId)}
                      testID={`add-card-institution-${institution.orgId}`}
                    >
                      <AppText className={`text-center text-sm font-extrabold ${TEXT.heading}`}>
                        {label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </RtlRow>

              <View className="mt-3 gap-2" testID="add-card-results">
                {hits.map(hit => (
                  <Pressable
                    accessibilityRole="button"
                    className={`min-h-[48px] justify-center rounded-lg border px-3 ${BORDER.hairline} ${SURFACE.card}`}
                    key={hit.cardId}
                    onPress={(): void => openCatalog(hit)}
                    testID={`add-card-hit-${hit.cardId}`}
                  >
                    <AppText className={`text-base font-extrabold ${TEXT.heading}`}>
                      {catalogDisplayName(hit)}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <Pressable
                accessibilityRole="button"
                className={`mt-4 min-h-[50px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
                onPress={openGeneric}
                testID="add-card-generic-path"
              >
                <AppText className={`text-center text-base font-extrabold ${TEXT.heading}`}>
                  {t('לא מוצאים? הזנה ידנית')}
                </AppText>
              </Pressable>
            </View>
          ) : null}

          {path === 'generic' ? (
            <View testID="add-card-generic-form">
              <Pressable
                accessibilityRole="button"
                className="mb-3 min-h-[44px] justify-center"
                onPress={backToSearch}
                testID="add-card-back-to-search"
              >
                <AppText className={`text-sm font-bold ${ACCENT.text}`}>{t('חזרה לחיפוש')}</AppText>
              </Pressable>
              {detailsForm}
            </View>
          ) : null}

          {path === 'catalog' ? (
            <View testID="add-card-catalog-form">
              <Pressable
                accessibilityRole="button"
                className="mb-3 min-h-[44px] justify-center"
                onPress={backToSearch}
                testID="add-card-back-to-search"
              >
                <AppText className={`text-sm font-bold ${ACCENT.text}`}>{t('חזרה לחיפוש')}</AppText>
              </Pressable>
              {detailsForm}
            </View>
          ) : null}
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
