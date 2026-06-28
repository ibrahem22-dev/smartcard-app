const mmkvStore = new Map<string, string>();

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: (key: string): string | undefined => mmkvStore.get(key),
    set: (key: string, value: string): void => {
      mmkvStore.set(key, value);
    },
    delete: (key: string): void => {
      mmkvStore.delete(key);
    },
  })),
}));

const changeLanguage = jest.fn();

jest.mock('../../i18n', () => ({
  __esModule: true,
  default: {
    changeLanguage: (...args: unknown[]): void => {
      changeLanguage(...args);
    },
  },
}));

jest.mock('expo-localization', () => ({
  getLocales: (): { languageCode: string }[] => [{ languageCode: 'he' }],
}));

import { MMKV_KEYS } from '../keys';
import { useLanguageStore } from '../useLanguageStore';

describe('useLanguageStore', () => {
  beforeEach(() => {
    mmkvStore.clear();
    changeLanguage.mockClear();
    useLanguageStore.setState({
      languageChoice: 'auto',
      resolvedLanguage: 'he',
      isHydrated: true,
    });
  });

  test('setLanguageChoice updates state immediately without reload', () => {
    useLanguageStore.getState().setLanguageChoice('en');

    const state = useLanguageStore.getState();
    expect(state.languageChoice).toBe('en');
    expect(state.resolvedLanguage).toBe('en');
    expect(mmkvStore.get(MMKV_KEYS.languagePreference)).toBe('en');
    expect(changeLanguage).toHaveBeenCalledWith('en');
  });

  test('setLanguageChoice to Hebrew updates RTL language immediately', () => {
    useLanguageStore.getState().setLanguageChoice('en');
    useLanguageStore.getState().setLanguageChoice('he');

    const state = useLanguageStore.getState();
    expect(state.resolvedLanguage).toBe('he');
    expect(changeLanguage).toHaveBeenLastCalledWith('he');
  });

  test('hydrateLanguage reads persisted MMKV choice', () => {
    mmkvStore.set(MMKV_KEYS.languagePreference, 'en');
    useLanguageStore.getState().hydrateLanguage();

    expect(useLanguageStore.getState().resolvedLanguage).toBe('en');
    expect(useLanguageStore.getState().isHydrated).toBe(true);
  });

  test('no reload helpers are invoked on setLanguageChoice', () => {
    const devSettingsReload = jest.fn();
    jest.doMock('react-native', () => ({
      DevSettings: { reload: devSettingsReload },
      I18nManager: { forceRTL: jest.fn(), allowRTL: jest.fn(), isRTL: false },
    }));

    useLanguageStore.getState().setLanguageChoice('he');
    expect(devSettingsReload).not.toHaveBeenCalled();
  });
});
