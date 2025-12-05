# Authentication Testing - Next.js 15 Upgrade

**Date:** December 4, 2025
**Tester:** [Your Name]
**Priority:** 🚨 CRITICAL

## Test Status

- ✅ Initial login tested and working
- [ ] New user registration
- [ ] New user invitation flow

---

## Test 1: New User Registration Flow

**Priority:** 🚨 CRITICAL
**Time Estimate:** 10-15 minutes
**Prerequisites:** None

### Test Steps

1. **Navigate to Registration**
   - [ ] Go to http://localhost:3000
   - [ ] Click "Sign Up" button
   - [ ] Verify redirect to `/business/sign-up`
   - [ ] Clerk sign-up form loads correctly

2. **Fill Registration Form**
   - [ ] Enter new email address (use a test email)
   - [ ] Enter password (min 8 characters)
   - [ ] Click "Sign Up" button
   - [ ] **Check:** No console errors

3. **Email Verification**
   - [ ] Check email inbox for verification code
   - [ ] Enter verification code in Clerk form
   - [ ] Click "Verify"
   - [ ] **Check:** Verification succeeds

4. **Initial Setup/Onboarding**
   - [ ] Verify redirect after verification
   - [ ] Check if onboarding form appears
   - [ ] Fill out any required profile information
   - [ ] **Check:** User can complete onboarding

5. **Dashboard Access**
   - [ ] Verify redirect to business dashboard
   - [ ] **Check:** Dashboard loads without errors
   - [ ] **Check:** User session persists (refresh page)
   - [ ] **Check:** User can navigate to different pages

6. **Sign Out and Back In**
   - [ ] Click user menu
   - [ ] Click "Sign Out"
   - [ ] **Check:** Redirect to sign-in page
   - [ ] Sign back in with new credentials
   - [ ] **Check:** Login succeeds
   - [ ] **Check:** User sees their data

### Expected Results

- ✅ User can register successfully
- ✅ Email verification works
- ✅ User is redirected to appropriate onboarding/dashboard
- ✅ Session persists correctly
- ✅ Sign out and sign in work

### Actual Results

**Status:** ✅ PASS / ⚠️ PARTIAL / ❌ FAIL

**Notes:**

```
[Document any issues, errors, or unexpected behavior]
```

**Console Errors:**

```
[Copy any console errors here]
```

**Screenshots:** [Attach if issues found]

---

## Test 2: New User Invitation Flow

**Priority:** 🚨 CRITICAL
**Time Estimate:** 15-20 minutes
**Prerequisites:** At least one business account with invite permissions

### Setup

- **Inviter:** Existing user with business admin role
- **Invitee:** New user email address (use a different test email)

### Test Steps - Part A: Sending Invitation

1. **Navigate to Team Management**
   - [ ] Sign in as existing business admin
   - [ ] Navigate to Team/Settings page
   - [ ] Find "Invite Team Member" section
   - [ ] **Check:** Invite button is visible

2. **Send Invitation**
   - [ ] Click "Invite Team Member" or similar
   - [ ] Enter invitee email address
   - [ ] Select role/permissions (if applicable)
   - [ ] Select subaccount access (if applicable)
   - [ ] Click "Send Invitation"
   - [ ] **Check:** Success message appears
   - [ ] **Check:** No console errors
   - [ ] **Check:** Invitation appears in pending list

3. **Verify Clerk Invitation Created**
   - [ ] Check browser console/network tab
   - [ ] Verify invitation API call succeeded
   - [ ] Note: Invitation should be visible in Clerk dashboard (optional check)

### Test Steps - Part B: Accepting Invitation

4. **Check Invitation Email**
   - [ ] Check invitee email inbox
   - [ ] **Check:** Invitation email received
   - [ ] **Check:** Email contains invitation link/instructions
   - [ ] Copy invitation link/code

5. **Accept Invitation**
   - [ ] Open invitation link in new browser/incognito window
   - [ ] **Check:** Redirects to Clerk sign-up page
   - [ ] Enter password for new account
   - [ ] Complete any required verification
   - [ ] **Check:** Account created successfully

6. **Verify Access**
   - [ ] After sign-up, verify redirect
   - [ ] **Check:** User is logged in
   - [ ] **Check:** User has access to assigned business/subaccount
   - [ ] **Check:** User sees correct role/permissions
   - [ ] **Check:** User cannot access areas they shouldn't

7. **Verify in Inviter Account**
   - [ ] Switch back to inviter account (original admin)
   - [ ] Navigate to team members list
   - [ ] **Check:** New user appears in team list
   - [ ] **Check:** Status shows "Active" (not pending)
   - [ ] **Check:** Assigned permissions are correct

### Test Steps - Part C: Permission Verification

8. **Test Invited User Permissions**
   - [ ] Sign in as invited user
   - [ ] Try to create content (if allowed)
   - [ ] **Check:** Allowed actions work
   - [ ] Try to access admin features (if not allowed)
   - [ ] **Check:** Restricted actions are blocked
   - [ ] Try to access different subaccounts
   - [ ] **Check:** Only assigned subaccounts are accessible

9. **Test Permission Changes**
   - [ ] As admin, update invited user's permissions
   - [ ] Save changes
   - [ ] As invited user, refresh page
   - [ ] **Check:** New permissions take effect

10. **Test User Removal**
    - [ ] As admin, remove invited user from team
    - [ ] Confirm removal
    - [ ] **Check:** User removed from list
    - [ ] As removed user, try to access business
    - [ ] **Check:** Access is revoked appropriately

### Expected Results

- ✅ Invitation sends successfully
- ✅ Invitee receives email
- ✅ Invitee can accept invitation and create account
- ✅ Invitee has correct access/permissions
- ✅ Permission changes propagate correctly
- ✅ User removal revokes access

### Actual Results

**Status:** ✅ PASS / ⚠️ PARTIAL / ❌ FAIL

**Notes:**

```
[Document the flow, any issues, or unexpected behavior]
```

**Console Errors:**

```
[Copy any console errors from both inviter and invitee sessions]
```

**Issues Found:**

1.
2.
3.

---

## Critical Scenarios to Test

### Edge Cases

#### Registration Edge Cases

- [ ] **Invalid email format:** Try registering with `notanemail`
  - Expected: Validation error
  - Actual:

- [ ] **Weak password:** Try password with < 8 characters
  - Expected: Validation error
  - Actual:

- [ ] **Duplicate email:** Try registering with existing email
  - Expected: Error message about existing account
  - Actual:

- [ ] **Network interruption:** Start registration, disconnect internet, try to continue
  - Expected: Graceful error handling
  - Actual:

#### Invitation Edge Cases

- [ ] **Invalid email in invitation:** Send invite to invalid email format
  - Expected: Validation error
  - Actual:

- [ ] **Duplicate invitation:** Send multiple invites to same email
  - Expected: Handle gracefully (show existing invite or send new one)
  - Actual:

- [ ] **Expired invitation:** Wait for invitation to expire (if applicable)
  - Expected: Show expired message, allow re-invite
  - Actual:

- [ ] **Invite to existing user:** Invite someone who already has an account
  - Expected: Handle appropriately (add to team, not create new account)
  - Actual:

---

## Security Checks

### Registration Security

- [ ] Password complexity enforced
- [ ] Email verification required
- [ ] No sensitive data in URLs
- [ ] CSRF protection working
- [ ] Rate limiting on registration attempts (if implemented)

### Invitation Security

- [ ] Invitation links are unique/one-time use (if applicable)
- [ ] Invitations have expiry (if applicable)
- [ ] Cannot invite to business you don't have access to
- [ ] Invitation acceptance requires verification
- [ ] Proper permission boundaries enforced

---

## Clerk v6 Specific Checks

### Middleware Verification

- [ ] Public routes accessible without auth:
  - `/site` pages
  - `/business/sign-in`
  - `/business/sign-up`
  - API webhooks (`/api/stripe/webhook`)

- [ ] Protected routes require auth:
  - `/business/[businessId]/*`
  - `/subaccount/[subaccountId]/*`

- [ ] Redirect behavior:
  - Unauthenticated user accessing protected route → redirects to sign-in
  - After sign-in → redirects to originally requested page (if applicable)

### Session Management

- [ ] Session persists across page refreshes
- [ ] Session persists across browser tabs
- [ ] Sign out clears session properly
- [ ] Session timeout works (if configured)

---

## Summary

### Registration Flow

- **Status:** ✅ PASS / ⚠️ ISSUES FOUND / ❌ FAIL
- **Critical Issues:**
- **Minor Issues:**
- **Performance:** Fast / Acceptable / Slow

### Invitation Flow

- **Status:** ✅ PASS / ⚠️ ISSUES FOUND / ❌ FAIL
- **Critical Issues:**
- **Minor Issues:**
- **Performance:** Fast / Acceptable / Slow

### Overall Authentication Assessment

- **Status:** 🟢 Ready / 🟡 Needs Fixes / 🔴 Blocking Issues
- **Next Steps:**
- **Blocker for deployment?** YES / NO

---

## Test Environment Details

- **Date:** December 4, 2025
- **Next.js Version:** 15.5.6
- **Clerk Version:** 6.35.5
- **Browser:**
- **OS:**
- **Database:** Connected
- **Email Provider:** [Clerk's email or custom]
