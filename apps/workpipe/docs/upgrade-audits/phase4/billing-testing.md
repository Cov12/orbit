# Billing & Stripe Testing - Next.js 15 Upgrade

**Date:** December 4, 2025
**Tester:** [Your Name]
**Priority:** 🚨 CRITICAL
**Feature:** Stripe Integration & Billing

## Test Overview

Billing/Stripe integration involves:

- Subscription checkout flow
- Webhook processing (headers() API - CRITICAL for Next.js 15)
- Payment processing
- Subscription management
- Customer portal

**CRITICAL NOTE:** Stripe webhook uses `headers()` from Next.js which changed in Next.js 15. This is a high-risk area that we specifically updated.

---

## Test 1: Subscription Checkout Flow

**Priority:** 🚨 CRITICAL
**Time Estimate:** 15-20 minutes

### Prerequisites

- Signed in as business owner
- Stripe test mode enabled
- Have Stripe test card ready: `4242 4242 4242 4242`

### Test Steps - Initiating Checkout

1. **Navigate to Billing Page**
   - [ ] From dashboard, go to Billing/Subscription page
   - [ ] URL should be: `/business/[businessId]/billing`
   - [ ] **Check:** Page loads without errors
   - [ ] **Check:** Current subscription status displays (if any)

2. **View Available Plans**
   - [ ] **Check:** Pricing cards/plans display
   - [ ] **Check:** Plan features listed
   - [ ] **Check:** Prices display correctly
   - [ ] **Check:** "Subscribe" or "Upgrade" buttons visible

3. **Select Plan**
   - [ ] Click "Subscribe" on a plan (use test plan if available)
   - [ ] **Check:** Button state changes (loading indicator)
   - [ ] **Check:** No console errors

### Test Steps - Stripe Checkout

4. **Stripe Checkout Redirect**
   - [ ] **Check:** Redirects to Stripe Checkout page
   - [ ] **Check:** Stripe Checkout loads correctly
   - [ ] **Check:** Correct plan selected
   - [ ] **Check:** Price matches selected plan
   - [ ] **Check:** Customer email pre-filled (if applicable)

5. **Fill Payment Information**
   - [ ] Enter email (if not pre-filled): `test@example.com`
   - [ ] Enter card number: `4242 4242 4242 4242`
   - [ ] Enter expiry: Any future date (e.g., `12/25`)
   - [ ] Enter CVC: Any 3 digits (e.g., `123`)
   - [ ] Enter billing zip: `12345`
   - [ ] **Check:** All fields accept input
   - [ ] **Check:** No validation errors on valid data

6. **Complete Payment**
   - [ ] Click "Subscribe" or "Pay" button
   - [ ] **Check:** Processing indicator appears
   - [ ] Wait for completion (may take 5-10 seconds)
   - [ ] **Check:** No timeout errors

### Test Steps - Post-Checkout

7. **Return to Application**
   - [ ] **Check:** Redirects back to application
   - [ ] **Check:** Success page or message displays
   - [ ] **Check:** URL is correct (success callback URL)
   - [ ] **Check:** No console errors

8. **Verify Subscription Active**
   - [ ] Navigate to billing page
   - [ ] **Check:** Subscription status shows "Active"
   - [ ] **Check:** Current plan displays correctly
   - [ ] **Check:** Next billing date shown (if applicable)
   - [ ] **Check:** "Manage Subscription" button visible

### Expected Results

- ✅ Can navigate to billing page
- ✅ Plans display correctly
- ✅ Stripe Checkout loads and works
- ✅ Payment processes successfully
- ✅ Redirects back to app correctly
- ✅ Subscription status updates

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

**Payment Completion Time:** \_\_\_ seconds

**Notes:**

```

```

**Console Errors:**

```

```

---

## Test 2: Stripe Webhook Processing (CRITICAL)

**Priority:** 🚨 CRITICAL - HIGHEST RISK
**Time Estimate:** 20-30 minutes

### CRITICAL IMPORTANCE

The Stripe webhook handler at `src/app/api/stripe/webhook/route.ts` uses `headers()` which we updated for Next.js 15. This test verifies the update worked correctly.

### Prerequisites

- Stripe CLI installed (`stripe` command available)
- Terminal access
- Development server running

### Test Steps - Setup Webhook Listener

1. **Start Stripe Webhook Listener**
   - [ ] Open new terminal window
   - [ ] Run command:
     ```bash
     stripe listen --forward-to http://localhost:3000/api/stripe/webhook
     ```
   - [ ] **Check:** Listener starts successfully
   - [ ] **Check:** Webhook signing secret displayed
   - [ ] **Check:** "Ready!" message appears
   - [ ] Copy webhook signing secret for reference

2. **Verify Webhook Endpoint Accessible**
   - [ ] In browser, check if endpoint is public
   - [ ] URL: `http://localhost:3000/api/stripe/webhook`
   - [ ] **Check:** Endpoint exists (may show error, that's OK)
   - [ ] **Check:** Not blocked by auth (should be public)

### Test Steps - Trigger Test Webhooks

3. **Trigger checkout.session.completed Event**
   - [ ] In new terminal, run:
     ```bash
     stripe trigger checkout.session.completed
     ```
   - [ ] **Check:** Event sent message appears
   - [ ] **Check:** Listener shows event received
   - [ ] Look for logs in application console
   - [ ] **Check:** Webhook handler executes

4. **Check Webhook Handler Logs**
   - [ ] In application server console, look for logs:
     - `CREATED FROM WEBHOOK 💳` or similar
   - [ ] **Check:** No error messages in logs
   - [ ] **Check:** Headers extracted successfully
   - [ ] **Check:** Signature verification passed
   - [ ] **Check:** Event processed

5. **Trigger customer.subscription.created**
   - [ ] Run:
     ```bash
     stripe trigger customer.subscription.created
     ```
   - [ ] **Check:** Event received
   - [ ] Check application logs
   - [ ] **Check:** Event processed correctly

6. **Trigger customer.subscription.updated**
   - [ ] Run:
     ```bash
     stripe trigger customer.subscription.updated
     ```
   - [ ] **Check:** Event received
   - [ ] Check application logs
   - [ ] **Check:** Event processed correctly

### Test Steps - Verify headers() Working

7. **Check Signature Verification**
   - [ ] Look at webhook listener output
   - [ ] Look for any signature errors
   - [ ] **CHECK CRITICAL:** No "stripe-signature header missing" errors
   - [ ] **CHECK CRITICAL:** No "webhook verification failed" errors
   - [ ] **CHECK CRITICAL:** `headers()` call working (no "headers is not a function" errors)

8. **Verify Database Updates**
   - [ ] After triggering webhook events
   - [ ] Check database or admin panel
   - [ ] **Check:** Subscription data updated
   - [ ] **Check:** Customer data created/updated
   - [ ] **Check:** No duplicate records

### Test Steps - Real Checkout Webhook

9. **Complete Real Checkout and Monitor Webhook**
   - [ ] With webhook listener running
   - [ ] Complete a subscription checkout (Test 1)
   - [ ] Watch webhook listener terminal
   - [ ] **Check:** Real webhook events received:
     - `checkout.session.completed`
     - `customer.subscription.created` or `updated`
   - [ ] **Check:** All events process successfully
   - [ ] **Check:** No errors in webhook handler

### Test Steps - Error Scenarios

10. **Test Invalid Signature**
    - [ ] Send malformed webhook (optional, advanced)
    - Expected: Webhook rejected, 400 error
    - Actual:

11. **Test Missing Signature**
    - [ ] Send webhook without signature header
    - Expected: Webhook rejected
    - Actual:

### Expected Results

- ✅ Webhook listener connects successfully
- ✅ Can trigger test webhook events
- ✅ headers() API working in Next.js 15
- ✅ Stripe signature verification passes
- ✅ Events process correctly
- ✅ Database updates correctly
- ✅ Real checkout webhooks work

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

**Webhook Events Tested:**

- [ ] checkout.session.completed: PASS / FAIL
- [ ] customer.subscription.created: PASS / FAIL
- [ ] customer.subscription.updated: PASS / FAIL

**headers() API Status:**

- **Working in Next.js 15:** ✅ YES / ❌ NO
- **Signature extraction:** ✅ SUCCESS / ❌ FAIL

**Critical Errors:**

```

```

**Webhook Handler Logs:**

```
[Copy relevant logs showing webhook processing]
```

---

## Test 3: Subscription Management

**Priority:** ⚠️ HIGH
**Time Estimate:** 15 minutes

### Prerequisites

- Active subscription from Test 1

### Test Steps

1. **Access Customer Portal**
   - [ ] On billing page, click "Manage Subscription"
   - [ ] **Check:** Redirects to Stripe Customer Portal
   - [ ] **Check:** Customer Portal loads
   - [ ] **Check:** Current subscription shows correctly

2. **Update Payment Method**
   - [ ] In Customer Portal, click "Update payment method"
   - [ ] Enter new test card: `4000 0566 5566 5556`
   - [ ] Submit update
   - [ ] **Check:** Payment method updates
   - [ ] **Check:** Success message
   - [ ] Return to application
   - [ ] **Check:** Payment method updated (if visible)

3. **View Invoices**
   - [ ] In Customer Portal, view invoices
   - [ ] **Check:** Past invoices display
   - [ ] **Check:** Can download invoice PDF
   - [ ] **Check:** Invoice amounts correct

4. **Update Subscription (if supported)**
   - [ ] Try upgrading/downgrading plan
   - [ ] **Check:** Plan change option available
   - [ ] Complete plan change (or cancel if not testing)
   - [ ] **Check:** Webhook fires for subscription update
   - [ ] **Check:** Database updates

5. **Cancel Subscription (if testing)**
   - [ ] CAUTION: Only do this in test mode
   - [ ] Click "Cancel subscription"
   - [ ] Confirm cancellation
   - [ ] **Check:** Cancellation processes
   - [ ] **Check:** Webhook fires
   - [ ] Return to application
   - [ ] **Check:** Subscription shows "Cancelled" or "Ends on [date]"

### Expected Results

- ✅ Customer Portal accessible
- ✅ Can update payment method
- ✅ Can view invoices
- ✅ Plan changes work (if applicable)
- ✅ Cancellation works (if tested)

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Test 4: Usage Limits & Feature Access

**Priority:** ⚠️ HIGH
**Time Estimate:** 10 minutes

### Test Steps

1. **Verify Premium Features Unlocked**
   - [ ] After subscribing, access premium features
   - [ ] **Check:** Features are accessible
   - [ ] **Check:** No "upgrade" prompts on premium features

2. **Check Usage Limits (if applicable)**
   - [ ] View current usage (team members, subaccounts, etc.)
   - [ ] **Check:** Limits match subscription plan
   - [ ] Try to exceed limit
   - [ ] **Check:** Appropriate message if limit reached

3. **Test Subscription Expiry (if applicable)**
   - [ ] If testing expired subscription
   - [ ] **Check:** Premium features locked
   - [ ] **Check:** Appropriate prompts to renew

### Expected Results

- ✅ Premium features accessible with subscription
- ✅ Limits enforced correctly
- ✅ Expiry handled appropriately

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Test 5: Payment Error Scenarios

**Priority:** ⚠️ HIGH
**Time Estimate:** 15 minutes

### Test Steps - Declined Cards

1. **Test Declined Card**
   - [ ] Attempt checkout with: `4000 0000 0000 0002` (generic decline)
   - [ ] **Check:** Stripe shows decline error
   - [ ] **Check:** Error message displayed to user
   - [ ] **Check:** Can retry with different card
   - [ ] **Check:** No subscription created in database

2. **Test Insufficient Funds**
   - [ ] Use card: `4000 0000 0000 9995`
   - [ ] **Check:** Appropriate error shown
   - [ ] **Check:** Handled gracefully

3. **Test Card Expired**
   - [ ] Enter valid card with expired date (e.g., `12/20`)
   - [ ] **Check:** Validation error
   - [ ] **Check:** Cannot proceed

### Test Steps - Network Errors

4. **Test Checkout Timeout**
   - [ ] Start checkout, disconnect internet
   - [ ] **Check:** Timeout handled gracefully
   - [ ] **Check:** Can retry

5. **Test Webhook Delivery Failure**
   - [ ] Stop webhook listener during checkout
   - [ ] Complete checkout
   - [ ] **Check:** Payment succeeds
   - [ ] Note: Webhook will retry later (Stripe automatic retry)
   - [ ] Restart webhook listener
   - [ ] **Check:** Can manually trigger missed webhooks if needed

### Expected Results

- ✅ Declined payments handled properly
- ✅ Error messages clear to users
- ✅ Can retry failed payments
- ✅ No corrupt data from failed payments

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Test 6: Multi-Currency & Regional (if applicable)

**Priority:** 🔵 MEDIUM
**Time Estimate:** 10 minutes (skip if not applicable)

### Test Steps

1. **Test Different Currencies**
   - [ ] If supporting multiple currencies, test checkout in EUR, GBP, etc.
   - [ ] **Check:** Prices convert correctly
   - [ ] **Check:** Checkout works in all currencies

2. **Test Regional Cards**
   - [ ] Use test cards for different regions (if applicable)
   - [ ] **Check:** All supported regions work

### Expected Results

- ✅ Multiple currencies work (if supported)

### Actual Results

**Status:** ✅ PASS / ❌ FAIL / N/A

---

## Test 7: Stripe API Integration

**Priority:** ⚠️ HIGH
**Time Estimate:** 10 minutes

### Test Steps

1. **Verify API Calls**
   - [ ] During checkout, open DevTools → Network
   - [ ] **Check:** API calls to `/api/stripe/create-customer`
   - [ ] **Check:** API calls to `/api/stripe/create-subscription`
   - [ ] **Check:** All API calls succeed (200 status)

2. **Check Error Handling**
   - [ ] If API call fails, appropriate error shown
   - [ ] **Check:** No exposed sensitive data in errors
   - [ ] **Check:** User-friendly error messages

3. **Verify Stripe Dashboard**
   - [ ] Log in to Stripe Dashboard (test mode)
   - [ ] Go to Customers
   - [ ] **Check:** Test customer created
   - [ ] Go to Subscriptions
   - [ ] **Check:** Test subscription exists
   - [ ] **Check:** Subscription status correct
   - [ ] Go to Events
   - [ ] **Check:** Webhook events logged

### Expected Results

- ✅ All API calls working
- ✅ Data syncs to Stripe dashboard
- ✅ Events logged correctly

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Critical Security Checks

### Webhook Security

- [ ] **Signature verification enabled:** Webhooks verify Stripe signature
- [ ] **Webhook endpoint public:** Not blocked by auth middleware
- [ ] **Webhook endpoint secure:** Only processes valid Stripe events
- [ ] **No sensitive data in logs:** Webhook logs don't expose secrets

### Payment Security

- [ ] **PCI compliance:** No card data stored in application
- [ ] **Stripe.js used:** All card data sent directly to Stripe
- [ ] **No card data in logs:** No card numbers in application logs
- [ ] **HTTPS enforced:** All payment pages use HTTPS (in production)

---

## Next.js 15 Specific Checks

### Headers API Verification

- [ ] **headers() is async:** Webhook route uses `await headers()`
- [ ] **No deprecation warnings:** No console warnings about headers()
- [ ] **Signature extraction works:** `headersList.get('stripe-signature')` succeeds
- [ ] **Error handling:** Appropriate error if signature missing

### API Route Compatibility

- [ ] **Route exports working:** POST export recognized
- [ ] **Request handling:** `req: NextRequest` type working
- [ ] **Response returning:** `NextResponse.json()` working

### Public Route Configuration

- [ ] **Webhook in public routes:** `/api/stripe/webhook` in middleware public routes
- [ ] **Webhook accessible:** Can POST to webhook without auth
- [ ] **Other Stripe routes public:** `/api/stripe/create-subscription`, `/api/stripe/create-customer` if needed

---

## Edge Cases

### Test Edge Cases

1. **Rapid Repeated Checkouts**
   - [ ] Complete checkout twice in quick succession
   - Expected: Handle gracefully (prevent duplicate subscriptions)
   - Actual:

2. **Webhook Replay Attack**
   - [ ] Send same webhook event twice
   - Expected: Handled idempotently or rejected
   - Actual:

3. **Partial Checkout**
   - [ ] Start checkout, close browser before completing
   - Expected: No incomplete subscription created
   - Actual:

4. **Concurrent Subscriptions**
   - [ ] Try to subscribe to multiple plans simultaneously
   - Expected: Handle appropriately (last one wins or error)
   - Actual:

---

## Summary

### Billing/Stripe Status

- **Status:** ✅ PASS / ⚠️ ISSUES FOUND / ❌ FAIL

### Webhook Processing (CRITICAL)

- **Status:** ✅ FULLY WORKING / ❌ BROKEN
- **headers() API:** ✅ WORKING / ❌ FAILING

### Critical Issues Found

1.
2.
3.

### Stripe Integration Assessment

- **Checkout flow:** Working / Issues
- **Webhook processing:** Working / Issues
- **Subscription management:** Working / Issues
- **Error handling:** Good / Needs improvement

### Next.js 15 Compatibility

- **headers() async update:** ✅ SUCCESS / ❌ FAILED
- **Webhook route handler:** ✅ WORKING / ❌ BROKEN
- **Public route configuration:** ✅ CORRECT / ❌ NEEDS FIX

### Overall Assessment

- **Ready for production payments?** YES / NO / WITH FIXES
- **Blocker for deployment?** YES / NO
- **Financial risk if deployed?** LOW / MEDIUM / HIGH
- **Recommended actions:**

---

## Test Environment

- **Date:** December 4, 2025
- **Next.js Version:** 15.5.6
- **Stripe Node.js Library Version:** [check package.json]
- **Browser:**
- **Stripe Mode:** Test / Live
- **Stripe CLI Version:** [run `stripe --version`]
- **Test Cards Used:**
  - Success: 4242 4242 4242 4242
  - Decline: 4000 0000 0000 0002
  - Others:
