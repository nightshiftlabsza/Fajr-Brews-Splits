import { describe, expect, it } from 'vitest';
import type { Order, Roaster } from '../types';
import { createRoasterSnapshot, getRoasterInitials, normalizeRoasterName, resolveOrderRoaster } from './roasters';

const roasters: Roaster[] = [
  {
    id: 'roaster-1',
    workspaceId: 'workspace-1',
    name: 'Father Coffee',
    logoUrl: 'https://example.com/father.png',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  },
];

describe('roaster helpers', () => {
  it('normalizes duplicate names consistently', () => {
    expect(normalizeRoasterName('  Father   Coffee ')).toBe('father coffee');
  });

  it('creates initials fallbacks for roasters without logos', () => {
    expect(getRoasterInitials('Father Coffee')).toBe('FC');
    expect(getRoasterInitials('')).toBe('RB');
  });

  it('resolves live roasters first and falls back to the order snapshot', () => {
    const order: Pick<Order, 'roasterId' | 'roasterSnapshot'> = {
      roasterId: 'roaster-1',
      roasterSnapshot: createRoasterSnapshot({
        id: 'roaster-1',
        name: 'Older Name',
        logoUrl: 'https://example.com/old.png',
      }),
    };

    expect(resolveOrderRoaster(order, roasters)).toEqual({
      id: 'roaster-1',
      name: 'Father Coffee',
      logoUrl: 'https://example.com/father.png',
    });

    expect(resolveOrderRoaster({ roasterId: null, roasterSnapshot: order.roasterSnapshot }, roasters)).toEqual({
      id: 'roaster-1',
      name: 'Older Name',
      logoUrl: 'https://example.com/old.png',
    });
  });
});
