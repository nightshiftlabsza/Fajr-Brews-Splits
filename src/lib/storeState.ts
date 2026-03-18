import type { Order, Person } from '../types';

export function dedupePeopleById(people: Person[]): Person[] {
  const seen = new Set<string>();
  return people.filter((person) => {
    if (seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
}

export function sortPeopleByName(people: Person[]): Person[] {
  return [...people].sort((left, right) => left.name.localeCompare(right.name));
}

export function upsertPersonById(people: Person[], person: Person): Person[] {
  return sortPeopleByName([
    ...dedupePeopleById(people).filter((candidate) => candidate.id !== person.id),
    person,
  ]);
}

export function mergeOrderPatch(order: Order, patch: Partial<Order>): Order {
  return { ...order, ...patch };
}

export function applyOrderPatches(order: Order, patches: Partial<Order>[]): Order {
  return patches.reduce<Order>((current, patch) => mergeOrderPatch(current, patch), order);
}

export function upsertOrderById(orders: Order[], order: Order): Order[] {
  return [order, ...orders.filter((candidate) => candidate.id !== order.id)].sort((left, right) => {
    if (left.orderDate !== right.orderDate) {
      return right.orderDate.localeCompare(left.orderDate);
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}
