import type { Order, Roaster, RoasterSnapshot } from '../types';

export interface ResolvedOrderRoaster {
  id: string | null;
  name: string;
  logoUrl?: string;
}

export function normalizeRoasterName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getRoasterInitials(name?: string | null): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'RB';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function createRoasterSnapshot(roaster?: Pick<Roaster, 'id' | 'name' | 'logoUrl'> | null): RoasterSnapshot | null {
  if (!roaster?.name?.trim()) {
    return null;
  }

  return {
    id: roaster.id,
    name: roaster.name,
    logoUrl: roaster.logoUrl,
  };
}

export function resolveOrderRoaster(order: Pick<Order, 'roasterId' | 'roasterSnapshot'>, roasters: Roaster[]): ResolvedOrderRoaster | null {
  if (order.roasterId) {
    const roaster = roasters.find((candidate) => candidate.id === order.roasterId);
    if (roaster) {
      return {
        id: roaster.id,
        name: roaster.name,
        logoUrl: roaster.logoUrl,
      };
    }
  }

  if (order.roasterSnapshot?.name?.trim()) {
    return {
      id: order.roasterSnapshot.id ?? null,
      name: order.roasterSnapshot.name,
      logoUrl: order.roasterSnapshot.logoUrl,
    };
  }

  return null;
}

export function isValidRoasterLogoFile(file: File): boolean {
  return ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type);
}
