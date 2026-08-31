import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import {
  LEARN_CONTENT,
  type LearnContact,
  type LearnGlossaryTerm,
  type LearnRight,
  type LearnSourcedValue,
  type LearnVerificationStatus,
} from '../data/adapter/learn';
import { useTranslation, type UseTranslationResult } from '../hooks/useTranslation';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

type LearnSection = 'glossary' | 'rights' | 'contacts';
type Translate = UseTranslationResult['t'];

const CONTACT_FIELDS: readonly {
  readonly key: Exclude<keyof LearnContact, 'orgId' | 'slug' | 'lifecycleStatus' | 'notes'>;
  readonly label: string;
}[] = [
  { key: 'legalNameHe', label: 'שם משפטי בעברית' },
  { key: 'legalNameAr', label: 'שם משפטי בערבית' },
  { key: 'legalNameEn', label: 'שם משפטי באנגלית' },
  { key: 'customerServicePhone', label: 'טלפון שירות לקוחות' },
  { key: 'customerServiceHours', label: 'שעות שירות לקוחות' },
  { key: 'cardLostStolenPhone', label: 'אובדן או גניבת כרטיס' },
  { key: 'complaintsEmail', label: 'דוא״ל לתלונות' },
  { key: 'complaintsCommissionerUrl', label: 'נציב תלונות הציבור' },
  { key: 'disputeChannelUrl', label: 'ערוץ להכחשת עסקה' },
  { key: 'officialWebsite', label: 'אתר רשמי' },
  { key: 'accessibilityStatementUrl', label: 'הצהרת נגישות' },
  { key: 'arabicSiteUrl', label: 'אתר בערבית' },
];

function isLearnVerificationStatus(status: string): status is LearnVerificationStatus {
  switch (status) {
    case 'VERIFIED_OFFICIAL':
    case 'CORROBORATED':
    case 'SINGLE_SOURCE':
    case 'CONFLICTING':
    case 'DERIVED':
    case 'DERIVED_FROM_OFFICIAL':
    case 'NOT_PUBLISHED':
    case 'LOGIN_GATED':
    case 'CUSTOMER_SPECIFIC':
    case 'ESTIMATED':
    case 'HISTORICAL':
    case 'UNKNOWN_AFTER_RESEARCH':
    case 'UNKNOWN':
    case 'N_A':
      return true;
  }
  return false;
}

function verificationLabel(status: LearnVerificationStatus, t: Translate): string {
  switch (status) {
    case 'VERIFIED_OFFICIAL':
      return t('אומת מול מקור רשמי');
    case 'CORROBORATED':
      return t('אומת מול כמה מקורות');
    case 'SINGLE_SOURCE':
      return t('מבוסס על מקור יחיד');
    case 'CONFLICTING':
      return t('המקורות סותרים');
    case 'DERIVED':
      return t('נגזר מנתונים קיימים');
    case 'DERIVED_FROM_OFFICIAL':
      return t('נגזר ממקור רשמי');
    case 'NOT_PUBLISHED':
      return t('לא פורסם');
    case 'LOGIN_GATED':
      return t('דורש כניסה לחשבון');
    case 'CUSTOMER_SPECIFIC':
      return t('תלוי בלקוח');
    case 'ESTIMATED':
      return t('הערכה');
    case 'HISTORICAL':
      return t('מידע היסטורי');
    case 'UNKNOWN_AFTER_RESEARCH':
      return t('לא נמצא לאחר בדיקה');
    case 'UNKNOWN':
      return t('סטטוס לא ידוע');
    case 'N_A':
      return t('לא רלוונטי');
  }
}

function sourcedVerificationLabel(status: string, t: Translate): string {
  return isLearnVerificationStatus(status)
    ? verificationLabel(status, t)
    : t('סטטוס אימות שהאפליקציה לא מזהה');
}

function arabicStatusLabel(status: NonNullable<LearnGlossaryTerm['arabicStatus']>, t: Translate): string {
  switch (status) {
    case 'OFFICIAL_ARABIC':
      return t('מונח ערבי רשמי');
    case 'COMMON_USAGE':
      return t('שימוש ערבי מקובל');
    case 'TRANSLITERATION':
      return t('תעתיק לערבית');
    case 'UNKNOWN_AFTER_RESEARCH':
      return t('ניסוח ערבי שלנו; לא נמצא מונח רשמי');
  }
}

function lifecycleLabel(status: LearnContact['lifecycleStatus'], t: Translate): string {
  switch (status) {
    case 'CURRENT':
      return t('ארגון פעיל');
    case 'HISTORICAL_MERGED':
      return t('ארגון היסטורי שמוזג');
  }
}

function localizedTerm(term: LearnGlossaryTerm, language: string): { title: string; definition: string } {
  if (language === 'ar') return { title: term.ar, definition: term.definitionAr };
  if (language === 'en') return { title: term.en, definition: term.definitionEn };
  return { title: term.he, definition: term.definitionHe };
}

function localizedRight(right: LearnRight, language: string): { title: string; summary: string } {
  if (language === 'ar') return { title: right.titleAr, summary: right.summaryAr };
  if (language === 'en') return { title: right.titleEn, summary: right.summaryEn };
  return { title: right.titleHe, summary: right.summaryHe };
}

function contactName(contact: LearnContact, language: string): string {
  const preferred = language === 'ar'
    ? contact.legalNameAr
    : language === 'en'
      ? contact.legalNameEn
      : contact.legalNameHe;
  return preferred?.value
    ?? contact.legalNameHe?.value
    ?? contact.legalNameEn?.value
    ?? contact.legalNameAr?.value
    ?? contact.slug;
}

function StatusText({ children, testID }: { readonly children: string; readonly testID: string }): React.ReactElement {
  return (
    <AppText className={`text-xs font-bold ${ACCENT.text}`} testID={testID}>
      {children}
    </AppText>
  );
}

function GlossaryRows({ language, t }: { readonly language: string; readonly t: Translate }): React.ReactElement {
  return (
    <View className="gap-3" testID="learn-glossary-list">
      {LEARN_CONTENT.glossary.map(term => {
        const text = localizedTerm(term, language);
        const rowId = `learn-glossary-row-${term.termId}`;
        return (
          <View className={`rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} key={term.termId} testID={rowId}>
            <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>{text.title}</AppText>
            <AppText className={`mt-2 text-sm leading-6 ${TEXT.body}`}>{text.definition}</AppText>
            {term.arabicStatus !== undefined ? (
              <StatusText testID={`${rowId}-arabic-status`}>
                {t('מעמד המונח בערבית: {{status}}', { status: arabicStatusLabel(term.arabicStatus, t) })}
              </StatusText>
            ) : null}
            {term.verificationStatus !== undefined ? (
              <StatusText testID={`${rowId}-verification`}>
                {t('מצב אימות: {{status}}', { status: verificationLabel(term.verificationStatus, t) })}
              </StatusText>
            ) : null}
            {term.notes !== undefined ? (
              <AppText className={`mt-2 text-sm leading-6 ${TEXT.secondary}`} testID={`${rowId}-notes`}>
                {t('הערה: {{note}}', { note: term.notes })}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function RightsRows({ language, t }: { readonly language: string; readonly t: Translate }): React.ReactElement {
  return (
    <View className="gap-3" testID="learn-rights-list">
      {LEARN_CONTENT.rights.map(right => {
        const text = localizedRight(right, language);
        const rowId = `learn-rights-row-${right.topicId}`;
        return (
          <View className={`rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} key={right.topicId} testID={rowId}>
            <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>{text.title}</AppText>
            <AppText className={`mt-2 text-sm leading-6 ${TEXT.body}`}>{text.summary}</AppText>
            {right.deadlines !== undefined ? (
              <AppText className={`mt-2 text-sm leading-6 ${TEXT.body}`}>{t('מועדים: {{value}}', { value: right.deadlines })}</AppText>
            ) : null}
            {right.whoToContact !== undefined ? (
              <AppText className={`mt-2 text-sm leading-6 ${TEXT.body}`}>{t('למי פונים: {{value}}', { value: right.whoToContact })}</AppText>
            ) : null}
            {right.verificationStatus !== undefined ? (
              <StatusText testID={`${rowId}-verification`}>
                {t('מצב אימות: {{status}}', { status: verificationLabel(right.verificationStatus, t) })}
              </StatusText>
            ) : null}
            {right.caveat !== undefined ? (
              <AppText className={`mt-3 rounded-lg p-3 text-sm leading-6 ${SURFACE.sunken} ${TEXT.secondary}`} testID={`${rowId}-caveat`}>
                {right.caveat}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function ContactValue({ field, rowId, t, value }: {
  readonly field: (typeof CONTACT_FIELDS)[number];
  readonly rowId: string;
  readonly t: Translate;
  readonly value: LearnSourcedValue;
}): React.ReactElement {
  const fieldId = `${rowId}-${String(field.key)}`;
  return (
    <View className={`border-t py-3 ${BORDER.subtle}`} testID={fieldId}>
      <AppText className={`text-xs font-extrabold ${TEXT.secondary}`}>{t(field.label)}</AppText>
      <AppText className={`mt-1 text-sm ${TEXT.body}`}>{value.value ?? t('אין ערך שפורסם')}</AppText>
      {value.verificationStatus !== undefined ? (
        <StatusText testID={`${fieldId}-verification`}>
          {t('מצב אימות: {{status}}', { status: sourcedVerificationLabel(value.verificationStatus, t) })}
        </StatusText>
      ) : null}
      {value.note !== undefined ? (
        <AppText className={`mt-1 text-sm leading-6 ${TEXT.secondary}`} testID={`${fieldId}-note`}>
          {t('הערה: {{note}}', { note: value.note })}
        </AppText>
      ) : null}
    </View>
  );
}

function ContactRows({ language, t }: { readonly language: string; readonly t: Translate }): React.ReactElement {
  return (
    <View className="gap-3" testID="learn-contacts-list">
      {LEARN_CONTENT.contacts.map(contact => {
        const rowId = `learn-contact-row-${contact.orgId}`;
        return (
          <View className={`rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} key={contact.orgId} testID={rowId}>
            <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>{contactName(contact, language)}</AppText>
            <StatusText testID={`${rowId}-lifecycle`}>{lifecycleLabel(contact.lifecycleStatus, t)}</StatusText>
            {CONTACT_FIELDS.map(field => {
              const value = contact[field.key];
              return value === undefined ? null : (
                <ContactValue field={field} key={field.key} rowId={rowId} t={t} value={value} />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function LearnScreen(): React.ReactElement {
  const { language, t } = useTranslation();
  const [section, setSection] = useState<LearnSection>('glossary');
  const sections: readonly { readonly id: LearnSection; readonly label: string; readonly count: number }[] = [
    { id: 'glossary', label: 'מילון', count: LEARN_CONTENT.counts.glossary },
    { id: 'rights', label: 'זכויות', count: LEARN_CONTENT.counts.rights },
    { id: 'contacts', label: 'אנשי קשר', count: LEARN_CONTENT.counts.contacts },
  ];

  return (
    <RtlScreen className={SURFACE.page}>
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
        <View className="w-full gap-4 px-5 py-6" testID="learn-screen">
          <AppText className={`text-[26px] font-extrabold ${TEXT.heading}`}>{t('לומדים')}</AppText>
          <AppText className={`text-sm leading-6 ${TEXT.secondary}`}>
            {t('מילון, זכויות ודרכי קשר מתוך חבילת התוכן של האפליקציה.')}
          </AppText>
          <RtlRow className="gap-2" testID="learn-section-tabs">
            {sections.map(item => {
              const selected = section === item.id;
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityValue={{ text: String(item.count) }}
                  className={`min-h-11 flex-1 items-center justify-center rounded-lg border px-2 ${selected ? `${ACCENT.border} ${ACCENT.surfaceStrong}` : `${BORDER.hairline} ${SURFACE.card}`}`}
                  key={item.id}
                  onPress={(): void => setSection(item.id)}
                  testID={`learn-tab-${item.id}`}
                >
                  <AppText className={`text-center text-sm font-extrabold ${selected ? ACCENT.text : TEXT.body}`}>
                    {t('{{label}} ({{count}})', { label: t(item.label), count: item.count })}
                  </AppText>
                </Pressable>
              );
            })}
          </RtlRow>
          {section === 'glossary' ? <GlossaryRows language={language} t={t} /> : null}
          {section === 'rights' ? <RightsRows language={language} t={t} /> : null}
          {section === 'contacts' ? <ContactRows language={language} t={t} /> : null}
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
