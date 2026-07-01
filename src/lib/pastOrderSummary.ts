import type { Order } from '../types';
import { calculate } from './calculations';
import { normalizeFeeAllocationType } from './invoiceFormatter';

function fallbackParticipantIds(order: Order): string[] {
  const personIds = new Set<string>();

  for (const lot of order.lots) {
    for (const share of lot.shares) {
      if (share.personId && share.shareGrams > 0) {
        personIds.add(share.personId);
      }
    }
    for (const bag of lot.bags ?? []) {
      for (const buyer of bag.buyers) {
        if (buyer.personId && buyer.grams > 0) {
          personIds.add(buyer.personId);
        }
      }
    }
  }

  for (const fee of order.fees) {
    if (normalizeFeeAllocationType(fee.allocationType) === 'specific_person' && fee.personId && fee.amountZar > 0) {
      personIds.add(fee.personId);
    }
  }

  for (const [personId, payment] of Object.entries(order.payments)) {
    if (payment && payment.status !== 'unpaid') {
      personIds.add(personId);
    }
  }

  return Array.from(personIds);
}

function fallbackTotal(order: Order): number {
  return order.goodsTotalZar + order.fees.reduce((sum, fee) => sum + (fee.amountZar || 0), 0);
}

export interface PastOrderSummary {
  participantIds: string[];
  participantCount: number;
  lotCount: number;
  totalZar: number;
  paidCount: number;
  partialCount: number;
  isValid: boolean;
}

export function getPastOrderSummary(order: Order, personNames: Record<string, string>): PastOrderSummary {
  const result = calculate(order, personNames);
  const participantIds = result.isValid ? result.personIds : fallbackParticipantIds(order);

  return {
    participantIds,
    participantCount: participantIds.length,
    lotCount: order.lots.length,
    totalZar: result.isValid ? result.totalOrderZar : fallbackTotal(order),
    paidCount: participantIds.filter((personId) => order.payments[personId]?.status === 'paid').length,
    partialCount: participantIds.filter((personId) => order.payments[personId]?.status === 'partial').length,
    isValid: result.isValid,
  };
}
