import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { learnContent } from '../data/adapter/learnContent';
import { useLanguage } from '../hooks/useLanguage';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

const COPY = {
  he: {
    title: 'ללמוד',
    intro: 'מידע כללי להבנה בלבד. אין כאן ייעוץ פיננסי, משפטי או השקעות.',
    glossary: 'מילון',
    rights: 'זכויות צרכניות',
    contacts: 'אנשי קשר של המנפיקים',
    source: 'מקור מאומת',
  },
  ar: {
    title: 'تعلّم',
    intro: 'معلومات عامة للفهم فقط. ليست نصيحة مالية أو قانونية أو استثمارية.',
    glossary: 'المصطلحات',
    rights: 'حقوق المستهلك',
    contacts: 'جهات اتصال المُصدرين',
    source: 'مصدر موثّق',
  },
  en: {
    title: 'Learn',
    intro: 'General educational information only. This is not financial, legal, or investment advice.',
    glossary: 'Glossary',
    rights: 'Consumer rights',
    contacts: 'Issuer contacts',
    source: 'Verified source',
  },
} as const;

type Section = 'glossary' | 'rights' | 'contacts';

export function LearnScreen(): React.ReactElement {
  const { language } = useLanguage();
  const copy = COPY[language];
  const content = useMemo(() => learnContent(language), [language]);
  const [section, setSection] = useState<Section>('glossary');

  return (
    <RtlScreen className={SURFACE.page} safe>
      <RtlScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <AppText className={`text-[26px] font-extrabold ${TEXT.heading}`}>
          {copy.title}
        </AppText>
        <AppText className={`mt-2 text-sm leading-6 ${TEXT.secondary}`}>
          {copy.intro}
        </AppText>
        <AppText className={`mt-1 text-xs ${TEXT.muted}`}>
          {`Dataset ${content.datasetVersion} · Pack ${content.packVersion}`}
        </AppText>

        <RtlRow className="mt-5 gap-2">
          {(['glossary', 'rights', 'contacts'] as const).map((value) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === value }}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-lg border px-2 ${
                section === value
                  ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                  : `${BORDER.hairline} ${SURFACE.card}`
              }`}
              key={value}
              onPress={(): void => setSection(value)}
              testID={`learn-tab-${value}`}
            >
              <AppText className={`text-center text-xs font-bold ${TEXT.body}`}>
                {copy[value]}
              </AppText>
            </Pressable>
          ))}
        </RtlRow>

        <View className="mt-4 gap-3" testID={`learn-section-${section}`}>
          {section === 'glossary'
            ? content.glossary.map((row) => (
                <View className={`rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} key={row.id}>
                  <AppText className={`text-base font-extrabold ${TEXT.heading}`}>{row.title}</AppText>
                  <AppText className={`mt-2 text-sm leading-6 ${TEXT.body}`}>{row.body}</AppText>
                  <AppText className={`mt-2 text-xs ${TEXT.muted}`}>{`${copy.source} · ${row.checkedAt}`}</AppText>
                </View>
              ))
            : null}
          {section === 'rights'
            ? content.rights.map((row) => (
                <View className={`rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} key={row.id}>
                  <AppText className={`text-base font-extrabold ${TEXT.heading}`}>{row.title}</AppText>
                  <AppText className={`mt-2 text-sm leading-6 ${TEXT.body}`}>{row.body}</AppText>
                  <AppText className={`mt-2 text-xs ${TEXT.muted}`}>{`${copy.source} · ${row.checkedAt}`}</AppText>
                </View>
              ))
            : null}
          {section === 'contacts'
            ? content.contacts.map((row) => (
                <View className={`rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} key={row.id}>
                  <AppText className={`text-base font-extrabold ${TEXT.heading}`}>{row.name}</AppText>
                  {row.phone === undefined ? null : (
                    <AppText className={`mt-2 text-sm ${TEXT.body}`}>{row.phone}</AppText>
                  )}
                  <AppText className={`mt-2 text-xs ${TEXT.muted}`}>{`${copy.source} · ${row.checkedAt}`}</AppText>
                </View>
              ))
            : null}
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}

