import { describe, expect, it } from 'vitest';
import type { Person } from '../types';
import { getCanonicalPeopleOptions } from './peopleOptions';

function makePerson(id: string, name: string): Person {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

describe('getCanonicalPeopleOptions', () => {
  it('keeps one new buyer option per stable id across repeated lots', () => {
    const buyer = makePerson('person-1', 'New Buyer');
    const options = getCanonicalPeopleOptions(
      [buyer, buyer, buyer],
      ['person-1', 'person-1', 'person-1'],
      ['person-1'],
    );

    expect(options).toHaveLength(1);
    expect(options[0].id).toBe('person-1');
  });

  it('keeps two newly added buyers present exactly once each', () => {
    const buyerA = makePerson('person-1', 'Buyer A');
    const buyerB = makePerson('person-2', 'Buyer B');

    const options = getCanonicalPeopleOptions(
      [buyerA, buyerA, buyerB, buyerB],
      ['person-1', 'person-2'],
      ['person-2', 'person-1'],
    );

    expect(options.map((person) => person.id)).toEqual(['person-1', 'person-2']);
  });

  it('dedupes by id rather than display name', () => {
    const first = makePerson('person-1', 'Zak');
    const second = makePerson('person-2', 'Zak');

    const options = getCanonicalPeopleOptions([first, second, first], [], []);

    expect(options).toHaveLength(2);
    expect(options.map((person) => person.id)).toEqual(['person-1', 'person-2']);
  });
});
