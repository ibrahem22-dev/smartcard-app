export type CardDnaSectionId = 'a' | 'b' | 'c' | 'd';

export interface CardDnaSection {
  readonly id: CardDnaSectionId;
  readonly titleKey: string;
  readonly testID: string;
}

export const CARD_DNA_SECTIONS: readonly CardDnaSection[] = [
  { id: 'a', titleKey: 'מה זה עולה לי', testID: 'card-dna-section-a' },
  { id: 'b', titleKey: 'מה זה נותן לי', testID: 'card-dna-section-b' },
  { id: 'c', titleKey: 'מתי הכי טוב להשתמש', testID: 'card-dna-section-c' },
  { id: 'd', titleKey: 'מה פעיל עכשיו', testID: 'card-dna-section-d' },
];
