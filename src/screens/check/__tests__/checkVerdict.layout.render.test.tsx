/**
 * D3's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §9 layout, top to bottom. Among sections that exist, order is:
 * pill · context line · Financial Impact · (later PHASE-2 blocks).
 * A section this package has not built is omitted, not faked.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { Currency } from '../../../types/purchase.types';

const SPEC_SECTIONS: { readonly id: string; readonly match: RegExp }[] = [
  { id: 'pill', match: /^check-verdict-pill-/ },
  { id: 'context', match: /^check-verdict-context$/ },
  { id: 'impact', match: /^check-verdict-impact-panel$/ },
  { id: 'recommendation', match: /^check-verdict-recommendation$/ },
  { id: 'runner-up', match: /^check-verdict-runner-up$/ },
  { id: 'fx', match: /^check-verdict-fx$/ },
  { id: 'strip', match: /^check-verdict-impact-strip$/ },
  { id: 'freshness', match: /^check-verdict-freshness$/ },
];

const REQUIRED_NOW = ['pill', 'context', 'impact'] as const;

type JsonNode = {
  readonly props?: { readonly testID?: string };
  readonly children?: JsonNode | readonly JsonNode[] | null;
};

function collectTestIds(node: unknown, acc: string[] = []): string[] {
  if (node === null || node === undefined) return acc;
  if (Array.isArray(node)) {
    for (const child of node) collectTestIds(child, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  const obj = node as JsonNode;
  const id = obj.props?.testID;
  if (typeof id === 'string' && id.length > 0) acc.push(id);
  collectTestIds(obj.children, acc);
  return acc;
}

const sectionOrder = (ids: readonly string[]): string[] => {
  const found: string[] = [];
  for (const id of ids) {
    const section = SPEC_SECTIONS.find((s) => s.match.test(id));
    if (section && found[found.length - 1] !== section.id) found.push(section.id);
  }
  return found;
};

const draft: CheckInputDraft = {
  amount: 4_100,
  currency: Currency.ILS,
  category: null,
  installments: 1,
  cardId: null,
};

const result = runPurchaseCheck(draft, {
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [],
});

const mount = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CheckVerdictScreen
        contextLine={{
          amount: draft.amount,
          currencySymbol: '₪',
          categoryLabel: null,
          installmentCount: 1,
        }}
        result={result}
      />
    </SafeAreaProvider>,
  );

describe('Check Verdict — D3: spec §9 layout order', () => {
  it('renders pill, context line and Financial Impact in spec order, top to bottom', () => {
    const view = mount();
    const ids = collectTestIds(view.toJSON() as JsonNode);
    const order = sectionOrder(ids);
    for (const required of REQUIRED_NOW) {
      expect(order).toContain(required);
    }
    const present = SPEC_SECTIONS.map((s) => s.id).filter((id) => order.includes(id));
    expect(order.filter((id) => present.includes(id))).toEqual(present);
  });

  it('the context line paints the user-entered amount, not an engine recomputation', () => {
    const { getByTestId } = mount();
    const line = String(getByTestId('check-verdict-context').props.children);
    expect(line).toContain('4100');
    expect(line).toContain('₪');
  });

  it('later §9 blocks, if present, still follow the spec after Financial Impact', () => {
    const view = mount();
    const order = sectionOrder(collectTestIds(view.toJSON() as JsonNode));
    const impactAt = order.indexOf('impact');
    expect(impactAt).toBeGreaterThanOrEqual(0);
    for (const later of ['recommendation', 'runner-up', 'fx', 'strip', 'freshness']) {
      const at = order.indexOf(later);
      if (at >= 0) expect(at).toBeGreaterThan(impactAt);
    }
  });
});
