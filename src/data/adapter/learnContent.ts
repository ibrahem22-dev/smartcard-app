import contentPack from './packs/content/pack.json';
import type { AppLanguage } from '../../i18n/locale';

interface LocalizedGlossaryRow {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly checkedAt: string;
}

interface LocalizedRightRow {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly checkedAt: string;
}

interface ContactRow {
  readonly id: string;
  readonly name: string;
  readonly phone?: string;
  readonly status: string;
  readonly checkedAt: string;
}

type PackRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sourcedValue(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const candidate = (value as { readonly value?: unknown }).value;
    return typeof candidate === 'string' ? candidate : undefined;
  }
  return undefined;
}

function localized(
  row: PackRecord,
  language: AppLanguage,
  stem: string,
): string {
  const suffix = language === 'he' ? 'He' : language === 'ar' ? 'Ar' : 'En';
  return text(row[`${stem}${suffix}`]);
}

const units = contentPack.units as unknown as {
  readonly glossary: readonly PackRecord[];
  readonly rights: readonly PackRecord[];
  readonly contacts: readonly PackRecord[];
};

export function learnContent(language: AppLanguage): {
  readonly datasetVersion: string;
  readonly packVersion: string;
  readonly glossary: readonly LocalizedGlossaryRow[];
  readonly rights: readonly LocalizedRightRow[];
  readonly contacts: readonly ContactRow[];
} {
  return {
    datasetVersion: contentPack.datasetVersion,
    packVersion: contentPack.packVersion,
    glossary: units.glossary.map((row) => ({
      id: text(row.termId),
      title: text(row[language]),
      body: localized(row, language, 'definition'),
      status: text(row.verificationStatus),
      checkedAt: text(row.lastCheckedAt),
    })),
    rights: units.rights.map((row) => ({
      id: text(row.topicId),
      title: localized(row, language, 'title'),
      body: localized(row, language, 'summary'),
      status: text(row.verificationStatus),
      checkedAt: text(row.lastCheckedAt),
    })),
    contacts: units.contacts.map((row): ContactRow => {
      const phone = sourcedValue(row.customerServicePhone);
      return {
        id: text(row.orgId),
        name:
          sourcedValue(
            row[
              language === 'he'
                ? 'legalNameHe'
                : language === 'ar'
                  ? 'legalNameAr'
                  : 'legalNameEn'
            ],
          ) ?? text(row.slug),
        ...(phone === undefined ? {} : { phone }),
        status: text(row.lifecycleStatus),
        checkedAt: text(row.lastCheckedAt),
      };
    }),
  };
}
