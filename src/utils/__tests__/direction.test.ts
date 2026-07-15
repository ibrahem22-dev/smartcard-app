import { I18nManager } from 'react-native';

import {
  getDirectionKey,
  getEndAlign,
  getRowDirection,
  getRowStyle,
  getRootDirectionStyle,
  getStartAlign,
  getTabOrder,
  getTabsForDirection,
  getTextAlign,
  getTrailingOffset,
  getWritingDirection,
  isLanguageRTL,
} from '../direction';

jest.mock('react-native', () => ({
  I18nManager: {
    allowRTL: jest.fn(),
    forceRTL: jest.fn(),
    isRTL: false,
  },
}));

describe('direction (manual dynamic RTL/LTR)', () => {
  describe('isLanguageRTL', () => {
    test('Hebrew is RTL', () => {
      expect(isLanguageRTL('he')).toBe(true);
    });

    test('English is LTR', () => {
      expect(isLanguageRTL('en')).toBe(false);
    });
  });

  describe('getTextAlign', () => {
    test('Hebrew → right', () => {
      expect(getTextAlign('he')).toBe('right');
    });

    test('English → left', () => {
      expect(getTextAlign('en')).toBe('left');
    });
  });

  describe('getWritingDirection', () => {
    test('Hebrew → rtl', () => {
      expect(getWritingDirection('he')).toBe('rtl');
    });

    test('English → ltr', () => {
      expect(getWritingDirection('en')).toBe('ltr');
    });
  });

  describe('getRowDirection', () => {
    test('Hebrew → row-reverse', () => {
      expect(getRowDirection('he')).toBe('row-reverse');
    });

    test('English → row', () => {
      expect(getRowDirection('en')).toBe('row');
    });
  });

  describe('getStartAlign / getEndAlign', () => {
    test('Hebrew start/end', () => {
      expect(getStartAlign('he')).toBe('flex-end');
      expect(getEndAlign('he')).toBe('flex-start');
    });

    test('English start/end', () => {
      expect(getStartAlign('en')).toBe('flex-start');
      expect(getEndAlign('en')).toBe('flex-end');
    });
  });

  describe('getDirectionKey', () => {
    test('includes language and writing direction', () => {
      expect(getDirectionKey('he')).toBe('he-rtl');
      expect(getDirectionKey('en')).toBe('en-ltr');
    });
  });

  describe('direction style helpers', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      Reflect.set(I18nManager, 'isRTL', false);
    });

    afterEach(() => {
      Reflect.set(I18nManager, 'isRTL', false);
    });

    test('root style is direction-neutral for Hebrew RTL and English LTR', () => {
      expect(getRootDirectionStyle('he')).toEqual({ flex: 1 });
      expect(getRootDirectionStyle('en')).toEqual({ flex: 1 });
      expect(getRootDirectionStyle('he')).not.toHaveProperty('direction');
      expect(getRootDirectionStyle('en')).not.toHaveProperty('direction');
    });

    test('trailing offset maps to left in Hebrew and right in English', () => {
      expect(getTrailingOffset(24, 'he')).toEqual({ left: 24 });
      expect(getTrailingOffset(24, 'he')).not.toHaveProperty('right');
      expect(getTrailingOffset(24, 'en')).toEqual({ right: 24 });
      expect(getTrailingOffset(24, 'en')).not.toHaveProperty('left');
    });

    test('row style mirrors Hebrew and preserves English declaration order', () => {
      expect(getRowStyle('he')).toEqual({
        flexDirection: getRowDirection('he'),
        alignItems: 'center',
      });
      expect(getRowStyle('en')).toEqual({
        flexDirection: getRowDirection('en'),
        alignItems: 'center',
      });
    });

    test('language output ignores conflicting global I18nManager state', () => {
      Reflect.set(I18nManager, 'isRTL', true);

      expect(getRootDirectionStyle('en')).toEqual({ flex: 1 });
      expect(getTrailingOffset(16, 'en')).toEqual({ right: 16 });
      expect(getRowStyle('en')).toEqual({
        flexDirection: getRowDirection('en'),
        alignItems: 'center',
      });

      Reflect.set(I18nManager, 'isRTL', false);

      expect(getRootDirectionStyle('he')).toEqual({ flex: 1 });
      expect(getTrailingOffset(16, 'he')).toEqual({ left: 16 });
      expect(getRowStyle('he')).toEqual({
        flexDirection: getRowDirection('he'),
        alignItems: 'center',
      });
    });

    test('calls do not mutate global direction or invoke native RTL controls', () => {
      Reflect.set(I18nManager, 'isRTL', true);
      const initialGlobalDirection = Reflect.get(I18nManager, 'isRTL');

      getRootDirectionStyle('he');
      getRootDirectionStyle('en');
      getTrailingOffset(12, 'he');
      getTrailingOffset(12, 'en');
      getRowStyle('he');
      getRowStyle('en');

      expect(Reflect.get(I18nManager, 'isRTL')).toBe(initialGlobalDirection);
      expect(I18nManager.forceRTL).not.toHaveBeenCalled();
      expect(I18nManager.allowRTL).not.toHaveBeenCalled();
    });

    test('repeated calls return identical values', () => {
      const expected = {
        rootHe: { flex: 1 },
        rootEn: { flex: 1 },
        trailingHe: { left: 20 },
        trailingEn: { right: 20 },
        rowHe: {
          flexDirection: getRowDirection('he'),
          alignItems: 'center',
        },
        rowEn: {
          flexDirection: getRowDirection('en'),
          alignItems: 'center',
        },
      };

      for (let call = 0; call < 10; call += 1) {
        expect({
          rootHe: getRootDirectionStyle('he'),
          rootEn: getRootDirectionStyle('en'),
          trailingHe: getTrailingOffset(20, 'he'),
          trailingEn: getTrailingOffset(20, 'en'),
          rowHe: getRowStyle('he'),
          rowEn: getRowStyle('en'),
        }).toEqual(expected);
      }
    });
  });

  describe('getTabOrder', () => {
    const baseTabs = ['Home', 'PurchaseGate', 'Cards', 'Calendar', 'Settings'] as const;

    test('English keeps LTR declaration order', () => {
      expect(getTabOrder(baseTabs, 'en')).toEqual([...baseTabs]);
    });

    test('Hebrew reverses for RTL-friendly tab bar', () => {
      expect(getTabOrder(baseTabs, 'he')).toEqual([...baseTabs].reverse());
    });
  });

  test('getTabsForDirection reverses for RTL', () => {
    const tabs = ['Home', 'Settings'] as const;
    expect(getTabsForDirection(tabs, false)).toEqual(['Home', 'Settings']);
    expect(getTabsForDirection(tabs, true)).toEqual(['Settings', 'Home']);
  });

  describe('AppText alignment contract', () => {
    test('Hebrew text alignment is right', () => {
      expect(getTextAlign('he')).toBe('right');
    });

    test('English text alignment is left', () => {
      expect(getTextAlign('en')).toBe('left');
    });
  });
});
