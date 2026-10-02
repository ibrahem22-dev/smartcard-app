import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EMPTY_BENEFITS_DB } from '../../../authority/noSource';
import { arBySource } from '../../../i18n/ar';
import { enBySource } from '../../../i18n/en';
import { resolveMedia } from '../../../media/resolveMedia';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import type { BenefitsDB } from '../../../types/benefits.types';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { CardDnaScreen } from '../CardDnaScreen';
import { SectionBGives } from '../SectionBGives';
import { benefitRowsFor } from '../benefitRows';

const fakeDb = {
  execSync: (): void => { /* the render suite needs only an empty catalog table */ },
  closeSync: (): void => { /* no native handle to close */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

jest.mock('../../../media/resolveMedia', () => {
  const actual = jest.requireActual('../../../media/resolveMedia');
  return { ...actual, resolveMedia: jest.fn(actual.resolveMedia) };
});

const mockedResolveMedia = resolveMedia as jest.MockedFunction<typeof resolveMedia>;

const CARD: EngineCard = {
  cardId: 'card:dna-gives',
  cardProductId: 'product:dna-gives',
  displayName: 'Everyday Club',
  last4: '1357',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 10_000, currentBalance: 1_000 },
  billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
};

const POPULATED_DB: BenefitsDB = {
  issuers: {
    Max: {
      clubs: {
        [CARD.displayName]: {
          benefits: [
            {
              category: 'groceries',
              type: 'cashback',
              value: 3.5,
              isInternationalOnly: false,
              description: 'Cashback at participating grocery stores',
            },
            {
              category: 'travel',
              type: 'discount',
              value: 12,
              isInternationalOnly: true,
              description: 'Discount on eligible international travel',
            },
          ],
        },
      },
    },
  },
};

const ROWS = benefitRowsFor(CARD, POPULATED_DB);

const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

function textsInTree(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsInTree);
  if (node === null || typeof node !== 'object') return [];
  return textsInTree((node as { readonly children?: unknown }).children);
}

function showEmpty() {
  return render(wrap(<CardDnaScreen />));
}

function showPopulated() {
  return render(wrap(<SectionBGives card={CARD} db={POPULATED_DB} />));
}

describe('Card DNA gives', () => {
  beforeEach(() => {
    mockedResolveMedia.mockClear();
    act(() => {
      useLanguageStore.getState().setLanguageChoice('en');
      useCardsStore.setState({ cards: [CARD] });
    });
  });

  it('renders the evidenced empty state when no benefit is evidenced for this card', () => {
    expect(benefitRowsFor(CARD, EMPTY_BENEFITS_DB)).toHaveLength(0);

    const tree = showEmpty();

    expect(tree.getByTestId('card-dna-gives-empty')).toBeTruthy();
    expect(tree.queryAllByTestId(/^card-dna-benefit-/)).toHaveLength(0);
  });

  it('says no benefit is evidenced rather than that the card has none', () => {
    const tree = showEmpty();
    const emptyText = textsInTree(tree.getByTestId('card-dna-gives-empty')).join(' ');
    const source = 'לא נמצאה עדות להטבה עבור הכרטיס הזה';

    expect([source, enBySource[source], arBySource[source]]).toContain(emptyText);
    expect(emptyText).not.toMatch(/card has no benefits|אין לכרטיס הטבות|لا توجد مزايا للبطاقة/i);
  });

  it('renders every benefit the database evidences for this card', () => {
    const tree = showPopulated();

    expect(ROWS).toHaveLength(2);
    for (const row of ROWS) {
      const testID = `card-dna-benefit-${row.id}`;
      expect(tree.getByTestId(testID)).toBeTruthy();
      expect(textsInTree(tree.getByTestId(`${testID}-description`)).join(' ')).toBe(
        row.description,
      );
    }
    expect(tree.queryByTestId('card-dna-gives-empty')).toBeNull();
  });

  it('tags each benefit as card or club', () => {
    const tree = showPopulated();
    const allowed = new Set(['Card', 'Club']);

    for (const row of ROWS) {
      const source = textsInTree(
        tree.getByTestId(`card-dna-benefit-${row.id}-source`),
      ).join(' ');
      expect(allowed.has(source)).toBe(true);
      expect(row.source).toBe('club');
      expect(source).toBe('Club');
    }
  });

  it('renders cashback and discount values as percentages', () => {
    const tree = showPopulated();

    expect(textsInTree(tree.getByTestId(`card-dna-benefit-${ROWS[0]?.id}-kind`)).join(' ')).toBe(
      'Cashback',
    );
    expect(textsInTree(tree.getByTestId(`card-dna-benefit-${ROWS[0]?.id}-value`)).join(' ')).toBe(
      '3.5%',
    );
    expect(textsInTree(tree.getByTestId(`card-dna-benefit-${ROWS[1]?.id}-kind`)).join(' ')).toBe(
      'Discount',
    );
    expect(textsInTree(tree.getByTestId(`card-dna-benefit-${ROWS[1]?.id}-value`)).join(' ')).toBe(
      '12%',
    );
  });

  it('renders no reward balance anywhere in the panel', () => {
    const tree = showPopulated();
    const painted = textsInTree(tree.toJSON()).join(' ');

    expect(painted).not.toMatch(/reward balance|points balance|miles balance|יתרת נקודות|رصيد المكافآت/i);
  });

  it('resolves every benefit image through the media resolver at an app-owned tier', () => {
    const tree = showPopulated();

    expect(mockedResolveMedia).toHaveBeenCalledTimes(ROWS.length);
    ROWS.forEach((row, index) => {
      const call = mockedResolveMedia.mock.calls[index];
      const resolution = mockedResolveMedia.mock.results[index]?.value;

      expect(call?.[0]).toEqual({
        subjectKind: 'benefit',
        subjectId: row.id,
        fallbackClass: 'benefit',
      });
      expect(call?.[1]).toEqual([]);
      expect(call?.[2]).toEqual({ context: { categoryKey: row.category } });
      expect(resolution?.kind).toBe('generated');
      expect(resolution?.tier).toBe(3);
      expect(tree.getByTestId(`card-dna-benefit-${row.id}-image`).props.accessibilityRole).toBe(
        'image',
      );
    });
  });
});
