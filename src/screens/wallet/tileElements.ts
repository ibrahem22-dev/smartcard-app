export type WalletTileElementId =
  | 'nickname-with-role'
  | 'issuer-or-club'
  | 'masked-digits'
  | 'limit-bar'
  | 'waiver-badge'
  | 'best-for-chips';

export interface WalletTileElement {
  readonly id: WalletTileElementId;
  readonly testID: string;
}

export const WALLET_TILE_ELEMENTS: readonly WalletTileElement[] = [
  {
    id: 'nickname-with-role',
    testID: 'wallet-tile-nickname-with-role',
  },
  {
    id: 'issuer-or-club',
    testID: 'wallet-tile-issuer-or-club',
  },
  {
    id: 'masked-digits',
    testID: 'wallet-tile-masked-digits',
  },
  {
    id: 'limit-bar',
    testID: 'wallet-tile-limit-bar',
  },
  {
    id: 'waiver-badge',
    testID: 'wallet-tile-waiver-badge',
  },
  {
    id: 'best-for-chips',
    testID: 'wallet-tile-best-for-chips',
  },
];
