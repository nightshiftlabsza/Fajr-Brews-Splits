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
  const inFlight = localOrder ?? baseSnapshot;
  if (!inFlight) {
    return remoteOrder;
  }

  const areValuesEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  };

  const pickField = <K extends keyof Order>(field: K): Order[K] => {
    if (localOrder && baseSnapshot) {
      const localChanged = !areValuesEqual(localOrder[field], baseSnapshot[field]);
      return localChanged ? localOrder[field] : remoteOrder[field];
    }
    if (inFlight) {
      const inFlightVal = inFlight[field];
      const remoteVal = remoteOrder[field];
      if (!areValuesEqual(inFlightVal, remoteVal)) {
        if (
          Array.isArray(inFlightVal) &&
          inFlightVal.length === 0 &&
          Array.isArray(remoteVal) &&
          remoteVal.length > 0
        ) {
          return remoteVal;
        }
        return inFlightVal;
      }
    }
    return remoteOrder[field];
  };

  return {
    ...remoteOrder,
    name: pickField('name'),
    orderDate: pickField('orderDate'),
    status: pickField('status'),
    isArchived: pickField('isArchived'),
    roasterId: pickField('roasterId'),
    roasterSnapshot: pickField('roasterSnapshot'),
    payerId: pickField('payerId'),
    payerBank: pickField('payerBank'),
    referenceTemplate: pickField('referenceTemplate'),
    payerNote: pickField('payerNote'),
    goodsTotalZar: pickField('goodsTotalZar'),
    lots: pickField('lots'),
    fees: pickField('fees'),
    payments: pickField('payments'),
    ownerId: pickField('ownerId'),
  };
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
