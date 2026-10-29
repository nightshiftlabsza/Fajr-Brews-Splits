# Security Headers Guide

This document describes the HTTP security headers configured for Fajr Brews Splits on Cloudflare Pages (`public/_headers`), how to switch the Content Security Policy (CSP) from report-only to enforcing, and the testing checklist to run before enforcing.

## Summary of Headers

| Header | Value | Purpose |
| :--- | :--- | :--- |
| `X-Content-Type-Options` | `nosniff` | Prevents the browser from MIME-type sniffing responses away from declared Content-Type (e.g. executing user-supplied images or text as script/HTML). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends full URL on same-origin requests, only origin (no path/query) on cross-origin requests, and no referrer when downgrading from HTTPS to HTTP. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Explicitly disables access to sensitive browser device features (camera, microphone, geolocation) that this app does not use. |
| `X-Frame-Options` | `DENY` | Prevents the application from being embedded in frames/iframes, protecting against clickjacking. |
| `Content-Security-Policy-Report-Only` | (See policy breakdown below) | Reports CSP policy violations to the browser console and reporting endpoints without blocking resource loading or breaking user workflows. |
| `Cache-Control` (`/assets/*`) | `public, max-age=31536000, immutable` | Enables 1-year immutable caching for Vite's content-hashed JavaScript, CSS, and font chunks. `index.html` remains un-cached to ensure instant updates. |

---

## Content Security Policy (CSP) Breakdown

The CSP is configured as:
```http
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
```

### Directives Explained:
- **`default-src 'self'`**: Sets fallback to own origin only.
- **`script-src 'self'`**: Only executes scripts bundled and served from the application's own origin (`/assets/*`). No external CDNs or unapproved third-party scripts.
- **`style-src 'self' 'unsafe-inline'`**: Allows stylesheets from own origin, plus inline `style` attributes used by React component dynamic styling and theme variables.
- **`img-src 'self' data: blob: https://*.supabase.co https://[PROJECT_REF].supabase.co`**:
  - `'self'`: local icons and SVG assets (like `/favicon.svg`).
  - `data:`: inline SVG graphics, status chips, and icons.
  - `blob:`: temporary object URLs used for PDF preview and logo upload previews.
  - `https://*.supabase.co` (and project URL placeholder): roaster logos served from Supabase Storage (`roaster-logos` bucket).
- **`font-src 'self'`**: Fonts are strictly self-hosted in `/assets/` (Manrope, Fraunces, Hanken Grotesk). No requests to `fonts.googleapis.com` or `fonts.gstatic.com`.
- **`connect-src 'self' https://*.supabase.co wss://*.supabase.co https://[PROJECT_REF].supabase.co wss://[PROJECT_REF].supabase.co`**:
  - `https://*.supabase.co`: Supabase REST API, Auth, and Storage.
  - `wss://*.supabase.co`: Supabase Realtime WebSocket connections.
- **`frame-ancestors 'none'`**: Modern CSP equivalent of `X-Frame-Options: DENY`; forbids framing by any parent.
- **`base-uri 'self'`**: Restricts allowed values for `<base href="...">` to prevent base-tag hijacking.
- **`form-action 'self'`**: Restricts form submit targets to same-origin.

---

## How to Switch CSP to Enforcing

Once in production and verified with zero violation reports:

1. In `public/_headers`, replace:
   ```http
   Content-Security-Policy-Report-Only: ...
   ```
   with:
   ```http
   Content-Security-Policy: ...
   ```
2. In `vite.config.ts` (if preview testing is used), update the header key from `'Content-Security-Policy-Report-Only'` to `'Content-Security-Policy'`.
3. Fill in the exact Supabase project reference if replacing the wildcard `https://*.supabase.co`.
4. Deploy to Cloudflare Pages and monitor browser console / reporting endpoint.

---

## What to Test First Before Enforcing

Before switching to enforcing mode, verify all critical user workflows:

1. **Order Wizard Steps**:
   - Step 1 (Setup): Roaster selection and currency selection (`RoasterCurrencyField`).
   - Step 2 (Coffees): Coffee lots list, bag allocation modal / drawer (`BagAssignPanel`).
   - Step 3 (Goods & Fees): Entering goods total and custom fees.
   - Step 4 (Summary): Checking totals reconciliation and cost breakdown.
   - Step 5 (Invoices): Generating individual and order invoices.
2. **PDF Generation & Download**:
   - Click "Download PDF" on an invoice: verify jsPDF generates the document and the browser triggers download without CSP violation reports on `blob:` URLs.
3. **Roaster Logo Upload**:
   - Open RoasterPicker -> "Add roaster" -> pick a PNG, JPG, or WEBP logo under 5 MB.
   - Verify file preview displays and no CSP violation occurs.
4. **History & Settings**:
   - History page: view past orders, switch order filters.
   - Settings page: switch theme (Emerald / YInMn), toggle mode (Light / Dark / System), test backup Export and Import.
5. **Viewports**:
   - Check both desktop (1280px+) and mobile phone viewport (390px - 412px).
