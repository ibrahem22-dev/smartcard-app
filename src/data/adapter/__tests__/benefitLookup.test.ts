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

  /*
   * THE TWO DECLARATIONS ARE COMPARED, BECAUSE ONE OF THEM MAY NOT BE TOUCHED.
   *
   * The first version of this case required the engine to IMPORT the shared map — one home, no
   * duplication, which is the better shape. It cost a P3-era file a byte of change, and
   * src/engines/benefitsMatcher.ts is covered by P3's boundary record: editing it opened P4's
   * intake I5, then P4's boundary C1, then P5's I5 and C1, and PHASE-3 could not close. Nothing
   * was functionally broken — P4's 41-gate ladder ran green — but a closed phase's verification
   * stopped covering the code, and P5 may not re-measure P3's boundary to fix that: its own C7
   * forbids re-opening P3. See D-021.
   *
   * So the engine keeps its own map and this case does the comparing instead. That is weaker than
   * one home and much stronger than a comment: if either declaration is edited without the other,
   * this fails and names both. The duplication is visible rather than silent, which is the whole
   * remedy — six defects in one day of this campaign were one fact in two files with nothing
   * comparing them.
   */
  it('is the only mapping — the engine and the card DNA surface both read it', () => {
    const engineSource = readFileSync(
      resolve(process.cwd(), 'src/engines/benefitsMatcher.ts'),
      'utf8',
    );
    const surfaceSource = readFileSync(
      resolve(process.cwd(), 'src/screens/cardDna/benefitRows.ts'),
      'utf8',
    );

    /* The surface has no map of its own: it reads the shared one. */
    expect(surfaceSource).toContain("from '../../data/adapter/benefitLookup'");
    expect(surfaceSource).not.toMatch(/\bconst\s+ISSUER_DATABASE_KEYS\b/u);

    /* The engine keeps its own, and the DATABASE KEYS must agree — those are what drift. */
    const engineLiteral = engineSource.match(
      /const\s+ISSUER_DATABASE_KEYS[^=]*=\s*\{([\s\S]*?)\};/u,
    );
    expect(engineLiteral).not.toBeNull();

    const engineKeys = [...(engineLiteral?.[1] ?? '').matchAll(/:\s*'([^']+)'/gu)]
      .map(([, key]) => key)
      .sort();
    const sharedKeys = Object.values(ISSUER_DATABASE_KEYS).sort();

    expect(engineKeys.length).toBeGreaterThan(0);
    expect(engineKeys).toEqual(sharedKeys);
  });
});
