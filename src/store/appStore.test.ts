/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../types';

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

type StoreTestConfig = {
  session?: { user?: { id: string; email?: string | null; user_metadata?: { full_name?: string } } } | null;
  workspaceMember?: QueryResult;
  linkResolution?: QueryResult;
  people?: QueryResult;
  orders?: QueryResult;
  roasters?: QueryResult;
  roasterInsert?: QueryResult;
  roasterUpdate?: QueryResult;
  orderUpdate?: QueryResult;
  logoUploadError?: { message: string; code?: string } | null;
};

function makeAwaitable<T>(result: Promise<T> | T) {
  const promise = Promise.resolve(result);
  return {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

function createSelectBuilder(result: QueryResult) {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };

  builder.eq.mockImplementation(() => builder);
  builder.order.mockImplementation(() => makeAwaitable(result));
  builder.maybeSingle.mockResolvedValue(result);
  builder.single.mockResolvedValue(result);

  return builder;
}

function createSupabaseMock(config: StoreTestConfig) {
  const workspaceMember = config.workspaceMember ?? { data: null, error: null };
  const linkResolution = config.linkResolution ?? {
    data: { status: 'none', linkedPersonId: null, matchedBy: null, person: null, candidates: [] },
    error: null,
  };
  const people = config.people ?? { data: [], error: null };
  const orders = config.orders ?? { data: [], error: null };
  const roasters = config.roasters ?? { data: [], error: null };
  const userSettings = {
    data: null,
    error: {
      code: 'PGRST116',
      message: 'No rows found',
    },
  };
  const roasterInsert = config.roasterInsert ?? { data: null, error: null };
  const roasterUpdate = config.roasterUpdate ?? { data: null, error: null };
  const orderUpdate = config.orderUpdate ?? { data: null, error: null };
  const orderUpdateMock = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue(orderUpdate),
  }));

  const storageApi = {
    upload: vi.fn().mockResolvedValue({ error: config.logoUploadError ?? null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/logo.png' } }),
  };

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: config.session ?? null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockImplementation((name: string) => {
      if (name === 'resolve_my_person_link') {
        return Promise.resolve(linkResolution);
      }

      return Promise.resolve({ data: null, error: null });
    }),
    storage: {
      from: vi.fn().mockReturnValue(storageApi),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: vi.fn().mockImplementation(() => createSelectBuilder(workspaceMember)),
        };
      }

      if (table === 'people') {
        return {
          select: vi.fn().mockImplementation(() => createSelectBuilder(people)),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockImplementation(() => createSelectBuilder(orders)),
          update: orderUpdateMock,
        };
      }

      if (table === 'user_settings') {
        return {
          select: vi.fn().mockImplementation(() => createSelectBuilder(userSettings)),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'roasters') {
        return {
          select: vi.fn().mockImplementation(() => createSelectBuilder(roasters)),
          insert: vi.fn().mockImplementation(() => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(roasterInsert),
            }),
          })),
          update: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(roasterUpdate),
              }),
            }),
          })),
        };
      }

      throw new Error(`Unexpected table mock: ${table}`);
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
    __mocks: {
      orderUpdate: orderUpdateMock,
    },
  };
}

const storePeople: Person[] = [
  {
    id: 'person-1',
    workspaceId: 'workspace-1',
    name: 'Abdul',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  },
];

function makeStoreOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id || 'order-1',
    workspaceId: 'workspace-1',
    name: overrides.name || 'Saved Order',
    orderDate: overrides.orderDate || '2026-03-18',
    roasterId: overrides.roasterId ?? null,
    roasterSnapshot: overrides.roasterSnapshot ?? null,
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate || 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 240,
    lots: overrides.lots ?? [
      {
        id: 'lot-1',
        name: 'Pastel Hour',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 1,
        shares: [{ id: 'share-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
        bagAllocations: [
          {
            id: 'bag-1',
            bagIndex: 0,
            mode: 'single',
            participants: [{ id: 'participant-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'share-1' }],
          },
        ],
      },
    ],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    isArchived: overrides.isArchived ?? true,
    ownerId: overrides.ownerId,
    createdBy: overrides.createdBy,
    createdAt: overrides.createdAt || '2026-03-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-03-18T00:00:00.000Z',
  };
}

async function loadStore(config: StoreTestConfig = {}) {
  const supabase = createSupabaseMock(config);

  vi.doMock('../lib/supabase', () => ({
    WORKSPACE_ID: 'workspace-1',
    supabase,
  }));

  const { useAppStore } = await import('./appStore');
  return { useAppStore, supabase };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('appStore.initialize', () => {
  it('does not trigger the blocking loader during silent reinitialization', async () => {
    const { useAppStore } = await loadStore();

    useAppStore.setState({ isInitialized: true, isLoading: false });

    const initializePromise = useAppStore.getState().initialize({ silent: true });
    expect(useAppStore.getState().isLoading).toBe(false);

    await initializePromise;

    expect(useAppStore.getState().isInitialized).toBe(true);
    expect(useAppStore.getState().isLoading).toBe(false);
  });

  it('still shows the blocking loader during the first initialize pass', async () => {
    const { useAppStore } = await loadStore();

    useAppStore.setState({ isInitialized: false, isLoading: false });

    const initializePromise = useAppStore.getState().initialize();
    expect(useAppStore.getState().isLoading).toBe(true);

    await initializePromise;

    expect(useAppStore.getState().isInitialized).toBe(true);
    expect(useAppStore.getState().isLoading).toBe(false);
  });

  it('marks the roaster backend ready when member roasters load successfully', async () => {
    const { useAppStore } = await loadStore({
      session: { user: { id: 'user-1', email: 'owner@example.com' } },
      workspaceMember: { data: { role: 'owner' }, error: null },
      roasters: {
        data: [
          {
            id: 'roaster-1',
            workspace_id: 'workspace-1',
            name: 'Father Coffee',
            logo_path: null,
            logo_url: null,
            created_at: '2026-03-18T00:00:00.000Z',
            updated_at: '2026-03-18T00:00:00.000Z',
          },
        ],
        error: null,
      },
    });

    await useAppStore.getState().initialize();

    expect(useAppStore.getState().roasterFeatureStatus).toBe('ready');
    expect(useAppStore.getState().roasterFeatureMessage).toBeNull();
    expect(useAppStore.getState().roasters).toHaveLength(1);
  });

  it('distinguishes an empty roaster list from a broken backend', async () => {
    const { useAppStore } = await loadStore({
      session: { user: { id: 'user-1', email: 'owner@example.com' } },
      workspaceMember: { data: { role: 'owner' }, error: null },
      roasters: { data: [], error: null },
    });

    await useAppStore.getState().initialize();

    expect(useAppStore.getState().roasterFeatureStatus).toBe('empty');
    expect(useAppStore.getState().roasterFeatureMessage).toBeNull();
    expect(useAppStore.getState().roasters).toEqual([]);
  });

  it('keeps startup working and marks roasters unavailable when the table is missing', async () => {
    const { useAppStore } = await loadStore({
      session: { user: { id: 'user-1', email: 'owner@example.com' } },
      workspaceMember: { data: { role: 'owner' }, error: null },
      roasters: {
        data: null,
        error: {
          code: 'PGRST205',
          message: "Could not find the table 'public.roasters' in the schema cache",
        },
      },
    });

    await useAppStore.getState().initialize();

    expect(useAppStore.getState().accessStatus).toBe('member');
    expect(useAppStore.getState().roasterFeatureStatus).toBe('unavailable');
    expect(useAppStore.getState().roasterFeatureMessage).toBe('Roasters are unavailable because the Supabase roaster migration has not been applied yet.');
    expect(useAppStore.getState().roasters).toEqual([]);
    expect(useAppStore.getState().error).toBeNull();
  });
});

describe('appStore.updateOrder integrity', () => {
  it('rejects destructive archived-order writes before local state or Supabase are touched', async () => {
    const { useAppStore, supabase } = await loadStore();
    const archivedOrder = makeStoreOrder({ id: 'archived-order', isArchived: true });
    const currentDraft = makeStoreOrder({ id: 'current-draft', name: 'Current Draft', isArchived: false });

    useAppStore.setState({
      people: storePeople,
      orders: [archivedOrder, currentDraft],
      currentOrderId: currentDraft.id,
    });

    await expect(useAppStore.getState().updateOrder('archived-order', { lots: [] }))
      .rejects.toThrow('Saved orders must keep at least one coffee lot.');

    expect(useAppStore.getState().orders).toEqual([archivedOrder, currentDraft]);
    expect(useAppStore.getState().currentOrderId).toBe('current-draft');
    expect(supabase.__mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it('updates the targeted archived order without using or changing the current draft', async () => {
    const { useAppStore, supabase } = await loadStore();
    const archivedOrder = makeStoreOrder({ id: 'archived-order', isArchived: true });
    const currentDraft = makeStoreOrder({ id: 'current-draft', name: 'Current Draft', isArchived: false });

    useAppStore.setState({
      people: storePeople,
      orders: [currentDraft, archivedOrder],
      currentOrderId: currentDraft.id,
    });

    await useAppStore.getState().updateOrder('archived-order', {
      name: 'Corrected Saved Order',
      isArchived: true,
    });

    const state = useAppStore.getState();
    expect(state.currentOrderId).toBe('current-draft');
    expect(state.orders.find((order) => order.id === 'current-draft')).toEqual(currentDraft);
    expect(state.orders.find((order) => order.id === 'archived-order')).toEqual(expect.objectContaining({
      id: 'archived-order',
      name: 'Corrected Saved Order',
      isArchived: true,
      lots: [
        expect.objectContaining({
          id: 'lot-1',
          bags: [
            expect.objectContaining({
              buyers: [expect.objectContaining({ personId: 'person-1', grams: 250 })],
            }),
          ],
        }),
      ],
    }));
    expect(supabase.__mocks.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Corrected Saved Order',
      is_archived: true,
      lots: expect.any(Array),
    }));
  });
});

describe('appStore roaster actions', () => {
  it('creates a roaster successfully without a logo', async () => {
    const { useAppStore } = await loadStore({
      roasterInsert: {
        data: {
          id: 'roaster-2',
          workspace_id: 'workspace-1',
          name: 'Rosetta',
          logo_path: null,
          logo_url: null,
          created_at: '2026-03-18T00:00:00.000Z',
          updated_at: '2026-03-18T00:00:00.000Z',
        },
        error: null,
      },
    });

    useAppStore.setState({
      accessStatus: 'member',
      roasterFeatureStatus: 'empty',
      roasterFeatureMessage: null,
      roasters: [],
    });

    const roaster = await useAppStore.getState().createRoaster({ name: 'Rosetta', logoFile: null });

    expect(roaster.name).toBe('Rosetta');
    expect(useAppStore.getState().roasterFeatureStatus).toBe('ready');
    expect(useAppStore.getState().roasters.map((entry) => entry.name)).toContain('Rosetta');
  });

  it('rejects duplicate roasters before hitting Supabase', async () => {
    const { useAppStore } = await loadStore();

    useAppStore.setState({
      accessStatus: 'member',
      roasterFeatureStatus: 'ready',
      roasters: [
        {
          id: 'roaster-1',
          workspaceId: 'workspace-1',
          name: 'Father Coffee',
          createdAt: '2026-03-18T00:00:00.000Z',
          updatedAt: '2026-03-18T00:00:00.000Z',
        },
      ],
    });

    await expect(useAppStore.getState().createRoaster({ name: ' Father   Coffee ', logoFile: null }))
      .rejects
      .toThrow('A roaster named "Father Coffee" already exists.');
  });

  it('normalizes a missing roasters table into a friendly admin message', async () => {
    const { useAppStore } = await loadStore({
      roasterInsert: {
        data: null,
        error: {
          code: 'PGRST205',
          message: "Could not find the table 'public.roasters' in the schema cache",
        },
      },
    });

    useAppStore.setState({
      accessStatus: 'member',
      roasterFeatureStatus: 'empty',
      roasterFeatureMessage: null,
    });

    await expect(useAppStore.getState().createRoaster({ name: 'Rosetta', logoFile: null }))
      .rejects
      .toThrow('Roaster saving is not available yet because the database migration has not been applied.');

    expect(useAppStore.getState().roasterFeatureStatus).toBe('unavailable');
    expect(useAppStore.getState().roasterFeatureMessage).toBe('Roaster saving is not available yet because the database migration has not been applied.');
  });

  it('keeps the roaster row when logo upload fails and surfaces a friendly warning', async () => {
    const { useAppStore } = await loadStore({
      roasterInsert: {
        data: {
          id: 'roaster-3',
          workspace_id: 'workspace-1',
          name: 'Rosetta',
          logo_path: null,
          logo_url: null,
          created_at: '2026-03-18T00:00:00.000Z',
          updated_at: '2026-03-18T00:00:00.000Z',
        },
        error: null,
      },
      logoUploadError: {
        message: 'Bucket not found: roaster-logos',
      },
    });

    useAppStore.setState({
      accessStatus: 'member',
      roasterFeatureStatus: 'empty',
      roasterFeatureMessage: null,
      roasters: [],
    });

    const roaster = await useAppStore.getState().createRoaster({
      name: 'Rosetta',
      logoFile: new File(['logo'], 'logo.png', { type: 'image/png' }),
    });

    expect(roaster.name).toBe('Rosetta');
    expect(roaster.logoUrl).toBeUndefined();
    expect(useAppStore.getState().roasters).toHaveLength(1);
    expect(useAppStore.getState().roasterFeatureMessage).toBe(
      'The roaster was saved, but its logo could not be uploaded because the roaster logo storage is not configured in Supabase yet.',
    );
  });
});
