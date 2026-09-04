/**
 * V9 / MDC-OBSERVABILITY option 1 — the local crash log records, redacts, bounds and never sends.
 */
const mockStore = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: (key: string): string | undefined => mockStore.get(key),
    set: (key: string, value: string): void => {
      mockStore.set(key, value);
    },
    delete: (key: string): void => {
      mockStore.delete(key);
    },
  })),
}));

import {
  MAX_ENTRIES,
  MESSAGE_CHARS,
  __resetCrashLogForTests,
  clearCrashLog,
  formatCrashLog,
  installCrashLog,
  readCrashLog,
  recordCrash,
  redact,
} from '../crashLog';

beforeEach(() => {
  mockStore.clear();
  __resetCrashLogForTests();
});

describe('the local crash log', () => {
  test('records an uncaught error with its name, message and stack, on the device only', () => {
    const entry = recordCrash(new RangeError('boom'), 'fatal', new Date('2026-09-04T10:00:00Z'));
    expect(entry).toMatchObject({ at: '2026-09-04T10:00:00.000Z', kind: 'fatal', name: 'RangeError', message: 'boom' });
    expect(entry.stack.length).toBeGreaterThan(0);
    expect(readCrashLog()).toHaveLength(1);
    expect(mockStore.has('entries')).toBe(true);
  });

  test('redacts every run of three or more digits so no amount, last-four or date is stored', () => {
    expect(redact('limit 20000 exceeded by 1,200 on card 4321 at 2026-09-04')).toBe('limit ### exceeded by 1,### on card ### at ###-09-04');
    const entry = recordCrash(new Error('available 18800 after 1200'), 'non-fatal');
    expect(entry.message).toBe('available ### after ###');
    // the timestamp is kept by design; name, message and stack carry no run of three digits
    for (const stored of readCrashLog()) {
      expect(`${stored.name} ${stored.message} ${stored.stack}`).not.toMatch(/\d{3,}/);
    }
  });

  test('keeps the newest entries only, MAX_ENTRIES deep', () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i += 1) recordCrash(new Error(`e${i}`), 'non-fatal');
    const log = readCrashLog();
    expect(log).toHaveLength(MAX_ENTRIES);
    expect(log[0]?.message).toBe(`e${MAX_ENTRIES + 4}`);
  });

  test('cuts an over-long message and never throws from the handler', () => {
    const entry = recordCrash(new Error('x'.repeat(MESSAGE_CHARS + 50)), 'fatal');
    expect(entry.message.length).toBe(MESSAGE_CHARS + 1);
    expect(() => recordCrash(undefined, 'fatal')).not.toThrow();
  });

  test('clear empties the log and format renders plain text a user can paste', () => {
    recordCrash(new Error('one'), 'fatal');
    expect(formatCrashLog()).toContain('Error: one');
    clearCrashLog();
    expect(readCrashLog()).toEqual([]);
    expect(formatCrashLog()).toBe('');
  });

  test('installs in front of the platform handler exactly once and still calls the previous handler', () => {
    const previous = jest.fn();
    let current: ((error: unknown, isFatal?: boolean) => void) | undefined = previous;
    const errorUtils = {
      getGlobalHandler: (): typeof current => current,
      setGlobalHandler: (h: typeof current): void => {
        current = h;
      },
    };
    expect(installCrashLog(errorUtils)).toBe(true);
    expect(installCrashLog(errorUtils)).toBe(false);
    current?.(new Error('fatal 12345'), true);
    expect(previous).toHaveBeenCalledTimes(1);
    expect(readCrashLog()[0]).toMatchObject({ kind: 'fatal', message: 'fatal ###' });
  });

  test('installs nothing when the platform exposes no ErrorUtils', () => {
    expect(installCrashLog(undefined)).toBe(false);
  });
});
