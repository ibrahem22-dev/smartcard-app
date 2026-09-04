import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../../components/AppText';
import { CardTile } from '../../components/CardTile';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation, type UseTranslationResult } from '../../hooks/useTranslation';
import { maskLast4 } from '../../media/maskLast4';
import type { WalletStackParamList } from '../../navigation/types';
import { readCardCost } from '../../store/cardCostResolution';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import {
  CardIssuer,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import { ltrNumerals } from '../../utils/calendar';
import { TABULAR_NUMERALS } from '../../utils/money';
import {
  WALLET_TILE_ELEMENTS,
} from './tileElements';
import type { WalletTileElementId } from './tileElements';
import { isForeignAmount, tileChipFor } from './tileDiscipline';
import { WaiverBadge } from './WaiverBadge';
import { WalletBestForChips } from './WalletBestForChips';
import { WalletLimitBar } from './WalletLimitBar';

type WalletNavigation = NativeStackNavigationProp<
  WalletStackParamList,
  'WalletRoot'
>;

export interface WalletTileProps {
  readonly card?: CardInput;
}

const ISSUER_LABELS: Readonly<Record<CardIssuer, string>> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

function roleLabel(
  role: CardRole | null,
  t: UseTranslationResult['t'],
): string | null {
  switch (role) {
    case CardRole.Daily:
      return t('יומיומי');
    case CardRole.Travel:
      return t('לנסיעות');
    case CardRole.Subscriptions:
      return t('למנויים');
    case CardRole.Installments:
      return t('לתשלומים');
    case CardRole.Education:
      return t('לחינוך');
    case CardRole.Benefits:
      return t('להטבות');
    case null:
      return null;
  }
}

function issuerOrClub(card: CardInput): string {
  if (card.unknownClub !== true && card.bankName?.trim()) {
    return card.bankName.trim();
  }

  return ISSUER_LABELS[card.issuer];
}

function expectedTestID(id: WalletTileElementId): string {
  switch (id) {
    case 'nickname-with-role':
      return 'wallet-tile-nickname-with-role';
    case 'issuer-or-club':
      return 'wallet-tile-issuer-or-club';
    case 'masked-digits':
      return 'wallet-tile-masked-digits';
    case 'limit-bar':
      return 'wallet-tile-limit-bar';
    case 'waiver-badge':
      return 'wallet-tile-waiver-badge';
    case 'best-for-chips':
      return 'wallet-tile-best-for-chips';
  }
}

export function WalletTile({ card }: WalletTileProps): React.ReactElement {
  const { t } = useTranslation();
  const { amount, money } = useMoney();
  const navigation = useNavigation<WalletNavigation>();

  if (card === undefined) {
    return <View />;
  }

  const role = roleLabel(card.primaryRole, t);
  const mask = maskLast4(card.last4);
  const annualFee = readCardCost(card, 'annual-fee');
  const annualFeeFigure = (() => {
    if (annualFee.kind === 'unknown') return null;

    const value = annualFee.kind === 'known'
      ? Number(annualFee.value)
      : card.annualFee;
    if (!Number.isFinite(value)) return null;

    return {
      chip: tileChipFor(
        annualFee.kind === 'known'
          ? { state: 'KNOWN', provenance: annualFee.chip }
          : annualFee.conflict,
      ),
      value,
    };
  })();

  const renderElement = (
    id: WalletTileElementId,
    testID: string,
  ): React.ReactElement => {
    if (testID !== expectedTestID(id)) {
      throw new Error(`Wallet tile element ${id} has an invalid testID`);
    }

    switch (id) {
      case 'nickname-with-role':
        return (
          <View key={id} testID={testID}>
            <CardTile
              context={{ issuerId: card.issuer }}
              last4={card.last4}
              nickname={card.displayName}
              nicknameTestID="wallet-tile-nickname"
              subject={{
                subjectKind: 'card',
                subjectId: card.cardId,
                fallbackClass: 'card',
              }}
              testID="wallet-card-tile"
            />
            {role === null ? null : (
              <RtlRow
                className={`mt-2 rounded-full border px-2 py-1 ${BORDER.hairline} ${SURFACE.raised}`}
                testID="wallet-tile-role-tag"
              >
                <AppText className={`text-xs font-bold ${TEXT.body}`}>
                  {role}
                </AppText>
              </RtlRow>
            )}
            {annualFeeFigure === null ? null : (
              <RtlRow
                className="mt-2 items-center justify-between gap-3"
                testID="wallet-tile-annual-fee"
              >
                <AppText className={`text-sm ${TEXT.secondary}`}>
                  {t('דמי כרטיס שנתיים')}
                </AppText>
                <View className="gap-1">
                  <AppText
                    className={`text-sm font-extrabold ${TEXT.heading}`}
                    style={TABULAR_NUMERALS}
                    testID="wallet-tile-annual-fee-value"
                  >
                    {isForeignAmount(card.currency)
                      ? `${amount(annualFeeFigure.value)} ${card.currency}`
                      : money(annualFeeFigure.value)}
                  </AppText>
                  <ProvenanceChip
                    testID="wallet-tile-annual-fee-chip"
                    view={{ chip: annualFeeFigure.chip, stale: false }}
                  />
                </View>
              </RtlRow>
            )}
          </View>
        );
      case 'issuer-or-club':
        return (
          <AppText
            className={`mt-2 text-sm ${TEXT.secondary}`}
            key={id}
            testID={testID}
          >
            {issuerOrClub(card)}
          </AppText>
        );
      case 'masked-digits':
        return (
          <View key={id} testID={testID}>
            {mask === null ? null : (
              <AppText className={`mt-1 text-sm ${TEXT.secondary}`}>
                {ltrNumerals(mask)}
              </AppText>
            )}
          </View>
        );
      case 'limit-bar':
        return (
          <View key={id} testID={testID}>
            <WalletLimitBar cardId={card.cardId} />
          </View>
        );
      case 'waiver-badge':
        return (
          <View key={id} testID={testID}>
            <WaiverBadge card={card} />
          </View>
        );
      case 'best-for-chips':
        return (
          <View key={id} testID={testID}>
            <WalletBestForChips cardId={card.cardId} />
          </View>
        );
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-[48px] justify-center w-full"
      onPress={(): void =>
        navigation.navigate('CardDetail', { cardId: card.cardId })
      }
      testID="wallet-tile"
    >
      {WALLET_TILE_ELEMENTS.map((element) =>
        renderElement(element.id, element.testID),
      )}
    </Pressable>
  );
}
