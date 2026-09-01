import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

import { arBySource } from '../../i18n/ar';
import { enBySource } from '../../i18n/en';
import { useLanguageStore } from '../../store/useLanguageStore';
import {
  VaultExportImportScreen,
  VAULT_TRANSFER_PROTECTION_TEXT,
} from '../VaultExportImportScreen';

describe('MDC C5 — encrypted vault export/import surface', () => {
  it('renders the exact passphrase-protection and non-recovery warning', () => {
    const english = enBySource[VAULT_TRANSFER_PROTECTION_TEXT];
    const arabic = arBySource[VAULT_TRANSFER_PROTECTION_TEXT];
    if (english === undefined || arabic === undefined) {
      throw new Error('VAULT_TRANSFER_PROTECTION_TRANSLATION_MISSING');
    }
    const expectedByLanguage = {
      he: VAULT_TRANSFER_PROTECTION_TEXT,
      en: english,
      ar: arabic,
    } as const;

    for (const language of ['he', 'en', 'ar'] as const) {
      useLanguageStore.setState({
        languageChoice: language,
        resolvedLanguage: language,
      });
      const api = render(<VaultExportImportScreen />);
      expect(api.getByText(expectedByLanguage[language])).toBeTruthy();
      api.unmount();
    }
  });
});
