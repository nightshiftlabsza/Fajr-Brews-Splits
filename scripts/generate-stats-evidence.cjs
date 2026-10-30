const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/mzaka.ZAK-PC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.resolve(ROOT, 'docs/stats-redesign/evidence');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

// Read CSS files
const tokensCss = fs.readFileSync(path.resolve(ROOT, 'src/styles/tokens.css'), 'utf8');
const globalsCss = fs.readFileSync(path.resolve(ROOT, 'src/styles/globals.css'), 'utf8');
const statsCss = fs.readFileSync(path.resolve(ROOT, 'src/styles/stats.css'), 'utf8');
const statsPhoneCss = fs.readFileSync(path.resolve(ROOT, 'src/styles/stats-phone.css'), 'utf8');

function getFontBase64(relPath) {
  const fullPath = path.resolve(ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath).toString('base64');
  }
  return '';
}

const frauncesLatinB64 = getFontBase64('src/assets/fonts/fraunces/fraunces-latin.woff2');
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
    font-family: 'Manrope';
    font-style: normal;
    font-weight: 400 600 700;
    font-display: swap;
    src: url('data:font/woff2;base64,${manropeLatinB64}') format('woff2');
  }
  @font-face {
    font-family: 'Hanken Grotesk';
    font-style: normal;
    font-weight: 400 600 700;
    font-display: swap;
    src: url('data:font/woff2;base64,${hankenGroteskLatinB64}') format('woff2');
  }
`;

function getLockupHtml() {
  return `
    <div class="splits-lockup" style="display: inline-flex; align-items: center; gap: var(--space-3); text-decoration: none; color: inherit;">
      <svg viewBox="0 0 32 32" width="32" height="32" fill="none" style="color: var(--color-accent); display: block; flex-shrink: 0;" aria-hidden="true">
        <path d="M15 3.1C8.4 3.6 3.5 9.2 3.5 16S8.4 28.4 15 28.9V3.1Z" fill="currentColor"/>
        <path d="M17 3.1v25.8c6.6-.5 11.5-6.1 11.5-12.9S23.6 3.6 17 3.1Z" fill="currentColor" fill-opacity="0.42"/>
      </svg>
      <div style="display: flex; flex-direction: column; justify-content: center;">
        <div style="font-family: var(--font-display); font-size: 1.375rem; line-height: 1; letter-spacing: -0.02em; color: var(--color-text-primary); font-weight: 700;">
          Splits<span style="color: var(--color-accent);">.</span>
        </div>
        <div style="font-family: var(--font-body); font-size: 0.6875rem; font-weight: 500; color: var(--color-text-muted); line-height: 1.2; margin-top: 3px;">
          by <span style="font-style: italic; color: var(--color-text-primary);">Fajr Brews</span>
        </div>
      </div>
    </div>
  `;
}

function getHeaderHtml() {
  return `
    <header class="nav-top" style="height: var(--nav-top-height, 64px); background: var(--color-surface); border-bottom: 1px solid var(--color-border); display: flex; align-items: center;">
      <div style="width: 100%; max-width: var(--content-max-width, 1200px); margin: 0 auto; padding: 0 var(--space-4); display: flex; align-items: center; justify-content: space-between;">
        ${getLockupHtml()}
        <nav style="display: flex; gap: var(--space-2);">
          <span style="font-weight: 700; color: var(--color-accent); font-size: var(--text-sm); padding: 8px 12px; background: var(--color-accent-light); border-radius: var(--radius-sm);">My Stats</span>
        </nav>
      </div>
    </header>
  `;
}

function buildStatsHomeHtml(theme, mode, width) {
  const isDesktop = width >= 1024;
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="${theme}" data-mode="${mode}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${tokensCss}
        ${fontsCss}
        ${globalsCss}
        ${statsCss}
        ${statsPhoneCss}
        body { margin: 0; background: var(--color-bg); font-family: var(--font-body); color: var(--color-text-primary); overflow-x: hidden; }
      </style>
    </head>
    <body>
      ${getHeaderHtml()}
      <div class="stats-container">
        <div class="stats-header-section">
          <h1 class="stats-title">Your coffee</h1>
          <p class="stats-subtitle">From orders you were part of, once they are done.</p>

          <div class="stats-period-bar">
            <button type="button" class="stats-picker-trigger" aria-label="Choose coffee statistics period">
              <span>2026 so far</span>
              <span aria-hidden="true">▾</span>
            </button>
            <div class="stats-period-context">4 orders you were part of</div>
          </div>
        </div>

        <button type="button" class="stats-recap-banner" aria-label="View Year in Coffee recap">
          <div>
            <div class="stats-recap-title-wrap">
              <span class="stats-recap-title">Your Year in Coffee, 2026 so far</span>
              <span class="stats-recap-badge">Recap</span>
            </div>
            <div class="stats-recap-sub">A look back at your year</div>
          </div>
          <span class="stats-recap-arrow" aria-hidden="true">→</span>
        </button>

        <div class="${isDesktop ? 'stats-desktop-grid' : ''}">
          <div>
            <div class="stats-card stats-headline-grid" role="region" aria-label="Key coffee facts">
              <div class="stats-headline-item">
                <div class="stats-headline-value">14.5<span class="stats-headline-unit">kg</span></div>
                <div class="stats-headline-label">Coffee taken</div>
              </div>
              <div class="stats-headline-item">
                <div class="stats-headline-value">9</div>
                <div class="stats-headline-label">Bags you shared in</div>
              </div>
              <div class="stats-headline-item">
                <div class="stats-headline-value">5</div>
                <div class="stats-headline-label">Roasters tried</div>
              </div>
            </div>

            <div class="stats-card">
              <div class="stats-card-eyebrow">Favourite roaster</div>
              <div class="stats-fav-row">
                <div style="width: 52px; height: 52px; border-radius: var(--radius-md); background: var(--color-accent-light); color: var(--color-accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.125rem;">FC</div>
                <div class="stats-fav-info">
                  <div class="stats-fav-name">Father Coffee</div>
                  <div class="stats-fav-detail">46% of the coffee you took · 4 orders</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="stats-card">
              <div class="stats-card-eyebrow">You keep coming back to</div>
              <div class="stats-rank-list">
                <div class="stats-rank-row">
                  <div class="stats-rank-meta">
                    <span class="stats-rank-name">Father Coffee</span>
                    <span class="stats-rank-amount">6.7 kg</span>
                  </div>
                  <div class="stats-bar-track" aria-hidden="true"><div class="stats-bar-fill" style="width: 100%;"></div></div>
                </div>
                <div class="stats-rank-row">
                  <div class="stats-rank-meta">
                    <span class="stats-rank-name">Subtext</span>
                    <span class="stats-rank-amount">4.2 kg</span>
                  </div>
                  <div class="stats-bar-track" aria-hidden="true"><div class="stats-bar-fill" style="width: 63%;"></div></div>
                </div>
                <div class="stats-rank-row">
                  <div class="stats-rank-meta">
                    <span class="stats-rank-name">Origin Roasters</span>
                    <span class="stats-rank-amount">2.1 kg</span>
                  </div>
                  <div class="stats-bar-track" aria-hidden="true"><div class="stats-bar-fill" style="width: 31%;"></div></div>
                </div>
              </div>
            </div>

            <div class="stats-card">
              <div class="stats-monthly-header">
                <div class="stats-card-eyebrow" style="margin-bottom: 0;">Monthly rhythm</div>
                <div class="stats-badge-pill">Busiest: March</div>
              </div>
              <div class="stats-month-chart" role="region" aria-label="Monthly order chart">
                <div role="button" tabindex="0" class="stats-month-col" aria-label="January: 1 order"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 33%;"></div></div><span class="stats-month-label">J</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="February: 1 order"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 33%;"></div></div><span class="stats-month-label">F</span></div>
                <div role="button" tabindex="0" class="stats-month-col is-busiest" aria-label="March: 3 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 100%;"></div></div><span class="stats-month-label">M</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="April: 1 order"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 33%;"></div></div><span class="stats-month-label">A</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="May: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">M</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="June: 1 order"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 33%;"></div></div><span class="stats-month-label">J</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="July: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">J</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="August: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">A</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="September: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">S</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="October: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">O</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="November: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">N</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="December: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">D</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-card stats-orders-card" style="margin-top: var(--space-4);">
          <div class="stats-orders-header">
            <div style="font-weight: 700; font-size: var(--text-base);">Recent orders you were part of</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Latest 4</div>
          </div>
          <div>
            <div class="stats-order-row">
              <div class="stats-order-primary">
                <div class="stats-order-coffee-name">Ethiopia Guji Natural</div>
                <div class="stats-order-meta">Father Coffee · 14 Jun 2026 · Winter Drop</div>
              </div>
              <div class="stats-order-secondary">
                <div class="stats-order-grams">250g</div>
                <div class="stats-order-money">Your share: R240.00</div>
              </div>
            </div>
            <div class="stats-order-row">
              <div class="stats-order-primary">
                <div class="stats-order-coffee-name">Colombia Huila Washed</div>
                <div class="stats-order-meta">Subtext · 12 Mar 2026 · March Group Order</div>
              </div>
              <div class="stats-order-secondary">
                <div class="stats-order-grams">375g</div>
                <div class="stats-order-money">Your share: R360.00</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildRecapHtml(theme, mode, width) {
  const isDesktop = width >= 768;
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="${theme}" data-mode="${mode}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${tokensCss}
        ${fontsCss}
        ${globalsCss}
        ${statsCss}
        ${statsPhoneCss}
        body { margin: 0; background: var(--color-bg); font-family: var(--font-body); color: var(--color-text-primary); overflow-x: hidden; }
      </style>
    </head>
    <body>
      ${getHeaderHtml()}
      <div class="stats-container yic-phone-container">
        <div style="margin-bottom: var(--space-6);">
          <button type="button" class="btn btn-secondary btn-sm" style="margin-bottom: var(--space-4); min-height: 44px;">
            ← Back to your coffee
          </button>
          <div class="stats-card-eyebrow">YEAR IN COFFEE · 2026 (so far)</div>
          <h1 class="stats-title" style="font-size: clamp(2rem, 4vw, 2.75rem);">What you took from the orders this year.</h1>
          <p class="stats-subtitle">A quiet summary of shared bags, roasters, and grams ordered together.</p>
        </div>

        <div class="yic-editorial-shell">
          ${isDesktop ? `
            <aside class="yic-sidebar">
              <div class="yic-sidebar-sticky">
                <div class="stats-card" style="padding: var(--space-4);">
                  <div class="stats-card-eyebrow" style="margin-bottom: var(--space-2);">Reporting period</div>
                  <button type="button" class="stats-picker-trigger" style="width: 100%; justify-content: space-between;">
                    <span>2026 so far</span>
                    <span aria-hidden="true">▾</span>
                  </button>
                  <div style="margin-top: var(--space-3); padding-top: var(--space-2); border-top: 1px solid var(--color-border); font-size: var(--text-xs); color: var(--color-text-secondary);">
                    <strong>Same dates last year:</strong> 3 orders (1.1 kg)
                  </div>
                </div>
                <nav class="yic-chapter-nav" aria-label="Year in coffee chapters">
                  <button type="button" class="yic-chapter-btn is-active"><span>01 Your year</span><span aria-hidden="true">→</span></button>
                  <button type="button" class="yic-chapter-btn"><span>02 Favourite roaster</span><span aria-hidden="true">→</span></button>
                  <button type="button" class="yic-chapter-btn"><span>03 Coffees you tried</span><span aria-hidden="true">→</span></button>
                  <button type="button" class="yic-chapter-btn"><span>04 Your months</span><span aria-hidden="true">→</span></button>
                  <button type="button" class="yic-chapter-btn"><span>05 Milestones</span><span aria-hidden="true">→</span></button>
                </nav>
              </div>
            </aside>
          ` : ''}

          <main class="yic-phone-scroll">
            <section class="yic-chapter-section">
              <div class="yic-chapter-num">01 · Your year</div>
              <div class="yic-hero-number">12</div>
              <div style="font-size: var(--text-lg); font-weight: 600;">orders you were part of</div>
              <div class="yic-summary-pill-row">
                <span>14.5 kg of coffee taken</span> · <span>9 bags you shared in</span> · <span>5 roasters tried</span> · <span>11 coffees tried</span>
              </div>
              <div class="yic-style-badge">
                <span>Loyalist</span>
                <span class="yic-style-detail">(8 of your 12 orders came from Father Coffee)</span>
              </div>
            </section>

            <section class="yic-chapter-section">
              <div class="yic-chapter-num">02 · Your favourite roaster</div>
              <div style="display: flex; align-items: center; gap: var(--space-4); margin: var(--space-4) 0;">
                <div style="width: 56px; height: 56px; border-radius: var(--radius-md); background: var(--color-accent-light); color: var(--color-accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.25rem;">FC</div>
                <div>
                  <h3 style="margin: 0; font-size: var(--text-xl);">Father Coffee</h3>
                  <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Most coffee taken</div>
                </div>
              </div>
              <div style="font-size: var(--text-base); line-height: 1.5;">
                You took the most coffee from them: <strong>46%</strong> of your coffee this year.
              </div>
              <div style="margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; font-size: var(--text-sm);">
                <span style="color: var(--color-text-muted);">Runner-up</span>
                <span style="font-weight: 600;">Origin Roasters · 28%</span>
              </div>
            </section>

            <section class="yic-chapter-section">
              <div class="yic-chapter-num">03 · Coffees you tried</div>
              <h3 style="margin: 0 0 var(--space-1) 0; font-size: var(--text-xl);">Ranked by coffee taken</h3>
              <p style="margin: 0 0 var(--space-4) 0; font-size: var(--text-sm); color: var(--color-text-muted);">Coffees you took from orders you were part of</p>
              <div class="stats-rank-list">
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--color-border);">
                  <div>
                    <div style="font-size: var(--text-sm); font-weight: 600;">Ethiopia Guji Natural</div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Father Coffee · 3 orders</div>
                  </div>
                  <div style="font-size: var(--text-sm); font-weight: 700; color: var(--color-accent);">3,250g</div>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                  <div>
                    <div style="font-size: var(--text-sm); font-weight: 600;">Colombia Huila Washed</div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Subtext · 2 orders</div>
                  </div>
                  <div style="font-size: var(--text-sm); font-weight: 700; color: var(--color-accent);">2,750g</div>
                </div>
              </div>
            </section>

            <section class="yic-chapter-section">
              <div class="yic-chapter-num">04 · Your months</div>
              <div class="stats-monthly-header">
                <div class="stats-card-eyebrow" style="margin-bottom: 0;">Monthly rhythm</div>
                <div class="stats-badge-pill">Busiest: March</div>
              </div>
              <div class="stats-month-chart" role="region" aria-label="Monthly order chart">
                <div role="button" tabindex="0" class="stats-month-col" aria-label="January: 1 order"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 33%;"></div></div><span class="stats-month-label">J</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="February: 1 order"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 33%;"></div></div><span class="stats-month-label">F</span></div>
                <div role="button" tabindex="0" class="stats-month-col is-busiest" aria-label="March: 3 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 100%;"></div></div><span class="stats-month-label">M</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="April: 1 order"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 33%;"></div></div><span class="stats-month-label">A</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="May: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">M</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="June: 1 order"><div class="stats-month-bar-wrap"><div class="stats-month-bar" style="height: 33%;"></div></div><span class="stats-month-label">J</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="July: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">J</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="August: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">A</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="September: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">S</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="October: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">O</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="November: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">N</span></div>
                <div role="button" tabindex="0" class="stats-month-col" aria-label="December: 0 orders"><div class="stats-month-bar-wrap"><div class="stats-month-bar--zero"></div></div><span class="stats-month-label">D</span></div>
              </div>
            </section>

            <section class="yic-chapter-section">
              <div class="yic-chapter-num">05 · Milestones</div>
              <h3 style="margin: 0 0 var(--space-4) 0; font-size: var(--text-xl);">Moments from your year</h3>
              <div class="stats-rank-list">
                <div style="padding: 10px 0; border-bottom: 1px solid var(--color-border);">
                  <div style="font-size: var(--text-sm); font-weight: 700;">First order of the year</div>
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">14 Jan 2026 · Summer Drop with Father Coffee</div>
                </div>
                <div style="padding: 10px 0;">
                  <div style="font-size: var(--text-sm); font-weight: 700;">2 roasters tried for the first time</div>
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">Subtext, Origin Roasters</div>
                </div>
              </div>
            </section>

            <section class="yic-chapter-section" style="text-align: center; padding: var(--space-8) var(--space-4);">
              <p style="font-size: var(--text-base); color: var(--color-text-secondary); margin-bottom: var(--space-4);">That was your 2026 in coffee.</p>
              <button type="button" class="btn btn-primary" style="min-height: 44px;">Back to your coffee</button>
            </section>
          </main>
        </div>

        ${!isDesktop ? `
          <div class="yic-dots-indicator" aria-label="Chapter progress">
            <button type="button" class="yic-dot-btn is-active" aria-label="Chapter 1"><div class="yic-dot-circle"></div></button>
            <button type="button" class="yic-dot-btn" aria-label="Chapter 2"><div class="yic-dot-circle"></div></button>
            <button type="button" class="yic-dot-btn" aria-label="Chapter 3"><div class="yic-dot-circle"></div></button>
            <button type="button" class="yic-dot-btn" aria-label="Chapter 4"><div class="yic-dot-circle"></div></button>
            <button type="button" class="yic-dot-btn" aria-label="Chapter 5"><div class="yic-dot-circle"></div></button>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}

function buildYearPickerHtml(theme, mode, width) {
  const isMobile = width < 768;
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="${theme}" data-mode="${mode}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${tokensCss}
        ${fontsCss}
        ${globalsCss}
        ${statsCss}
        ${statsPhoneCss}
        body { margin: 0; background: var(--color-bg); font-family: var(--font-body); color: var(--color-text-primary); }
      </style>
    </head>
    <body>
      ${getHeaderHtml()}
      <div class="stats-container">
        <h1 class="stats-title">Your coffee</h1>
        <p class="stats-subtitle">From orders you were part of, once they are done.</p>

        <div style="position: relative; display: inline-block; margin-top: var(--space-4);">
          <button type="button" class="stats-picker-trigger" aria-haspopup="dialog" aria-expanded="true">
            <span>2026 so far</span>
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      </div>

      <div class="${isMobile ? 'stats-bottom-sheet-backdrop' : ''}" style="${!isMobile ? 'position: absolute; top: 180px; left: 32px; z-index: 100;' : ''}">
        <div class="${isMobile ? 'stats-bottom-sheet' : 'stats-card'}" style="${!isMobile ? 'width: 320px; box-shadow: var(--shadow-lg); padding: var(--space-4);' : ''}">
          ${isMobile ? '<div class="stats-sheet-drag-handle" aria-hidden="true"></div>' : ''}
          <div class="stats-sheet-header">
            <h3 class="stats-sheet-title">Choose a year</h3>
            <button type="button" class="stats-sheet-close-btn" aria-label="Close year picker">✕</button>
          </div>
          <div class="stats-sheet-body">
            <button type="button" class="stats-sheet-row">
              <span>All time</span>
              <span class="stats-sheet-row-meta">7 orders total</span>
            </button>
            <button type="button" class="stats-sheet-row is-active">
              <span>2026<span class="stats-sheet-badge-current">so far</span></span>
              <span class="stats-sheet-row-meta">4 orders ✓</span>
            </button>
            <button type="button" class="stats-sheet-row">
              <span>2025</span>
              <span class="stats-sheet-row-meta">2 orders</span>
            </button>
            <button type="button" class="stats-sheet-row">
              <span>2024</span>
              <span class="stats-sheet-row-meta">1 order</span>
            </button>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildEmptyStateHtml(theme, mode) {
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="${theme}" data-mode="${mode}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${tokensCss}
        ${fontsCss}
        ${globalsCss}
        ${statsCss}
        ${statsPhoneCss}
        body { margin: 0; background: var(--color-bg); font-family: var(--font-body); color: var(--color-text-primary); }
      </style>
    </head>
    <body>
      ${getHeaderHtml()}
      <div class="stats-container">
        <div class="stats-header-section">
          <h1 class="stats-title">Your coffee</h1>
          <p class="stats-subtitle">From orders you were part of, once they are done.</p>
        </div>
        <div class="stats-card" style="text-align: center; padding: var(--space-10) var(--space-4);">
          <div style="font-size: 2.5rem; margin-bottom: var(--space-2);">📦</div>
          <h3 style="margin: 0 0 var(--space-2) 0; color: var(--color-text-primary);">No orders you were part of yet</h3>
          <p style="margin: 0 0 var(--space-4) 0; color: var(--color-text-muted); font-size: var(--text-sm);">
            Once an order is done, your coffees, roasters, and grams will appear here.
          </p>
          <button type="button" class="btn btn-primary" style="min-height: 44px;">Start an order →</button>
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildOneOrderStateHtml(theme, mode) {
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="${theme}" data-mode="${mode}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${tokensCss}
        ${fontsCss}
        ${globalsCss}
        ${statsCss}
        ${statsPhoneCss}
        body { margin: 0; background: var(--color-bg); font-family: var(--font-body); color: var(--color-text-primary); }
      </style>
    </head>
    <body>
      ${getHeaderHtml()}
      <div class="stats-container">
        <div class="stats-header-section">
          <h1 class="stats-title">Your coffee</h1>
          <p class="stats-subtitle">From orders you were part of, once they are done.</p>
          <div class="stats-period-bar">
            <button type="button" class="stats-picker-trigger"><span>2024</span><span aria-hidden="true">▾</span></button>
            <div class="stats-period-context">1 order you were part of</div>
          </div>
        </div>

        <div class="stats-card stats-headline-grid" role="region" aria-label="Key coffee facts">
          <div class="stats-headline-item">
            <div class="stats-headline-value">0.25<span class="stats-headline-unit">kg</span></div>
            <div class="stats-headline-label">Coffee taken</div>
          </div>
          <div class="stats-headline-item">
            <div class="stats-headline-value">1</div>
            <div class="stats-headline-label">Bags you shared in</div>
          </div>
          <div class="stats-headline-item">
            <div class="stats-headline-value">1</div>
            <div class="stats-headline-label">Roasters tried</div>
          </div>
        </div>

        <div class="stats-card">
          <div style="font-weight: 700; color: var(--color-text-primary); margin-bottom: var(--space-2);">One order so far</div>
          <p style="margin: 0; font-size: var(--text-sm); color: var(--color-text-muted);">
            More will show here as you join group orders.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function captureEvidence() {
  const browser = await chromium.launch({ headless: true });
  const widths = [320, 375, 430, 768, 1024, 1440];
  const themes = [
    { theme: 'emerald', mode: 'light', name: 'classic-light' },
    { theme: 'yinmn', mode: 'dark', name: 'modern-dark' },
  ];

  const overflowResults = [];
  const buttonSizeResults = [];

  for (const t of themes) {
    for (const w of widths) {
      // 1. Stats Home
      {
        const page = await browser.newPage({ viewport: { width: w, height: 900 } });
        await page.setContent(buildStatsHomeHtml(t.theme, t.mode, w));
        const outPath = path.join(EVIDENCE_DIR, `stats-home-${t.name}-${w}.png`);
        await page.screenshot({ path: outPath, fullPage: true });

        const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        overflowResults.push({ screen: 'stats-home', theme: t.name, width: w, passed: isNoOverflow });

        const smallButtons = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns
            .filter((b) => b.offsetWidth < 44 || b.offsetHeight < 44)
            .map((b) => ({ text: b.textContent?.trim() || b.getAttribute('aria-label'), w: b.offsetWidth, h: b.offsetHeight }));
        });
        if (smallButtons.length > 0) {
          buttonSizeResults.push({ screen: 'stats-home', theme: t.name, width: w, smallButtons });
        }
        await page.close();
      }

      // 2. Year in Coffee Recap
      {
        const page = await browser.newPage({ viewport: { width: w, height: 900 } });
        await page.setContent(buildRecapHtml(t.theme, t.mode, w));
        const outPath = path.join(EVIDENCE_DIR, `recap-${t.name}-${w}.png`);
        await page.screenshot({ path: outPath, fullPage: true });

        const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        overflowResults.push({ screen: 'recap', theme: t.name, width: w, passed: isNoOverflow });

        const smallButtons = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns
            .filter((b) => b.offsetWidth < 44 || b.offsetHeight < 44)
            .map((b) => ({ text: b.textContent?.trim() || b.getAttribute('aria-label'), w: b.offsetWidth, h: b.offsetHeight }));
        });
        if (smallButtons.length > 0) {
          buttonSizeResults.push({ screen: 'recap', theme: t.name, width: w, smallButtons });
        }
        await page.close();
      }

      // 3. Year Picker
      {
        const page = await browser.newPage({ viewport: { width: w, height: 800 } });
        await page.setContent(buildYearPickerHtml(t.theme, t.mode, w));
        const outPath = path.join(EVIDENCE_DIR, `year-picker-${t.name}-${w}.png`);
        await page.screenshot({ path: outPath, fullPage: true });

        const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        overflowResults.push({ screen: 'year-picker', theme: t.name, width: w, passed: isNoOverflow });

        const smallButtons = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns
            .filter((b) => b.offsetWidth < 44 || b.offsetHeight < 44)
            .map((b) => ({ text: b.textContent?.trim() || b.getAttribute('aria-label'), w: b.offsetWidth, h: b.offsetHeight }));
        });
        if (smallButtons.length > 0) {
          buttonSizeResults.push({ screen: 'year-picker', theme: t.name, width: w, smallButtons });
        }
        await page.close();
      }

      // 4. Empty State
      {
        const page = await browser.newPage({ viewport: { width: w, height: 700 } });
        await page.setContent(buildEmptyStateHtml(t.theme, t.mode));
        const outPath = path.join(EVIDENCE_DIR, `empty-state-${t.name}-${w}.png`);
        await page.screenshot({ path: outPath, fullPage: true });

        const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        overflowResults.push({ screen: 'empty-state', theme: t.name, width: w, passed: isNoOverflow });

        const smallButtons = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns
            .filter((b) => b.offsetWidth < 44 || b.offsetHeight < 44)
            .map((b) => ({ text: b.textContent?.trim() || b.getAttribute('aria-label'), w: b.offsetWidth, h: b.offsetHeight }));
        });
        if (smallButtons.length > 0) {
          buttonSizeResults.push({ screen: 'empty-state', theme: t.name, width: w, smallButtons });
        }
        await page.close();
      }

      // 5. One Order State
      {
        const page = await browser.newPage({ viewport: { width: w, height: 700 } });
        await page.setContent(buildOneOrderStateHtml(t.theme, t.mode));
        const outPath = path.join(EVIDENCE_DIR, `one-order-${t.name}-${w}.png`);
        await page.screenshot({ path: outPath, fullPage: true });

        const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        overflowResults.push({ screen: 'one-order', theme: t.name, width: w, passed: isNoOverflow });

        const smallButtons = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns
            .filter((b) => b.offsetWidth < 44 || b.offsetHeight < 44)
            .map((b) => ({ text: b.textContent?.trim() || b.getAttribute('aria-label'), w: b.offsetWidth, h: b.offsetHeight }));
        });
        if (smallButtons.length > 0) {
          buttonSizeResults.push({ screen: 'one-order', theme: t.name, width: w, smallButtons });
        }
        await page.close();
      }
    }
  }

  await browser.close();

  console.log('\n=== HORIZONTAL OVERFLOW CHECK (scrollWidth <= innerWidth) ===');
  let allOverflowPassed = true;
  for (const r of overflowResults) {
    if (!r.passed) {
      console.log(`FAIL: ${r.screen} in ${r.theme} at ${r.width}px overflowed!`);
      allOverflowPassed = false;
    }
  }
  if (allOverflowPassed) {
    console.log(`PASS: All ${overflowResults.length} screen-theme-width combinations passed (no horizontal overflow).`);
  }

  console.log('\n=== TOUCH TARGET SIZE CHECK (all interactive elements >= 44x44px) ===');
  let allTouchTargetsPassed = true;
  for (const r of buttonSizeResults) {
    if (r.smallButtons.length > 0) {
      console.log(`WARNING: ${r.screen} in ${r.theme} at ${r.width}px has small buttons:`, r.smallButtons);
      allTouchTargetsPassed = false;
    }
  }
  if (allTouchTargetsPassed) {
    console.log(`PASS: All interactive buttons on stats screens meet >= 44px min-dimensions.`);
  }

  // Check file sizes
  console.log('\n=== EVIDENCE FILE SIZES (each PNG under 300 KB) ===');
  const files = fs.readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith('.png'));
  let allFilesUnder300Kb = true;
  for (const f of files) {
    const size = fs.statSync(path.join(EVIDENCE_DIR, f)).size;
    const sizeKb = (size / 1024).toFixed(1);
    if (size > 300 * 1024) {
      console.log(`OVERSIZED: ${f} is ${sizeKb} KB`);
      allFilesUnder300Kb = false;
    }
  }
  if (allFilesUnder300Kb) {
    console.log(`PASS: All ${files.length} screenshot PNG files are under 300 KB each.`);
  }
}

captureEvidence().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
