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
  upsertRoasterById,
} from '../lib/storeState';
import { assertCanPersistOrder } from '../lib/orderIntegrity';
import { getNextActiveOrderId, getPreferredActiveOrderId, normalizeOrderStatus, syncOrderStatusFlags } from '../lib/orderLifecycle';
import { createRoasterSnapshot, normalizeRoasterName } from '../lib/roasters';
import type {
  Person,
  Order,
  OrderStatus,
  CoffeeLot,
  Fee,
  PaymentRecord,
  PayerBank,
  RoasterSnapshot,
  AppSettings,
  Theme,
  ThemeMode,
  AccessStatus,
  AuthUser,
  WorkspaceMember,
  DbPerson,
  DbOrder,
  DbRoaster,
  DbWorkspaceMember,
  PersonLinkResolution,
  PersonLinkCandidate,
  PersonMatchReason,
  Roaster,
  RoasterFeatureStatus,
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

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return (parsed !== null && parsed !== undefined ? parsed : fallback) as T;
    } catch (err) {
      console.warn('parseJsonField: Failed to parse JSON payload', value, err);
      return fallback;
    }
  }
  return value as T;
}

function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  const parsed = parseJsonField(value, fallback);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  console.warn('parseJsonArray: Expected array but received', typeof parsed, value);
  return fallback;
}

function parseJsonObject<T extends object | null>(value: unknown, fallback: T): T {
  const parsed = parseJsonField(value, fallback);
  if (parsed === null && fallback === null) return null as T;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as T;
  }
  if (parsed === null) return fallback;
  console.warn('parseJsonObject: Expected object but received', typeof parsed, value);
  return fallback;
}

function mapOrder(row: DbOrder, existingOrder?: Order | null): Order {
  const status = normalizeOrderStatus(row.status, row.is_archived);
  const lots = parseJsonArray<CoffeeLot>(row.lots, existingOrder?.lots ?? []);
  const fees = parseJsonArray<Fee>(row.fees, existingOrder?.fees ?? []);
  const payments = parseJsonObject<Record<string, PaymentRecord>>(row.payments, existingOrder?.payments ?? {});
  const payerBank = parseJsonObject<PayerBank>(
    row.payer_bank,
    existingOrder?.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
  );
  const roasterSnapshot = parseJsonObject<RoasterSnapshot | null>(
    row.roaster_snapshot,
    existingOrder?.roasterSnapshot ?? null,
  );

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    orderDate: row.order_date,
    status,
    roasterId: row.roaster_id ?? null,
    roasterSnapshot,
    payerId: row.payer_id,
    payerBank,
    referenceTemplate: row.reference_template,
    payerNote: row.payer_note ?? undefined,
    goodsTotalZar: Number(row.goods_total_zar),
    lots,
    fees,
    payments,
    isArchived: status === 'archived',
    ownerId: row.owner_id ?? row.created_by ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoaster(row: DbRoaster): Roaster {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    logoPath: row.logo_path ?? undefined,
    logoUrl: row.logo_url ?? undefined,
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
  roasters: Roaster[];
  orders: Order[];
  currentOrderId: string | null;
  roasterFeatureStatus: RoasterFeatureStatus;
  roasterFeatureMessage: string | null;

  // ── Settings ──────────────────────────────────────────────
  settings: AppSettings;

  // ── UI ────────────────────────────────────────────────────
  isInitialized: boolean;
  isLoading: boolean;
  isSyncing: boolean;
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

  // ── Roaster Actions ───────────────────────────────────────
  createRoaster: (data: { name: string; logoFile?: File | null }) => Promise<Roaster>;
  updateRoaster: (id: string, data: { name?: string; logoFile?: File | null; removeLogo?: boolean }) => Promise<Roaster>;

  // ── Order Actions ─────────────────────────────────────────
  createOrder: (data: Omit<Order, 'id' | 'workspaceId' | 'status' | 'isArchived' | 'createdBy' | 'createdAt' | 'updatedAt'> & { status?: OrderStatus }) => Promise<Order | null>;
  updateOrder: (id: string, data: Partial<Order>) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  joinOrder: (orderId: string) => Promise<void>;
  leaveOrder: (orderId: string) => Promise<void>;
  setCurrentOrderId: (id: string | null) => void;
  setOrderWizardStep: (orderId: string, step: OrderWizardStep) => void;
  flushOrderWrites: (orderId: string) => Promise<void>;

  // ── Workspace member actions ──────────────────────────────
  fetchWorkspaceMembers: () => Promise<void>;
  addMemberByEmail: (email: string, role?: 'admin' | 'member') => Promise<string | null>;
  removeMember: (userId: string) => Promise<void>;

  // ── Settings Actions ──────────────────────────────────────
  setTheme: (theme: Theme) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
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

function sanitizeLogoFilename(name: string): string {
  const trimmed = name.trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'logo';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return String(error);
}

function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return null;
}

function isRoasterBackendUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error);

  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes("public.roasters") ||
    message.includes("table 'public.roasters'") ||
    message.includes('relation "public.roasters" does not exist') ||
    message.includes('schema cache')
  );
}

function isRoasterDuplicateError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error);

  return (
    code === '23505' ||
    message.includes('roasters_workspace_normalized_name_key') ||
    message.includes('duplicate key value')
  );
}

function isRoasterLogoStorageUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('roaster-logos') ||
    message.includes('bucket') ||
    message.includes('storage') ||
    message.includes('object not found')
  );
}

function isRoasterPermissionError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('not allowed')
  );
}

function getRoasterBackendUnavailableMessage(): string {
  return 'Roaster saving is not available yet because the database migration has not been applied.';
}

function normalizeRoasterMutationError(error: unknown, options: { roasterName?: string } = {}): Error {
  if (isRoasterBackendUnavailableError(error)) {
    return new Error(getRoasterBackendUnavailableMessage());
  }

  if (isRoasterDuplicateError(error)) {
    const safeName = options.roasterName?.trim();
    return new Error(safeName ? `A roaster named "${safeName}" already exists.` : 'That roaster already exists.');
  }

  if (isRoasterPermissionError(error)) {
    return new Error('You do not have permission to manage roasters in this workspace.');
  }

  return new Error(getErrorMessage(error));
}

function getRoasterLoadFailureMessage(error: unknown): string {
  if (isRoasterBackendUnavailableError(error)) {
    return 'Roasters are unavailable because the Supabase roaster migration has not been applied yet.';
  }

  if (isRoasterPermissionError(error)) {
    return 'Roasters could not be loaded because this account does not have permission to read them.';
  }

  return 'Roasters could not be loaded right now. Check the Supabase roaster table and policies.';
}

function getRoasterLogoFailureMessage(error: unknown): string {
  if (isRoasterLogoStorageUnavailableError(error)) {
    return 'The roaster was saved, but its logo could not be uploaded because the roaster logo storage is not configured in Supabase yet.';
  }

  if (isRoasterPermissionError(error)) {
    return 'The roaster was saved, but the logo could not be uploaded because this account cannot access roaster logo storage.';
  }

  return 'The roaster was saved, but its logo could not be uploaded. Check the roaster logo bucket and policies in Supabase.';
}

async function deleteRoasterLogoBestEffort(logoPath: string): Promise<void> {
  try {
    await supabase.storage.from('roaster-logos').remove([logoPath]);
  } catch (error) {
    console.error('deleteRoasterLogoBestEffort failed', error);
  }
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

async function uploadRoasterLogo(roasterId: string, file: File): Promise<{ logoPath: string; logoUrl: string }> {
  const extension = file.name.includes('.') ? file.name.split('.').pop() ?? 'png' : 'png';
  const fileName = sanitizeLogoFilename(file.name.replace(/\.[^.]+$/, ''));
  const logoPath = `workspace/${WORKSPACE_ID}/roasters/${roasterId}/${Date.now()}-${fileName}.${extension.toLowerCase()}`;

  const { error: uploadError } = await supabase.storage
    .from('roaster-logos')
    .upload(logoPath, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from('roaster-logos').getPublicUrl(logoPath);
  return {
    logoPath,
    logoUrl: data.publicUrl,
  };
}

const orderWriteChains = new Map<string, Promise<void>>();
const optimisticOrderSnapshots = new Map<string, Order>();
let initializePromise: Promise<void> | null = null;

// ─── Computed getter ─────────────────────────────────────────

export const getCurrentOrder = (state: AppStore): Order | null => {
  if (!state.currentOrderId) return null;
  return state.orders.find((o) => o.id === state.currentOrderId) ?? null;
};

// ─── Check for a cached Supabase session (skips splash on tab restore) ──────
const hasCachedSession = (() => {
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
    if (!key) return false;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Boolean(parsed?.access_token);
  } catch {
    return false;
  }
})();

// ─── Store ────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  accessStatus: 'checking',
  memberRole: null,
  linkedPersonId: null,
  linkResolution: defaultLinkResolution,
  workspaceMembers: [],
  people: [],
  roasters: [],
  orders: [],
  currentOrderId: safeLocalStorage.getItem('fb_current_order_id'),
  roasterFeatureStatus: 'idle',
  roasterFeatureMessage: null,
  settings: { theme: 'emerald', themeMode: 'light' },
  isInitialized: hasCachedSession,
  isLoading: false,
  isSyncing: false,
  error: null,
  sessionUi: {
    orderWizardSteps: {},
    orderProtectionOpen: {},
  },
  _realtimeChannel: null,

  // ── Initialize ────────────────────────────────────────────
  initialize: async (options) => {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
    const silent = options?.silent ?? false;
    const shouldBlock = !silent || !get().isInitialized;

    if (shouldBlock) {
      set({ isLoading: true, isSyncing: false, error: null });
    } else {
      set({ isSyncing: true, error: null });
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
          roasters: [],
          orders: [],
          currentOrderId: null,
          roasterFeatureStatus: 'idle',
          roasterFeatureMessage: null,
          isInitialized: true,
          isLoading: false,
          isSyncing: false,
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

      if (memberRow) {
        // Setup Realtime before fetch so no events are missed during the fetch window
        get()._setupRealtime(WORKSPACE_ID);
      } else {
        get()._teardownRealtime();
      }

      let peopleRows: DbPerson[] | null = [];
      let orderRows: DbOrder[] | null = [];
      let roasters: Roaster[] = [];
      let roasterFeatureStatus: RoasterFeatureStatus = memberRow
        ? 'empty'
        : linkedPersonId
          ? 'unsupported-for-user'
          : 'idle';
      let roasterFeatureMessage: string | null = null;

      if (hasWorkspaceAccess) {
        const { data: fetchedPeopleRows, error: peopleError } = await supabase
          .from('people')
          .select('*')
          .eq('workspace_id', WORKSPACE_ID)
          .order('name');

        if (peopleError) {
          throw new Error(getErrorMessage(peopleError));
        }

        peopleRows = fetchedPeopleRows as DbPerson[] | null;

        const canFetchAllOrders = memberRow?.role === 'owner' || memberRow?.role === 'admin';
        const fetchedOrdersById = new Map<string, DbOrder>();

        if (canFetchAllOrders) {
          const { data: fetchedOrderRows, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('workspace_id', WORKSPACE_ID)
            .order('order_date', { ascending: false });

          if (orderError) {
            throw new Error(getErrorMessage(orderError));
          }

          for (const row of (fetchedOrderRows as DbOrder[] | null) ?? []) {
            fetchedOrdersById.set(row.id, row);
          }
        } else if (memberRow) {
          const { data: ownedOrderRows, error: ownedOrderError } = await supabase
            .from('orders')
            .select('*')
            .eq('workspace_id', WORKSPACE_ID)
            .or(`owner_id.eq.${session.user.id},created_by.eq.${session.user.id}`)
            .order('order_date', { ascending: false });

          if (ownedOrderError) {
            throw new Error(getErrorMessage(ownedOrderError));
          }

          for (const row of (ownedOrderRows as DbOrder[] | null) ?? []) {
            fetchedOrdersById.set(row.id, row);
          }
        }

        if (linkedPersonId && !canFetchAllOrders) {
          const { data: scopedOrderRows, error: scopedOrderError } = await supabase
            .rpc('get_my_participant_orders');

          if (scopedOrderError) {
            throw new Error(getErrorMessage(scopedOrderError));
          }

          for (const row of (scopedOrderRows as DbOrder[] | null) ?? []) {
            fetchedOrdersById.set(row.id, row);
          }
        }

        orderRows = Array.from(fetchedOrdersById.values());

        if (memberRow) {
          const { data: fetchedRoasterRows, error: roasterError } = await supabase
            .from('roasters')
            .select('*')
            .eq('workspace_id', WORKSPACE_ID)
            .order('updated_at', { ascending: false });

          if (roasterError) {
            console.error('initialize: failed to load roasters', roasterError);
            roasterFeatureStatus = 'unavailable';
            roasterFeatureMessage = getRoasterLoadFailureMessage(roasterError);
          } else {
            roasters = (fetchedRoasterRows as DbRoaster[] | null ?? []).map(mapRoaster);
            roasterFeatureStatus = roasters.length > 0 ? 'ready' : 'empty';
          }
        }
      }

      const people = sortPeopleByName(dedupePeopleById((peopleRows ?? []).map(mapPerson)));
      const orders = (orderRows ?? []).map((row) => mapOrder(row));

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
        roasters,
        orders,
        currentOrderId,
        roasterFeatureStatus,
        roasterFeatureMessage,
        isInitialized: true,
        isLoading: false,
        isSyncing: false,
      });
    } catch (err) {
      set({ error: String(err), isInitialized: true, isLoading: false, isSyncing: false });
    } finally {
      initializePromise = null;
    }
    })();

    return initializePromise;
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
      roasters: [],
      orders: [],
      currentOrderId: null,
      roasterFeatureStatus: 'idle',
      roasterFeatureMessage: null,
      isInitialized: true,
      isLoading: false,
      isSyncing: false,
      sessionUi: {
        orderWizardSteps: {},
        orderProtectionOpen: {},
      },
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

  // ── Roasters ──────────────────────────────────────────────
  createRoaster: async ({ name, logoFile }) => {
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      throw new Error('Roaster name is required.');
    }

    if (get().accessStatus !== 'member') {
      throw new Error('Only workspace members can manage roasters.');
    }

    if (get().roasterFeatureStatus === 'unavailable') {
      throw new Error(getRoasterBackendUnavailableMessage());
    }

    const duplicate = get().roasters.find((roaster) => normalizeRoasterName(roaster.name) === normalizeRoasterName(trimmedName));
    if (duplicate) {
      throw new Error(`A roaster named "${duplicate.name}" already exists.`);
    }

    const { data: row, error } = await supabase
      .from('roasters')
      .insert({
        workspace_id: WORKSPACE_ID,
        name: trimmedName,
      })
      .select()
      .single();

    if (error) {
      console.error('createRoaster: failed to insert roaster', error);
      const normalizedError = normalizeRoasterMutationError(error, { roasterName: trimmedName });
      if (isRoasterBackendUnavailableError(error)) {
        set({
          roasterFeatureStatus: 'unavailable',
          roasterFeatureMessage: normalizedError.message,
        });
      }
      throw normalizedError;
    }

    let roaster = mapRoaster(row as DbRoaster);
    let roasterFeatureMessage: string | null = null;

    if (logoFile) {
      try {
        const upload = await uploadRoasterLogo(roaster.id, logoFile);
        const { data: updatedRow, error: updateError } = await supabase
          .from('roasters')
          .update({
            logo_path: upload.logoPath,
            logo_url: upload.logoUrl,
          })
          .eq('id', roaster.id)
          .select()
          .single();

        if (updateError) {
          await deleteRoasterLogoBestEffort(upload.logoPath);
          throw updateError;
        }
        roaster = mapRoaster(updatedRow as DbRoaster);
      } catch (uploadError) {
        console.error('createRoaster: logo upload/update failed, keeping roaster without logo', uploadError);
        roasterFeatureMessage = getRoasterLogoFailureMessage(uploadError);
      }
    }

    set((state) => ({
      roasters: upsertRoasterById(state.roasters, roaster),
      roasterFeatureStatus: 'ready',
      roasterFeatureMessage,
    }));
    return roaster;
  },

  updateRoaster: async (id, data) => {
    if (get().accessStatus !== 'member') {
      throw new Error('Only workspace members can manage roasters.');
    }

    if (get().roasterFeatureStatus === 'unavailable') {
      throw new Error(getRoasterBackendUnavailableMessage());
    }

    const currentRoaster = get().roasters.find((roaster) => roaster.id === id);
    if (!currentRoaster) {
      throw new Error('Roaster not found.');
    }

    const nextName = data.name?.trim().replace(/\s+/g, ' ') || currentRoaster.name;
    const duplicate = get().roasters.find((roaster) => (
      roaster.id !== id &&
      normalizeRoasterName(roaster.name) === normalizeRoasterName(nextName)
    ));

    if (duplicate) {
      throw new Error(`A roaster named "${duplicate.name}" already exists.`);
    }

    const dbPatch: Record<string, unknown> = {};
    if (data.name !== undefined) dbPatch.name = nextName;

    let uploadedLogo: { logoPath: string; logoUrl: string } | null = null;

    if (data.removeLogo) {
      dbPatch.logo_path = null;
      dbPatch.logo_url = null;
    } else if (data.logoFile) {
      try {
        uploadedLogo = await uploadRoasterLogo(id, data.logoFile);
      } catch (error) {
        console.error('updateRoaster: failed to upload replacement logo', error);
        throw new Error(getRoasterLogoFailureMessage(error));
      }
      dbPatch.logo_path = uploadedLogo.logoPath;
      dbPatch.logo_url = uploadedLogo.logoUrl;
    }

    const { data: row, error } = await supabase
      .from('roasters')
      .update(dbPatch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('updateRoaster: failed to update roaster', error);
      if (uploadedLogo?.logoPath) {
        await deleteRoasterLogoBestEffort(uploadedLogo.logoPath);
      }
      const normalizedError = normalizeRoasterMutationError(error, { roasterName: nextName });
      if (isRoasterBackendUnavailableError(error)) {
        set({
          roasterFeatureStatus: 'unavailable',
          roasterFeatureMessage: normalizedError.message,
        });
      }
      throw normalizedError;
    }

    if (data.removeLogo && currentRoaster.logoPath) {
      await deleteRoasterLogoBestEffort(currentRoaster.logoPath);
    }

    if (uploadedLogo?.logoPath && currentRoaster.logoPath && currentRoaster.logoPath !== uploadedLogo.logoPath) {
      await deleteRoasterLogoBestEffort(currentRoaster.logoPath);
    }

    const roaster = mapRoaster(row as DbRoaster);
    set((state) => ({
      roasters: upsertRoasterById(state.roasters, roaster),
      roasterFeatureStatus: 'ready',
      roasterFeatureMessage: null,
      orders: state.orders.map((order) => (
        order.roasterId === roaster.id
          ? { ...order, roasterSnapshot: createRoasterSnapshot(roaster) }
          : order
      )),
    }));

    return roaster;
  },

  // ── Orders ────────────────────────────────────────────────
  createOrder: async (data) => {
    const userId = get().user?.id;
    const initialStatus = normalizeOrderStatus(data.status, false);
    const { data: row, error } = await supabase
      .from('orders')
      .insert({
        workspace_id: WORKSPACE_ID,
        name: data.name,
        order_date: data.orderDate,
        status: initialStatus,
        roaster_id: data.roasterId,
        roaster_snapshot: data.roasterSnapshot,
        payer_id: data.payerId,
        payer_bank: data.payerBank,
        reference_template: data.referenceTemplate,
        payer_note: data.payerNote || null,
        goods_total_zar: data.goodsTotalZar,
        lots: data.lots,
        fees: data.fees,
        payments: data.payments,
        is_archived: initialStatus === 'archived',
        owner_id: userId ?? null,
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
    const targetOrder = get().orders.find((order) => order.id === id);
    if (!targetOrder) {
      return;
    }

    const mergedOrder = syncOrderStatusFlags(mergeOrderPatch(targetOrder, data));
    if (targetOrder.isArchived && mergedOrder.status !== 'archived') {
      throw new Error('Saved historical orders cannot be moved back to active order status.');
    }

    const strictIntegrity = targetOrder.isArchived || mergedOrder.isArchived;
    const optimisticOrder = assertCanPersistOrder(mergedOrder, {
      people: get().people,
      strict: strictIntegrity,
    });
    optimisticOrderSnapshots.set(id, optimisticOrder);
    set((s) => ({
      orders: s.orders.map((order) => (order.id === id ? optimisticOrder : order)),
    }));

    const dbData: Record<string, unknown> = {};
    if (data.name !== undefined) dbData.name = optimisticOrder.name;
    if (data.orderDate !== undefined) dbData.order_date = optimisticOrder.orderDate;
    if (data.status !== undefined || data.isArchived !== undefined) {
      dbData.status = optimisticOrder.status;
      dbData.is_archived = optimisticOrder.isArchived;
    }
    if (data.roasterId !== undefined) dbData.roaster_id = optimisticOrder.roasterId;
    if (data.roasterSnapshot !== undefined) dbData.roaster_snapshot = optimisticOrder.roasterSnapshot;
    if (data.payerId !== undefined) dbData.payer_id = optimisticOrder.payerId;
    if (data.payerBank !== undefined) dbData.payer_bank = optimisticOrder.payerBank;
    if (data.referenceTemplate !== undefined) dbData.reference_template = optimisticOrder.referenceTemplate;
    if (data.payerNote !== undefined) dbData.payer_note = optimisticOrder.payerNote || null;
    if (data.goodsTotalZar !== undefined) dbData.goods_total_zar = optimisticOrder.goodsTotalZar;
    if (data.lots !== undefined || strictIntegrity) dbData.lots = optimisticOrder.lots;
    if (data.fees !== undefined || strictIntegrity) dbData.fees = optimisticOrder.fees;
    if (data.payments !== undefined || strictIntegrity) dbData.payments = optimisticOrder.payments;
    if (data.isArchived !== undefined || strictIntegrity) dbData.is_archived = optimisticOrder.isArchived;
    if (data.ownerId !== undefined) dbData.owner_id = optimisticOrder.ownerId;

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

  updateOrderStatus: async (id, status) => {
    await get().updateOrder(id, { status, isArchived: status === 'archived' });
  },

  joinOrder: async (orderId) => {
    const { error } = await supabase.rpc('join_planned_order', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    await get().initialize({ silent: true });
  },

  leaveOrder: async (orderId) => {
    const { error } = await supabase.rpc('leave_planned_order', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    await get().initialize({ silent: true });
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
      return {
        orders,
        currentOrderId,
        sessionUi: {
          ...s.sessionUi,
          orderWizardSteps,
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

  // ── Workspace Members ─────────────────────────────────────
  flushOrderWrites: async (orderId) => {
    await (orderWriteChains.get(orderId) ?? Promise.resolve());
  },

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
    const { people, roasters, orders, settings } = get();
    return JSON.stringify({ version: '2', people, roasters, orders, settings, exportedAt: new Date().toISOString() }, null, 2);
  },

  importJSON: async (json) => {
    const parsed = JSON.parse(json);

    if (parsed.version !== '1' && parsed.version !== '2') {
      throw new Error('Unsupported export format. Expected version 1 or 2.');
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

    const importedRoasterIdMap = new Map<string, Roaster>();
    if (parsed.version === '2' && parsed.roasters && Array.isArray(parsed.roasters)) {
      for (const r of parsed.roasters) {
        if (!r || typeof r.name !== 'string') continue;
        try {
          const existing = get().roasters.find((roaster) => normalizeRoasterName(roaster.name) === normalizeRoasterName(String(r.name)));
          const roaster = existing ?? await get().createRoaster({
            name: String(r.name),
          });
          if (typeof r.id === 'string') {
            importedRoasterIdMap.set(r.id, roaster);
          }
        } catch (err) {
          console.error('importJSON: skipping roaster due to error', r.name, err);
        }
      }
    }

    if (parsed.orders && Array.isArray(parsed.orders)) {
      for (const o of parsed.orders) {
        if (!o || typeof o.id !== 'string') continue;
        try {
          if (!get().orders.find((ex) => ex.id === o.id)) {
            const importedRoaster = typeof o.roasterId === 'string' ? importedRoasterIdMap.get(o.roasterId) : undefined;
            const importedSnapshotName = o.roasterSnapshot && typeof o.roasterSnapshot === 'object'
              ? String(o.roasterSnapshot.name ?? importedRoaster?.name ?? '').trim()
              : importedRoaster?.name ?? '';
            const roasterSnapshot = importedSnapshotName
              ? {
                id: o.roasterSnapshot && typeof o.roasterSnapshot === 'object' && typeof o.roasterSnapshot.id === 'string'
                  ? o.roasterSnapshot.id
                  : importedRoaster?.id ?? null,
                name: importedSnapshotName,
                logoUrl: o.roasterSnapshot && typeof o.roasterSnapshot === 'object' && typeof o.roasterSnapshot.logoUrl === 'string'
                  ? o.roasterSnapshot.logoUrl
                  : importedRoaster?.logoUrl,
              }
              : null;

            await get().createOrder({
              name: String(o.name ?? 'Imported Order'),
              orderDate: String(o.orderDate ?? new Date().toISOString().split('T')[0]),
              roasterId: importedRoaster?.id ?? null,
              roasterSnapshot,
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

  // ── Realtime ──────────────────────────────────────────────
  _setupRealtime: (workspaceId) => {
    const existing = get()._realtimeChannel;
    // Already subscribed — no need to rebuild the WebSocket channel
    if (existing) return;

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
                const existing = get().orders.find((o) => o.id === (newRow as DbOrder).id);
                const order = mapOrder(newRow as DbOrder, existing);
                const nextOrder = optimisticOrderSnapshots.get(order.id) ?? order;
                set((s) => ({
                  orders: upsertOrderById(s.orders, nextOrder),
                }));
              } else if (eventType === 'UPDATE') {
                const existing = get().orders.find((o) => o.id === (newRow as DbOrder).id);
                const order = mapOrder(newRow as DbOrder, existing);
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roasters', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          try {
              const { eventType, new: newRow, old: oldRow } = payload;
              if (eventType === 'INSERT') {
                const roaster = mapRoaster(newRow as DbRoaster);
                set((s) => ({
                  roasters: upsertRoasterById(s.roasters, roaster),
                  roasterFeatureStatus: 'ready',
                  roasterFeatureMessage: null,
                }));
              } else if (eventType === 'UPDATE') {
                const roaster = mapRoaster(newRow as DbRoaster);
                set((s) => ({
                  roasters: upsertRoasterById(s.roasters, roaster),
                  roasterFeatureStatus: 'ready',
                  roasterFeatureMessage: null,
                  orders: s.orders.map((order) => (
                    order.roasterId === roaster.id
                      ? { ...order, roasterSnapshot: createRoasterSnapshot(roaster) }
                      : order
                  )),
                }));
              } else if (eventType === 'DELETE') {
                const deletedRoasterId = (oldRow as DbRoaster).id;
                set((s) => ({
                  roasters: s.roasters.filter((roaster) => roaster.id !== deletedRoasterId),
                  roasterFeatureStatus: s.roasters.length <= 1 ? 'empty' : 'ready',
                  roasterFeatureMessage: null,
                }));
              }
          } catch (err) {
            console.error('Realtime roasters error:', err);
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
