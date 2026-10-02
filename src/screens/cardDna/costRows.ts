export type CardCostRowId =
  | 'annual-fee'
  | 'monthly-fee'
  | 'fx-commission'
  | 'foreign-atm-fee'
  | 'interest-rates'
  | 'other-costs';

export interface CardCostRow {
  readonly id: CardCostRowId;
  readonly labelKey: string;
  readonly testID: string;
}

export const CARD_COST_ROWS: readonly CardCostRow[] = [
  {
    id: 'annual-fee',
    labelKey: 'דמי כרטיס שנתיים',
    testID: 'card-dna-cost-annual-fee',
  },
  {
    id: 'monthly-fee',
    labelKey: 'דמי כרטיס חודשיים',
    testID: 'card-dna-cost-monthly-fee',
  },
  {
    id: 'fx-commission',
    labelKey: 'עמלת מט"ח',
    testID: 'card-dna-cost-fx-commission',
  },
  {
    id: 'foreign-atm-fee',
    labelKey: 'עמלת משיכת מזומן בחו"ל',
    testID: 'card-dna-cost-foreign-atm-fee',
  },
  {
    id: 'interest-rates',
    labelKey: 'שיעורי ריבית',
    testID: 'card-dna-cost-interest-rates',
  },
  {
    id: 'other-costs',
    labelKey: 'עלויות נוספות',
    testID: 'card-dna-cost-other-costs',
  },
];
