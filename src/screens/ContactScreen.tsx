import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import {
  negotiationContactFor,
  ISSUER_ORG_IDS,
} from '../authority/issuerContactAuthority';
import type { IssuerContact, ProblemType } from '../types/contact.types';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

const PROBLEM_OPTIONS: readonly {
  readonly id: ProblemType;
  readonly label: string;
}[] = [
  { id: 'wrong_charge', label: 'חיוב שגוי' },
  { id: 'cancel_transaction', label: 'ביטול עסקה' },
  { id: 'charge_return', label: 'חזרת חיוב' },
  { id: 'general_question', label: 'שאלה כללית' },
];

/**
 * THE THREE CARD COMPANIES, FROM THE SHIPPED CONTENT PACK — not from this file.
 *
 * This list used to be three hardcoded numbers: `1-800-000-020`, `1-800-444-006`,
 * `1-800-225-525`. None of them is in the canonical corpus, and the corpus disagrees with all
 * three — it records max on `03-6178888`, CAL on `03-5726444` and Isracard on `*6272`, each
 * captured from the issuer's own contact page on 2026-08-19 and carrying `VERIFIED_OFFICIAL`.
 * Three numbers nobody could source, on a screen whose entire purpose is to be dialled.
 *
 * They are read through the same authority the Negotiation Hub uses, so the two surfaces cannot
 * print different numbers for one issuer, and an organisation the corpus does not publish a
 * number for is shown WITHOUT a call button rather than with a plausible one.
 */
const ISSUER_CONTACTS: readonly IssuerContact[] = Object.values(ISSUER_ORG_IDS)
  .map((orgId) => negotiationContactFor(orgId))
  .filter((contact): contact is NonNullable<typeof contact> => contact !== undefined)
  .map((contact): IssuerContact => ({
    name: contact.legalNameHe ?? contact.legalNameEn ?? contact.orgId,
    phone: contact.phone?.display ?? '',
    ...(contact.phone === undefined ? {} : { telUri: contact.phone.uri }),
    ...(contact.sourceUrl === undefined ? {} : { sourceUrl: contact.sourceUrl }),
  }));

const SCRIPTS: Record<ProblemType, readonly [string, string]> = {
  wrong_charge: [
    'שלום, אני רוצה לדווח על חיוב שגוי בחשבוני.',
    'יכול/ה לעזור לי לבדוק את הפעולה?',
  ],
  cancel_transaction: [
    'שלום, אני רוצה לבדוק אפשרות לביטול עסקה שבוצעה בכרטיס.',
    'אפשר להסביר לי מה נדרש כדי לפתוח את הבקשה?',
  ],
  charge_return: [
    'שלום, קיבלתי התרעה או חשש לחזרת חיוב בכרטיס.',
    'אפשר לבדוק את מצב החיוב ומה אפשר לעשות עכשיו?',
  ],
  general_question: [
    'שלום, יש לי שאלה לגבי פעילות או תנאים בכרטיס האשראי.',
    'אשמח שתעזרו לי להבין את הפרטים לפני שאמשיך.',
  ],
};

/**
 * The dial URI, from the authority that built it.
 *
 * It used to be assembled here by stripping hyphens, which cannot express an Israeli `*NNNN`
 * service line — `tel:6272` reaches nobody. The URI now travels with the number.
 */
function getTelUrl(issuer: IssuerContact): string | undefined {
  return issuer.telUri;
}

export function ContactScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const [selectedProblem, setSelectedProblem] =
    useState<ProblemType>('wrong_charge');
  const script = SCRIPTS[selectedProblem];

  return (
    <RtlScreen className={`${SURFACE.page}`}>
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
      <View className="min-h-full w-full p-4">
        <AppText
          className={`mb-4 text-2xl font-extrabold ${TEXT.heading}`}
          style={{ color: theme.bankColor }}
        >
          {t('צור קשר עם חברת האשראי')}
        </AppText>

        <RtlRow className="mb-4 w-full flex-wrap gap-2">
          {PROBLEM_OPTIONS.map(option => {
            const isSelected = option.id === selectedProblem;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`min-h-[48px] justify-center rounded-lg border px-3 ${
                  isSelected
                    ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                    : `${BORDER.hairline} ${SURFACE.card}`
                }`}
                key={option.id}
                onPress={(): void => setSelectedProblem(option.id)}
              >
                <AppText
                  className={`text-center text-sm font-bold ${ isSelected ? `${ACCENT.text}` : `${TEXT.secondary}` }`}
                >
                  {t(option.label)}
                </AppText>
              </Pressable>
            );
          })}
        </RtlRow>

        <View className="w-full gap-3">
          {ISSUER_CONTACTS.map((issuer: IssuerContact): React.ReactElement => (
            <View
              className={`w-full rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
              key={issuer.name}
            >
              <AppText
                className={`text-xl font-extrabold ${TEXT.heading}`}
                style={{ color: theme.companyAccent }}
              >
                {issuer.name}
              </AppText>
              {issuer.phone === '' ? (
                <AppText className={`mt-1 text-sm ${TEXT.secondary}`}>
                  {t('לא פורסם מספר טלפון מאומת לחברה הזאת')}
                </AppText>
              ) : (
                <AppText
                  className={`mt-1 text-base font-extrabold ${ACCENT.text}`}
                >
                  {issuer.phone}
                </AppText>
              )}

              <View className={`mt-3 rounded-lg p-3 ${SURFACE.sunken}`}>
                <AppText
                  className={`mb-2 text-sm font-extrabold ${TEXT.body}`}
                >
                  {t('מה לומר')}
                </AppText>
                <AppText
                  className={`text-sm leading-6 ${TEXT.body}`}
                >
                  {t(script[0])}
                </AppText>
                <AppText
                  className={`text-sm leading-6 ${TEXT.body}`}
                >
                  {t(script[1])}
                </AppText>
              </View>

              {getTelUrl(issuer) === undefined ? null : (
              <Pressable
                accessibilityLabel={`${t('התקשר עכשיו')} — ${issuer.name}`}
                accessibilityRole="button"
                className={`mt-3 min-h-[48px] items-center justify-center rounded-lg ${SURFACE.inverse}`}
                onPress={(): Promise<void> => Linking.openURL(getTelUrl(issuer) as string)}
              >
                <AppText
                  className={`text-center text-sm font-extrabold ${TEXT.inverse}`}
                >
                  {t('התקשר עכשיו')}
                </AppText>
              </Pressable>
              )}
              {issuer.sourceUrl === undefined ? null : (
                <AppText className={`mt-2 text-xs ${TEXT.muted}`}>
                  {`${t('מקור')}: ${issuer.sourceUrl}`}
                </AppText>
              )}
            </View>
          ))}
        </View>
      </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
