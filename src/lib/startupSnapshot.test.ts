import { describe, expect, it, vi } from 'vitest';
import {
  clearStartupSnapshot,
  readStartupSnapshot,
  saveStartupSnapshot,
  STARTUP_SNAPSHOT_STORAGE_KEY,
  STARTUP_SNAPSHOT_VERSION,
  type StartupSnapshot,
  type StartupSnapshotStorage,
} from './startupSnapshot';

function createInMemoryStorage(initialData: Record<string, string> = {}): StartupSnapshotStorage {
  const store = new Map<string, string>(Object.entries(initialData));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

function makeValidSnapshot(overrides: Partial<StartupSnapshot> = {}): StartupSnapshot {
  return {
    version: STARTUP_SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    userId: 'user-123',
    user: {
      id: 'user-123',
      email: 'user@example.com',
      fullName: 'Test User',
    },
    accessStatus: 'member',
    memberRole: 'admin',
    linkedPersonId: 'person-1',
    people: [
      {
        id: 'person-1',
        workspaceId: 'ws-1',
        name: 'Person One',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ],
    orders: [],
    roasters: [],
    roasterFeatureStatus: 'ready',
    settings: {
      theme: 'emerald',
      themeMode: 'light',
    },
    ...overrides,
  };
}

describe('startupSnapshot', () => {
  it('round-trips a valid startup snapshot', () => {
    const storage = createInMemoryStorage();
    const snapshot = makeValidSnapshot();

    saveStartupSnapshot(storage, snapshot);

    const retrieved = readStartupSnapshot(storage);
    expect(retrieved).toEqual(snapshot);
  });

  it('returns null and clears storage when version does not match', () => {
    const storage = createInMemoryStorage();
    const raw = JSON.stringify({
      ...makeValidSnapshot(),
      version: 99,
    });
    storage.setItem(STARTUP_SNAPSHOT_STORAGE_KEY, raw);

    const retrieved = readStartupSnapshot(storage);
    expect(retrieved).toBeNull();
    expect(storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears storage when json is corrupt', () => {
    const storage = createInMemoryStorage();
    storage.setItem(STARTUP_SNAPSHOT_STORAGE_KEY, '{ invalid_json ');

    const retrieved = readStartupSnapshot(storage);
    expect(retrieved).toBeNull();
    expect(storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears storage when required fields or array types are missing or wrong', () => {
    const storage = createInMemoryStorage();

    const missingPeople = JSON.stringify({
      ...makeValidSnapshot(),
      people: 'not-an-array',
    });
    storage.setItem(STARTUP_SNAPSHOT_STORAGE_KEY, missingPeople);
    expect(readStartupSnapshot(storage)).toBeNull();
    expect(storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY)).toBeNull();

    const invalidAccess = JSON.stringify({
      ...makeValidSnapshot(),
      accessStatus: 'none',
    });
    storage.setItem(STARTUP_SNAPSHOT_STORAGE_KEY, invalidAccess);
    expect(readStartupSnapshot(storage)).toBeNull();
    expect(storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY)).toBeNull();

    const missingUser = JSON.stringify({
      ...makeValidSnapshot(),
      user: null,
    });
    storage.setItem(STARTUP_SNAPSHOT_STORAGE_KEY, missingUser);
    expect(readStartupSnapshot(storage)).toBeNull();
    expect(storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears storage when snapshot is older than 30 days', () => {
    const storage = createInMemoryStorage();
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const staleSnapshot = makeValidSnapshot({ savedAt: thirtyOneDaysAgo });

    storage.setItem(STARTUP_SNAPSHOT_STORAGE_KEY, JSON.stringify(staleSnapshot));

    const retrieved = readStartupSnapshot(storage);
    expect(retrieved).toBeNull();
    expect(storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY)).toBeNull();
  });

  it('does not throw and leaves nothing behind when storage throws a quota error on save', () => {
    let rawStore: string | null = 'corrupted_or_partial_payload';
    const storage: StartupSnapshotStorage = {
      getItem: () => rawStore,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        rawStore = null;
      },
    };

    const snapshot = makeValidSnapshot();
    expect(() => saveStartupSnapshot(storage, snapshot)).not.toThrow();
    expect(rawStore).toBeNull();
  });

  it('clears the startup snapshot key cleanly', () => {
    const storage = createInMemoryStorage();
    saveStartupSnapshot(storage, makeValidSnapshot());
    expect(storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY)).not.toBeNull();

    clearStartupSnapshot(storage);
    expect(storage.getItem(STARTUP_SNAPSHOT_STORAGE_KEY)).toBeNull();
  });
});
