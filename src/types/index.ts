// ─── Theme ───────────────────────────────────────────────────
export type Theme = 'porcelain' | 'obsidian' | 'slate';

// ─── Fee allocation types ─────────────────────────────────────
export type FeeAllocationType =
  | 'fixed_shared'        // Equal split across all participants
  | 'proportional_value'  // By each person's share of foreign list value
  | 'per_bag';            // By bag fractions (shareGrams / gramsPerBag)

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
}

export interface CoffeeLot {
  id: string;
  name: string;
  foreignPricePerBag: number; // > 0, original list price in foreign currency
  gramsPerBag: number;        // integer >= 1
  quantity: number;           // integer >= 1
  shares: ShareLine[];
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
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
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
  created_at: string;
}

export interface DbUserSettings {
  id: string;
  user_id: string;
  theme: Theme;
  last_export_date: string | null;
  updated_at: string;
}

// ─── Calculation Results ─────────────────────────────────────
export interface LotPersonBreakdown {
  lotId: string;
  lotName: string;
  shareGrams: number;
  gramsPerBag: number;
  lotQuantity: number;
  goodsZar: number;
  splitWith: string[]; // names of other people sharing this lot
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
  bagShareRatio: number;          // 0..1 ratio
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
  lastExportDate?: string;
}

// ─── Workspace Membership ─────────────────────────────────────
export type MembershipStatus = 'checking' | 'member' | 'none' | 'error';

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
}

// ─── App Tab Navigation ───────────────────────────────────────
export type AppTab = 'order' | 'invoices' | 'people' | 'history' | 'settings';
