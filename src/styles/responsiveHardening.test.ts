import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Responsive mobile hardening refinements (F5, F6, F7, F8, F9)', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const globalsCssPath = path.resolve(__dirname, 'globals.css');
  const indexHtmlPath = path.resolve(rootDir, 'index.html');
  const orderPagePath = path.resolve(rootDir, 'src/components/pages/OrderPage.tsx');
  const pendingAccessPath = path.resolve(rootDir, 'src/components/auth/PendingAccess.tsx');
  const settlementPacksPath = path.resolve(rootDir, 'src/components/order/SettlementPacks.tsx');

  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const orderPage = fs.readFileSync(orderPagePath, 'utf8');
  const pendingAccess = fs.readFileSync(pendingAccessPath, 'utf8');
  const settlementPacks = fs.readFileSync(settlementPacksPath, 'utf8');

  it('F7: includes viewport-fit=cover in index.html meta viewport tag', () => {
    expect(indexHtml).toMatch(/<meta\s+name="viewport"\s+content="[^"]*viewport-fit=cover[^"]*"\s*\/>/);
  });

  it('F8: defines .btn-warning in globals.css with proper tokens and interactive states', () => {
    expect(globalsCss).toMatch(/\.btn-warning\s*\{[\s\S]*?background:\s*var\(--color-warning\);/);
    expect(globalsCss).toMatch(/\.btn-warning\s*\{[\s\S]*?color:\s*var\(--color-text-inverse\);/);
    expect(globalsCss).toMatch(/\.btn-warning\s*\{[\s\S]*?border-color:\s*var\(--color-warning\);/);
    expect(globalsCss).toMatch(/\.btn-warning:hover:not\(:disabled\)\s*\{[\s\S]*?opacity:\s*0\.92;/);
    expect(globalsCss).toMatch(/\.btn-warning:active:not\(:disabled\)\s*\{[\s\S]*?opacity:\s*0\.85;/);
    expect(globalsCss).toMatch(/\.btn-warning:focus-visible\s*\{[\s\S]*?box-shadow:\s*0\s+0\s+0\s+3px\s+var\(--color-focus-ring\);/);
  });

  it('F5: defines base .btn-xs utility in globals.css', () => {
    expect(globalsCss).toMatch(/\.btn-xs\s*\{[\s\S]*?padding:\s*3px\s+8px;[\s\S]*?font-size:\s*0\.75rem;[\s\S]*?min-height:\s*24px;/);
  });

  it('F6: includes .wizard-progress in 1-column grid collapse below 768px in globals.css', () => {
    expect(globalsCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.wizard-progress[\s\S]*?grid-template-columns:\s*1fr;/);
  });

  it('F6: applies global horizontal overflow protection on html, body in globals.css', () => {
    expect(globalsCss).toMatch(/html,\s*body\s*\{[\s\S]*?overflow-x:\s*hidden;/);
  });

  it('F7: configures safe area bottom padding for .app-main and .wizard-footer in globals.css', () => {
    expect(globalsCss).toMatch(/\.app-main\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--space-8\)\s*\+\s*72px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\);/);
    expect(globalsCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.wizard-footer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*0;[\s\S]*?padding-bottom:\s*calc\(var\(--space-3\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\);/);
  });

  it('F7: applies landscape horizontal safe area insets to key layout containers in globals.css', () => {
    expect(globalsCss).toMatch(/@media\s*\(orientation:\s*landscape\)\s*\{[\s\S]*?\.page-container[\s\S]*?padding-left:\s*max\(var\(--space-4\),\s*env\(safe-area-inset-left,\s*0px\)\);/);
    expect(globalsCss).toMatch(/@media\s*\(orientation:\s*landscape\)\s*\{[\s\S]*?\.page-container[\s\S]*?padding-right:\s*max\(var\(--space-4\),\s*env\(safe-area-inset-right,\s*0px\)\);/);
  });

  it('F8: prevents iOS Safari form input auto-zoom on mobile in globals.css', () => {
    expect(globalsCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.input,[\s\S]*?font-size:\s*1rem\s*!important;/);
  });

  it('F5: enforces >=44px minimum touch targets on mobile controls in globals.css', () => {
    expect(globalsCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.btn-sm,[\s\S]*?\.btn-xs,[\s\S]*?\.settings-tab-btn,[\s\S]*?\.buyer-chip,[\s\S]*?\.bag-mode-pill,[\s\S]*?\.order-tab-chip\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(globalsCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.buyer-chips-wrap\s*\{[\s\S]*?gap:\s*var\(--space-2\);/);
  });

  it('F9: enables flex-wrap on .history-header-actions and reduces .card-padded padding on mobile', () => {
    expect(globalsCss).toMatch(/\.history-header-actions\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
    expect(globalsCss).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.card-padded\s*\{[\s\S]*?padding:\s*var\(--space-4\);/);
  });

  it('F6: prevents title overflow with word breaking on .order-header-title in OrderPage.tsx', () => {
    expect(orderPage).toMatch(/\.order-header-title\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;[\s\S]*?min-width:\s*0;/);
  });

  it('F5: configures mobile touch targets on .order-tab-chip in OrderPage.tsx', () => {
    expect(orderPage).toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.order-tab-chip\s*\{[\s\S]*?min-height:\s*44px;/);
  });

  it('F6: constrains email badge container and inner text against overflow in PendingAccess.tsx', () => {
    expect(pendingAccess).toMatch(/maxWidth:\s*'100%'/);
    expect(pendingAccess).toMatch(/flexWrap:\s*'wrap'/);
    expect(pendingAccess).toMatch(/overflowWrap:\s*'anywhere'/);
    expect(pendingAccess).toMatch(/wordBreak:\s*'break-all'/);
  });

  it('F5 & F8: sets minHeight 44 and fontSize 1rem on payment inputs in SettlementPacks.tsx', () => {
    expect(settlementPacks).toMatch(/minHeight:\s*44,\s*fontSize:\s*'1rem'/);
  });
});
