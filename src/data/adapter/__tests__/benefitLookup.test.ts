import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CardIssuer } from '../../../types/card.types';
import type { BenefitsClub, BenefitsDB } from '../../../types/benefits.types';
import { clubForCard, ISSUER_DATABASE_KEYS } from '../benefitLookup';

const MAX_CLUB: BenefitsClub = {
  benefits: [
    {
      category: 'groceries',
      type: 'cashback',
      value: 5,
      isInternationalOnly: false,
      description: 'Five percent back',
    },
  ],
};

const BENEFITS_DB: BenefitsDB = {
  issuers: {
    Max: {
      clubs: {
        'Max Club': MAX_CLUB,
      },
    },
  },
};

describe('benefit lookup', () => {
  it('maps every CardIssuer to a database key', () => {
    expect(ISSUER_DATABASE_KEYS).toEqual({
      [CardIssuer.Max]: 'Max',
      [CardIssuer.Isracard]: 'Isracard',
      [CardIssuer.Cal]: 'CAL',
    });
    expect(Object.keys(ISSUER_DATABASE_KEYS)).toHaveLength(
      Object.values(CardIssuer).length,
    );
  });

  it('finds the club a card belongs to', () => {
    expect(
      clubForCard(
        { issuer: CardIssuer.Max, displayName: 'Max Club' },
        BENEFITS_DB,
      ),
    ).toBe(MAX_CLUB);
  });

  it('returns undefined when the issuer is absent from the database', () => {
    expect(
      clubForCard(
        { issuer: CardIssuer.Cal, displayName: 'Max Club' },
        BENEFITS_DB,
      ),
    ).toBeUndefined();
  });

  it('returns undefined when the card is in no club of its issuer', () => {
    expect(
      clubForCard(
        { issuer: CardIssuer.Max, displayName: 'Unknown Club' },
        BENEFITS_DB,
      ),
    ).toBeUndefined();
  });

  it('is the only mapping — the engine and the card DNA surface both read it', () => {
    const engineSource = readFileSync(
      resolve(process.cwd(), 'src/engines/benefitsMatcher.ts'),
      'utf8',
    );
    const surfaceSource = readFileSync(
      resolve(process.cwd(), 'src/screens/cardDna/benefitRows.ts'),
      'utf8',
    );

    expect(engineSource).toContain("from '../data/adapter/benefitLookup'");
    expect(surfaceSource).toContain(
      "from '../../data/adapter/benefitLookup'",
    );
    expect(engineSource).not.toMatch(/\bconst\s+ISSUER_DATABASE_KEYS\b/u);
    expect(surfaceSource).not.toMatch(/\bconst\s+ISSUER_DATABASE_KEYS\b/u);
  });
});
