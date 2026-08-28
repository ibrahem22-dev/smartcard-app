/**
 * A6's evidence: the population is derived, and it would collapse if either source went away.
 *
 * The claim is not "there are five surfaces" — a hand-written list satisfies that. The claim is
 * that the set COMES FROM the navigation declaration and the shipped packs, so that adding a
 * segment to `ia.ts` adds a surface here without anybody editing this file, and removing one takes
 * it away. Each case below is written to fail if that stops being true.
 */
import { BOTTOM_NAVIGATION } from '../../navigation/ia';
import { currentCatalogProducts } from '../../data/adapter/catalogSearch';
import {
  CARD_DNA_ROUTE,
  CARD_DNA_STACK,
  derivedCardCount,
  derivedCardIds,
  derivedContexts,
  derivedSurfaces,
  POPULATION_AS_OF,
  POPULATION_THROUGH,
} from '../population';
import { evaluateSurfaceEngines } from '../surfaceEngines';

describe('the derived agreement population', () => {
  it('is not empty — a check over zero surfaces fails, and so does this', () => {
    expect(derivedSurfaces().length).toBeGreaterThan(0);
    expect(derivedContexts().length).toBeGreaterThan(0);
    expect(derivedCardIds().length).toBeGreaterThan(0);
  });

  it('names all five P5 surfaces exactly once', () => {
    const ids = derivedSurfaces().map((s) => s.id).sort();
    expect(ids).toEqual(['card-dna', 'home', 'plan-calendar', 'plan-commitments', 'wallet-cards']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('takes four of them from the navigation declaration, by its own keys', () => {
    const fromNav = derivedSurfaces().filter((s) => s.derivedFrom === 'BOTTOM_NAVIGATION');
    expect(fromNav).toHaveLength(4);
    /* Every navKey must resolve in ia.ts. A key this file invented would not. */
    for (const s of fromNav) {
      const [tab, segment] = s.navKey.split('/');
      const item = BOTTOM_NAVIGATION.find((i) => i.key === tab);
      expect(item).toBeDefined();
      if (segment !== undefined) {
        expect((item?.segments ?? []).some((seg) => seg.key === segment)).toBe(true);
      }
    }
  });

  it('takes the fifth from a route, and says so, because a tab list cannot yield it', () => {
    const cardDna = derivedSurfaces().find((s) => s.id === 'card-dna');
    expect(cardDna?.derivedFrom).toBe('WalletStack route');
    expect(cardDna?.navKey).toBe(CARD_DNA_ROUTE);
    /* Card DNA really is absent from the tab declaration — assumption A21. If it ever appears
       there, this fails and the derivation should move, rather than both being true at once. */
    expect(BOTTOM_NAVIGATION.some((i) => i.key === CARD_DNA_ROUTE)).toBe(false);
    expect(CARD_DNA_STACK).toContain('WalletStack');
  });

  it('does not treat the Wallet Benefits segment as a P5 surface', () => {
    /* It exists in the declaration, and it is V1.x: spec §26 and contract §17. A population that
       swept up every segment would put a surface P5 does not own into every agreement property. */
    const wallet = BOTTOM_NAVIGATION.find((i) => i.key === 'Wallet');
    expect((wallet?.segments ?? []).some((s) => s.key === 'Benefits')).toBe(true);
    expect(derivedSurfaces().some((s) => s.navKey === 'Wallet/Benefits')).toBe(false);
  });

  it('takes its card ids from the shipped catalog pack, not from this file', () => {
    const current = currentCatalogProducts();
    expect(derivedCardCount()).toBe(current.length);
    expect(derivedCardCount()).toBeGreaterThan(100);
    for (const id of derivedCardIds(3)) {
      expect(current.some((p) => p.cardId === id)).toBe(true);
    }
  });

  it('carries the boundary contexts two implementations of one rule diverge on', () => {
    const labels = derivedContexts().map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining([
      'exactly the warning threshold',
      'exactly the strong-warning threshold',
      'exactly the blocked threshold',
      'a settled hold the user marked Paid early',
      'a card billing on the last day of the window',
    ]));
  });

  it('lands exactly on the thresholds rather than near them', () => {
    const byLabel = (l: string) => derivedContexts().find((c) => c.label === l)?.context;
    const strong = evaluateSurfaceEngines(byLabel('exactly the strong-warning threshold') as never);
    expect(strong.load?.current.ratioOfIncome.value).toBe(0.35);
    /* And the engine's own boundary semantics are what decide the band at that exact point:
       0.35 is NOT strong_warning, because classify() tests `ratio > strongWarningRatio`. A
       population that only ever landed at 0.34 and 0.36 would never have told anyone. */
    expect(strong.load?.current.band).toBe('warning');
    const blocked = evaluateSurfaceEngines(byLabel('exactly the blocked threshold') as never);
    expect(blocked.load?.current.ratioOfIncome.value).toBe(0.5);
    expect(blocked.load?.current.band).toBe('strong_warning');
  });

  it('includes the states in which an engine must decline rather than answer', () => {
    const byLabel = (l: string) => derivedContexts().find((c) => c.label === l)?.context;
    const noIncome = evaluateSurfaceEngines(byLabel('no income captured — the honest unknown, not a zero') as never);
    expect(noIncome.load).toBeNull();
    const noCards = evaluateSurfaceEngines(byLabel('no cards in the vault') as never);
    expect(noCards.scoring).toBeNull();
  });

  it('fixes its window rather than reading a clock, so a property cannot pass only today', () => {
    expect(POPULATION_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(POPULATION_THROUGH).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const c of derivedContexts()) {
      expect(c.context.asOfDate).toBe(POPULATION_AS_OF);
      expect(c.context.throughDate).toBe(POPULATION_THROUGH);
    }
  });

  it('every context evaluates without an engine throwing', () => {
    for (const c of derivedContexts()) {
      expect(() => evaluateSurfaceEngines(c.context)).not.toThrow();
    }
  });
});
