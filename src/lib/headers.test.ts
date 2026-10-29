import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('security headers configuration', () => {
  const headersPath = path.resolve(__dirname, '../../public/_headers');
  const headersContent = fs.readFileSync(headersPath, 'utf-8');

  it('contains Content-Security-Policy-Report-Only and does not apply an enforcing CSP', () => {
    expect(headersContent).toContain('Content-Security-Policy-Report-Only:');
    // Ensure enforcing header is not present
    const lines = headersContent.split('\n').filter((l) => !l.trim().startsWith('#'));
    const enforcingLine = lines.find((l) => l.trim().startsWith('Content-Security-Policy:'));
    expect(enforcingLine).toBeUndefined();
  });

  it('includes required defense-in-depth security headers', () => {
    expect(headersContent).toContain('X-Content-Type-Options: nosniff');
    expect(headersContent).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(headersContent).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    expect(headersContent).toContain('X-Frame-Options: DENY');
  });

  it('configures CSP directives correctly for the app stack', () => {
    expect(headersContent).toContain("frame-ancestors 'none'");
    expect(headersContent).toContain("font-src 'self'");
    expect(headersContent).toContain("style-src 'self' 'unsafe-inline'");
    expect(headersContent).toContain("img-src 'self' data: blob:");
    expect(headersContent).toContain('https://*.supabase.co');
    expect(headersContent).toContain('wss://*.supabase.co');

    // Forbids Google Fonts
    expect(headersContent).not.toContain('fonts.googleapis.com');
    expect(headersContent).not.toContain('fonts.gstatic.com');
  });

  it('configures 1-year immutable caching for content-hashed assets and no long cache on root', () => {
    expect(headersContent).toContain('/assets/*');
    expect(headersContent).toContain('Cache-Control: public, max-age=31536000, immutable');
    // index.html or root must not have immutable cache
    const rootBlock = headersContent.split('/assets/*')[0];
    expect(rootBlock).not.toContain('max-age=31536000');
  });
});
