import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useAppDirection } from '../../hooks/useAppDirection';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import {
  availableBanks,
  availableCardCompanies,
  cardFeeProfileFor,
  cardProductsForIssuer,
  compatibleProgrammesForProduct,
  issuerByOrgId,
  issuerDisplayName,
  networkByIdCatalog,
  productDisplayName,
  searchProductsForIssuer,
  type CatalogIssuer,
  type CatalogProduct,
} from '../../authority/cardCatalogAuthority';
import { ACCENT, BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';

/**
 * THE GUIDED CARD PICKER — card nature, then issuer, then product, then programme.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY LIST IS DERIVED, NONE IS TYPED
 *
 * The banks are the organisations of kind `BANK` that currently have at least one selectable
 * product; the card companies are the same query with the other kind. A hardcoded bank list would
 * be a second home for a fact the catalog owns, and the first thing it would do is keep offering a
 * bank whose products were retired. `org:union` is the worked example: it ships in the corpus,
 * it is `HISTORICAL_MERGED`, it has no current product, and it is therefore not offered.
 *
 * PRODUCTS ARE FILTERED BY ISSUER, NEVER BY OPERATOR. A Bank Leumi card operated by CAL is Leumi's
 * product; offering it under CAL would tell somebody their bank card belongs to a card company.
 *
 * PROGRAMMES COME FROM THE ESTATE'S OWN EDGE, with the estate's own `attachmentBasis` shown beside
 * each one. 72 of 378 current products carry an edge; the other 306 skip this step, because an
 * absent edge is an absence of evidence and not a statement that the product has no club. Nothing
 * is inferred from a similar display name.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE REVIEW SHOWS WHAT THE ESTATE VERIFIED AND SAYS SO WHERE IT DID NOT
 *
 * FX commission and the foreign-ATM percentage are resolved per card and VERIFIED on all 378
 * current products, so they are shown as figures. The monthly card fee usually is NOT resolvable:
 * the tariff publishes several amounts by a card LEVEL no field on a product row names, and the
 * review says that rather than picking one.
 *
 * NO TIER FILTER IS OFFERED. The estate models no tier — `productType` carries 66 distinct values
 * and none of them is Gold or Platinum — so a tier control would be a dimension this app invented.
 */

export type GuidedNature = 'BANK' | 'CARD_COMPANY';

export interface GuidedSelection {
  readonly product: CatalogProduct;
  readonly issuer: CatalogIssuer | undefined;
  readonly programmeNodeIds: readonly string[];
}

export interface GuidedCardPickerProps {
  /** Called with the whole selection when the user confirms the review. */
  readonly onConfirm: (selection: GuidedSelection) => void;
  readonly onCancel: () => void;
}

type Step = 'nature' | 'issuer' | 'product' | 'programme' | 'review';

export function GuidedCardPicker({
  onConfirm,
  onCancel,
}: GuidedCardPickerProps): React.ReactElement {
  const { t, language } = useTranslation();
  const { money, percent } = useMoney();
  const { textAlign, writingDirection } = useAppDirection();

  const [step, setStep] = React.useState<Step>('nature');
  const [nature, setNature] = React.useState<GuidedNature | null>(null);
  const [issuerOrgId, setIssuerOrgId] = React.useState<string | null>(null);
  const [product, setProduct] = React.useState<CatalogProduct | null>(null);
  const [programmeIds, setProgrammeIds] = React.useState<readonly string[]>([]);
  const [productQuery, setProductQuery] = React.useState<string>('');

  const lang = language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'he';

  const issuers = React.useMemo(
    (): readonly CatalogIssuer[] =>
      nature === 'BANK'
        ? availableBanks()
        : nature === 'CARD_COMPANY'
          ? availableCardCompanies()
          : [],
    [nature],
  );

  const products = React.useMemo(
    (): readonly CatalogProduct[] =>
      issuerOrgId === null
        ? []
        : productQuery.trim() === ''
          ? cardProductsForIssuer(issuerOrgId)
          : searchProductsForIssuer(issuerOrgId, productQuery),
    [issuerOrgId, productQuery],
  );

  const programmes = React.useMemo(
    () => (product === null ? [] : compatibleProgrammesForProduct(product.cardId)),
    [product],
  );

  const feeProfile = React.useMemo(
    () => (product === null ? undefined : cardFeeProfileFor(product.cardId)),
    [product],
  );

  const chooseNature = (chosen: GuidedNature): void => {
    setNature(chosen);
    setIssuerOrgId(null);
    setProduct(null);
    setProgrammeIds([]);
    setStep('issuer');
  };

  const chooseIssuer = (orgId: string): void => {
    setIssuerOrgId(orgId);
    setProduct(null);
    setProgrammeIds([]);
    setProductQuery('');
    setStep('product');
  };

  const chooseProduct = (chosen: CatalogProduct): void => {
    setProduct(chosen);
    setProgrammeIds([]);
    /* NO PROGRAMME EDGE, NO PROGRAMME STEP. Asking a question with no answers is a step that
       teaches the user the app is broken. */
    setStep(compatibleProgrammesForProduct(chosen.cardId).length === 0 ? 'review' : 'programme');
  };

  const toggleProgramme = (nodeId: string): void => {
    setProgrammeIds((current) =>
      current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId],
    );
  };

  const back = (): void => {
    if (step === 'nature') onCancel();
    else if (step === 'issuer') setStep('nature');
    else if (step === 'product') setStep('issuer');
    else if (step === 'programme') setStep('product');
    else setStep(programmes.length === 0 ? 'product' : 'programme');
  };

  const selectedIssuer = issuerOrgId === null ? undefined : issuerByOrgId(issuerOrgId);

  const optionButton = (
    label: string,
    testID: string,
    onPress: () => void,
    selected: boolean,
    hint?: string,
  ): React.ReactElement => (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`min-h-[48px] justify-center rounded-lg border px-3 py-2 ${
        selected ? `${ACCENT.border} ${ACCENT.surfaceStrong}` : `${BORDER.hairline} ${SURFACE.card}`
      }`}
      key={testID}
      onPress={onPress}
      testID={testID}
    >
      <AppText className={`text-sm font-extrabold ${TEXT.heading}`}>{label}</AppText>
      {hint === undefined ? null : (
        <AppText className={`mt-1 text-xs ${TEXT.secondary}`}>{hint}</AppText>
      )}
    </Pressable>
  );

  return (
    <View className="gap-3" testID="guided-card-picker">
      <RtlRow className="items-center justify-between gap-2">
        <AppText className={`flex-1 text-base font-extrabold ${TEXT.heading}`}>
          {step === 'nature'
            ? t('סוג הכרטיס')
            : step === 'issuer'
              ? nature === 'BANK'
                ? t('בחירת בנק')
                : t('בחירת חברת אשראי')
              : step === 'product'
                ? t('בחירת כרטיס')
                : step === 'programme'
                  ? t('מועדון או תוכנית')
                  : t('סיכום לפני שמירה')}
        </AppText>
        <Pressable
          accessibilityLabel={t('חזרה')}
          accessibilityRole="button"
          className={`min-h-[48px] justify-center rounded-lg border px-3 ${BORDER.hairline}`}
          onPress={back}
          testID="guided-card-picker-back"
        >
          <AppText className={`text-sm font-bold ${TEXT.body}`}>{t('חזרה')}</AppText>
        </Pressable>
      </RtlRow>

      {step === 'nature' ? (
        <View className="gap-2" testID="guided-step-nature">
          {optionButton(
            t('כרטיס בנקאי'),
            'guided-nature-BANK',
            (): void => chooseNature('BANK'),
            nature === 'BANK',
            t('כרטיס שהונפק דרך הבנק שלך'),
          )}
          {optionButton(
            t('כרטיס חוץ בנקאי'),
            'guided-nature-CARD_COMPANY',
            (): void => chooseNature('CARD_COMPANY'),
            nature === 'CARD_COMPANY',
            t('כרטיס שהונפק ישירות על ידי חברת אשראי'),
          )}
        </View>
      ) : null}

      {step === 'issuer' ? (
        <View className="gap-2" testID="guided-step-issuer">
          {issuers.map((issuer) =>
            optionButton(
              issuerDisplayName(issuer, lang),
              `guided-issuer-${issuer.orgId}`,
              (): void => chooseIssuer(issuer.orgId),
              issuerOrgId === issuer.orgId,
            ),
          )}
        </View>
      ) : null}

      {step === 'product' ? (
        <View className="gap-2" testID="guided-step-product">
          <TextInput
            accessibilityLabel={t('חיפוש בכרטיסים של המנפיק')}
            className={`min-h-[48px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
            onChangeText={setProductQuery}
            placeholder={t('חיפוש בכרטיסים של המנפיק')}
            style={{ textAlign, writingDirection }}
            testID="guided-product-search"
            value={productQuery}
          />
          {products.length === 0 ? (
            <AppText className={`text-sm ${TEXT.secondary}`} testID="guided-product-empty">
              {t('לא נמצא כרטיס מתאים אצל המנפיק הזה')}
            </AppText>
          ) : null}
          {products.map((candidate) => {
            const networks = candidate.networkIds
              .map((id) => networkByIdCatalog(id))
              .filter((n): n is NonNullable<typeof n> => n !== undefined)
              .map((n) => (lang === 'he' ? n.nameHe ?? n.nameEn ?? n.slug : n.nameEn ?? n.slug))
              .join(' · ');
            return optionButton(
              productDisplayName(candidate, lang),
              `guided-product-${candidate.cardId}`,
              (): void => chooseProduct(candidate),
              product?.cardId === candidate.cardId,
              networks === '' ? undefined : networks,
            );
          })}
        </View>
      ) : null}

      {step === 'programme' ? (
        <View className="gap-2" testID="guided-step-programme">
          <AppText className={`text-xs ${TEXT.secondary}`}>
            {t('רק מועדונים שיש להם קשר מתועד לכרטיס הזה')}
          </AppText>
          {programmes.map((link) =>
            optionButton(
              link.programme.displayName,
              `guided-programme-${link.programme.nodeId}`,
              (): void => toggleProgramme(link.programme.nodeId),
              programmeIds.includes(link.programme.nodeId),
              link.attachmentBasis,
            ),
          )}
          <Pressable
            accessibilityLabel={t('בלי מועדון או תוכנית')}
            accessibilityRole="button"
            className={`min-h-[48px] justify-center rounded-lg border px-3 ${BORDER.hairline} ${SURFACE.card}`}
            onPress={(): void => {
              setProgrammeIds([]);
              setStep('review');
            }}
            testID="guided-programme-none"
          >
            <AppText className={`text-sm font-bold ${TEXT.body}`}>
              {t('בלי מועדון או תוכנית')}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityLabel={t('המשך לסיכום')}
            accessibilityRole="button"
            className={`min-h-[48px] items-center justify-center rounded-lg ${ACCENT.solid}`}
            onPress={(): void => setStep('review')}
            testID="guided-programme-continue"
          >
            <AppText className={`text-base font-extrabold ${TEXT.onAccent}`}>
              {t('המשך לסיכום')}
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {step === 'review' && product !== null ? (
        <View className="gap-2" testID="guided-step-review">
          <AppText className={`text-sm font-bold ${TEXT.body}`} testID="guided-review-issuer">
            {`${t('מנפיק')}: ${
              selectedIssuer === undefined ? product.issuerOrgId : issuerDisplayName(selectedIssuer, lang)
            }`}
          </AppText>
          <AppText className={`text-sm font-bold ${TEXT.body}`} testID="guided-review-product">
            {`${t('כרטיס')}: ${productDisplayName(product, lang)}`}
          </AppText>
          {product.networkIds.length === 0 ? (
            <AppText className={`text-xs ${TEXT.secondary}`} testID="guided-review-network-unknown">
              {t('רשת התשלומים לא אושרה במאגר')}
            </AppText>
          ) : (
            <AppText className={`text-xs ${TEXT.body}`} testID="guided-review-network">
              {`${t('רשת')}: ${product.networkIds
                .map((id) => networkByIdCatalog(id))
                .filter((n): n is NonNullable<typeof n> => n !== undefined)
                .map((n) => (lang === 'he' ? n.nameHe ?? n.nameEn ?? n.slug : n.nameEn ?? n.slug))
                .join(' · ')}`}
            </AppText>
          )}
          {programmeIds.length === 0 ? null : (
            <AppText className={`text-xs ${TEXT.body}`} testID="guided-review-programmes">
              {`${t('מועדון')}: ${programmes
                .filter((link) => programmeIds.includes(link.programme.nodeId))
                .map((link) => link.programme.displayName)
                .join(' · ')}`}
            </AppText>
          )}

          {/* THE VERIFIED FEES — figures where the estate resolved one, a stated absence where not. */}
          {feeProfile?.fxCommissionPct.single === undefined ? null : (
            <RtlRow className="items-center gap-2" testID="guided-review-fx">
              <AppText className={`text-xs ${TEXT.body}`}>{t('עמלת מט"ח')}</AppText>
              <AppText
                accessibilityValue={{ text: String(feeProfile.fxCommissionPct.single.value) }}
                className={`text-xs font-extrabold ${TEXT.heading}`}
                style={TABULAR_NUMERALS}
              >
                {percent(feeProfile.fxCommissionPct.single.value / 100)}
              </AppText>
              <ProvenanceChip
                testID="guided-review-fx-chip"
                view={{ chip: 'VERIFIED', stale: false }}
              />
            </RtlRow>
          )}
          {feeProfile?.foreignAtmPct.single === undefined ? null : (
            <RtlRow className="items-center gap-2" testID="guided-review-atm">
              <AppText className={`text-xs ${TEXT.body}`}>{t('עמלת משיכת מזומן בחו"ל')}</AppText>
              <AppText
                accessibilityValue={{ text: String(feeProfile.foreignAtmPct.single.value) }}
                className={`text-xs font-extrabold ${TEXT.heading}`}
                style={TABULAR_NUMERALS}
              >
                {percent(feeProfile.foreignAtmPct.single.value / 100)}
              </AppText>
            </RtlRow>
          )}
          {feeProfile === undefined ? null : feeProfile.cardFee.single !== undefined ? (
            <RtlRow className="items-center gap-2" testID="guided-review-card-fee">
              <AppText className={`text-xs ${TEXT.body}`}>{t('דמי כרטיס חודשיים')}</AppText>
              <AppText
                accessibilityValue={{ text: String(feeProfile.cardFee.single.value) }}
                className={`text-xs font-extrabold ${TEXT.heading}`}
                style={TABULAR_NUMERALS}
              >
                {feeProfile.cardFee.single.unit === 'ILS'
                  ? money(feeProfile.cardFee.single.value)
                  : `${feeProfile.cardFee.single.value} ${feeProfile.cardFee.single.unit}`}
              </AppText>
            </RtlRow>
          ) : (
            <AppText className={`text-xs ${ROLE_TEXT.advisory}`} testID="guided-review-card-fee-unresolved">
              {t('התעריפון מפרסם כמה סכומים לפי דרגת כרטיס, והנתונים אינם מציינים את הדרגה שלך')}
            </AppText>
          )}

          <Pressable
            accessibilityLabel={t('אישור ומעבר לפרטי הכרטיס')}
            accessibilityRole="button"
            className={`min-h-[48px] items-center justify-center rounded-lg ${ACCENT.solid}`}
            onPress={(): void =>
              onConfirm({ product, issuer: selectedIssuer, programmeNodeIds: programmeIds })
            }
            testID="guided-review-confirm"
          >
            <AppText className={`text-base font-extrabold ${TEXT.onAccent}`}>
              {t('אישור ומעבר לפרטי הכרטיס')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
