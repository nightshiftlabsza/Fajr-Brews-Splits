/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoffeeCostSummary } from './CoffeeCostSummary';
import { calculate } from '../../lib/calculations';
import type { Order } from '../../types';

describe('CoffeeCostSummary Component (BUG-MONEY-03)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      container.remove();
    }
    container = null;
    root = null;
  });

  function renderComponent(order: Order) {
    const result = calculate(order, {});
    act(() => {
      root!.render(<CoffeeCostSummary result={result} />);
    });
    return { result, html: container!.innerHTML, text: container!.textContent || '' };
  }

  it('renders order totals without standalone fees row when all fees attach to coffee', () => {
    const order: Order = {
      id: 'order-1',
      workspaceId: 'ws-1',
      name: 'Order 1',
      orderDate: '2026-10-23',
      roasterId: null,
      roasterSnapshot: null,
      payerId: 'buyer-1',
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 400,
      lots: [
        {
          id: 'lot-1',
          name: 'Ethiopia Yirg',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 2,
          bags: [
            { id: 'b1', splitMode: 'full', buyers: [{ id: 'by1', personId: 'buyer-1', grams: 250 }] },
            { id: 'b2', splitMode: 'full', buyers: [{ id: 'by2', personId: 'buyer-2', grams: 250 }] },
          ],
          shares: [],
        },
      ],
      fees: [
        { id: 'f1', label: 'Shipping', amountZar: 100, allocationType: 'equal_per_person' },
      ],
      payments: {},
      isArchived: false,
      createdAt: '2026-10-23T00:00:00Z',
      updatedAt: '2026-10-23T00:00:00Z',
    };

    const { text } = renderComponent(order);

    // Standalone fees row should NOT be present
    expect(text).not.toContain('Standalone & participant fees');
    // Lot row should be present
    expect(text).toContain('Ethiopia Yirg');
    // Order total row should be present
    expect(text).toContain('Order total');
    expect(text).toContain('R500.00'); // 400 goods + 100 fee
  });

  it('renders standalone fees row and cleanly reconciles table to totalOrderZar when standalone fees exist', () => {
    const order: Order = {
      id: 'order-2',
      workspaceId: 'ws-1',
      name: 'Order 2',
      orderDate: '2026-10-23',
      roasterId: null,
      roasterSnapshot: null,
      payerId: 'buyer-1',
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 600,
      lots: [
        {
          id: 'lot-1',
          name: 'Kenya Nyeri',
          foreignPricePerBag: 25,
          gramsPerBag: 250,
          quantity: 1,
          bags: [
            { id: 'b1', splitMode: 'full', buyers: [{ id: 'by1', personId: 'buyer-1', grams: 250 }] },
          ],
          shares: [],
        },
      ],
      fees: [
        // Standalone specific fee on a 0g non-buyer
        { id: 'f-pudo', label: 'PUDO Courier', amountZar: 65, allocationType: 'specific_person', personId: 'non-buyer' },
      ],
      payments: {},
      isArchived: false,
      createdAt: '2026-10-23T00:00:00Z',
      updatedAt: '2026-10-23T00:00:00Z',
    };

    const { text, result } = renderComponent(order);

    // Both coffee lot and standalone row should be rendered
    expect(text).toContain('Kenya Nyeri');
    expect(text).toContain('R600.00'); // coffee lot total
    expect(text).toContain('Standalone & participant fees');
    expect(text).toContain('R65.00'); // standalone fee
    expect(text).toContain('Order total');
    expect(text).toContain('R665.00'); // order grand total

    // Verify mathematical reconciliation: lot totals + standalone fees === totalOrderZar
    const lotsTotal = result.lotCalcs.reduce((s, l) => s + l.totalZar, 0);
    const standaloneFees = Math.max(0, Math.round((result.totalOrderZar - lotsTotal) * 100) / 100);

    expect(lotsTotal).toBe(600);
    expect(standaloneFees).toBe(65);
    expect(lotsTotal + standaloneFees).toBe(result.totalOrderZar);
  });
});
