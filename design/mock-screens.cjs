const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/mzaka.ZAK-PC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.resolve(ROOT, 'docs/evidence/05-identity');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

// Read CSS files
const tokensCss = fs.readFileSync(path.resolve(ROOT, 'src/styles/tokens.css'), 'utf8');
const globalsCss = fs.readFileSync(path.resolve(ROOT, 'src/styles/globals.css'), 'utf8');

// Read Fonts and encode to base64
function getFontBase64(relPath) {
  const fullPath = path.resolve(ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath).toString('base64');
  }
  return '';
}

const frauncesLatinB64 = getFontBase64('src/assets/fonts/fraunces/fraunces-latin.woff2');
const frauncesItalicB64 = getFontBase64('src/assets/fonts/fraunces/fraunces-italic.woff2');
const manropeLatinB64 = getFontBase64('src/assets/fonts/manrope/manrope-latin.woff2');
const hankenGroteskLatinB64 = getFontBase64('src/assets/fonts/hanken-grotesk/hanken-grotesk-latin.woff2');

const fontsCss = `
  @font-face {
    font-family: 'Fraunces';
    font-style: normal;
    font-weight: 600 700;
    font-display: swap;
    src: url('data:font/woff2;base64,${frauncesLatinB64}') format('woff2');
  }
  @font-face {
    font-family: 'Fraunces';
    font-style: italic;
    font-weight: 500;
    font-display: swap;
    src: url('data:font/woff2;base64,${frauncesItalicB64}') format('woff2');
    unicode-range: U+0020, U+0042, U+0046, U+0061, U+0065, U+006A, U+0072, U+0073, U+0077;
  }
  @font-face {
    font-family: 'Manrope';
    font-style: normal;
    font-weight: 400 700;
    font-display: swap;
    src: url('data:font/woff2;base64,${manropeLatinB64}') format('woff2');
  }
  @font-face {
    font-family: 'Hanken Grotesk';
    font-style: normal;
    font-weight: 400 700;
    font-display: swap;
    src: url('data:font/woff2;base64,${hankenGroteskLatinB64}') format('woff2');
  }
`;

const headerComponentStyles = `
  .nav-top {
    position: relative;
    z-index: var(--z-header);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    box-shadow: none;
    height: var(--nav-top-height, 64px);
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }

  .nav-top-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: var(--content-max-width, 1200px);
    margin: 0 auto;
    padding: 0 var(--space-6);
    gap: var(--space-4);
    height: 100%;
    box-sizing: border-box;
  }

  @media (max-width: 767px) {
    .nav-top-inner {
      padding: 0 var(--space-4);
      gap: var(--space-3);
    }
    .nav-desktop-tabs {
      display: none !important;
    }
    .nav-user-email,
    .nav-user-caret {
      display: none !important;
    }
    .nav-user-trigger {
      padding: 3px !important;
      min-height: 32px !important;
    }
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    .nav-top-inner {
      padding: 0 var(--space-4);
      gap: var(--space-3);
    }
    .nav-desktop-tab {
      padding: 6px 10px;
      font-size: 0.8125rem;
    }
    .nav-user-email {
      max-width: 110px;
    }
  }

  .nav-desktop-tabs {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .nav-desktop-tab {
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }

  .nav-desktop-tab:hover {
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
  }

  .nav-desktop-tab.active {
    background: var(--color-accent-light);
    color: var(--color-accent);
    font-weight: 600;
  }

  .nav-user {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
    position: relative;
  }

  .nav-user-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 38px;
    padding: 4px 12px 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    cursor: pointer;
    transition: border-color var(--transition-fast), background-color var(--transition-fast);
  }

  .nav-user-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--color-accent-light);
    color: var(--color-accent);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .nav-user-email {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-user-caret {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    flex-shrink: 0;
  }
`;

const authComponentStyles = `
  .auth-shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    padding: var(--space-4);
    box-sizing: border-box;
  }

  .auth-card {
    width: 100%;
    max-width: 420px;
    margin: 40px auto;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: none;
    padding: var(--space-8);
    box-sizing: border-box;
  }

  @media (max-width: 480px) {
    .auth-card {
      padding: var(--space-6) var(--space-5);
    }
  }

  .auth-brand {
    display: flex;
    justify-content: center;
    margin-bottom: var(--space-4);
  }

  .auth-tagline {
    text-align: center;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
  }
`;

const splitsLockupStyles = `
  .splits-lockup {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    text-decoration: none;
    color: inherit;
    user-select: none;
  }

  .splits-lockup-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .splits-brand-name {
    font-family: var(--font-display);
    font-size: 1.375rem;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
  }

  [data-theme="emerald"] .splits-brand-name {
    font-weight: 600;
  }

  [data-theme="yinmn"] .splits-brand-name {
    font-weight: 700;
  }

  .splits-dot {
    color: var(--color-accent);
  }

  .splits-attribution {
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-text-muted);
    line-height: 1.2;
    margin-top: 3px;
    white-space: nowrap;
  }

  .splits-attribution-org {
    color: var(--color-text-primary);
  }

  [data-theme="emerald"] .splits-attribution-org {
    font-family: 'Fraunces', Georgia, serif;
    font-style: italic;
    font-weight: 500;
  }

  [data-theme="yinmn"] .splits-attribution-org {
    font-family: var(--font-body);
    font-style: normal;
    font-weight: 700;
  }

  @media (max-width: 480px) {
    .splits-lockup:not(.splits-lockup--large) .splits-mark {
      width: 28px;
      height: 28px;
    }

    .splits-lockup:not(.splits-lockup--large) .splits-brand-name {
      font-size: 1.25rem;
    }

    .splits-lockup:not(.splits-lockup--large) .splits-attribution {
      display: none;
    }
  }

  .splits-lockup--large {
    gap: var(--space-4);
  }

  .splits-lockup--large .splits-brand-name {
    font-size: 2rem;
  }

  .splits-lockup--large .splits-attribution {
    font-size: 0.875rem;
    margin-top: 4px;
  }
`;

function getLockupHtml(size = 'default') {
  const isLarge = size === 'large';
  const markSize = isLarge ? 48 : 32;
  const largeClass = isLarge ? ' splits-lockup--large' : '';
  return `
    <div class="splits-lockup${largeClass}">
      <svg viewBox="0 0 32 32" width="${markSize}" height="${markSize}" fill="none" class="splits-mark" style="color: var(--color-accent); display: block; flex-shrink: 0;" aria-hidden="true">
        <path d="M15 3.1C8.4 3.6 3.5 9.2 3.5 16S8.4 28.4 15 28.9V3.1Z" fill="currentColor"/>
        <path d="M17 3.1v25.8c6.6-.5 11.5-6.1 11.5-12.9S23.6 3.6 17 3.1Z" fill="currentColor" fill-opacity="0.42"/>
      </svg>
      <div class="splits-lockup-text">
        <div class="splits-brand-name">Splits<span class="splits-dot">.</span></div>
        <div class="splits-attribution">by <span class="splits-attribution-org">Fajr Brews</span></div>
      </div>
    </div>
  `;
}

function buildHeaderHtml(theme, mode) {
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="${theme}" data-mode="${mode}">
    <head>
      <meta charset="UTF-8">
      <style>
        ${tokensCss}
        ${fontsCss}
        ${globalsCss}
        ${headerComponentStyles}
        ${splitsLockupStyles}
        body { margin: 0; background: var(--color-bg); font-family: var(--font-body); }
      </style>
    </head>
    <body>
      <header class="nav-top">
        <div class="nav-top-inner">
          ${getLockupHtml('default')}

          <nav class="nav-desktop-tabs">
            <button class="nav-desktop-tab active">Active Orders</button>
            <button class="nav-desktop-tab">My Stats</button>
            <button class="nav-desktop-tab">Past Orders</button>
            <button class="nav-desktop-tab">Settings</button>
          </nav>

          <div class="nav-user">
            <div class="realtime-dot" title="Realtime sync active"></div>
            <button type="button" class="nav-user-trigger" aria-haspopup="menu" aria-expanded="false">
              <span class="nav-user-avatar">AB</span>
              <span class="nav-user-email">owner@fajrbrews.com</span>
              <span class="nav-user-caret">▾</span>
            </button>
          </div>
        </div>
      </header>
    </body>
    </html>
  `;
}

function buildAuthHtml(theme = 'emerald', mode = 'light') {
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="${theme}" data-mode="${mode}">
    <head>
      <meta charset="UTF-8">
      <style>
        ${tokensCss}
        ${fontsCss}
        ${globalsCss}
        ${authComponentStyles}
        ${splitsLockupStyles}
        body { margin: 0; background: var(--color-bg); font-family: var(--font-body); }
      </style>
    </head>
    <body>
      <div class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand">
            ${getLockupHtml('large')}
          </div>
          <p class="auth-tagline">Shared coffee order reconciliation</p>

          <div class="form-group">
            <label class="label">Email address</label>
            <input type="email" class="input" placeholder="you@example.com" value="zakariyya@fajrbrews.com" readonly />
          </div>

          <div class="form-group" style="margin-top: var(--space-4);">
            <label class="label">Password</label>
            <input type="password" class="input" value="••••••••••••" readonly />
          </div>

          <button class="btn btn-primary w-full" style="margin-top: var(--space-6);">Sign in</button>
          <button class="btn btn-secondary w-full" style="margin-top: var(--space-2);">Create account</button>
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildInvoiceHtml(theme = 'emerald', mode = 'light') {
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="${theme}" data-mode="${mode}">
    <head>
      <meta charset="UTF-8">
      <style>
        ${tokensCss}
        ${fontsCss}
        ${globalsCss}
        ${splitsLockupStyles}
        body { margin: 0; background: var(--color-bg); font-family: var(--font-body); padding: var(--space-8); }
        .invoice-paper {
          max-width: 680px;
          margin: 0 auto;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          box-shadow: var(--shadow-md);
        }
        .invoice-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: var(--space-6);
          border-bottom: 2px solid var(--color-border);
          margin-bottom: var(--space-6);
        }
        .invoice-header h2 {
          font-family: var(--font-display);
          font-size: 1.75rem;
          margin: 0 0 4px 0;
          color: var(--color-text-primary);
        }
        .invoice-subtitle {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }
        .invoice-amount-hero {
          font-family: var(--font-display);
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text-primary);
          text-align: right;
        }
        .invoice-status-label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-paid);
          text-align: right;
        }
        .invoice-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-6);
          border-bottom: 1px solid var(--color-border);
        }
        .invoice-line-item {
          display: flex;
          justify-content: space-between;
          padding: var(--space-3) 0;
          border-bottom: 1px dashed var(--color-border);
        }
        .invoice-total-row {
          display: flex;
          justify-content: space-between;
          padding-top: var(--space-4);
          font-weight: 700;
          font-size: 1.125rem;
          color: var(--color-text-primary);
        }
      </style>
    </head>
    <body>
      <div class="invoice-paper">
        <div class="invoice-header">
          <div class="invoice-header-row">
            <div>
              <h2>Splits</h2>
              <div class="invoice-subtitle">by Fajr Brews · Invoice</div>
            </div>
            <div>
              <div class="invoice-amount-hero">R425.00</div>
              <div class="invoice-status-label">Amount Due</div>
            </div>
          </div>
        </div>

        <div class="invoice-meta-grid">
          <div>
            <div style="font-weight: 700; color: var(--color-text-primary); font-size: 1rem;">Zakariyya</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-muted);">zakariyya@fajrbrews.com</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.875rem; font-weight: 600; color: var(--color-text-primary);">Friedhats Autumn Drop</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-muted);">24 Oct 2026</div>
            <div style="font-size: 0.8125rem; color: var(--color-accent); font-weight: 600; margin-top: 4px;">Ref: FAJR-FRIEDHATS-ZAK</div>
          </div>
        </div>

        <div class="invoice-line-item">
          <div>
            <div style="font-weight: 600; color: var(--color-text-primary);">Colombia El Paraiso</div>
            <div style="font-size: 0.75rem; color: var(--color-text-muted);">Bag 1: 250g whole bag</div>
          </div>
          <div style="font-weight: 600; color: var(--color-text-primary);">R320.00</div>
        </div>

        <div class="invoice-line-item">
          <div>
            <div style="font-weight: 600; color: var(--color-text-primary);">DHL Express</div>
            <div style="font-size: 0.75rem; color: var(--color-text-muted);">Equal per person</div>
          </div>
          <div style="font-weight: 600; color: var(--color-text-primary);">R90.00</div>
        </div>

        <div class="invoice-line-item">
          <div>
            <div style="font-weight: 600; color: var(--color-text-primary);">PUDO Locker Courier</div>
            <div style="font-size: 0.75rem; color: var(--color-text-muted);">Specific person</div>
          </div>
          <div style="font-weight: 600; color: var(--color-text-primary);">R15.00</div>
        </div>

        <div class="invoice-total-row">
          <div>Total Due</div>
          <div style="color: var(--color-accent);">R425.00</div>
        </div>

        <div style="margin-top: var(--space-6); padding: var(--space-4); background: var(--color-surface-raised); border-radius: var(--radius-md); font-size: 0.8125rem;">
          <div style="font-weight: 600; margin-bottom: 4px; color: var(--color-text-primary);">Payment Details</div>
          <div style="color: var(--color-text-secondary);">FNB · Account 1234567890 · Abdul Basit</div>
          <div style="color: var(--color-text-muted); font-size: 0.75rem; margin-top: 4px;">Use reference FAJR-FRIEDHATS-ZAK</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function captureAll() {
  const browser = await chromium.launch({ headless: true });

  const themes = [
    { theme: 'emerald', mode: 'light', name: 'emerald-light' },
    { theme: 'emerald', mode: 'dark', name: 'emerald-dark' },
    { theme: 'yinmn', mode: 'light', name: 'yinmn-light' },
    { theme: 'yinmn', mode: 'dark', name: 'yinmn-dark' },
  ];

  // 1-8. Header desktop 1280px & phone 360px in 4 theme variants
  for (const t of themes) {
    // Desktop 1280px
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 64 } });
      await page.setContent(buildHeaderHtml(t.theme, t.mode));
      await page.waitForSelector('.splits-lockup');
      const header = await page.$('.nav-top');
      if (header) {
        const outPath = path.join(EVIDENCE_DIR, `header-${t.name}-desktop.png`);
        await header.screenshot({ path: outPath });
        const box = await header.boundingBox();
        console.log(`Captured header-${t.name}-desktop.png (${fs.statSync(outPath).size} bytes, height: ${box.height}px)`);
      }
      await page.close();
    }

    // Phone 360px
    {
      const page = await browser.newPage({ viewport: { width: 360, height: 64 } });
      await page.setContent(buildHeaderHtml(t.theme, t.mode));
      await page.waitForSelector('.splits-lockup');
      const header = await page.$('.nav-top');
      if (header) {
        const outPath = path.join(EVIDENCE_DIR, `header-${t.name}-phone.png`);
        await header.screenshot({ path: outPath });
        const box = await header.boundingBox();
        console.log(`Captured header-${t.name}-phone.png (${fs.statSync(outPath).size} bytes, height: ${box.height}px)`);
      }
      await page.close();
    }
  }

  // 9. Sign-in desktop 1280px
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
    await page.setContent(buildAuthHtml('emerald', 'light'));
    await page.waitForSelector('.auth-card');
    const outPath = path.join(EVIDENCE_DIR, 'signin-desktop.png');
    await page.screenshot({ path: outPath });
    console.log(`Captured signin-desktop.png (${fs.statSync(outPath).size} bytes)`);
    await page.close();
  }

  // 10. Sign-in phone 360px
  {
    const page = await browser.newPage({ viewport: { width: 360, height: 680 } });
    await page.setContent(buildAuthHtml('emerald', 'light'));
    await page.waitForSelector('.auth-card');
    const outPath = path.join(EVIDENCE_DIR, 'signin-phone.png');
    await page.screenshot({ path: outPath });
    console.log(`Captured signin-phone.png (${fs.statSync(outPath).size} bytes)`);
    await page.close();
  }

  // 11. Favicon sizes 16, 32, 64px rendered
  {
    const page = await browser.newPage({ viewport: { width: 440, height: 180 } });
    const faviconSvg = fs.readFileSync(path.resolve(ROOT, 'public/favicon.svg'), 'utf8');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 24px;
            background: #F4F7F2;
            font-family: -apple-system, system-ui, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 28px;
          }
          .box {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            font-weight: 600;
            color: #3A5240;
          }
          .icon-16 { width: 16px; height: 16px; image-rendering: -webkit-optimize-contrast; }
          .icon-32 { width: 32px; height: 32px; }
          .icon-64 { width: 64px; height: 64px; }
          .icon-wrap {
            background: #FFFFFF;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #C8DAC8;
            box-shadow: 0 2px 8px rgba(13, 26, 16, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 72px;
            min-height: 72px;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="icon-wrap"><img class="icon-16" src="data:image/svg+xml;utf8,${encodeURIComponent(faviconSvg)}" /></div>
          <span>16×16</span>
        </div>
        <div class="box">
          <div class="icon-wrap"><img class="icon-32" src="data:image/svg+xml;utf8,${encodeURIComponent(faviconSvg)}" /></div>
          <span>32×32</span>
        </div>
        <div class="box">
          <div class="icon-wrap"><img class="icon-64" src="data:image/svg+xml;utf8,${encodeURIComponent(faviconSvg)}" /></div>
          <span>64×64</span>
        </div>
      </body>
      </html>
    `;
    await page.setContent(html);
    const outPath = path.join(EVIDENCE_DIR, 'favicon-sizes-16-32-64.png');
    await page.screenshot({ path: outPath });
    console.log(`Captured favicon-sizes-16-32-64.png (${fs.statSync(outPath).size} bytes)`);
    await page.close();
  }

  // 12. Invoice view
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 720 } });
    await page.setContent(buildInvoiceHtml('emerald', 'light'));
    const invoiceEl = await page.$('.invoice-paper');
    const outPath = path.join(EVIDENCE_DIR, 'invoice-view.png');
    if (invoiceEl) {
      await invoiceEl.screenshot({ path: outPath });
    } else {
      await page.screenshot({ path: outPath });
    }
    console.log(`Captured invoice-view.png (${fs.statSync(outPath).size} bytes)`);
    await page.close();
  }

  await browser.close();
  console.log('All 12 evidence screenshots generated successfully.');
}

captureAll().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
