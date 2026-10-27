import type {
  AppSettings,
  AuthUser,
  Order,
  Person,
  Roaster,
  RoasterFeatureStatus,
} from '../types';

export const STARTUP_SNAPSHOT_STORAGE_KEY = 'fb_startup_snapshot_v1';
export const STARTUP_SNAPSHOT_VERSION = 1;
export const STARTUP_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface StartupSnapshotStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StartupSnapshot {
  version: number;
  savedAt: string;
  userId: string;
  user: AuthUser;
  accessStatus: 'member' | 'participant';
  memberRole: 'owner' | 'admin' | 'member' | null;
  linkedPersonId: string | null;
  people: Person[];
  orders: Order[];
  roasters: Roaster[];
  roasterFeatureStatus: RoasterFeatureStatus;
  settings: AppSettings;
}

export function clearStartupSnapshot(storage: StartupSnapshotStorage): void {
  try {
    storage.removeItem(STARTUP_SNAPSHOT_STORAGE_KEY);
  } catch {
    // Ignore storage errors in private browsing or constrained environments
  }
}

export function saveStartupSnapshot(storage: StartupSnapshotStorage, snapshot: StartupSnapshot): void {
  if (snapshot.accessStatus !== 'member' && snapshot.accessStatus !== 'participant') {
    return;
  }

  try {
    const payload: StartupSnapshot = {
      version: STARTUP_SNAPSHOT_VERSION,
      savedAt: snapshot.savedAt,
      userId: snapshot.userId,
      user: snapshot.user,
      accessStatus: snapshot.accessStatus,
      memberRole: snapshot.memberRole,
      linkedPersonId: snapshot.linkedPersonId,
      people: snapshot.people,
      orders: snapshot.orders,
      roasters: snapshot.roasters,
      roasterFeatureStatus: snapshot.roasterFeatureStatus,
      settings: snapshot.settings,
    };
    const serialized = JSON.stringify(payload);
    storage.setItem(STARTUP_SNAPSHOT_STORAGE_KEY, serialized);
  } catch {
    clearStartupSnapshot(storage);
  }
}

export function readStartupSnapshot(storage: StartupSnapshotStorage): StartupSnapshot | null {
  const raw = storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY);
  if (!raw) {
    clearStartupSnapshot(storage);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearStartupSnapshot(storage);
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    clearStartupSnapshot(storage);
    return null;
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.version !== STARTUP_SNAPSHOT_VERSION) {
    clearStartupSnapshot(storage);
    return null;
  }

  if (typeof candidate.savedAt !== 'string') {
    clearStartupSnapshot(storage);
    return null;
  }

  const savedTime = Date.parse(candidate.savedAt);
  if (Number.isNaN(savedTime)) {
    clearStartupSnapshot(storage);
    return null;
  }

  const age = Date.now() - savedTime;
  if (age < 0 || age > STARTUP_SNAPSHOT_MAX_AGE_MS) {
    clearStartupSnapshot(storage);
    return null;
  }

  if (typeof candidate.userId !== 'string' || !candidate.userId) {
    clearStartupSnapshot(storage);
    return null;
  }

  if (candidate.accessStatus !== 'member' && candidate.accessStatus !== 'participant') {
    clearStartupSnapshot(storage);
    return null;
  }

  if (
    candidate.memberRole !== null &&
    candidate.memberRole !== 'owner' &&
    candidate.memberRole !== 'admin' &&
    candidate.memberRole !== 'member'
  ) {
    clearStartupSnapshot(storage);
    return null;
  }

  if (candidate.linkedPersonId !== null && typeof candidate.linkedPersonId !== 'string') {
    clearStartupSnapshot(storage);
    return null;
  }

  if (
    !candidate.user ||
    typeof candidate.user !== 'object' ||
    Array.isArray(candidate.user) ||
    typeof (candidate.user as Record<string, unknown>).id !== 'string' ||
    typeof (candidate.user as Record<string, unknown>).email !== 'string'
  ) {
    clearStartupSnapshot(storage);
    return null;
  }

  if (!Array.isArray(candidate.people) || !Array.isArray(candidate.orders) || !Array.isArray(candidate.roasters)) {
    clearStartupSnapshot(storage);
    return null;
  }

  if (typeof candidate.roasterFeatureStatus !== 'string') {
    clearStartupSnapshot(storage);
    return null;
  }

  if (!candidate.settings || typeof candidate.settings !== 'object' || Array.isArray(candidate.settings)) {
    clearStartupSnapshot(storage);
    return null;
  }

  return candidate as unknown as StartupSnapshot;
}
