import type { Order, Person, Roaster } from '../types';

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

export function sortRoasters(roasters: Roaster[]): Roaster[] {
  return [...roasters].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }
    return left.name.localeCompare(right.name);
  });
}

export function mergeConcurrentOrderUpdate(
  remoteOrder: Order,
  localOrder?: Order | null,
  baseSnapshot?: Order | null,
): Order {
  if (!baseSnapshot && !localOrder) {
    return remoteOrder;
  }

  const merged: Order = { ...remoteOrder };

  const mutableFields: (keyof Order)[] = [
    'name',
    'orderDate',
    'status',
    'isArchived',
    'roasterId',
    'roasterSnapshot',
    'payerId',
    'payerBank',
    'referenceTemplate',
    'payerNote',
    'goodsTotalZar',
    'lots',
    'fees',
    'payments',
    'ownerId',
  ];

  const areValuesEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  };

  for (const field of mutableFields) {
    if (localOrder && baseSnapshot) {
      const localChanged = !areValuesEqual(localOrder[field], baseSnapshot[field]);
      if (localChanged) {
        (merged as any)[field] = localOrder[field];
      }
    } else {
      const inFlight = localOrder ?? baseSnapshot!;
      if (!areValuesEqual(inFlight[field], remoteOrder[field])) {
        if (
          Array.isArray(inFlight[field]) &&
          (inFlight[field] as any[]).length === 0 &&
          Array.isArray(remoteOrder[field]) &&
          (remoteOrder[field] as any[]).length > 0
        ) {
          continue;
        }
        (merged as any)[field] = inFlight[field];
      }
    }
  }

  return merged;
}

export function upsertRoasterById(roasters: Roaster[], roaster: Roaster): Roaster[] {
  return sortRoasters([
    ...roasters.filter((candidate) => candidate.id !== roaster.id),
    roaster,
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
