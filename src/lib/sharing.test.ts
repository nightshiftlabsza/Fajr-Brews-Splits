import { describe, expect, it } from 'vitest';
import { buildEmailSubject } from './sharing';

describe('sharing helpers', () => {
  it('formats email subject as Splits invoice — {roaster} — {ref}', () => {
    const subject = buildEmailSubject('Friedhats', 'AHMED-OCT26');
    expect(subject).toBe('Splits invoice — Friedhats — AHMED-OCT26');
  });
});
