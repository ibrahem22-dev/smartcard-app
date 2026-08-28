import React, { act } from 'react';

import { evaluateSurfaceEngines } from '../surfaceEngines';
import type { SurfaceContext } from '../surfaceContext';
import { usePaidEarly, type UsePaidEarlyResult } from '../usePaidEarly';

interface TestRendererInstance {
  unmount(): void;
}

const TestRenderer = require('react-test-renderer') as {
  readonly create: (element: React.ReactElement) => TestRendererInstance;
};

const baseContext = (paidEarlyCommitmentIds?: readonly string[]): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: {
    id: 'profile:paid-early-hook',
    monthlyIncome: 10_000,
    createdAt: 1,
    updatedAt: 1,
  },
  cards: [],
  installments: [{
    installmentId: 'inst:new',
    billingCardId: 'card:unlinked',
    merchantName: 'Test commitment',
    monthlyPayment: 200,
    monthsRemaining: 3,
    totalAmount: 600,
    source: 'imported',
  }],
  loans: [],
  purchases: [],
  ...(paidEarlyCommitmentIds === undefined ? {} : { paidEarlyCommitmentIds }),
});

function mountHook(context: SurfaceContext): {
  readonly current: () => UsePaidEarlyResult;
  readonly renderer: TestRendererInstance;
} {
  let latest: UsePaidEarlyResult | undefined;

  function Probe(): null {
    latest = usePaidEarly(context);
    return null;
  }

  let renderer: TestRendererInstance | undefined;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  return {
    current: () => {
      if (latest === undefined) throw new Error('the Paid-early hook did not render');
      return latest;
    },
    renderer: renderer as TestRendererInstance,
  };
}

describe('usePaidEarly', () => {
  it('starts from the ids the context already carries', () => {
    const hook = mountHook(baseContext(['inst:existing']));

    expect(hook.current().paidEarlyCommitmentIds).toEqual(['inst:existing']);
    expect(hook.current().context.paidEarlyCommitmentIds).toEqual(['inst:existing']);
    hook.renderer.unmount();
  });

  it('adds a commitment to the paid-early set', () => {
    const hook = mountHook(baseContext(['inst:existing']));

    act(() => hook.current().markPaidEarly('inst:new'));

    expect(hook.current().paidEarlyCommitmentIds).toEqual(['inst:existing', 'inst:new']);
    hook.renderer.unmount();
  });

  it('produces a context the engine can be evaluated with', () => {
    const hook = mountHook(baseContext());
    act(() => hook.current().markPaidEarly('inst:new'));

    const result = evaluateSurfaceEngines(hook.current().context);

    expect(result.load?.paidEarlyCommitmentIds).toEqual(['inst:new']);
    expect(result.context).toBe(hook.current().context);
    hook.renderer.unmount();
  });

  it('computes no freed figure of its own', () => {
    const hook = mountHook(baseContext());
    act(() => hook.current().markPaidEarly('inst:new'));

    expect(Object.keys(hook.current()).sort()).toEqual([
      'context',
      'markPaidEarly',
      'paidEarlyCommitmentIds',
    ]);
    expect(hook.current()).not.toHaveProperty('releasedByEarlyPayoffIls');
    hook.renderer.unmount();
  });
});
