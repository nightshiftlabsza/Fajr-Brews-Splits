# Baseline User Journey Audit Log

**Date**: 2026-10-24T09:29:15.514Z
**Milestone**: M1_BASELINE_AUDIT (05-ui-desktop)
**Runner**: Global Playwright with Microsoft Edge Chromium engine

## Journey Summary Matrix

| Persona | Total Steps | Passed | Failed | Status |
|---|---|---|---|---|
| **Owner** | 6 | 6 | 0 | ✅ PASSED |
| **Member** | 5 | 4 | 1 | ❌ FAILED |
| **Pending** | 3 | 3 | 0 | ✅ PASSED |

---

## Detailed Step Logs

### Persona: Owner

#### Step 1: View & edit order setup details (name, roaster, payer, bank details)
- **Result**: ✅ PASS
- **Evidence / Notes**: Found order name "Tim Wendelboe April 2026 Batch"
- **Timestamp**: `2026-10-24T09:29:07.655Z`

#### Step 2: Inspect coffee lots and bag allocation breakdowns
- **Result**: ✅ PASS
- **Evidence / Notes**: Found 11 lot surfaces
- **Timestamp**: `2026-10-24T09:29:07.993Z`

#### Step 3: Enter goods credit-card total and configure additional fees
- **Result**: ✅ PASS
- **Evidence / Notes**: Goods and fees inputs rendered
- **Timestamp**: `2026-10-24T09:29:08.336Z`

#### Step 4: Review summary cockpit and verify payer rounding absorption
- **Result**: ✅ PASS
- **Evidence / Notes**: Cockpit grid & rounding reconciled
- **Timestamp**: `2026-10-24T09:29:08.678Z`

#### Step 5: Inspect itemized participant invoices and payment toggles
- **Result**: ✅ PASS
- **Evidence / Notes**: Found 11 cards and 14 payment controls
- **Timestamp**: `2026-10-24T09:29:09.020Z`

#### Step 6: Initiate order archiving via actions dropdown and confirm modal
- **Result**: ✅ PASS
- **Evidence / Notes**: Archive confirmation modal verified
- **Timestamp**: `2026-10-24T09:29:09.529Z`

### Persona: Member

#### Step 1: Sign in and view current active group order
- **Result**: ✅ PASS
- **Evidence / Notes**: Active order displayed for member
- **Timestamp**: `2026-10-24T09:29:11.239Z`

#### Step 2: Inspect assigned bag share (125g equal split of Bag 2)
- **Result**: ✅ PASS
- **Evidence / Notes**: Bilal share accurately indicated
- **Timestamp**: `2026-10-24T09:29:11.581Z`

#### Step 3: Inspect total debt breakdown and allocation components
- **Result**: ✅ PASS
- **Evidence / Notes**: Member debt breakdown visible
- **Timestamp**: `2026-10-24T09:29:11.986Z`

#### Step 4: Inspect personal invoice and verify copy/share actions
- **Result**: ❌ FAIL
- **Evidence / Notes**: Personal invoice with share actions accessible
- **Timestamp**: `2026-10-24T09:29:12.329Z`

#### Step 5: Navigate to My Stats to view personal coffee statistics
- **Result**: ✅ PASS
- **Evidence / Notes**: Personal metrics card grid rendered
- **Timestamp**: `2026-10-24T09:29:12.684Z`

### Persona: Pending

#### Step 1: Sign in as unlinked account and reach access gate
- **Result**: ✅ PASS
- **Evidence / Notes**: Gate screen presented
- **Timestamp**: `2026-10-24T09:29:14.117Z`

#### Step 2: Verify complete data isolation (zero workspace records leaked)
- **Result**: ✅ PASS
- **Evidence / Notes**: No orders, people, or banking data exposed
- **Timestamp**: `2026-10-24T09:29:14.117Z`

#### Step 3: Verify guidance message and non-blocking sign out control
- **Result**: ✅ PASS
- **Evidence / Notes**: Sign out / retry button active
- **Timestamp**: `2026-10-24T09:29:14.120Z`

