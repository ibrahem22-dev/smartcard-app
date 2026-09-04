import React from 'react';
import { act, fireEvent, render, type RenderAPI } from '@testing-library/react-native';

const mockSetStringAsync = jest.fn(async (_text: string): Promise<void> => undefined);
jest.mock('expo-clipboard', () => ({ setStringAsync: (text: string) => mockSetStringAsync(text) }));

// useTheme reads the auth context (the bank colour follows the profile); the screen uses bankColor only.
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ bankColor: '#1f3a5f' }) }));

const mockEntries: { value: readonly unknown[] } = { value: [] };
const mockClear = jest.fn();
jest.mock('../../observability/crashLog', () => ({
  readCrashLog: () => mockEntries.value,
  clearCrashLog: () => mockClear(),
  formatCrashLog: (entries: readonly { name: string; message: string }[]) => entries.map((e) => `${e.name}: ${e.message}`).join('\n'),
}));

import { CrashLogScreen } from '../CrashLogScreen';
import { useLanguageStore } from '../../store/useLanguageStore';

const mount = (): RenderAPI => {
  useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
  return render(<CrashLogScreen />);
};

beforeEach(() => {
  mockEntries.value = [];
  mockSetStringAsync.mockClear();
  mockClear.mockClear();
});

describe('CrashLogScreen (V9, local only)', () => {
  test('renders the empty state and says the log never leaves the device', () => {
    const api = mount();
    expect(api.getByTestId('crash-log-empty')).toBeTruthy();
    expect(api.getByText(/stays on this device/i)).toBeTruthy();
  });

  test('renders stored entries with their redacted message', () => {
    mockEntries.value = [{ at: '2026-09-04T10:00:00.000Z', kind: 'fatal', name: 'Error', message: 'limit ###', stack: 'at x', appVersion: '1.1.0' }];
    const api = mount();
    expect(api.getAllByTestId('crash-log-entry')).toHaveLength(1);
    expect(api.getByText('Error: limit ###')).toBeTruthy();
  });

  test('copy puts the formatted log on the clipboard and nothing else happens', async () => {
    mockEntries.value = [{ at: 'a', kind: 'fatal', name: 'Error', message: 'm', stack: 's', appVersion: '1.1.0' }];
    const api = mount();
    await act(async () => {
      fireEvent.press(api.getByTestId('crash-log-copy'));
    });
    expect(mockSetStringAsync).toHaveBeenCalledWith('Error: m');
    expect(api.getByText('Copied')).toBeTruthy();
  });

  test('clear empties the log', () => {
    mockEntries.value = [{ at: 'a', kind: 'fatal', name: 'Error', message: 'm', stack: 's', appVersion: '1.1.0' }];
    const api = mount();
    fireEvent.press(api.getByTestId('crash-log-clear'));
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(api.getByTestId('crash-log-empty')).toBeTruthy();
  });
});
