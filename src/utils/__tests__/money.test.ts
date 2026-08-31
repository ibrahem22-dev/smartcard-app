import { formatPercent, formatRatioAsPercent } from '../money';

describe('financial percentage truth', () => {
  test('keeps published percentage values in percentage units', () => {
    expect(formatPercent(2.5, 'en')).toBe('2.5%');
  });

  test('converts engine ratios before adding the percent sign', () => {
    expect(formatRatioAsPercent(0.35, 'en')).toBe('35%');
    expect(formatRatioAsPercent(0.5, 'he')).toBe('50%');
    expect(formatRatioAsPercent(0.41, 'ar')).toBe('41%');
  });
});

