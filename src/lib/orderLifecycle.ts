import type { Order } from '../types';

function byNewestOrderDate(left: Order, right: Order): number {
  return new Date(right.orderDate).getTime() - new Date(left.orderDate).getTime();
}

export function getActiveOrders(orders: Order[]): Order[] {
  return orders.filter((order) => !order.isArchived).sort(byNewestOrderDate);
}

export function getPastOrders(orders: Order[]): Order[] {
  return orders.filter((order) => order.isArchived).sort(byNewestOrderDate);
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

export function getOrderLifecycleLabel(order: Order): 'In progress' | 'Past order' {
  return order.isArchived ? 'Past order' : 'In progress';
}
