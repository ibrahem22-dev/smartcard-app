import React from 'react';
import { View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlScreen, RtlScrollView } from '../components/rtl';
import {
  readDataPrivacy,
  type CountReading,
  type DataPrivacyArtifact,
  type PackProvenanceState,
} from '../data/adapter/dataPrivacy';
import { useTranslation, type UseTranslationResult } from '../hooks/useTranslation';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

type Translate = UseTranslationResult['t'];

function artifactKindLabel(kind: DataPrivacyArtifact['kind'], t: Translate): string {
  switch (kind) {
    case 'PACK':
      return t('חבילת נתונים');
    case 'FX_SNAPSHOT':
      return t('תמונת מצב של שערי מטבע');
  }
}

function provenanceLabel(state: PackProvenanceState, t: Translate): string {
  switch (state) {
    case 'VERIFIED':
      return t('מאומת');
    case 'ESTIMATE':
      return t('הערכה');
    case 'UNKNOWN':
      return t('לא ידוע');
    case 'CONFLICT':
      return t('סתירה');
  }
}

function CountLine({ label, reading, testID, t }: {
  readonly label: string;
  readonly reading: CountReading;
  readonly testID: string;
  readonly t: Translate;
}): React.ReactElement {
  if (reading.status === 'UNAVAILABLE') {
    return (
      <AppText className={`text-sm leading-6 ${TEXT.body}`} testID={testID}>
        {t('{{label}}: הספירה אינה זמינה — {{reason}}', { label: t(label), reason: reading.reason })}
      </AppText>
    );
  }
  return (
    <AppText className={`text-sm leading-6 ${TEXT.body}`} testID={testID}>
      {t('{{label}}: {{count}}', { label: t(label), count: reading.count })}
    </AppText>
  );
}

function ArtifactCard({ artifact, t }: {
  readonly artifact: DataPrivacyArtifact;
  readonly t: Translate;
}): React.ReactElement {
  const rowId = `data-privacy-artifact-${artifact.set}`;
  return (
    <View className={`rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} testID={rowId}>
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
        {t('{{set}} — {{kind}}', { set: artifact.set, kind: artifactKindLabel(artifact.kind, t) })}
      </AppText>
      <AppText className={`mt-2 text-sm ${TEXT.body}`} testID={`${rowId}-version`}>
        {t('גרסה: {{version}}', { version: artifact.version })}
      </AppText>
      <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-dataset-version`}>
        {t('גרסת מערך נתונים: {{version}}', { version: artifact.datasetVersion })}
      </AppText>
      <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-format-version`}>
        {t('גרסת מבנה: {{version}}', { version: artifact.formatVersion })}
      </AppText>
      <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-generated-at`}>
        {t('נוצרה: {{date}}', { date: artifact.generatedAt })}
      </AppText>
      <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-bytes`}>
        {t('גודל במניפסט: {{count}} בתים', { count: artifact.bytes })}
      </AppText>
      <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-rows`}>
        {t('רשומות מקומיות בחבילה: {{count}}', { count: artifact.rowCount })}
      </AppText>
      <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-min-app-version`}>
        {t('גרסת אפליקציה מזערית: {{version}}', { version: artifact.minAppVersion })}
      </AppText>
      <AppText className={`text-sm font-bold ${ACCENT.text}`} testID={`${rowId}-stale-after-days`}>
        {t('המניפסט מצהיר על רעננות של {{count}} ימים; זה אינו פסק דין על התיישנות.', {
          count: artifact.staleAfterDays,
        })}
      </AppText>
      {artifact.kind === 'FX_SNAPSHOT' ? (
        <View className={`mt-3 border-t pt-3 ${BORDER.subtle}`} testID={`${rowId}-fx-freshness`}>
          <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-snapshot-date`}>
            {t('תאריך תמונת המצב: {{date}}', { date: artifact.snapshotDate })}
          </AppText>
          <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-earliest-rate-date`}>
            {t('תאריך שער מוקדם ביותר: {{date}}', { date: artifact.earliestRateDate })}
          </AppText>
          <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-latest-rate-date`}>
            {t('תאריך שער אחרון: {{date}}', { date: artifact.latestRateDate })}
          </AppText>
          <AppText className={`text-sm ${TEXT.body}`} testID={`${rowId}-accessed-at`}>
            {t('המקור נגיש לאחרונה: {{date}}', { date: artifact.accessedAt })}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export function DataPrivacyScreen(): React.ReactElement {
  const { t } = useTranslation();
  const reading = readDataPrivacy();
  const importedRows = reading.local.importedPackRows;

  return (
    <RtlScreen className={SURFACE.page}>
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
        <View className="w-full gap-5 px-5 py-6" testID="data-privacy-screen">
          <View>
            <AppText className={`text-[26px] font-extrabold ${TEXT.heading}`}>
              {t('מידע ופרטיות')}
            </AppText>
            <AppText className={`mt-2 text-sm leading-6 ${TEXT.secondary}`}>
              {t('כל הגרסאות, התאריכים והספירות נקראים עכשיו מהמניפסטים ומהאחסון המקומי.')}
            </AppText>
          </View>

          <View className="gap-3" testID="data-privacy-artifacts">
            <AppText className={`text-xl font-extrabold ${TEXT.heading}`}>
              {t('גרסאות ורעננות מוצהרת')}
            </AppText>
            {reading.artifacts.map(artifact => (
              <ArtifactCard artifact={artifact} key={artifact.set} t={t} />
            ))}
          </View>

          <View className={`gap-2 rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} testID="data-privacy-provenance">
            <AppText className={`text-xl font-extrabold ${TEXT.heading}`}>{t('תמהיל מקור הנתונים')}</AppText>
            <AppText className={`text-sm leading-6 ${TEXT.secondary}`}>
              {t('הספירה היא של שדות חבילה באוצר המילים VERIFIED, ESTIMATE, UNKNOWN, CONFLICT. USER שייך לנתוני הכספת ואינו נכלל בספירת החבילות.')}
            </AppText>
            {reading.provenanceMix.map(item => (
              <AppText
                className={`text-sm font-bold ${ACCENT.text}`}
                key={item.state}
                testID={`data-privacy-provenance-${item.state}`}
              >
                {t('{{label}}: {{count}}', { label: provenanceLabel(item.state, t), count: item.count })}
              </AppText>
            ))}
          </View>

          <View className={`gap-2 rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`} testID="data-privacy-local">
            <AppText className={`text-xl font-extrabold ${TEXT.heading}`}>{t('מה מוחזק מקומית')}</AppText>
            <AppText className={`text-sm leading-6 ${TEXT.secondary}`}>
              {t('האפליקציה משתמשת בכספת MMKV מוצפנת, במופע MMKV נפרד ולא מוצפן להעדפות, וב-SQLite לחבילות מיובאות.')}
            </AppText>
            <AppText className={`text-sm leading-6 ${TEXT.body}`} testID="data-privacy-bundled-rows">
              {t('רשומות JSON המוחזקות בחבילת האפליקציה: {{count}}', { count: reading.local.bundledRows })}
            </AppText>
            <CountLine label="מפתחות בכספת המוצפנת" reading={reading.local.encryptedVaultKeys} t={t} testID="data-privacy-vault-keys" />
            <CountLine label="מפתחות בהעדפות הלא מוצפנות" reading={reading.local.preferenceKeys} t={t} testID="data-privacy-preference-keys" />
            <CountLine label="רשומות חבילה שיובאו ל-SQLite" reading={importedRows} t={t} testID="data-privacy-imported-rows" />
            {importedRows.status === 'AVAILABLE' && importedRows.count === 0 ? (
              <AppText className={`text-sm leading-6 ${TEXT.secondary}`} testID="data-privacy-empty-pack-store-explanation">
                {t('SQLite ריק כי עדיין אין מסלול ייצור שמייבא אליו; נתוני החבילות המקומיים נקראים מקובצי JSON המובנים שמנויים למעלה.')}
              </AppText>
            ) : null}
          </View>
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
