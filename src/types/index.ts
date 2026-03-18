// ─── Theme ───────────────────────────────────────────────────
export type Theme = 'emerald' | 'yinmn';
export type ThemeMode = 'light' | 'dark' | 'auto';

// ─── Fee allocation types ─────────────────────────────────────
export type FeeAllocationType =
  | 'fixed_shared'        // Equal split across all participants
  | 'value_based';        // By each person's share of foreign list value

// ─── Payment ──────────────────────────────────────────────────
export type PaymentStatus = 'unpaid' | 'paid' | 'partial';

export interface PaymentRecord {
  status: PaymentStatus;
  amountPaid?: number;
  datePaid?: string; // ISO date string
}

// ─── People Directory ─────────────────────────────────────────
export interface Person {
  id: string;
  workspaceId: string;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Coffee Lots ──────────────────────────────────────────────
export interface ShareLine {
  id: string;
  personId: string;
  shareGrams: number; // must be integer >= 1
  bagIndex?: number;
}

export interface LotBagParticipant {
  id: string;
  personId: string;
  shareGrams: number;
  sourceShareId: string;
}

export interface LotBagAllocation {
  id: string;
  bagIndex: number;
  mode: 'single' | 'split';
  participants: LotBagParticipant[];
}

export interface CoffeeLot {
  id: string;
  name: string;
  foreignPricePerBag: number; // > 0, original list price in foreign currency
  gramsPerBag: number;        // integer >= 1
  quantity: number;           // integer >= 1
  shares: ShareLine[];
  bagAllocations?: LotBagAllocation[];
}

// ─── Fees ─────────────────────────────────────────────────────
export interface Fee {
  id: string;
  label: string;
  amountZar: number;
  allocationType: FeeAllocationType;
}

// ─── Payer Bank Details ───────────────────────────────────────
export interface PayerBank {
  bankName: string;
  accountNumber: string;
  beneficiary: string;
  branch?: string;
}

// ─── Order ────────────────────────────────────────────────────
export interface Order {
  id: string;
  workspaceId: string;
  name: string;
  orderDate: string;         // ISO date string (YYYY-MM-DD)
  payerId: string | null;    // references people.id
  payerBank: PayerBank;
  referenceTemplate: string; // e.g. "FAJR-{ORDER}-{NAME}"
  payerNote?: string;
  goodsTotalZar: number;
  lots: CoffeeLot[];
  fees: Fee[];
  payments: Record<string, PaymentRecord>; // personId → PaymentRecord
  isArchived: boolean;
  pinRequired?: boolean;     // true if a PIN is set on this order
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Order Participants ───────────────────────────────────────
export interface OrderParticipant {
  id: string;
  orderId: string;
  userId: string;
  addedAt: string;
}

// ─── Supabase DB row types ────────────────────────────────────
export interface DbOrder {
  id: string;
  workspace_id: string;
  name: string;
  order_date: string;
  payer_id: string | null;
  payer_bank: PayerBank;
  reference_template: string;
  payer_note: string | null;
  goods_total_zar: number;
  lots: CoffeeLot[];
  fees: Fee[];
  payments: Record<string, PaymentRecord>;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPerson {
  id: string;
  workspace_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  linked_user_id?: string | null;
  linked_at?: string | null;
  link_source?: 'email' | 'phone' | 'name' | 'manual' | null;
  created_at: string;
  updated_at: string;
}

export interface DbWorkspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface DbWorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

export interface DbProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone?: string | null;
  created_at: string;
}

export interface DbUserSettings {
  id: string;
  user_id: string;
  theme: Theme;
  theme_mode: ThemeMode;
  last_export_date: string | null;
  updated_at: string;
}

// ─── Calculation Results ─────────────────────────────────────
export interface LotPersonBreakdown {
  id: string;
  lotId: string;
  lotName: string;
  bagIndex: number;
  bagMode: 'single' | 'split';
  shareGrams: number;
  gramsPerBag: number;
  lotQuantity: number;
  goodsZar: number;
  valueBasedFeesZar: number; // Split by each person's share of foreign list value
  splitWith: string[]; // names of other people sharing this specific bag
}

export interface FeePersonBreakdown {
  feeId: string;
  label: string;
  allocationType: FeeAllocationType;
  amountZar: number;
}

export interface PersonCalculation {
  personId: string;
  totalGrams: number;
  goodsZar: number;               // full precision
  feesZar: number;                // full precision
  totalPreRound: number;          // full precision
  totalFinal: number;             // rounded
  coffeeValueForeignShare: number; // 0..1 ratio
  lotBreakdowns: LotPersonBreakdown[];
  feeBreakdowns: FeePersonBreakdown[];
}

export interface CalculationResult {
  personIds: string[];
  personCalcs: Record<string, PersonCalculation>;
  totalOrderZar: number;
  totalGoodsZar: number;
  totalFeesZar: number;
  roundingAbsorbed: number; // positive = payer paid more, negative = payer paid less
  lotGoodsZar: Record<string, number>; // lotId → allocated ZAR amount
  isValid: boolean;
  validationErrors: string[];
}

// ─── App Settings ─────────────────────────────────────────────
export interface AppSettings {
  theme: Theme;
  themeMode: ThemeMode;
  lastExportDate?: string;
}

// ─── Workspace Membership ─────────────────────────────────────
export type AccessStatus = 'checking' | 'member' | 'participant' | 'none' | 'error';

export type PersonMatchReason = 'email' | 'phone' | 'name' | 'manual';

export interface PersonLinkCandidate {
  personId: string;
  workspaceId?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  matchReason: Exclude<PersonMatchReason, 'manual'>;
}

export interface PersonLinkResolution {
  status: 'idle' | 'linked' | 'auto-linked' | 'needs-confirmation' | 'ambiguous' | 'none';
  linkedPersonId: string | null;
  matchedBy: PersonMatchReason | null;
  person: PersonLinkCandidate | null;
  candidates: PersonLinkCandidate[];
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
  email?: string;
  fullName?: string;
}

// ─── Auth ─────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
}

// ─── App Tab Navigation ───────────────────────────────────────
export type AppTab = 'order' | 'people' | 'history' | 'settings';
