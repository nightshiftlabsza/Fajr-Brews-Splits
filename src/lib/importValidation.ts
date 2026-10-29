import { getCurrency } from '../data/currencies';

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const STRING_LIMITS = {
  shortName: 100,
  date: 20,
  template: 100,
  note: 1000,
  phone: 50,
  email: 254,
  bankField: 100,
  lotName: 200,
  feeLabel: 100,
  url: 2000,
} as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)+$/i;

/**
 * Validates whether an identifier is safe to pass to the database as a UUID column.
 * Accepts standard RFC 4122 UUIDs, and safe hyphenated slugs used in test environments.
 * Rejects hostile payloads (SQL injection, XSS, directory traversal, control characters, special characters).
 */
export function isValidDatabaseId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed !== id || id.length < 3 || id.length > 64) return false;
  return UUID_REGEX.test(id) || SAFE_ID_REGEX.test(id);
}

export function capString(val: unknown, maxLength: number): string | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export interface RawExportData {
  version: string;
  people?: unknown[];
  roasters?: unknown[];
  orders?: unknown[];
  settings?: Record<string, unknown>;
  exportedAt?: string;
}

export function validateBackupFileStructure(parsed: unknown): RawExportData {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid backup file. Expected a JSON object.');
  }

  const raw = parsed as Record<string, unknown>;

  if (raw.version !== '1' && raw.version !== '2') {
    throw new Error('Unsupported export format. Expected version 1 or 2.');
  }

  if (raw.orders !== undefined && !Array.isArray(raw.orders)) {
    throw new Error('Invalid backup file. The orders field must be a list.');
  }

  if (raw.people !== undefined && !Array.isArray(raw.people)) {
    throw new Error('Invalid backup file. The people field must be a list.');
  }

  if (raw.roasters !== undefined && !Array.isArray(raw.roasters)) {
    throw new Error('Invalid backup file. The roasters field must be a list.');
  }

  return raw as unknown as RawExportData;
}

export function sanitizeListCurrency(rawCurrency: unknown): string | null | undefined {
  if (typeof rawCurrency === 'string') {
    const trimmed = rawCurrency.trim().toUpperCase();
    if (!trimmed) return null;
    const known = getCurrency(trimmed);
    return known ? known.code : undefined;
  }
  if (rawCurrency === null) {
    return null;
  }
  return undefined;
}

export interface ImportSummary {
  importedCount: number;
  skippedCount: number;
  reasons: string[];
  summary: string;
}

export function formatImportSummary(importedCount: number, skippedCount: number, reasons: string[]): ImportSummary {
  const uniqueReasons = Array.from(new Set(reasons.filter(Boolean)));
  let summary: string;

  if (skippedCount === 0) {
    summary = `Imported ${importedCount} items successfully.`;
  } else if (importedCount === 0) {
    summary = `Skipped ${skippedCount} items: ${uniqueReasons.join(', ')}.`;
  } else {
    summary = `Imported ${importedCount}, skipped ${skippedCount}: ${uniqueReasons.join(', ')}.`;
  }

  return {
    importedCount,
    skippedCount,
    reasons: uniqueReasons,
    summary,
  };
}
