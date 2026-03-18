import type { Person } from '../types';
import { dedupePeopleById } from './storeState';

export function getCanonicalPeopleOptions(
  people: Person[],
  lotPersonIds: string[],
  recentBuyerIds: string[],
): Person[] {
  const canonicalPeople = dedupePeopleById(people);
  const lotOrder = Array.from(new Set(lotPersonIds.filter(Boolean)));
  const lotRank = new Map(lotOrder.map((personId, index) => [personId, index]));
  const recentOrder = Array.from(new Set(recentBuyerIds.filter(Boolean)));
  const recentRank = new Map(recentOrder.map((personId, index) => [personId, index]));

  return [...canonicalPeople].sort((left, right) => {
    const leftInLot = lotRank.has(left.id) ? 0 : 1;
    const rightInLot = lotRank.has(right.id) ? 0 : 1;
    if (leftInLot !== rightInLot) return leftInLot - rightInLot;
    if (leftInLot === 0) return (lotRank.get(left.id) ?? 0) - (lotRank.get(right.id) ?? 0);

    const leftRecent = recentRank.has(left.id) ? 0 : 1;
    const rightRecent = recentRank.has(right.id) ? 0 : 1;
    if (leftRecent !== rightRecent) return leftRecent - rightRecent;
    if (leftRecent === 0) return (recentRank.get(left.id) ?? 0) - (recentRank.get(right.id) ?? 0);

    return left.name.localeCompare(right.name);
  });
}
