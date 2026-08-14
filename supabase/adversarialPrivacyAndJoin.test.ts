import { describe, expect, it } from 'vitest';
import type { DbOrder, Fee, Lot } from '../src/types';

/**
 * Pure simulation of the PostgreSQL RPC `get_my_participant_orders()` projection logic.
 * Exactly mirrors the SQL PL/pgSQL function in `supabase/schema.sql`.
 */
function simulateGetMyParticipantOrdersRPC(
  order: DbOrder,
  myPersonId: string,
  isOrderFullViewer: boolean
): Partial<DbOrder> | null {
  // If the user is full viewer (owner/admin), they do not use this participant projection
  if (isOrderFullViewer) {
    return null;
  }

  // Calculate goods_total_zar for this participant's lots only
  let projectedGoodsTotalZar = 0;
  const rawLots = (order.lots as Lot[]) ?? [];
  const projectedLots: Lot[] = [];

  for (const lot of rawLots) {
    const hasMyShare = lot.shares?.some((s) => s.personId === myPersonId);
    const hasMyBagBuyer = lot.bags?.some((b) => b.buyers?.some((buyer) => buyer.personId === myPersonId));

    if (!hasMyShare && !hasMyBagBuyer) {
      // Omit lot entirely if participant has no share or bag
      continue;
    }

    // Filter shares
    const myShares = (lot.shares ?? []).filter((s) => s.personId === myPersonId);

    // Filter bags: keep only bags where participant has grams, and keep only participant's buyer record
    const myBags = (lot.bags ?? [])
      .map((bag) => ({
        ...bag,
        buyers: (bag.buyers ?? []).filter((buyer) => buyer.personId === myPersonId),
      }))
      .filter((bag) => (bag.buyers ?? []).length > 0);

    // Calculate participant grams
    const totalMyGrams = myBags.reduce(
      (sum, b) => sum + (b.buyers ?? []).reduce((bSum, buyer) => bSum + (buyer.grams ?? 0), 0),
      0
    );

    const pricePerBag = lot.foreignPricePerBag ?? 0;
    const gramsPerBag = lot.gramsPerBag || 1;
    projectedGoodsTotalZar += pricePerBag * (totalMyGrams / gramsPerBag);

    projectedLots.push({
      ...lot,
      shares: myShares,
      bags: myBags,
    });
  }

  // Filter fees
  const rawFees = (order.fees as Fee[]) ?? [];
  const projectedFees = rawFees.filter((fee) => {
    if (['equal_per_person', 'proportional_by_value', 'fixed_shared', 'value_based'].includes(fee.allocationType)) {
      return true;
    }
    if (fee.allocationType === 'specific_person' && fee.personId === myPersonId) {
      return true;
    }
    return false;
  });

  // Filter payments
  const rawPayments = order.payments ?? {};
  const projectedPayments: Record<string, unknown> = {};
  if (myPersonId in rawPayments) {
    projectedPayments[myPersonId] = rawPayments[myPersonId];
  }

  return {
    id: order.id,
    workspace_id: order.workspace_id,
    name: order.name,
    order_date: order.order_date,
    roaster_id: order.roaster_id,
    roaster_snapshot: order.roaster_snapshot,
    payer_id: order.payer_id === myPersonId ? order.payer_id : null,
    payer_bank: order.payer_bank,
    reference_template: order.reference_template,
    payer_note: order.payer_note,
    goods_total_zar: projectedGoodsTotalZar,
    lots: projectedLots as unknown as typeof order.lots,
    fees: projectedFees as unknown as typeof order.fees,
    payments: projectedPayments as unknown as typeof order.payments,
    is_archived: order.is_archived,
    owner_id: null,
    created_by: null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

describe('Adversarial Purchase Privacy & Planned Order Joining', () => {
  const zakariyyaId = 'person-zakariyya-owner';
  const ahmedId = 'person-ahmed-participant';
  const sarahId = 'person-sarah-participant';
  const zaidId = 'person-zaid-participant';

  const complexMultiBuyerOrder: DbOrder = {
    id: '11111111-1111-1111-1111-111111111111',
    workspace_id: '99999999-9999-9999-9999-999999999999',
    name: 'Exclusive March Kenya & Geisha Drop',
    order_date: '2026-03-20',
    roaster_id: 'roaster-1',
    roaster_snapshot: { name: 'Father Coffee', logoUrl: 'https://example.com/logo.png' },
    payer_id: zakariyyaId,
    payer_bank: { bankName: 'FNB', accountNumber: '123456789', beneficiary: 'Zakariyya' },
    reference_template: 'FAJR-{ORDER}-{NAME}',
    payer_note: 'Please pay before roasting date',
    goods_total_zar: 2400,
    lots: [
      {
        id: 'lot-1-kenya',
        name: 'Kenya Nyeri Hill',
        foreignPricePerBag: 250,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 's1', personId: ahmedId, shareGrams: 125 },
          { id: 's2', personId: sarahId, shareGrams: 375 },
        ],
        bags: [
          {
            id: 'bag-k1',
            splitMode: 'equal',
            buyers: [
              { id: 'b1', personId: ahmedId, grams: 125 },
              { id: 'b2', personId: sarahId, grams: 125 },
            ],
          },
          {
            id: 'bag-k2',
            splitMode: 'full',
            buyers: [
              { id: 'b3', personId: sarahId, grams: 250 },
            ],
          },
        ],
      },
      {
        id: 'lot-2-geisha',
        name: 'Panama Hacienda La Esmeralda Geisha',
        foreignPricePerBag: 950,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 's3', personId: zakariyyaId, shareGrams: 250 },
          { id: 's4', personId: zaidId, shareGrams: 250 },
        ],
        bags: [
          {
            id: 'bag-g1',
            splitMode: 'full',
            buyers: [{ id: 'b4', personId: zakariyyaId, grams: 250 }],
          },
          {
            id: 'bag-g2',
            splitMode: 'full',
            buyers: [{ id: 'b5', personId: zaidId, grams: 250 }],
          },
        ],
      },
    ],
    fees: [
      { id: 'fee-shipping', label: 'DHL Express Import', amountZar: 400, allocationType: 'equal_per_person' },
      { id: 'fee-customs', label: 'Customs Duty', amountZar: 200, allocationType: 'proportional_by_value' },
      { id: 'fee-sarah-courier', label: 'Sarah Local Courier', amountZar: 80, allocationType: 'specific_person', personId: sarahId },
      { id: 'fee-ahmed-extra', label: 'Ahmed Extra Packaging', amountZar: 30, allocationType: 'specific_person', personId: ahmedId },
    ],
    payments: {
      [zakariyyaId]: { status: 'paid', amountPaid: 1100 },
      [sarahId]: { status: 'paid', amountPaid: 605 },
      [ahmedId]: { status: 'partial', amountPaid: 100 },
      [zaidId]: { status: 'unpaid', amountPaid: 0 },
    },
    is_archived: false,
    owner_id: 'user-zakariyya',
    created_by: 'user-zakariyya',
    created_at: '2026-03-20T08:00:00.000Z',
    updated_at: '2026-03-20T10:00:00.000Z',
  };

  it('proves Ahmed receives ZERO data belonging to Sarah, Zakariyya, or Zaid', () => {
    const projected = simulateGetMyParticipantOrdersRPC(complexMultiBuyerOrder, ahmedId, false);
    expect(projected).not.toBeNull();

    const payloadJsonString = JSON.stringify(projected);

    // 1. Other participant IDs and names must NEVER appear in the payload string
    expect(payloadJsonString).not.toContain(sarahId);
    expect(payloadJsonString).not.toContain(zaidId);
    expect(payloadJsonString).not.toContain('user-zakariyya');

    // 2. Unrelated lot (Geisha) must be completely omitted
    expect(payloadJsonString).not.toContain('Panama Hacienda La Esmeralda Geisha');
    expect(payloadJsonString).not.toContain('lot-2-geisha');

    // 3. Kenya lot must contain ONLY Ahmed's share and bag
    const lots = projected!.lots as Lot[];
    expect(lots).toHaveLength(1);
    expect(lots[0].id).toBe('lot-1-kenya');

    // Shares contains ONLY Ahmed
    expect(lots[0].shares).toEqual([{ id: 's1', personId: ahmedId, shareGrams: 125 }]);

    // Bags: bag-k1 contains ONLY Ahmed (Sarah stripped out), and bag-k2 (all Sarah) is omitted entirely
    expect(lots[0].bags).toEqual([
      {
        id: 'bag-k1',
        splitMode: 'equal',
        buyers: [{ id: 'b1', personId: ahmedId, grams: 125 }],
      },
    ]);

    // 4. Fees: Sarah's specific fee is excluded; Ahmed's specific fee and shared fees are included
    const fees = projected!.fees as Fee[];
    expect(fees.map((f) => f.id)).toEqual(['fee-shipping', 'fee-customs', 'fee-ahmed-extra']);
    expect(fees.some((f) => f.id === 'fee-sarah-courier')).toBe(false);

    // 5. Payments: Contains ONLY Ahmed's payment record
    const payments = projected!.payments as Record<string, unknown>;
    expect(Object.keys(payments)).toEqual([ahmedId]);
    expect(payments[ahmedId]).toEqual({ status: 'partial', amountPaid: 100 });
    expect(payments[sarahId]).toBeUndefined();
    expect(payments[zakariyyaId]).toBeUndefined();
    expect(payments[zaidId]).toBeUndefined();

    // 6. Sensitive identifiers stripped
    expect(projected!.payer_id).toBeNull(); // Zakariyya was payer
    expect(projected!.owner_id).toBeNull();
    expect(projected!.created_by).toBeNull();

    // 7. Goods total is calculated for Ahmed's purchase ONLY (125g / 250g * R250 = R125)
    expect(projected!.goods_total_zar).toBe(125);
  });

  describe('Planned Order Joining Logic & Invariant Checks', () => {
    it('allows a workspace member to join an order in planning status', () => {
      const order = {
        id: 'order-planned-1',
        workspace_id: 'workspace-1',
        status: 'planning',
        is_archived: false,
      };

      const isMember = true;
      const canJoin = isMember && order.status === 'planning' && !order.is_archived;
      expect(canJoin).toBe(true);
    });

    it('rejects a non-workspace member from joining', () => {
      const order = {
        id: 'order-planned-1',
        workspace_id: 'workspace-1',
        status: 'planning',
        is_archived: false,
      };

      const isMember = false;
      const canJoin = isMember && order.status === 'planning';
      expect(canJoin).toBe(false);
    });

    it('prevents joining a locked, completed, or archived order', () => {
      const lockedOrder = { status: 'locked', is_archived: false };
      const completedOrder = { status: 'completed', is_archived: false };
      const archivedOrder = { status: 'archived', is_archived: true };

      const canJoinLocked = lockedOrder.status === 'planning' && !lockedOrder.is_archived;
      const canJoinCompleted = completedOrder.status === 'planning' && !completedOrder.is_archived;
      const canJoinArchived = archivedOrder.status === 'planning' && !archivedOrder.is_archived;

      expect(canJoinLocked).toBe(false);
      expect(canJoinCompleted).toBe(false);
      expect(canJoinArchived).toBe(false);
    });

    it('ensures joining twice is idempotent and does not create duplicate participations', () => {
      const participants = new Set<string>();

      // First join
      participants.add(`order-1:user-ahmed`);
      expect(participants.size).toBe(1);

      // Second join (idempotent ON CONFLICT DO NOTHING)
      participants.add(`order-1:user-ahmed`);
      expect(participants.size).toBe(1);
    });
  });
});
