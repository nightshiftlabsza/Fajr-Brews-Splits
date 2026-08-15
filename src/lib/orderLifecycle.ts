import type { Order, OrderStatus } from '../types';

export function normalizeOrderStatus(status?: string | null, isArchived?: boolean): OrderStatus {
  if (isArchived || status === 'archived') {
    return 'archived';
  }
  if (status === 'locked' || status === 'completed' || status === 'planning') {
    return status;
  }
  return 'planning';
}

export function syncOrderStatusFlags<T extends { status?: OrderStatus | null; isArchived?: boolean }>(
  target: T,
): T & { status: OrderStatus; isArchived: boolean } {
  const canonicalStatus = normalizeOrderStatus(target.status, target.isArchived);
  return {
    ...target,
    status: canonicalStatus,
    isArchived: canonicalStatus === 'archived',
  };
}

function byNewestOrderDate(left: Order, right: Order): number {
  const dateDiff = new Date(right.orderDate).getTime() - new Date(left.orderDate).getTime();
  if (!isNaN(dateDiff) && dateDiff !== 0) return dateDiff;
  const createdDiff = new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
  if (!isNaN(createdDiff) && createdDiff !== 0) return createdDiff;
  return (left.name || '').localeCompare(right.name || '');
}

export function getActiveOrders(orders: Order[]): Order[] {
  return orders
    .map(syncOrderStatusFlags)
    .filter((order) => order.status !== 'archived')
    .sort(byNewestOrderDate);
}

export function getPastOrders(orders: Order[]): Order[] {
  return orders
    .map(syncOrderStatusFlags)
    .filter((order) => order.status === 'archived')
    .sort(byNewestOrderDate);
}

export function getPreferredActiveOrderId(orders: Order[], currentOrderId?: string | null): string | null {
  const activeOrders = getActiveOrders(orders);
  if (currentOrderId && activeOrders.some((order) => order.id === currentOrderId)) {
    return currentOrderId;
  }
  return activeOrders[0]?.id ?? null;
}

export function getNextActiveOrderId(orders: Order[], excludedOrderId?: string): string | null {
  return getActiveOrders(orders).find((order) => order.id !== excludedOrderId)?.id ?? null;
}

export function getOrderLifecycleLabel(order: Order): 'Planning' | 'Locked' | 'Completed' | 'Past order' {
  const normalized = normalizeOrderStatus(order.status, order.isArchived);
  if (normalized === 'archived') return 'Past order';
  if (normalized === 'locked') return 'Locked';
  if (normalized === 'completed') return 'Completed';
  return 'Planning';
}
