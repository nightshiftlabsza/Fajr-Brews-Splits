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
  orderInsert?: QueryResult;
  orderDelete?: QueryResult;
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
  const orderInsert = config.orderInsert ?? { data: null, error: null };
  const orderDelete = config.orderDelete ?? { data: null, error: null };
  const orderUpdateMock = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue(orderUpdate),
  }));
  const orderDeleteMock = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue(orderDelete),
  }));
  const orderInsertMock = vi.fn().mockImplementation((payload: any) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockImplementation(() => {
        if (orderInsert.error) {
          return Promise.resolve(orderInsert);
        }
        const row = orderInsert.data ?? {
          id: payload.id || `order-${Math.random().toString(36).slice(2, 8)}`,
          workspace_id: payload.workspace_id,
          name: payload.name,
          order_date: payload.order_date,
          status: payload.status,
          roaster_id: payload.roaster_id,
          roaster_snapshot: payload.roaster_snapshot,
          payer_id: payload.payer_id,
          payer_bank: payload.payer_bank,
          reference_template: payload.reference_template,
          payer_note: payload.payer_note,
          goods_total_zar: String(payload.goods_total_zar ?? 0),
          lots: payload.lots,
          fees: payload.fees,
          payments: payload.payments,
          is_archived: payload.is_archived,
          owner_id: payload.owner_id,
          created_by: payload.created_by,
          created_at: '2026-08-15T08:00:00.000Z',
          updated_at: '2026-08-15T08:00:00.000Z',
        };
        return Promise.resolve({ data: row, error: null });
      }),
    }),
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
          insert: vi.fn().mockImplementation((payload: any) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                const row = {
                  id: `person-${Math.random().toString(36).slice(2, 8)}`,
                  workspace_id: payload.workspace_id,
                  name: payload.name,
                  phone: payload.phone ?? null,
                  email: payload.email ?? null,
                  note: payload.note ?? null,
                  created_at: '2026-03-18T00:00:00.000Z',
                  updated_at: '2026-03-18T00:00:00.000Z',
                };
                return Promise.resolve({ data: row, error: null });
              }),
            }),
          })),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockImplementation(() => createSelectBuilder(orders)),
          update: orderUpdateMock,
          insert: orderInsertMock,
          delete: orderDeleteMock,
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
          insert: vi.fn().mockImplementation((payload: any) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                if (roasterInsert.data || roasterInsert.error) {
                  return Promise.resolve(roasterInsert);
                }
                const row = {
                  id: `roaster-${Math.random().toString(36).slice(2, 8)}`,
                  workspace_id: payload.workspace_id,
                  name: payload.name,
                  logo_path: payload.logo_path ?? null,
                  logo_url: payload.logo_url ?? null,
                  created_at: '2026-03-18T00:00:00.000Z',
                  updated_at: '2026-03-18T00:00:00.000Z',
                };
                return Promise.resolve({ data: row, error: null });
              }),
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
    status: overrides.status ?? (overrides.isArchived ? 'archived' : 'planning'),
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

describe('appStore Realtime JSONB Hydration & Data Integrity', () => {
  it('correctly hydrates stringified JSONB columns delivered by Supabase Realtime', async () => {
    let realtimeCallback: ((payload: unknown) => void) | null = null;

    const { useAppStore, supabase } = await loadStore();
    const channelObj: any = {
      on: vi.fn().mockImplementation((event: string, filter: any, callback: any) => {
        if (filter?.table === 'orders') {
          realtimeCallback = callback;
        }
        return channelObj;
      }),
      subscribe: vi.fn().mockImplementation(() => channelObj),
      unsubscribe: vi.fn(),
    };
    (supabase.channel as any).mockReturnValue(channelObj);

    useAppStore.setState({ _realtimeChannel: null, orders: [] });
    useAppStore.getState()._setupRealtime('workspace-1');

    expect(realtimeCallback).toBeTruthy();

    const stringifiedPayload = {
      eventType: 'UPDATE',
      new: {
        id: 'order-realtime-1',
        workspace_id: 'workspace-1',
        name: 'Realtime March Drop',
        order_date: '2026-08-15',
        status: 'planning',
        roaster_id: 'roaster-1',
        roaster_snapshot: JSON.stringify({ id: 'roaster-1', name: 'Father Coffee' }),
        payer_id: 'person-1',
        payer_bank: JSON.stringify({ bankName: 'Investec', accountNumber: '987654321', beneficiary: 'Alice' }),
        reference_template: 'FAJR-{ORDER}-{NAME}',
        payer_note: 'Please pay ASAP',
        goods_total_zar: '1200.0000',
        lots: JSON.stringify([
          {
            id: 'lot-realtime-1',
            name: 'Kenya AA Nyeri',
            foreignPricePerBag: 22,
            gramsPerBag: 250,
            quantity: 2,
            bags: [
              { id: 'bag-1', splitMode: 'full', buyers: [{ id: 'b-1', personId: 'person-1', grams: 250 }] },
              { id: 'bag-2', splitMode: 'full', buyers: [{ id: 'b-2', personId: 'person-2', grams: 250 }] },
            ],
            shares: [
              { id: 'b-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
              { id: 'b-2', personId: 'person-2', shareGrams: 250, bagIndex: 1 },
            ],
            bagAllocations: [
              { id: 'bag-1', bagIndex: 0, mode: 'single', participants: [{ id: 'b-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'b-1' }] },
              { id: 'bag-2', bagIndex: 1, mode: 'single', participants: [{ id: 'b-2', personId: 'person-2', shareGrams: 250, sourceShareId: 'b-2' }] },
            ],
          },
        ]),
        fees: JSON.stringify([
          { id: 'fee-1', label: 'Shipping', amountZar: 200, allocationType: 'equal_per_person', personId: null },
        ]),
        payments: JSON.stringify({
          'person-1': { status: 'paid', amountPaid: 700 },
        }),
        is_archived: false,
        created_at: '2026-08-15T08:00:00.000Z',
        updated_at: '2026-08-15T08:30:00.000Z',
      },
      old: { id: 'order-realtime-1' },
    };

    realtimeCallback!(stringifiedPayload);

    const orders = useAppStore.getState().orders;
    expect(orders).toHaveLength(1);
    const order = orders[0];

    // Assert lots, bags, shares, fees, payments, bank, roasterSnapshot are all correctly parsed
    expect(order.lots).toHaveLength(1);
    expect(order.lots[0]!.name).toBe('Kenya AA Nyeri');
    expect(order.lots[0]!.bags).toHaveLength(2);
    expect(order.lots[0]!.bags![0]!.buyers[0]!.personId).toBe('person-1');
    expect(order.fees).toHaveLength(1);
    expect(order.fees[0]!.label).toBe('Shipping');
    expect(order.fees[0]!.amountZar).toBe(200);
    expect(order.payments['person-1']?.status).toBe('paid');
    expect(order.payerBank.bankName).toBe('Investec');
    expect(order.roasterSnapshot?.name).toBe('Father Coffee');
  });

  it('preserves existing valid order state if Realtime payload is corrupted', async () => {
    let realtimeCallback: ((payload: unknown) => void) | null = null;

    const { useAppStore, supabase } = await loadStore();
    const channelObj: any = {
      on: vi.fn().mockImplementation((event: string, filter: any, callback: any) => {
        if (filter?.table === 'orders') {
          realtimeCallback = callback;
        }
        return channelObj;
      }),
      subscribe: vi.fn().mockImplementation(() => channelObj),
      unsubscribe: vi.fn(),
    };
    (supabase.channel as any).mockReturnValue(channelObj);

    const initialOrder = makeStoreOrder({
      id: 'order-existing-1',
      name: 'Existing Safe Order',
      lots: [
        {
          id: 'lot-safe',
          name: 'Panama Geisha',
          foreignPricePerBag: 45,
          gramsPerBag: 250,
          quantity: 1,
          bags: [{ id: 'b-1', splitMode: 'full', buyers: [{ id: 'buy-1', personId: 'person-1', grams: 250 }] }],
          shares: [{ id: 'buy-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
          bagAllocations: [{ id: 'b-1', bagIndex: 0, mode: 'single', participants: [{ id: 'buy-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'buy-1' }] }],
        },
      ],
      fees: [{ id: 'fee-safe', label: 'Air freight', amountZar: 350, allocationType: 'equal_per_person', personId: null }],
    });

    useAppStore.setState({ _realtimeChannel: null, orders: [initialOrder] });
    useAppStore.getState()._setupRealtime('workspace-1');

    // Corrupted payload with invalid JSON
    const corruptedPayload = {
      eventType: 'UPDATE',
      new: {
        id: 'order-existing-1',
        workspace_id: 'workspace-1',
        name: 'Existing Safe Order',
        order_date: '2026-08-15',
        status: 'planning',
        roaster_id: null,
        roaster_snapshot: 'INVALID_JSON_ROASTER',
        payer_id: 'person-1',
        payer_bank: 'INVALID_JSON_BANK',
        reference_template: 'FAJR-{ORDER}-{NAME}',
        goods_total_zar: '1200',
        lots: 'CORRUPTED_JSON_STRING_THAT_CANNOT_BE_PARSED',
        fees: 'CORRUPTED_FEES_STRING',
        payments: 'CORRUPTED_PAYMENTS_STRING',
        is_archived: false,
        created_at: '2026-08-15T08:00:00.000Z',
        updated_at: '2026-08-15T08:35:00.000Z',
      },
      old: { id: 'order-existing-1' },
    };

    realtimeCallback!(corruptedPayload);

    const orders = useAppStore.getState().orders;
    expect(orders).toHaveLength(1);
    const order = orders[0];

    // Assert existing valid lots and fees were preserved, not wiped to []!
    expect(order.lots).toHaveLength(1);
    expect(order.lots[0].name).toBe('Panama Geisha');
    expect(order.fees).toHaveLength(1);
    expect(order.fees[0].label).toBe('Air freight');
  });

  it('updates currentOrderId when the currently selected order is deleted remotely via Realtime', async () => {
    let realtimeCallback: ((payload: any) => void) | null = null;
    const { useAppStore, supabase } = await loadStore();
    const channelObj: any = {
      on: vi.fn().mockImplementation((_event: string, _opts: any, callback: any) => {
        if (_opts?.table === 'orders') realtimeCallback = callback;
        return channelObj;
      }),
      subscribe: vi.fn().mockImplementation(() => channelObj),
      unsubscribe: vi.fn(),
    };
    (supabase.channel as any).mockReturnValue(channelObj);

    const orderA = makeStoreOrder({ id: 'order-a', name: 'Order A', isArchived: false, status: 'planning' });
    const orderB = makeStoreOrder({ id: 'order-b', name: 'Order B', isArchived: false, status: 'planning' });

    useAppStore.setState({
      _realtimeChannel: null,
      orders: [orderA, orderB],
      currentOrderId: 'order-a',
    });

    useAppStore.getState()._setupRealtime('workspace-1');

    expect(realtimeCallback).toBeTruthy();
    realtimeCallback!({
      eventType: 'DELETE',
      old: { id: 'order-a' },
    });

    const state = useAppStore.getState();
    expect(state.orders.map((o) => o.id)).toEqual(['order-b']);
    expect(state.currentOrderId).toBe('order-b');
  });

  describe('M3 Bug Fixes: State Sync, Persistence & Errors', () => {
    it('BUG-ORD-04: realtime UPDATE preserves concurrent remote updates when in-flight local snapshot exists', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null;
      const { useAppStore, supabase } = await loadStore();
      const channelObj: any = {
        on: vi.fn().mockImplementation((_event: string, opts: any, callback: any) => {
          if (opts?.table === 'orders') realtimeCallback = callback;
          return channelObj;
        }),
        subscribe: vi.fn().mockImplementation(() => channelObj),
        unsubscribe: vi.fn(),
      };
      (supabase.channel as any).mockReturnValue(channelObj);

      const baseOrder = makeStoreOrder({
        id: 'order-concurrent-1',
        name: 'Initial Name',
        goodsTotalZar: 500,
        fees: [],
        status: 'planning',
        isArchived: false,
      });

      useAppStore.setState({
        _realtimeChannel: null,
        orders: [baseOrder],
        people: storePeople,
      });
      useAppStore.getState()._setupRealtime('workspace-1');

      let resolveUpdate: (val: any) => void;
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve;
      });
      (supabase.__mocks.orderUpdate as any).mockImplementation(() => ({
        eq: vi.fn().mockReturnValue(updatePromise),
      }));

      const writePromise = useAppStore.getState().patchOrder('order-concurrent-1', { name: 'Local In-Flight Name' });

      expect(useAppStore.getState().orders[0].name).toBe('Local In-Flight Name');

      realtimeCallback!({
        eventType: 'UPDATE',
        new: {
          id: 'order-concurrent-1',
          workspace_id: 'workspace-1',
          name: 'Initial Name',
          order_date: '2026-03-18',
          status: 'planning',
          roaster_id: null,
          roaster_snapshot: null,
          payer_id: 'person-1',
          payer_bank: { bankName: '', accountNumber: '', beneficiary: '' },
          reference_template: 'FAJR-{ORDER}-{NAME}',
          goods_total_zar: '500',
          lots: baseOrder.lots,
          fees: [{ id: 'fee-remote-1', label: 'Remote Courier Fee', amountZar: 150, allocationType: 'equal_per_person', personId: null }],
          payments: {},
          is_archived: false,
          created_at: '2026-03-18T00:00:00.000Z',
          updated_at: '2026-03-18T00:05:00.000Z',
        },
        old: { id: 'order-concurrent-1' },
      });

      const order = useAppStore.getState().orders.find((o) => o.id === 'order-concurrent-1')!;
      expect(order.name).toBe('Local In-Flight Name');
      expect(order.fees).toHaveLength(1);
      expect(order.fees[0].id).toBe('fee-remote-1');
      expect(order.fees[0].label).toBe('Remote Courier Fee');

      resolveUpdate!({ data: null, error: null });
      await writePromise;
    });

    it('BUG-ORD-06 / BUG-ERR-01 / BUG-ERR-02: patchOrder returns Promise, rolls back optimistic state and sets store error on failure', async () => {
      const { useAppStore } = await loadStore({
        orderUpdate: { data: null, error: { message: 'Database connection lost', code: 'PGRST001' } },
      });

      const order1 = makeStoreOrder({
        id: 'order-err-1',
        name: 'Pre-mutation Order Name',
        goodsTotalZar: 400,
      });

      useAppStore.setState({ orders: [order1], people: storePeople, error: null });

      const patchPromise = useAppStore.getState().patchOrder('order-err-1', {
        name: 'Failed Optimistic Name',
        goodsTotalZar: 9999,
      });

      expect(patchPromise).toBeInstanceOf(Promise);
      await expect(patchPromise).rejects.toThrow('Database connection lost');

      const orderAfterRollback = useAppStore.getState().orders.find((o) => o.id === 'order-err-1')!;
      expect(orderAfterRollback.name).toBe('Pre-mutation Order Name');
      expect(orderAfterRollback.goodsTotalZar).toBe(400);

      expect(useAppStore.getState().error).toBe('Database connection lost');
    });

    it('BUG-ERR-03: deleteOrder catches error, surfaces in store error state and throws', async () => {
      const { useAppStore } = await loadStore({
        orderDelete: { data: null, error: { message: 'Delete forbidden by RLS', code: '42501' } },
      });

      const order = makeStoreOrder({ id: 'order-del-err', name: 'Undeletable' });
      useAppStore.setState({ orders: [order], error: null });

      await expect(useAppStore.getState().deleteOrder('order-del-err')).rejects.toThrow('Delete forbidden by RLS');

      expect(useAppStore.getState().error).toBe('Delete forbidden by RLS');
      expect(useAppStore.getState().orders).toHaveLength(1);
    });

    it('BUG-ERR-04: archiveOrder catches error, surfaces in store error state, and rolls back optimistic state', async () => {
      const { useAppStore } = await loadStore({
        orderUpdate: { data: null, error: { message: 'Failed to archive: lock error', code: '500' } },
      });

      const order = makeStoreOrder({
        id: 'order-arch-err',
        name: 'Active Order',
        status: 'planning',
        isArchived: false,
      });

      useAppStore.setState({ orders: [order], error: null });

      await expect(useAppStore.getState().archiveOrder('order-arch-err')).rejects.toThrow('Failed to archive: lock error');

      expect(useAppStore.getState().error).toBe('Failed to archive: lock error');
      const current = useAppStore.getState().orders.find((o) => o.id === 'order-arch-err')!;
      expect(current.status).toBe('planning');
      expect(current.isArchived).toBe(false);
    });

    it('BUG-EDGE-01: importJSON preserves order status and isArchived, and does not overwrite currentOrderId for archived orders', async () => {
      const { useAppStore } = await loadStore();

      const activeOrder = makeStoreOrder({ id: 'active-stay', name: 'Active Working Order', status: 'planning', isArchived: false });
      useAppStore.setState({
        orders: [activeOrder],
        currentOrderId: 'active-stay',
      });

      const backupJSON = JSON.stringify({
        version: '2',
        people: [],
        roasters: [],
        orders: [
          {
            id: 'archived-imported-1',
            name: 'Historical Archive 2025',
            orderDate: '2025-05-10',
            status: 'archived',
            isArchived: true,
            goodsTotalZar: 800,
            lots: [],
            fees: [],
            payments: {},
          },
          {
            id: 'locked-imported-2',
            name: 'Locked Finalizing Batch',
            orderDate: '2026-01-15',
            status: 'locked',
            isArchived: false,
            goodsTotalZar: 1200,
            lots: [],
            fees: [],
            payments: {},
          },
        ],
      });

      await useAppStore.getState().importJSON(backupJSON);

      const orders = useAppStore.getState().orders;
      const importedArchived = orders.find((o) => o.id === 'archived-imported-1');
      expect(importedArchived).toBeDefined();
      expect(importedArchived?.status).toBe('archived');
      expect(importedArchived?.isArchived).toBe(true);

      const importedLocked = orders.find((o) => o.id === 'locked-imported-2');
      expect(importedLocked).toBeDefined();
      expect(importedLocked?.status).toBe('locked');
      expect(importedLocked?.isArchived).toBe(false);

      expect(useAppStore.getState().currentOrderId).toBe('active-stay');
    });

    it('BUG-EDGE-02: importJSON re-import does not duplicate existing orders', async () => {
      const { useAppStore } = await loadStore();

      const backupJSON = JSON.stringify({
        version: '2',
        people: [],
        roasters: [],
        orders: [
          {
            id: 'order-reimport-1',
            name: 'Single Order Backup',
            orderDate: '2026-03-20',
            status: 'planning',
            goodsTotalZar: 500,
            lots: [],
            fees: [],
            payments: {},
          },
        ],
      });

      await useAppStore.getState().importJSON(backupJSON);
      expect(useAppStore.getState().orders.filter((o) => o.name === 'Single Order Backup')).toHaveLength(1);

      await useAppStore.getState().importJSON(backupJSON);
      expect(useAppStore.getState().orders.filter((o) => o.name === 'Single Order Backup')).toHaveLength(1);
    });

    it('BUG-EDGE-03: importJSON remaps bagAllocations participant IDs, restores settings, and restores roaster logoUrl', async () => {
      const { useAppStore } = await loadStore();
      useAppStore.setState({ accessStatus: 'member' });

      const backupJSON = JSON.stringify({
        version: '2',
        settings: {
          theme: 'tokyo',
          themeMode: 'dark',
        },
        people: [
          { id: 'old-p-99', name: 'Zaid Zakariya', email: 'zaid@example.com' },
        ],
        roasters: [
          { id: 'old-r-99', name: 'Rosetta Roastery', logoUrl: 'https://images.example.com/rosetta.png' },
        ],
        orders: [
          {
            id: 'order-bag-alloc-test',
            name: 'Rosetta Order',
            orderDate: '2026-03-25',
            status: 'planning',
            roasterId: 'old-r-99',
            payerId: 'old-p-99',
            goodsTotalZar: 600,
            lots: [
              {
                id: 'lot-1',
                name: 'Kainamui',
                foreignPricePerBag: 25,
                gramsPerBag: 250,
                quantity: 1,
                shares: [{ id: 's-1', personId: 'old-p-99', shareGrams: 250, bagIndex: 0 }],
                bags: [{ id: 'b-1', splitMode: 'full', buyers: [{ id: 'b-1', personId: 'old-p-99', grams: 250 }] }],
                bagAllocations: [
                  {
                    id: 'alloc-1',
                    bagIndex: 0,
                    mode: 'single',
                    participants: [
                      { id: 'part-1', personId: 'old-p-99', shareGrams: 250, sourceShareId: 's-1' },
                    ],
                  },
                ],
              },
            ],
            fees: [],
            payments: {},
          },
        ],
      });

      await useAppStore.getState().importJSON(backupJSON);

      const state = useAppStore.getState();

      expect(state.settings.theme).toBe('tokyo');
      expect(state.settings.themeMode).toBe('dark');

      const roaster = state.roasters.find((r) => r.name === 'Rosetta Roastery');
      expect(roaster).toBeDefined();
      expect(roaster?.logoUrl).toBe('https://images.example.com/rosetta.png');

      const person = state.people.find((p) => p.name === 'Zaid Zakariya');
      expect(person).toBeDefined();
      expect(person?.id).not.toBe('old-p-99');

      const importedOrder = state.orders.find((o) => o.name === 'Rosetta Order')!;
      expect(importedOrder).toBeDefined();
      expect(importedOrder.payerId).toBe(person!.id);

      const alloc = importedOrder.lots[0].bagAllocations?.[0];
      expect(alloc).toBeDefined();
      expect(alloc?.participants[0].personId).toBe(person!.id);
      expect(alloc?.participants[0].personId).not.toBe('old-p-99');
    });
  });
});
