import { describe, expect, it } from 'vitest';
import {
  capString,
  formatImportSummary,
  isValidDatabaseId,
  sanitizeListCurrency,
  validateBackupFileStructure,
  STRING_LIMITS,
} from './importValidation';

describe('importValidation', () => {
  describe('validateBackupFileStructure', () => {
    it('accepts valid version 1 and version 2 payloads', () => {
      const v1 = { version: '1', people: [], orders: [] };
      const v2 = { version: '2', people: [], roasters: [], orders: [], settings: {} };
      expect(validateBackupFileStructure(v1)).toEqual(v1);
      expect(validateBackupFileStructure(v2)).toEqual(v2);
    });

    it('rejects non-object payloads', () => {
      expect(() => validateBackupFileStructure(null)).toThrow('Invalid backup file. Expected a JSON object.');
      expect(() => validateBackupFileStructure('not an object')).toThrow('Invalid backup file. Expected a JSON object.');
      expect(() => validateBackupFileStructure([1, 2, 3])).toThrow('Invalid backup file. Expected a JSON object.');
      expect(() => validateBackupFileStructure(12345)).toThrow('Invalid backup file. Expected a JSON object.');
    });

    it('rejects unsupported versions', () => {
      expect(() => validateBackupFileStructure({ version: '3' })).toThrow('Unsupported export format. Expected version 1 or 2.');
      expect(() => validateBackupFileStructure({ version: '0' })).toThrow('Unsupported export format. Expected version 1 or 2.');
      expect(() => validateBackupFileStructure({ version: undefined })).toThrow('Unsupported export format. Expected version 1 or 2.');
    });

    it('rejects payloads where people, roasters, or orders are not arrays', () => {
      expect(() => validateBackupFileStructure({ version: '2', orders: 'not-an-array' })).toThrow(
        'Invalid backup file. The orders field must be a list.'
      );
      expect(() => validateBackupFileStructure({ version: '2', people: 42 })).toThrow(
        'Invalid backup file. The people field must be a list.'
      );
      expect(() => validateBackupFileStructure({ version: '2', roasters: { a: 1 } })).toThrow(
        'Invalid backup file. The roasters field must be a list.'
      );
    });
  });

  describe('isValidDatabaseId', () => {
    it('accepts standard RFC 4122 UUIDs', () => {
      expect(isValidDatabaseId('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
      expect(isValidDatabaseId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidDatabaseId('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11')).toBe(true);
    });

    it('accepts safe test identifier slugs used in Vitest mocks', () => {
      expect(isValidDatabaseId('archived-imported-1')).toBe(true);
      expect(isValidDatabaseId('locked-imported-2')).toBe(true);
      expect(isValidDatabaseId('order-corrupt-curr')).toBe(true);
      expect(isValidDatabaseId('single-order-backup-1')).toBe(true);
    });

    it('rejects hostile inputs including SQL injection and XSS', () => {
      expect(isValidDatabaseId("'; DROP TABLE orders; --")).toBe(false);
      expect(isValidDatabaseId('<script>alert(1)</script>')).toBe(false);
      expect(isValidDatabaseId('../../etc/passwd')).toBe(false);
      expect(isValidDatabaseId('admin" OR "1"="1')).toBe(false);
      expect(isValidDatabaseId('order id with spaces')).toBe(false);
      expect(isValidDatabaseId('id\x00withnull')).toBe(false);
      expect(isValidDatabaseId('order\nnewline')).toBe(false);
      expect(isValidDatabaseId('a'.repeat(100))).toBe(false);
      expect(isValidDatabaseId('')).toBe(false);
      expect(isValidDatabaseId('ab')).toBe(false); // too short
    });

    it('rejects non-string values gracefully', () => {
      expect(isValidDatabaseId(null)).toBe(false);
      expect(isValidDatabaseId(undefined)).toBe(false);
      expect(isValidDatabaseId(12345)).toBe(false);
      expect(isValidDatabaseId({})).toBe(false);
      expect(isValidDatabaseId([])).toBe(false);
    });
  });

  describe('capString', () => {
    it('truncates strings longer than maxLength and preserves shorter strings', () => {
      expect(capString('Short string', 20)).toBe('Short string');
      expect(capString('This is a very long string that should be capped', 10)).toBe('This is a ');
      expect(capString('   trimmed value   ', 20)).toBe('trimmed value');
    });

    it('returns undefined for empty, null, or undefined values', () => {
      expect(capString(null, 10)).toBeUndefined();
      expect(capString(undefined, 10)).toBeUndefined();
      expect(capString('', 10)).toBeUndefined();
      expect(capString('   ', 10)).toBeUndefined();
      expect(capString(12345, 10)).toBeUndefined();
    });
  });

  describe('sanitizeListCurrency', () => {
    it('normalizes known ISO currency codes', () => {
      expect(sanitizeListCurrency('eur')).toBe('EUR');
      expect(sanitizeListCurrency('USD')).toBe('USD');
      expect(sanitizeListCurrency('zar')).toBe('ZAR');
      expect(sanitizeListCurrency(' GBP ')).toBe('GBP');
      expect(sanitizeListCurrency('jpy')).toBe('JPY');
    });

    it('drops unknown currency codes without throwing', () => {
      expect(sanitizeListCurrency('XYZ')).toBeUndefined();
      expect(sanitizeListCurrency('NOT_A_VALID_ISO_CODE_123456')).toBeUndefined();
      expect(sanitizeListCurrency('123')).toBeUndefined();
      expect(sanitizeListCurrency('<script>')).toBeUndefined();
    });

    it('normalizes null or empty currency values to null', () => {
      expect(sanitizeListCurrency(null)).toBeNull();
      expect(sanitizeListCurrency('')).toBeNull();
    });
  });

  describe('formatImportSummary', () => {
    it('formats clean success message when no rows are skipped', () => {
      const summary = formatImportSummary(12, 0, []);
      expect(summary.summary).toBe('Imported 12 items successfully.');
      expect(summary.importedCount).toBe(12);
      expect(summary.skippedCount).toBe(0);
    });

    it('formats summary with skipped count and unique reasons', () => {
      const summary = formatImportSummary(12, 2, ['invalid ID', 'invalid ID', 'missing order name']);
      expect(summary.summary).toBe('Imported 12, skipped 2: invalid ID, missing order name.');
      expect(summary.importedCount).toBe(12);
      expect(summary.skippedCount).toBe(2);
      expect(summary.reasons).toEqual(['invalid ID', 'missing order name']);
    });

    it('formats all-skipped message when no rows are imported', () => {
      const summary = formatImportSummary(0, 3, ['invalid ID']);
      expect(summary.summary).toBe('Skipped 3 items: invalid ID.');
      expect(summary.importedCount).toBe(0);
      expect(summary.skippedCount).toBe(3);
    });
  });
});
