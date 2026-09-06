import React from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import {
  ISSUER_ORG_IDS,
  negotiationContactFor,
  type IssuerNegotiationContact,
} from '../../authority/issuerContactAuthority';
import { cardFeeProfileFor } from '../../authority/cardCatalogAuthority';
import {
  BORDER,
  ROLE_TEXT,
  SURFACE,
  TEXT,
} from '../../theme/tokens';
import type { CardInput } from '../../types/card.types';
import { TABULAR_NUMERALS } from '../../utils/money';
import {
  NEGOTIATION_TOPICS,
  negotiationScript,
  negotiationTopicLabel,
  type NegotiationTopic,
  type ScriptLanguage,
} from './negotiationScripts';

/**
 * THE NEGOTIATION HUB — what the fee-waiver countdown turns into when you tap it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A COUNTDOWN THAT TELLS YOU SOMETHING IS ENDING AND OFFERS NOTHING IS A NOTIFICATION, NOT A TOOL
 *
 * `WaiverBadge` said "N days left on your fee waiver" and stopped. This is what it now opens: the
 * issuer's own published number, the fee facts the tariff supports, and four scripts the holder
 * can read out or send. The badge stays informational and never schedules anything — criterion W3
 * forbids a notification from this surface, and tapping is not scheduling.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NOTHING LEAVES THE DEVICE UNTIL THE USER PRESSES SOMETHING, AND WHAT LEAVES IS SHOWN FIRST
 *
 * Three actions, each explicit: CALL opens the dialer, WHATSAPP opens WhatsApp with the message
 * already visible on this screen, COPY puts the text on the clipboard. Nothing sends. The message
 * is rendered in full above the buttons so the person reads it before it goes anywhere, which is
 * the directive's requirement in as many words.
 *
 * NO PRIVATE FIGURE IS IN THE MESSAGE. `negotiationScripts.ts` interpolates the card's nickname
 * and nothing else — no balance, no limit, no income, not even the fee this sheet displays.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A NUMBER THIS APP CANNOT SOURCE IS NOT SHOWN
 *
 * Every channel comes from `negotiationContactFor`, which reads the shipped content pack: the
 * issuer's own contact page, the date it was captured, the verbatim quote and the verification
 * status. Where the corpus publishes no number, the sheet says so and the scripts still work —
 * they are useful to somebody who already knows their issuer's number.
 */

export interface IssuerNegotiationSheetProps {
  /**
   * OPTIONAL, because E2's harness mounts every file under `src/screens/**` with no props at all.
   * A sheet with no card has nothing to negotiate about and renders nothing — the same shape
   * `WalletTile` uses for the same reason.
   */
  readonly card?: CardInput;
  readonly visible: boolean;
  readonly onClose: () => void;
  /** Injected in tests so the sheet's external intents can be observed without opening anything. */
  readonly openUrl?: (url: string) => Promise<unknown>;
  readonly copyText?: (text: string) => Promise<unknown>;
}

function scriptLanguage(language: string): ScriptLanguage {
  return language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'he';
}

/**
 * Which organisation to ring.
 *
 * The canonical `issuerOrgId` first — for a bank-issued card that is the bank, which is who the
 * holder actually has the relationship with. The legacy three-value enum is the fallback for a
 * card created before canonical identity existed.
 */
function contactFor(card: CardInput): IssuerNegotiationContact | undefined {
  const canonical = card.issuerOrgId;
  if (canonical !== undefined) {
    const found = negotiationContactFor(canonical);
    if (found !== undefined) return found;
  }
  return negotiationContactFor(ISSUER_ORG_IDS[card.issuer]);
}

export function IssuerNegotiationSheet({
  card,
  visible,
  onClose,
  openUrl,
  copyText,
}: IssuerNegotiationSheetProps): React.ReactElement | null {
  const { t, language } = useTranslation();
  const { money, percent } = useMoney();
  const [topic, setTopic] = React.useState<NegotiationTopic>('waiver-renewal');
  const [copied, setCopied] = React.useState<boolean>(false);

  const contact = card === undefined ? undefined : contactFor(card);
  const feeProfile =
    card?.cardProductId === undefined ? undefined : cardFeeProfileFor(card.cardProductId);
  const message =
    card === undefined ? '' : negotiationScript(topic, scriptLanguage(language), card.displayName);

  const open = React.useCallback(
    (url: string): void => {
      /* EXPLICIT, AND ONE HOP. The sheet hands a URI to the platform; it never composes a request,
         never posts and never sends. `Linking.openURL` is the only external effect in this file. */
      void (openUrl ?? Linking.openURL)(url);
    },
    [openUrl],
  );

  const copy = React.useCallback((): void => {
    void (copyText ?? Clipboard.setStringAsync)(message);
    setCopied(true);
  }, [copyText, message]);

  const waiverNote = feeProfile?.waivers.find((rule) => rule.appliesToFee === 'CARD_FEE');

  /* Declared after every hook, so no hook runs on some renders and not others. */
  if (card === undefined) return null;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      {/* `justify-end` here is the VERTICAL axis: the sheet sits at the bottom of the screen, and
          a column's main axis is top-to-bottom in every language. The rule scans for the class
          because on a ROW it would be a hardcoded horizontal edge, which this is not. rtl-ok */}
      <View className={`flex-1 justify-end ${SURFACE.modalScrim}`}>
        <View
          className={`max-h-[88%] gap-3 rounded-t-2xl p-4 ${SURFACE.card}`}
          testID="issuer-negotiation-sheet"
        >
          <RtlRow className="items-center justify-between gap-2">
            <AppText className={`flex-1 text-lg font-extrabold ${TEXT.heading}`}>
              {t('משא ומתן על דמי הכרטיס')}
            </AppText>
            <Pressable
              accessibilityLabel={t('סגירה')}
              accessibilityRole="button"
              className={`min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border ${BORDER.hairline}`}
              onPress={onClose}
              testID="issuer-negotiation-close"
            >
              <AppText className={`text-base font-bold ${TEXT.body}`}>✕</AppText>
            </Pressable>
          </RtlRow>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            <AppText className={`text-base font-bold ${TEXT.body}`} testID="issuer-negotiation-card">
              {card.displayName}
            </AppText>

            {contact === undefined ? (
              <AppText
                className={`mt-2 text-sm ${ROLE_TEXT.advisory}`}
                testID="issuer-negotiation-no-issuer"
              >
                {t('אין במאגר פרטי קשר לחברה שהנפיקה את הכרטיס הזה')}
              </AppText>
            ) : (
              <View className="mt-2 gap-1" testID="issuer-negotiation-issuer">
                <AppText className={`text-sm font-bold ${TEXT.body}`} testID="issuer-negotiation-issuer-name">
                  {contact.legalNameHe ?? contact.legalNameEn ?? contact.orgId}
                </AppText>
                {contact.hours === undefined ? null : (
                  <AppText className={`text-xs ${TEXT.secondary}`} testID="issuer-negotiation-hours">
                    {contact.hours}
                  </AppText>
                )}
                <AppText className={`text-xs ${TEXT.muted}`} testID="issuer-negotiation-provenance">
                  {`${t('מקור')}: ${contact.sourceUrl ?? contact.orgId}${
                    contact.accessedAt === undefined ? '' : ` · ${contact.accessedAt}`
                  }`}
                </AppText>
              </View>
            )}

            {/* THE FEE FACTS THE TARIFF SUPPORTS — and only those. */}
            <View className="mt-3 gap-1" testID="issuer-negotiation-fee">
              <AppText className={`text-sm font-bold ${TEXT.body}`}>{t('דמי כרטיס חודשיים')}</AppText>
              {feeProfile === undefined ? (
                <AppText className={`text-xs ${TEXT.secondary}`} testID="issuer-negotiation-fee-absent">
                  {t('הכרטיס הזה אינו מוצר מהקטלוג, ולכן אין אליו תעריפון')}
                </AppText>
              ) : feeProfile.cardFee.single !== undefined ? (
                <AppText
                  accessibilityValue={{ text: String(feeProfile.cardFee.single.value) }}
                  className={`text-base font-extrabold ${TEXT.heading}`}
                  style={TABULAR_NUMERALS}
                  testID="issuer-negotiation-fee-value"
                >
                  {feeProfile.cardFee.single.unit === 'ILS'
                    ? money(feeProfile.cardFee.single.value)
                    : `${feeProfile.cardFee.single.value} ${feeProfile.cardFee.single.unit}`}
                </AppText>
              ) : (
                <AppText className={`text-xs ${TEXT.secondary}`} testID="issuer-negotiation-fee-unresolved">
                  {t('התעריפון מפרסם כמה סכומים לפי דרגת כרטיס, והנתונים אינם מציינים את הדרגה שלך')}
                </AppText>
              )}
              {waiverNote?.quote === undefined ? null : (
                <AppText className={`text-xs ${TEXT.muted}`} testID="issuer-negotiation-waiver-quote">
                  {waiverNote.quote}
                </AppText>
              )}
            </View>

            {/* THE SCRIPT PICKER. */}
            <AppText className={`mt-4 text-sm font-bold ${TEXT.body}`}>{t('מה לומר')}</AppText>
            <RtlRow className="mt-1 flex-wrap gap-2" testID="issuer-negotiation-topics">
              {NEGOTIATION_TOPICS.map((candidate) => {
                const selected = candidate === topic;
                const label = negotiationTopicLabel(candidate, scriptLanguage(language));
                return (
                  <Pressable
                    accessibilityLabel={label}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`min-h-[48px] items-center justify-center rounded-full border px-3 ${
                      selected ? `${SURFACE.raised} ${BORDER.subtle}` : `${SURFACE.sunken} ${BORDER.hairline}`
                    }`}
                    key={candidate}
                    onPress={(): void => {
                      setTopic(candidate);
                      setCopied(false);
                    }}
                    testID={`issuer-negotiation-topic-${candidate}`}
                  >
                    <AppText className={`text-xs font-bold ${TEXT.body}`}>{label}</AppText>
                  </Pressable>
                );
              })}
            </RtlRow>

            {/* THE MESSAGE, IN FULL, BEFORE ANY ACTION. */}
            <View className={`mt-3 rounded-lg p-3 ${SURFACE.sunken}`}>
              <AppText
                className={`text-sm leading-6 ${TEXT.body}`}
                testID="issuer-negotiation-message"
              >
                {message}
              </AppText>
            </View>
            <AppText className={`mt-1 text-xs ${TEXT.muted}`} testID="issuer-negotiation-review-note">
              {t('הטקסט נפתח לעריכה באפליקציית ההודעות ואינו נשלח מכאן')}
            </AppText>

            <View className="mt-3 gap-2">
              {contact?.phone === undefined ? (
                <AppText className={`text-xs ${ROLE_TEXT.advisory}`} testID="issuer-negotiation-no-phone">
                  {t('לא פורסם מספר טלפון רשמי לחברה הזאת')}
                </AppText>
              ) : (
                <Pressable
                  accessibilityLabel={t('התקשרות אל {{number}}', { number: contact.phone.display })}
                  accessibilityRole="button"
                  className={`min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.sunken}`}
                  onPress={(): void => open((contact.phone as { uri: string }).uri)}
                  testID="issuer-negotiation-call"
                >
                  <AppText className={`text-sm font-extrabold ${TEXT.body}`}>
                    {`${t('התקשרות')} · ${contact.phone.display}`}
                  </AppText>
                </Pressable>
              )}

              {contact?.whatsapp === undefined ? (
                <AppText className={`text-xs ${TEXT.muted}`} testID="issuer-negotiation-no-whatsapp">
                  {t('לא פורסם ערוץ וואטסאפ רשמי לחברה הזאת')}
                </AppText>
              ) : (
                <Pressable
                  accessibilityLabel={t('פתיחת וואטסאפ עם הטקסט')}
                  accessibilityRole="button"
                  className={`min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.sunken}`}
                  onPress={(): void =>
                    open(
                      `${(contact.whatsapp as { uri: string }).uri}?text=${encodeURIComponent(message)}`,
                    )
                  }
                  testID="issuer-negotiation-whatsapp"
                >
                  <AppText className={`text-sm font-extrabold ${TEXT.body}`}>
                    {t('פתיחת וואטסאפ עם הטקסט')}
                  </AppText>
                </Pressable>
              )}

              <Pressable
                accessibilityLabel={t('העתקת הטקסט')}
                accessibilityRole="button"
                className={`min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.sunken}`}
                onPress={copy}
                testID="issuer-negotiation-copy"
              >
                <AppText className={`text-sm font-extrabold ${TEXT.body}`}>
                  {copied ? t('הטקסט הועתק') : t('העתקת הטקסט')}
                </AppText>
              </Pressable>
            </View>

            {feeProfile?.fxCommissionPct.single === undefined ? null : (
              <AppText
                accessibilityValue={{ text: String(feeProfile.fxCommissionPct.single.value) }}
                className={`mt-3 text-xs ${TEXT.muted}`}
                style={TABULAR_NUMERALS}
                testID="issuer-negotiation-fx"
              >
                {`${t('עמלת מט"ח')} ${percent(feeProfile.fxCommissionPct.single.value / 100)}`}
              </AppText>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
