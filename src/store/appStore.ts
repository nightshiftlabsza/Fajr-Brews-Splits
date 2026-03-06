import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, WORKSPACE_ID } from '../lib/supabase';
import type {
  Person,
  Order,
  AppSettings,
  Theme,
  MembershipStatus,
  AuthUser,
  WorkspaceMember,
  DbPerson,
  DbOrder,
  DbWorkspaceMember,
} from '../types';

// ─── Mappers (DB row → App type) ─────────────────────────────

function mapPerson(row: DbPerson): Person {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrder(row: DbOrder): Order {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    orderDate: row.order_date,
    payerId: row.payer_id,
    payerBank: row.payer_bank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: row.reference_template,
    payerNote: row.payer_note ?? undefined,
    goodsTotalZar: Number(row.goods_total_zar),
    lots: row.lots ?? [],
    fees: row.fees ?? [],
    payments: row.payments ?? {},
    isArchived: row.is_archived,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Store Interface ──────────────────────────────────────────

interface AppStore {
  // ── Auth ──────────────────────────────────────────────────
  user: AuthUser | null;
  membershipStatus: MembershipStatus;
  memberRole: 'owner' | 'admin' | 'member' | null;
  workspaceMembers: WorkspaceMember[];

  // ── Data ──────────────────────────────────────────────────
  people: Person[];
  orders: Order[];
  currentOrderId: string | null;

  // ── Settings ──────────────────────────────────────────────
  settings: AppSettings;

  // ── UI ────────────────────────────────────────────────────
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // ── Realtime channel ──────────────────────────────────────
  _realtimeChannel: RealtimeChannel | null;

  // ── Auth Actions ──────────────────────────────────────────
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;

  // ── People Actions ────────────────────────────────────────
  addPerson: (data: Omit<Person, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePerson: (id: string, data: Partial<Pick<Person, 'name' | 'phone' | 'email' | 'note'>>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;

  // ── Order Actions ─────────────────────────────────────────
  createOrder: (data: Omit<Order, 'id' | 'workspaceId' | 'isArchived' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<Order | null>;
  updateOrder: (id: string, data: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  setCurrentOrderId: (id: string | null) => void;

  // ── Workspace member actions ──────────────────────────────
  fetchWorkspaceMembers: () => Promise<void>;
  addMemberByEmail: (email: string, role?: 'admin' | 'member') => Promise<string | null>;
  removeMember: (userId: string) => Promise<void>;

  // ── Settings Actions ──────────────────────────────────────
  setTheme: (theme: Theme) => Promise<void>;
  setLastExportDate: (date: string) => Promise<void>;

  // ── Import/Export ─────────────────────────────────────────
  exportJSON: () => string;
  importJSON: (json: string) => Promise<void>;

  // ── Internal ──────────────────────────────────────────────
  _setupRealtime: (workspaceId: string) => void;
  _teardownRealtime: () => void;
  _loadSettings: (userId: string) => Promise<void>;
  _saveSettings: (userId: string, settings: Partial<AppSettings>) => Promise<void>;
}

// ─── Computed getter ─────────────────────────────────────────

export const getCurrentOrder = (state: AppStore): Order | null => {
  if (!state.currentOrderId) return null;
  return state.orders.find((o) => o.id === state.currentOrderId) ?? null;
};

// ─── Store ────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  membershipStatus: 'checking',
  memberRole: null,
  workspaceMembers: [],
  people: [],
  orders: [],
  currentOrderId: localStorage.getItem('fb_current_order_id'),
  settings: { theme: 'porcelain' },
  isInitialized: false,
  isLoading: false,
  error: null,
  _realtimeChannel: null,

  // ── Initialize ────────────────────────────────────────────
  initialize: async () => {
    set({ isLoading: true, error: null });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ user: null, membershipStatus: 'none', isInitialized: true, isLoading: false });
        return;
      }

      const user: AuthUser = {
        id: session.user.id,
        email: session.user.email ?? '',
        fullName: session.user.user_metadata?.full_name,
      };

      // Check workspace membership
      const { data: memberRow, error: memberErr } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('user_id', session.user.id)
        .single();

      if (memberErr || !memberRow) {
        set({
          user,
          membershipStatus: 'none',
          isInitialized: true,
          isLoading: false,
        });
        return;
      }

      // Fetch data
      const [{ data: peopleRows }, { data: orderRows }] = await Promise.all([
        supabase
          .from('people')
          .select('*')
          .eq('workspace_id', WORKSPACE_ID)
          .order('name'),
        supabase
          .from('orders')
          .select('*')
          .eq('workspace_id', WORKSPACE_ID)
          .order('order_date', { ascending: false }),
      ]);

      const people = (peopleRows as DbPerson[] | null ?? []).map(mapPerson);
      const orders = (orderRows as DbOrder[] | null ?? []).map(mapOrder);

      await get()._loadSettings(session.user.id);

      // Apply saved theme to DOM
      const currentTheme = get().settings.theme;
      document.documentElement.setAttribute('data-theme', currentTheme);

      set({
        user,
        membershipStatus: 'member',
        memberRole: memberRow.role,
        people,
        orders,
        isInitialized: true,
        isLoading: false,
      });

      get()._setupRealtime(WORKSPACE_ID);
    } catch (err) {
      set({ error: String(err), isInitialized: true, isLoading: false });
    }
  },

  // ── Auth ──────────────────────────────────────────────────
  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    await get().initialize();
    return null;
  },

  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return error.message;
    return null;
  },

  signOut: async () => {
    get()._teardownRealtime();
    await supabase.auth.signOut();
    set({
      user: null,
      membershipStatus: 'none',
      memberRole: null,
      people: [],
      orders: [],
      currentOrderId: null,
    });
  },

  // ── People ────────────────────────────────────────────────
  addPerson: async (data) => {
    const { data: row, error } = await supabase
      .from('people')
      .insert({
        workspace_id: WORKSPACE_ID,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        note: data.note || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (row) {
      set((s) => ({ people: [...s.people, mapPerson(row as DbPerson)].sort((a, b) => a.name.localeCompare(b.name)) }));
    }
  },

  updatePerson: async (id, data) => {
    const { error } = await supabase
      .from('people')
      .update({
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        note: data.note ?? null,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    set((s) => ({
      people: s.people.map((p) => (p.id === id ? { ...p, ...data } : p)),
    }));
  },

  deletePerson: async (id) => {
    const { error } = await supabase.from('people').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ people: s.people.filter((p) => p.id !== id) }));
  },

  // ── Orders ────────────────────────────────────────────────
  createOrder: async (data) => {
    const userId = get().user?.id;
    const { data: row, error } = await supabase
      .from('orders')
      .insert({
        workspace_id: WORKSPACE_ID,
        name: data.name,
        order_date: data.orderDate,
        payer_id: data.payerId,
        payer_bank: data.payerBank,
        reference_template: data.referenceTemplate,
        payer_note: data.payerNote || null,
        goods_total_zar: data.goodsTotalZar,
        lots: data.lots,
        fees: data.fees,
        payments: data.payments,
        is_archived: false,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (row) {
      const order = mapOrder(row as DbOrder);
      set((s) => ({ orders: [order, ...s.orders], currentOrderId: order.id }));
      localStorage.setItem('fb_current_order_id', order.id);
      return order;
    }
    return null;
  },

  updateOrder: async (id, data) => {
    const dbData: Record<string, unknown> = {};
    if (data.name !== undefined) dbData.name = data.name;
    if (data.orderDate !== undefined) dbData.order_date = data.orderDate;
    if (data.payerId !== undefined) dbData.payer_id = data.payerId;
    if (data.payerBank !== undefined) dbData.payer_bank = data.payerBank;
    if (data.referenceTemplate !== undefined) dbData.reference_template = data.referenceTemplate;
    if (data.payerNote !== undefined) dbData.payer_note = data.payerNote || null;
    if (data.goodsTotalZar !== undefined) dbData.goods_total_zar = data.goodsTotalZar;
    if (data.lots !== undefined) dbData.lots = data.lots;
    if (data.fees !== undefined) dbData.fees = data.fees;
    if (data.payments !== undefined) dbData.payments = data.payments;
    if (data.isArchived !== undefined) dbData.is_archived = data.isArchived;

    const { error } = await supabase.from('orders').update(dbData).eq('id', id);
    if (error) throw new Error(error.message);

    set((s) => ({
      orders: s.orders.map((o) => (o.id === id ? { ...o, ...data } : o)),
    }));
  },

  deleteOrder: async (id) => {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => {
      const orders = s.orders.filter((o) => o.id !== id);
      const currentOrderId = s.currentOrderId === id ? null : s.currentOrderId;
      if (currentOrderId === null) localStorage.removeItem('fb_current_order_id');
      return { orders, currentOrderId };
    });
  },

  setCurrentOrderId: (id) => {
    set({ currentOrderId: id });
    if (id) localStorage.setItem('fb_current_order_id', id);
    else localStorage.removeItem('fb_current_order_id');
  },

  // ── Workspace Members ─────────────────────────────────────
  fetchWorkspaceMembers: async () => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('*, profiles(email, full_name)')
      .eq('workspace_id', WORKSPACE_ID);

    if (error) return;
    const members: WorkspaceMember[] = (data as DbWorkspaceMember[]).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      email: row.profiles?.email,
      fullName: row.profiles?.full_name ?? undefined,
    }));
    set({ workspaceMembers: members });
  },

  addMemberByEmail: async (email, role = 'member') => {
    // Look up profile by email
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (profileErr || !profile) {
      return 'No registered user found with that email address.';
    }

    const { error } = await supabase.from('workspace_members').insert({
      workspace_id: WORKSPACE_ID,
      user_id: profile.id,
      role,
    });

    if (error) {
      if (error.code === '23505') return 'This user is already a member.';
      return error.message;
    }

    await get().fetchWorkspaceMembers();
    return null;
  },

  removeMember: async (userId) => {
    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', WORKSPACE_ID)
      .eq('user_id', userId);
    await get().fetchWorkspaceMembers();
  },

  // ── Settings ──────────────────────────────────────────────
  _loadSettings: async (userId) => {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
      set({ settings: { theme: data.theme, lastExportDate: data.last_export_date ?? undefined } });
    }
  },

  _saveSettings: async (userId, settings) => {
    const current = get().settings;
    const merged = { ...current, ...settings };

    await supabase.from('user_settings').upsert({
      user_id: userId,
      theme: merged.theme,
      last_export_date: merged.lastExportDate ?? null,
    });
  },

  setTheme: async (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set((s) => ({ settings: { ...s.settings, theme } }));
    const userId = get().user?.id;
    if (userId) await get()._saveSettings(userId, { theme });
  },

  setLastExportDate: async (date) => {
    set((s) => ({ settings: { ...s.settings, lastExportDate: date } }));
    const userId = get().user?.id;
    if (userId) await get()._saveSettings(userId, { lastExportDate: date });
  },

  // ── Export / Import ───────────────────────────────────────
  exportJSON: () => {
    const { people, orders, settings } = get();
    return JSON.stringify({ people, orders, settings, exportedAt: new Date().toISOString() }, null, 2);
  },

  importJSON: async (json) => {
    const parsed = JSON.parse(json);
    if (parsed.people && Array.isArray(parsed.people)) {
      // Import people — insert any that don't exist by name
      for (const p of parsed.people) {
        if (!get().people.find((ex) => ex.name === p.name)) {
          await get().addPerson({ name: p.name, phone: p.phone, email: p.email, note: p.note });
        }
      }
    }
    if (parsed.orders && Array.isArray(parsed.orders)) {
      for (const o of parsed.orders) {
        if (!get().orders.find((ex) => ex.id === o.id)) {
          await get().createOrder(o);
        }
      }
    }
  },

  // ── Realtime ──────────────────────────────────────────────
  _setupRealtime: (workspaceId) => {
    const existing = get()._realtimeChannel;
    if (existing) existing.unsubscribe();

    const channel = supabase
      .channel(`workspace:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'people', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === 'INSERT') {
            const person = mapPerson(newRow as DbPerson);
            set((s) => ({
              people: [...s.people.filter((p) => p.id !== person.id), person]
                .sort((a, b) => a.name.localeCompare(b.name)),
            }));
          } else if (eventType === 'UPDATE') {
            const person = mapPerson(newRow as DbPerson);
            set((s) => ({ people: s.people.map((p) => (p.id === person.id ? person : p)) }));
          } else if (eventType === 'DELETE') {
            set((s) => ({ people: s.people.filter((p) => p.id !== (oldRow as DbPerson).id) }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === 'INSERT') {
            const order = mapOrder(newRow as DbOrder);
            set((s) => ({
              orders: [order, ...s.orders.filter((o) => o.id !== order.id)],
            }));
          } else if (eventType === 'UPDATE') {
            const order = mapOrder(newRow as DbOrder);
            set((s) => ({ orders: s.orders.map((o) => (o.id === order.id ? order : o)) }));
          } else if (eventType === 'DELETE') {
            set((s) => ({ orders: s.orders.filter((o) => o.id !== (oldRow as DbOrder).id) }));
          }
        }
      )
      .subscribe();

    set({ _realtimeChannel: channel });
  },

  _teardownRealtime: () => {
    const channel = get()._realtimeChannel;
    if (channel) {
      channel.unsubscribe();
      set({ _realtimeChannel: null });
    }
  },
}));
