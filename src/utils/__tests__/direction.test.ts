import {
  getDirectionKey,
  getEndAlign,
  getRowDirection,
  getStartAlign,
  getTabOrder,
  getTabsForDirection,
  getTextAlign,
  getWritingDirection,
  isLanguageRTL,
} from '../direction';

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
