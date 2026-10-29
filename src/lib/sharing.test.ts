/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import {
  buildEmailSubject,
  buildMailtoUrl,
  isValidMailtoRecipient,
  openEmail,
} from './sharing';

describe('sharing helpers', () => {
  it('formats email subject as Splits invoice — {roaster} — {ref}', () => {
    const subject = buildEmailSubject('Friedhats', 'AHMED-OCT26');
    expect(subject).toBe('Splits invoice — Friedhats — AHMED-OCT26');
  });

  describe('isValidMailtoRecipient', () => {
    it('accepts legitimate email addresses', () => {
      expect(isValidMailtoRecipient('alice@example.com')).toBe(true);
      expect(isValidMailtoRecipient('user.name+tag@domain.co.za')).toBe(true);
      expect(isValidMailtoRecipient('roaster-orders@sub.example.com')).toBe(true);
      expect(isValidMailtoRecipient('customer_123@beans.org')).toBe(true);
    });

    it('rejects mailto injection delimiters (?, &, <, >, ,, ;, %)', () => {
      expect(isValidMailtoRecipient('victim@example.com?cc=attacker@example.com')).toBe(false);
      expect(isValidMailtoRecipient('victim@example.com&bcc=attacker@example.com')).toBe(false);
      expect(isValidMailtoRecipient('victim@example.com?body=injected')).toBe(false);
      expect(isValidMailtoRecipient('victim<attacker@evil.com>')).toBe(false);
      expect(isValidMailtoRecipient('victim>attacker@evil.com')).toBe(false);
      expect(isValidMailtoRecipient('<script>alert(1)</script>@test.com')).toBe(false);
      expect(isValidMailtoRecipient('alice@example.com,bob@example.com')).toBe(false);
      expect(isValidMailtoRecipient('alice@example.com;bob@example.com')).toBe(false);
      expect(isValidMailtoRecipient('victim%40example.com')).toBe(false);
      expect(isValidMailtoRecipient('victim@example.com%0aBcc:evil@example.com')).toBe(false);
    });

    it('rejects control characters, newlines, and carriage returns', () => {
      expect(isValidMailtoRecipient('victim@example.com\r\nBcc:evil@example.com')).toBe(false);
      expect(isValidMailtoRecipient('victim@example.com\nSubject:hacked')).toBe(false);
      expect(isValidMailtoRecipient('victim@example.com\r')).toBe(false);
      expect(isValidMailtoRecipient('victim\x00@example.com')).toBe(false);
      expect(isValidMailtoRecipient('victim\x1f@example.com')).toBe(false);
      expect(isValidMailtoRecipient('victim\x7f@example.com')).toBe(false);
    });

    it('rejects addresses containing whitespace or surrounding spaces', () => {
      expect(isValidMailtoRecipient(' alice@example.com')).toBe(false);
      expect(isValidMailtoRecipient('alice@example.com ')).toBe(false);
      expect(isValidMailtoRecipient('alice @example.com')).toBe(false);
      expect(isValidMailtoRecipient('alice@ example.com')).toBe(false);
      expect(isValidMailtoRecipient('alice\texample@domain.com')).toBe(false);
    });

    it('rejects addresses without exactly one @ symbol', () => {
      expect(isValidMailtoRecipient('notanemail')).toBe(false);
      expect(isValidMailtoRecipient('alice@@example.com')).toBe(false);
      expect(isValidMailtoRecipient('alice@bob@example.com')).toBe(false);
    });

    it('rejects empty local or domain parts', () => {
      expect(isValidMailtoRecipient('@example.com')).toBe(false);
      expect(isValidMailtoRecipient('alice@')).toBe(false);
      expect(isValidMailtoRecipient('@')).toBe(false);
      expect(isValidMailtoRecipient('')).toBe(false);
    });

    it('rejects non-string values gracefully', () => {
      expect(isValidMailtoRecipient(null)).toBe(false);
      expect(isValidMailtoRecipient(undefined)).toBe(false);
      expect(isValidMailtoRecipient(12345)).toBe(false);
      expect(isValidMailtoRecipient({})).toBe(false);
    });
  });

  describe('buildMailtoUrl', () => {
    it('builds mailto link with valid recipient without encoding the address', () => {
      const url = buildMailtoUrl('alice@example.com', 'Subject Test', 'Body Text');
      expect(url).toBe('mailto:alice@example.com?subject=Subject%20Test&body=Body%20Text');
      // Address must contain literal '@', not '%40'
      expect(url).toContain('mailto:alice@example.com?');
    });

    it('falls back to no-recipient mailto link when address is invalid or hostile', () => {
      const hostileUrl = buildMailtoUrl('victim@example.com?cc=evil@example.com', 'Subject', 'Body');
      expect(hostileUrl).toBe('mailto:?subject=Subject&body=Body');

      const newlineUrl = buildMailtoUrl('victim@example.com\r\nBcc:evil@example.com', 'Subject', 'Body');
      expect(newlineUrl).toBe('mailto:?subject=Subject&body=Body');

      const missingUrl = buildMailtoUrl(undefined, 'Subject', 'Body');
      expect(missingUrl).toBe('mailto:?subject=Subject&body=Body');
    });
  });

  describe('openEmail', () => {
    it('calls window.open with validated recipient mailto url', () => {
      const originalOpen = window.open;
      const openMock = vi.fn();
      window.open = openMock;

      try {
        const payload: any = {
          order: {
            id: 'o-1',
            name: 'Order 1',
            lots: [],
            fees: [],
            payments: {},
            payerBank: { bankName: 'FNB', accountNumber: '12345', beneficiary: 'Alice' },
            referenceTemplate: 'FAJR-{ORDER}-{NAME}',
          },
          person: { id: 'p-1', name: 'Alice', email: 'alice@example.com' },
          payer: { id: 'p-1', name: 'Alice' },
          calc: {
            personId: 'p-1',
            totalGrams: 250,
            goodsZar: 100,
            feesZar: 20,
            totalPreRound: 120,
            totalFinal: 120,
            coffeeValueForeignShare: 1,
            lotBreakdowns: [],
            feeBreakdowns: [],
          },
        };

        openEmail(payload);

        expect(openMock).toHaveBeenCalledTimes(1);
        const [url, target] = openMock.mock.calls[0];
        expect(target).toBe('_self');
        expect(url).toMatch(/^mailto:alice@example\.com\?subject=/);
      } finally {
        window.open = originalOpen;
      }
    });

    it('falls back to no-recipient when person email is hostile', () => {
      const originalOpen = window.open;
      const openMock = vi.fn();
      window.open = openMock;

      try {
        const payload: any = {
          order: {
            id: 'o-1',
            name: 'Order 1',
            lots: [],
            fees: [],
            payments: {},
            payerBank: { bankName: 'FNB', accountNumber: '12345', beneficiary: 'Alice' },
            referenceTemplate: 'FAJR-{ORDER}-{NAME}',
          },
          person: { id: 'p-1', name: 'Mallory', email: 'mallory@example.com?cc=evil@example.com' },
          payer: { id: 'p-1', name: 'Alice' },
          calc: {
            personId: 'p-1',
            totalGrams: 250,
            goodsZar: 100,
            feesZar: 20,
            totalPreRound: 120,
            totalFinal: 120,
            coffeeValueForeignShare: 1,
            lotBreakdowns: [],
            feeBreakdowns: [],
          },
        };

        openEmail(payload);

        expect(openMock).toHaveBeenCalledTimes(1);
        const [url, target] = openMock.mock.calls[0];
        expect(target).toBe('_self');
        expect(url).toMatch(/^mailto:\?subject=/);
      } finally {
        window.open = originalOpen;
      }
    });
  });
});
