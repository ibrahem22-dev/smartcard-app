import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { ProvenanceChip } from '../components/ProvenanceChip';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import type { ProvenanceRecord } from '../authority/provenanceChip';
import {
  catalogDisplayName,
  catalogFxPrefill,
  catalogPrefillView,
  currentCatalogInstitutions,
  searchCatalog,
  unknownFieldView,
  userEnteredView,
  writeWizardCard,
  type CatalogProductHit,
  type ClubResolution,
} from '../authority/addCardCatalog';
import { ClubResolver } from './addCard/ClubResolver';
import { useAppDirection } from '../hooks/useAppDirection';
import { useTranslation } from '../hooks/useTranslation';
import type { WalletStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import { ACCENT, BORDER, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';
import { CardIssuer } from '../types/card.types';
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

function FieldHeading({
  label,
  fieldId,
  view,
}: {
  readonly label: string;
  readonly fieldId: string;
  readonly view: ProvenanceRecord;
}): React.ReactElement {
  return (
    <RtlRow className="items-center justify-between gap-2">
      <AppText className={`text-sm font-bold ${TEXT.body}`}>{label}</AppText>
      <View testID={`add-card-field-${fieldId}`}>
        <ProvenanceChip view={view} />
      </View>
    </RtlRow>
  );
}

export function AddCardScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { textAlign, writingDirection } = useAppDirection();
  const navigation = useNavigation<AddCardNavigation>();
  const addVaultEntry = useCardsStore(state => state.addVaultEntry);
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
    const fx = catalogFxPrefill(hit.cardId);
    if (fx !== null) {
      setFeePercentText(fx.percentText);
    }
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

    addVaultEntry(
      writeWizardCard({
        displayName: displayName.trim(),
        last4,
        issuer,
        creditLimit,
        currentBalance,
        ...(billingDay === undefined ? {} : { billingDayOfMonth: billingDay }),
        ...(fee === undefined ? {} : { foreignTransactionFee: fee }),
        ...(selected === null ? {} : { catalogCardId: selected.cardId }),
        ...(clubResolution?.outcome === 'unknown' ? { unknownClub: true } : {}),
      }),
    );
    navigation.goBack();
  }

  const inputStyle = { textAlign, writingDirection };
  const inputClass = `min-h-[50px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`;
  const labelClass = `text-sm font-bold ${TEXT.body}`;

  const catalogName = selected !== null ? catalogDisplayName(selected) : '';
  const catalogIssuer = selected !== null ? issuerFromCatalogHit(selected) : null;
  const fxPrefill = selected !== null ? catalogFxPrefill(selected.cardId) : null;

  const nameView =
    path === 'catalog' && displayName === catalogName
      ? catalogPrefillView()
      : displayName.trim() === ''
        ? unknownFieldView()
        : userEnteredView();
  const issuerView =
    path === 'catalog' && issuer !== null && issuer === catalogIssuer
      ? catalogPrefillView()
      : issuer === null
        ? unknownFieldView()
        : userEnteredView();
  const last4View = last4.trim() === '' ? unknownFieldView() : userEnteredView();
  const limitView = creditLimitText.trim() === '' ? unknownFieldView() : userEnteredView();
  const balanceView = currentBalanceText.trim() === '' ? unknownFieldView() : userEnteredView();
  const billingView = billingDayText.trim() === '' ? unknownFieldView() : userEnteredView();
  const fxView =
    fxPrefill !== null && feePercentText === fxPrefill.percentText
      ? fxPrefill.view
      : feePercentText.trim() === ''
        ? unknownFieldView()
        : userEnteredView();

  const detailsForm = (
    <>
      <FieldHeading fieldId="displayName" label={t('שם הכרטיס')} view={nameView} />
      <TextInput
        className={inputClass}
        onChangeText={setDisplayName}
        style={inputStyle}
        testID="add-card-display-name"
        value={displayName}
      />

      <FieldHeading fieldId="issuer" label={t('חברת האשראי')} view={issuerView} />
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

      <FieldHeading fieldId="last4" label={t('4 ספרות אחרונות')} view={last4View} />
      <TextInput
        className={inputClass}
        keyboardType="number-pad"
        maxLength={4}
        onChangeText={(text): void => setLast4(text.replace(/\D/g, '').slice(0, 4))}
        style={inputStyle}
        testID="add-card-last4"
        value={last4}
      />

      <FieldHeading fieldId="creditLimit" label={t('מסגרת אשראי (₪)')} view={limitView} />
      <TextInput
        className={inputClass}
        keyboardType="decimal-pad"
        onChangeText={setCreditLimitText}
        style={inputStyle}
        value={creditLimitText}
      />

      <FieldHeading fieldId="currentBalance" label={t('חיוב נוכחי (₪)')} view={balanceView} />
      <TextInput
        className={inputClass}
        keyboardType="decimal-pad"
        onChangeText={setCurrentBalanceText}
        style={inputStyle}
        value={currentBalanceText}
      />

      <FieldHeading fieldId="billingDay" label={t('יום חיוב בחודש (אופציונלי)')} view={billingView} />
      <TextInput
        className={inputClass}
        keyboardType="number-pad"
        maxLength={2}
        onChangeText={setBillingDayText}
        style={inputStyle}
        value={billingDayText}
      />

      <FieldHeading fieldId="fxFee" label={t('עמלת המרת מט"ח % (אופציונלי)')} view={fxView} />
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
      <AppText className={`text-xs font-bold ${TEXT.muted}`}>{t('אפשר לתקן בכל עת')}</AppText>

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
        <View className="w-full gap-3 p-4" testID="add-card-wizard">
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
                  className={`min-h-[44px] items-center justify-center rounded-lg border px-3 ${
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
                      className={`min-h-[44px] items-center justify-center rounded-lg border px-3 ${
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
                    accessibilityLabel={catalogDisplayName(hit)}
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
