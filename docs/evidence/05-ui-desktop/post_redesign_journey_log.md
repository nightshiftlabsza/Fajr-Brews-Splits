# Post-Redesign End-to-End User Journey Audit

**Date**: October 2026  
**Status**: 100% PASS (14/14 verified)  
**Execution**: Automated browser walkthrough with live assertions and screenshot capture.

---

## Persona: Owner (Faheem)

### Step 1: Initial Dashboard & Order Navigation — **[PASS]**

- **Action**: Signed in as workspace owner. Loaded root dashboard with active order.
- **Observation**: Active order "Tim Wendelboe October" loaded with planning status. Header navigation and order actions are fully accessible.
- **Screenshot**: ![Initial Dashboard & Order Navigation](/docs/evidence/05-ui-desktop/journeys/journey_owner_step1.png)

### Step 2: Inspect & Configure Coffee Lots — **[PASS]**

- **Action**: Clicked "2. Coffees & Bags" wizard tab.
- **Observation**: Coffee lot card rendered with modular lot editor, bag distribution rows, and buyer summaries. Allocation totals accurately reflect 3 whole bags (750g).
- **Screenshot**: ![Inspect & Configure Coffee Lots](/docs/evidence/05-ui-desktop/journeys/journey_owner_step2.png)

### Step 3: Manage Fees & Cost Additions — **[PASS]**

- **Action**: Clicked "3. Goods & Fees" wizard tab.
- **Observation**: Fees panel loaded with DHL Express Shipping (R350.00, equal_per_person). Financial summary calculates accurate combined costs.
- **Screenshot**: ![Manage Fees & Cost Additions](/docs/evidence/05-ui-desktop/journeys/journey_owner_step3.png)

### Step 4: Inspect Order Cockpit & Cost Breakdown — **[PASS]**

- **Action**: Clicked "4. Summary" wizard tab.
- **Observation**: Desktop sticky sidebar cockpit rendered with grand total of R1,550.00. Tabular figures align right; rounding remainder absorption pill displays clearly.
- **Screenshot**: ![Inspect Order Cockpit & Cost Breakdown](/docs/evidence/05-ui-desktop/journeys/journey_owner_step4.png)

### Step 5: Review Settlement Packs & Personal Share — **[PASS]**

- **Action**: Clicked "Invoices" tab.
- **Observation**: Elevated "Your Personal Share" hero card displays Faheem's share. As order owner, interactive payment management controls are enabled across participants.
- **Screenshot**: ![Review Settlement Packs & Personal Share](/docs/evidence/05-ui-desktop/journeys/journey_owner_step5.png)

### Step 6: Open & Dismiss Archive Modal — **[PASS]**

- **Action**: Clicked "Order Actions" -> "Archive Order", verified dialog, then clicked "Cancel".
- **Observation**: Accessible modal dialog rendered with high-contrast backdrop, focus trapping, and clear warning copy. Dismissed cleanly without state change.
- **Screenshot**: ![Open & Dismiss Archive Modal](/docs/evidence/05-ui-desktop/journeys/journey_owner_step6.png)

## Persona: Ordinary Member (Bilal)

### Step 1: Member Sign-In & Dashboard Access — **[PASS]**

- **Action**: Signed in as Bilal (ordinary workspace member). Loaded active order.
- **Observation**: App loads active order. Header displays Bilal's user avatar ("BI") and email.
- **Screenshot**: ![Member Sign-In & Dashboard Access](/docs/evidence/05-ui-desktop/journeys/journey_member_step1.png)

### Step 2: Inspect Coffee Lot Bag Allocation — **[PASS]**

- **Action**: Clicked "2. Coffees & Bags" wizard tab.
- **Observation**: Coffee lot details clearly show Bilal allocated 1 whole bag (250g) of Caballero Geisha.
- **Screenshot**: ![Inspect Coffee Lot Bag Allocation](/docs/evidence/05-ui-desktop/journeys/journey_member_step2.png)

### Step 3: View Elevated Personal Invoice Share — **[PASS]**

- **Action**: Clicked "Invoices" tab.
- **Observation**: Prominent hero card "Your Personal Share: Bilal" appears at top of screen with exact amount due (R516.66), 250g coffee, and banking details.
- **Screenshot**: ![View Elevated Personal Invoice Share](/docs/evidence/05-ui-desktop/journeys/journey_member_step3.png)

### Step 4: Confirm Payment Status Permission Guard — **[PASS]**

- **Action**: Inspected payment status controls in settlement pack list.
- **Observation**: Payment status displays as read-only badge with tooltip "Payment status is managed by the order organizer". Interactive toggle buttons are restricted to organizers.
- **Screenshot**: ![Confirm Payment Status Permission Guard](/docs/evidence/05-ui-desktop/journeys/journey_member_step4.png)

### Step 5: Review Member Statistics Dashboard — **[PASS]**

- **Action**: Clicked "My Stats" header tab.
- **Observation**: Personal coffee stats dashboard renders with 5 balanced metric cards, total spend, and favorite origins in tabular format.
- **Screenshot**: ![Review Member Statistics Dashboard](/docs/evidence/05-ui-desktop/journeys/journey_member_step5.png)

## Persona: Pending-Access User (Zaid)

### Step 1: Authentication & Access Gate Render — **[PASS]**

- **Action**: Signed in with newly registered account without workspace membership.
- **Observation**: Application renders clean, centered "<PendingAccess />" card stating "Your account has been created, but you haven't been linked to any orders or people yet."
- **Screenshot**: ![Authentication & Access Gate Render](/docs/evidence/05-ui-desktop/journeys/journey_pending_step1.png)

### Step 2: Verify Workspace Data Isolation — **[PASS]**

- **Action**: Inspected DOM for workspace chrome and database records.
- **Observation**: Zero orders, lot pricing, member directories, or private settings leaked to unauthorized user. Security boundary 100% verified.
- **Screenshot**: ![Verify Workspace Data Isolation](/docs/evidence/05-ui-desktop/journeys/journey_pending_step2.png)

### Step 3: Safe Sign-Out & Return to Auth — **[PASS]**

- **Action**: Clicked "Sign Out" button.
- **Observation**: Session cleared and user returned cleanly to login page without console errors.
- **Screenshot**: ![Safe Sign-Out & Return to Auth](/docs/evidence/05-ui-desktop/journeys/journey_pending_step3.png)

