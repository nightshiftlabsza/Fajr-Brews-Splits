import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { APP_URL, RESET_PASSWORD_PATH } from '../lib/appConfig';
import type { OrderWizardStep } from '../lib/orderWizard';
import { supabase, WORKSPACE_ID } from '../lib/supabase';
import {
  dedupePeopleById,
  mergeOrderPatch,
  sortPeopleByName,
  upsertOrderById,
  upsertPersonById,
} from '../lib/storeState';
import { getNextActiveOrderId, getPreferredActiveOrderId } from '../lib/orderLifecycle';
import type {
  Person,
  Order,
  AppSettings,
  Theme,
  ThemeMode,
  AccessStatus,
  AuthUser,
  WorkspaceMember,
  DbPerson,
  DbOrder,
  DbWorkspaceMember,
  PersonLinkResolution,
  PersonLinkCandidate,
  PersonMatchReason,
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

function mapOrder(row: DbOrder & { pin_required?: boolean }): Order {
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
    lots: Array.isArray(row.lots) ? row.lots : [],
    fees: Array.isArray(row.fees) ? row.fees : [],
    payments: (row.payments && typeof row.payments === 'object' && !Array.isArray(row.payments))
      ? row.payments
      : {},
    isArchived: row.is_archived,
    pinRequired: row.pin_required ?? false,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Store Interface ──────────────────────────────────────────

interface AppStore {
  // ── Auth ──────────────────────────────────────────────────
  user: AuthUser | null;
  accessStatus: AccessStatus;
  memberRole: 'owner' | 'admin' | 'member' | null;
  linkedPersonId: string | null;
  linkResolution: PersonLinkResolution;
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
  sessionUi: {
    orderWizardSteps: Record<string, OrderWizardStep>;
    orderProtectionOpen: Record<string, boolean>;
  };

  // ── Realtime channel ──────────────────────────────────────
  _realtimeChannel: RealtimeChannel | null;

  // ── Auth Actions ──────────────────────────────────────────
  initialize: (options?: { silent?: boolean }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  confirmPersonLink: (personId: string) => Promise<string | null>;
  dismissLinkResolution: () => void;

  // ── People Actions ────────────────────────────────────────
  addPerson: (data: Omit<Person, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>) => Promise<Person>;
  updatePerson: (id: string, data: Partial<Pick<Person, 'name' | 'phone' | 'email' | 'note'>>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;

  // ── Order Actions ─────────────────────────────────────────
  createOrder: (data: Omit<Order, 'id' | 'workspaceId' | 'isArchived' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<Order | null>;
  updateOrder: (id: string, data: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  setCurrentOrderId: (id: string | null) => void;
  setOrderWizardStep: (orderId: string, step: OrderWizardStep) => void;
  setOrderProtectionOpen: (orderId: string, open: boolean) => void;

  // ── Workspace member actions ──────────────────────────────
  fetchWorkspaceMembers: () => Promise<void>;
  addMemberByEmail: (email: string, role?: 'admin' | 'member') => Promise<string | null>;
  removeMember: (userId: string) => Promise<void>;

  // ── Settings Actions ──────────────────────────────────────
  setTheme: (theme: Theme) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setLastExportDate: (date: string) => Promise<void>;

  // ── PIN / Order Access Actions ────────────────────────────
  unlockedOrderIds: Set<string>;
  verifyOrderPin: (orderId: string, pin: string) => Promise<boolean>;
  setOrderPin: (orderId: string, pin: string) => Promise<void>;
  clearOrderPin: (orderId: string) => Promise<void>;

  // ── Import/Export ─────────────────────────────────────────
  exportJSON: () => string;
  importJSON: (json: string) => Promise<void>;

  // ── Internal ──────────────────────────────────────────────
  _setupRealtime: (workspaceId: string) => void;
  _teardownRealtime: () => void;
  _loadSettings: (userId: string) => Promise<void>;
  _saveSettings: (userId: string, settings: Partial<AppSettings>) => Promise<void>;
}

// ─── Safe localStorage (private-browsing guard) ──────────────

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  removeItem: (key: string): void => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

function normalizeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('networkerror') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('fetch resource')
  ) {
    return 'Fajr Brews could not reach Supabase. Please check that the Supabase project URL and publishable key are correct.';
  }

  return message;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone?: string): string | undefined {
  const trimmed = phone?.trim();
  return trimmed ? trimmed : undefined;
}

const defaultLinkResolution: PersonLinkResolution = {
  status: 'idle',
  linkedPersonId: null,
  matchedBy: null,
  person: null,
  candidates: [],
};

function mapLinkCandidate(value: unknown): PersonLinkCandidate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const personId = typeof row.personId === 'string' ? row.personId : null;
  const name = typeof row.name === 'string' ? row.name : null;
  const matchReason = row.matchReason;

  if (
    !personId ||
    !name ||
    (matchReason !== 'email' && matchReason !== 'phone' && matchReason !== 'name')
  ) {
    return null;
  }

  return {
    personId,
    workspaceId: typeof row.workspaceId === 'string' ? row.workspaceId : undefined,
    name,
    email: typeof row.email === 'string' ? row.email : undefined,
    phone: typeof row.phone === 'string' ? row.phone : undefined,
    matchReason,
  };
}

function mapLinkResolution(payload: unknown): PersonLinkResolution {
  if (!payload || typeof payload !== 'object') {
    return defaultLinkResolution;
  }

  const row = payload as Record<string, unknown>;
  const candidates = Array.isArray(row.candidates)
    ? row.candidates.map(mapLinkCandidate).filter((candidate): candidate is PersonLinkCandidate => candidate !== null)
    : [];
  const person = mapLinkCandidate(row.person);
  const status = row.status;
  const matchedBy = row.matchedBy;

  return {
    status:
      status === 'linked' ||
      status === 'auto-linked' ||
      status === 'needs-confirmation' ||
      status === 'ambiguous' ||
      status === 'none'
        ? status
        : 'idle',
    linkedPersonId: typeof row.linkedPersonId === 'string' ? row.linkedPersonId : null,
    matchedBy:
      matchedBy === 'email' ||
      matchedBy === 'phone' ||
      matchedBy === 'name' ||
      matchedBy === 'manual'
        ? (matchedBy as PersonMatchReason)
        : null,
    person,
    candidates,
  };
}

const orderWriteChains = new Map<string, Promise<void>>();
const optimisticOrderSnapshots = new Map<string, Order>();

// ─── Computed getter ─────────────────────────────────────────

export const getCurrentOrder = (state: AppStore): Order | null => {
  if (!state.currentOrderId) return null;
  return state.orders.find((o) => o.id === state.currentOrderId) ?? null;
};

// ─── Store ────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  accessStatus: 'checking',
  memberRole: null,
  linkedPersonId: null,
  linkResolution: defaultLinkResolution,
  workspaceMembers: [],
  people: [],
  orders: [],
  currentOrderId: safeLocalStorage.getItem('fb_current_order_id'),
  settings: { theme: 'emerald', themeMode: 'light' },
  isInitialized: false,
  isLoading: false,
  error: null,
  sessionUi: {
    orderWizardSteps: {},
    orderProtectionOpen: {},
  },
  _realtimeChannel: null,
  unlockedOrderIds: new Set<string>(),

  // ── Initialize ────────────────────────────────────────────
  initialize: async (options) => {
    const silent = options?.silent ?? false;
    const shouldBlock = !silent || !get().isInitialized;

    if (shouldBlock) {
      set({ isLoading: true, error: null });
    } else {
      set({ error: null });
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        set({
          user: null,
          accessStatus: 'none',
          memberRole: null,
          linkedPersonId: null,
          linkResolution: defaultLinkResolution,
          people: [],
          orders: [],
          currentOrderId: null,
          isInitialized: true,
          isLoading: false,
        });
        return;
      }

      const user: AuthUser = {
        id: session.user.id,
        email: session.user.email ?? '',
        fullName: session.user.user_metadata?.full_name,
        phone: session.user.user_metadata?.phone,
      };

      const [{ data: memberRow, error: memberErr }, { data: linkPayload, error: linkErr }] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', WORKSPACE_ID)
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase.rpc('resolve_my_person_link'),
      ]);

      if (memberErr) {
        throw new Error(memberErr.message);
      }

      if (linkErr) {
        throw new Error(linkErr.message);
      }

      const linkResolution = mapLinkResolution(linkPayload);
      const linkedPersonId = linkResolution.linkedPersonId ?? linkResolution.person?.personId ?? null;
      const hasWorkspaceAccess = Boolean(memberRow) || Boolean(linkedPersonId);

      if (hasWorkspaceAccess) {
        // Setup Realtime before fetch so no events are missed during the fetch window
        get()._setupRealtime(WORKSPACE_ID);
      } else {
        get()._teardownRealtime();
      }

      const [{ data: peopleRows }, { data: orderRows }] = hasWorkspaceAccess
        ? await Promise.all([
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
        ])
        : [{ data: [] }, { data: [] }];

      const people = sortPeopleByName(dedupePeopleById((peopleRows as DbPerson[] | null ?? []).map(mapPerson)));
      const orders = (orderRows as DbOrder[] | null ?? []).map(mapOrder);

      await get()._loadSettings(session.user.id);

      // Apply saved theme + mode to DOM
      const currentTheme = get().settings.theme;
      const currentMode = get().settings.themeMode;
      document.documentElement.setAttribute('data-theme', currentTheme);
      document.documentElement.setAttribute('data-mode', currentMode);
      safeLocalStorage.setItem('fb_theme', currentTheme);
      safeLocalStorage.setItem('fb_theme_mode', currentMode);

      // Validate saved currentOrderId against fetched orders (Bug 4B)
      const savedId = safeLocalStorage.getItem('fb_current_order_id');
      const currentOrderId = getPreferredActiveOrderId(orders, savedId);
      if (currentOrderId && currentOrderId !== savedId) {
        safeLocalStorage.setItem('fb_current_order_id', currentOrderId);
      } else if (!currentOrderId) {
        safeLocalStorage.removeItem('fb_current_order_id');
      }

      set({
        user,
        accessStatus: memberRow ? 'member' : linkedPersonId ? 'participant' : 'none',
        memberRole: memberRow?.role ?? null,
        linkedPersonId,
        linkResolution,
        people,
        orders,
        currentOrderId,
        isInitialized: true,
        isLoading: false,
      });
    } catch (err) {
      set({ error: String(err), isInitialized: true, isLoading: false });
    }
  },

  // ── Auth ──────────────────────────────────────────────────
  signIn: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (error) return normalizeAuthError(error);
      await get().initialize();
      return null;
    } catch (error) {
      return normalizeAuthError(error);
    }
  },

  signUp: async (email, password, fullName, phone) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            ...(normalizePhone(phone) ? { phone: normalizePhone(phone) } : {}),
          },
        },
      });
      if (error) return normalizeAuthError(error);
      return null;
    } catch (error) {
      return normalizeAuthError(error);
    }
  },

  requestPasswordReset: async (email) => {
    const redirectTo = `${APP_URL}${RESET_PASSWORD_PATH}`;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
        redirectTo,
      });
      if (error) return normalizeAuthError(error);
      return null;
    } catch (error) {
      return normalizeAuthError(error);
    }
  },

  updatePassword: async (password) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return normalizeAuthError(error);
      await get().initialize();
      return null;
    } catch (error) {
      return normalizeAuthError(error);
    }
  },

  signOut: async () => {
    get()._teardownRealtime();
    orderWriteChains.clear();
    optimisticOrderSnapshots.clear();
    await supabase.auth.signOut();
    set({
      user: null,
      accessStatus: 'none',
      memberRole: null,
      linkedPersonId: null,
      linkResolution: defaultLinkResolution,
      people: [],
      orders: [],
      currentOrderId: null,
      sessionUi: {
        orderWizardSteps: {},
        orderProtectionOpen: {},
      },
      unlockedOrderIds: new Set<string>(),
    });
  },

  confirmPersonLink: async (personId) => {
    try {
      const { error } = await supabase.rpc('confirm_my_person_link', {
        p_person_id: personId,
      });

      if (error) {
        return error.message;
      }

      await get().initialize({ silent: true });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  },

  dismissLinkResolution: () => {
    set((state) => ({
      linkResolution: {
        ...state.linkResolution,
        status: state.linkResolution.linkedPersonId ? 'linked' : 'idle',
      },
    }));
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
      const person = mapPerson(row as DbPerson);
      set((s) => ({ people: upsertPersonById(s.people, person) }));
      return person;
    }
    throw new Error('Failed to create person.');
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
    set((s) => {
      const current = s.people.find((person) => person.id === id);
      if (!current) {
        return { people: s.people };
      }

      return {
        people: upsertPersonById(s.people, { ...current, ...data }),
      };
    });
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
      set((s) => ({ orders: upsertOrderById(s.orders, order), currentOrderId: order.id }));
      safeLocalStorage.setItem('fb_current_order_id', order.id);
      return order;
    }
    return null;
  },

  updateOrder: async (id, data) => {
    const currentOrder = get().orders.find((order) => order.id === id);
    if (!currentOrder) {
      return;
    }

    const optimisticOrder = mergeOrderPatch(currentOrder, data);
    optimisticOrderSnapshots.set(id, optimisticOrder);
    set((s) => ({
      orders: s.orders.map((order) => (order.id === id ? optimisticOrder : order)),
    }));

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

    const previousChain = orderWriteChains.get(id) ?? Promise.resolve();
    const nextChain = previousChain
      .catch(() => undefined)
      .then(async () => {
        const { error } = await supabase.from('orders').update(dbData).eq('id', id);
        if (error) throw new Error(error.message);
      })
      .finally(() => {
        if (orderWriteChains.get(id) === nextChain) {
          orderWriteChains.delete(id);
          optimisticOrderSnapshots.delete(id);
        }
      });

    orderWriteChains.set(id, nextChain);
    await nextChain;
  },

  deleteOrder: async (id) => {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw new Error(error.message);
    orderWriteChains.delete(id);
    optimisticOrderSnapshots.delete(id);
    set((s) => {
      const orders = s.orders.filter((o) => o.id !== id);
      const currentOrderId = s.currentOrderId === id
        ? getNextActiveOrderId(orders)
        : s.currentOrderId;
      if (currentOrderId) safeLocalStorage.setItem('fb_current_order_id', currentOrderId);
      else safeLocalStorage.removeItem('fb_current_order_id');
      const { [id]: _removedStep, ...orderWizardSteps } = s.sessionUi.orderWizardSteps;
      const { [id]: _removedProtection, ...orderProtectionOpen } = s.sessionUi.orderProtectionOpen;
      const unlockedOrderIds = new Set(s.unlockedOrderIds);
      unlockedOrderIds.delete(id);
      return {
        orders,
        currentOrderId,
        unlockedOrderIds,
        sessionUi: {
          ...s.sessionUi,
          orderWizardSteps,
          orderProtectionOpen,
        },
      };
    });
  },

  setCurrentOrderId: (id) => {
    set({ currentOrderId: id });
    if (id) safeLocalStorage.setItem('fb_current_order_id', id);
    else safeLocalStorage.removeItem('fb_current_order_id');
  },

  setOrderWizardStep: (orderId, step) => {
    set((s) => ({
      sessionUi: {
        ...s.sessionUi,
        orderWizardSteps: {
          ...s.sessionUi.orderWizardSteps,
          [orderId]: step,
        },
      },
    }));
  },

  setOrderProtectionOpen: (orderId, open) => {
    set((s) => ({
      sessionUi: {
        ...s.sessionUi,
        orderProtectionOpen: {
          ...s.sessionUi.orderProtectionOpen,
          [orderId]: open,
        },
      },
    }));
  },

  // ── Workspace Members ─────────────────────────────────────
  fetchWorkspaceMembers: async () => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('*, profiles(email, full_name)')
      .eq('workspace_id', WORKSPACE_ID);

    if (error) throw new Error(error.message);
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
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', WORKSPACE_ID)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    await get().fetchWorkspaceMembers();
  },

  // ── Settings ──────────────────────────────────────────────
  _loadSettings: async (userId) => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    // PGRST116 = no row found — perfectly fine for first-time users
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (data) {
      set({
        settings: {
          theme: data.theme ?? 'emerald',
          themeMode: (data as { theme_mode?: ThemeMode }).theme_mode ?? 'light',
          lastExportDate: data.last_export_date ?? undefined,
        },
      });
    }
  },

  _saveSettings: async (userId, settings) => {
    const current = get().settings;
    const merged = { ...current, ...settings };

    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      theme: merged.theme,
      theme_mode: merged.themeMode,
      last_export_date: merged.lastExportDate ?? null,
    });
    if (error) throw new Error(error.message);
  },

  setTheme: async (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set((s) => ({ settings: { ...s.settings, theme } }));
    safeLocalStorage.setItem('fb_theme', theme);
    const userId = get().user?.id;
    if (userId) await get()._saveSettings(userId, { theme });
  },

  setThemeMode: async (mode) => {
    document.documentElement.setAttribute('data-mode', mode);
    set((s) => ({ settings: { ...s.settings, themeMode: mode } }));
    safeLocalStorage.setItem('fb_theme_mode', mode);
    const userId = get().user?.id;
    if (userId) await get()._saveSettings(userId, { themeMode: mode });
  },

  setLastExportDate: async (date) => {
    set((s) => ({ settings: { ...s.settings, lastExportDate: date } }));
    const userId = get().user?.id;
    if (userId) await get()._saveSettings(userId, { lastExportDate: date });
  },

  // ── Export / Import ───────────────────────────────────────
  exportJSON: () => {
    const { people, orders, settings } = get();
    // Strip PIN fields — they are security-sensitive and meaningless without the server-side hash
    const cleanOrders = orders.map((o) => {
      const { pinRequired: _pr, ...rest } = o;
      return rest;
    });
    return JSON.stringify({ version: '1', people, orders: cleanOrders, settings, exportedAt: new Date().toISOString() }, null, 2);
  },

  importJSON: async (json) => {
    const parsed = JSON.parse(json);

    if (parsed.version !== '1') {
      throw new Error('Unsupported export format. Expected version 1.');
    }

    if (parsed.people && Array.isArray(parsed.people)) {
      // Import people — insert any that don't exist by name
      for (const p of parsed.people) {
        if (!p || typeof p.name !== 'string') continue;
        try {
          if (!get().people.find((ex) => ex.name === p.name)) {
            await get().addPerson({
              name: String(p.name),
              phone: p.phone ? String(p.phone) : undefined,
              email: p.email ? String(p.email) : undefined,
              note: p.note ? String(p.note) : undefined,
            });
          }
        } catch (err) {
          console.error('importJSON: skipping person due to error', p.name, err);
        }
      }
    }

    if (parsed.orders && Array.isArray(parsed.orders)) {
      for (const o of parsed.orders) {
        if (!o || typeof o.id !== 'string') continue;
        try {
          if (!get().orders.find((ex) => ex.id === o.id)) {
            await get().createOrder({
              name: String(o.name ?? 'Imported Order'),
              orderDate: String(o.orderDate ?? new Date().toISOString().split('T')[0]),
              payerId: o.payerId ? String(o.payerId) : null,
              payerBank: o.payerBank && typeof o.payerBank === 'object' ? o.payerBank : { bankName: '', accountNumber: '', beneficiary: '' },
              referenceTemplate: String(o.referenceTemplate ?? 'FAJR-{ORDER}-{NAME}'),
              payerNote: o.payerNote ? String(o.payerNote) : undefined,
              goodsTotalZar: Number(o.goodsTotalZar ?? 0),
              lots: Array.isArray(o.lots) ? o.lots : [],
              fees: Array.isArray(o.fees) ? o.fees : [],
              payments: (o.payments && typeof o.payments === 'object' && !Array.isArray(o.payments)) ? o.payments : {},
            });
          }
        } catch (err) {
          console.error('importJSON: skipping order due to error', o.id, err);
        }
      }
    }
  },

  // ── PIN / Order Access ────────────────────────────────────
  verifyOrderPin: async (orderId, pin) => {
    const { data, error } = await supabase.rpc('verify_order_pin', {
      p_order_id: orderId,
      p_pin: pin,
    });
    if (error) throw new Error(error.message);
    const success = data === true;
    if (success) {
      set((s) => ({ unlockedOrderIds: new Set([...s.unlockedOrderIds, orderId]) }));
    }
    return success;
  },

  setOrderPin: async (orderId, pin) => {
    const { error } = await supabase.rpc('set_order_pin', {
      p_order_id: orderId,
      p_pin: pin,
    });
    if (error) throw new Error(error.message);
    // Update local state to reflect pin is now required
    set((s) => ({
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, pinRequired: true } : o)),
      // The order is now unlocked for this session since we just set it
      unlockedOrderIds: new Set([...s.unlockedOrderIds, orderId]),
    }));
  },

  clearOrderPin: async (orderId) => {
    const { error } = await supabase.rpc('clear_order_pin', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    set((s) => ({
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, pinRequired: false } : o)),
    }));
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
          try {
              const { eventType, new: newRow, old: oldRow } = payload;
              if (eventType === 'INSERT') {
                const person = mapPerson(newRow as DbPerson);
                set((s) => ({
                  people: upsertPersonById(s.people, person),
                }));
              } else if (eventType === 'UPDATE') {
                const person = mapPerson(newRow as DbPerson);
                set((s) => ({ people: upsertPersonById(s.people, person) }));
              } else if (eventType === 'DELETE') {
                set((s) => ({ people: s.people.filter((p) => p.id !== (oldRow as DbPerson).id) }));
              }
          } catch (err) {
            console.error('Realtime people error:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          try {
              const { eventType, new: newRow, old: oldRow } = payload;
              if (eventType === 'INSERT') {
                const order = mapOrder(newRow as DbOrder);
                const nextOrder = optimisticOrderSnapshots.get(order.id) ?? order;
                set((s) => ({
                  orders: upsertOrderById(s.orders, nextOrder),
                }));
              } else if (eventType === 'UPDATE') {
                const order = mapOrder(newRow as DbOrder);
                const nextOrder = optimisticOrderSnapshots.get(order.id) ?? order;
                set((s) => ({ orders: upsertOrderById(s.orders, nextOrder) }));
              } else if (eventType === 'DELETE') {
                const deletedOrderId = (oldRow as DbOrder).id;
                optimisticOrderSnapshots.delete(deletedOrderId);
                orderWriteChains.delete(deletedOrderId);
                set((s) => ({ orders: s.orders.filter((o) => o.id !== deletedOrderId) }));
              }
          } catch (err) {
            console.error('Realtime orders error:', err);
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
