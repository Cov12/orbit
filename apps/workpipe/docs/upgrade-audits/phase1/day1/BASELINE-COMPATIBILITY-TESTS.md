# Baseline Compatibility Test Suite

**Date**: 2025-11-24
**Branch**: upgrade-nextj
**Purpose**: Establish functional baseline BEFORE upgrading to Next.js 15

## Overview

This document provides a comprehensive manual testing checklist to verify that all critical functionality works in the current state (Next.js 14.1.4).

**Complete these tests BEFORE any upgrades to establish a baseline.**

After the Next.js 15 upgrade, repeat these same tests to verify nothing broke.

## Pre-Test Setup

### Environment

- [ ] Application running: `npm run dev`
- [ ] Database connected and accessible
- [ ] `.env.local` configured with all required keys
- [ ] Clerk authentication configured
- [ ] Stripe keys configured (test mode)
- [ ] UploadThing configured

### Test User Accounts

Create test accounts with different roles:

- [ ] Business Owner account
- [ ] Business Admin account
- [ ] Subaccount User account
- [ ] Test business with subaccounts

---

## 1. Authentication & Authorization (Clerk)

### Sign Up Flow

- [ ] Navigate to `/business/sign-up`
- [ ] Create new account with email
- [ ] Verify email verification works
- [ ] Redirect to `/business` after sign-up
- [ ] User appears in Clerk dashboard

### Sign In Flow

- [ ] Navigate to `/business/sign-in`
- [ ] Sign in with existing credentials
- [ ] Redirect to `/business` after sign-in
- [ ] Session persists on page refresh
- [ ] User info displays correctly in UI

### Protected Routes

- [ ] Access `/business` without auth redirects to sign-in
- [ ] Access `/subaccount` without auth redirects to sign-in
- [ ] Signed-in users can access protected routes
- [ ] Sign out works and clears session

### Role-Based Access

- [ ] Business Owner can access all business routes
- [ ] Business Admin can access business settings
- [ ] Subaccount users have limited access
- [ ] Unauthorized access shows Unauthorized component

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 2. Business Management

### Create Business

- [ ] Navigate to business creation form
- [ ] Fill in all required fields (name, email, phone, address)
- [ ] Upload business logo (test image upload)
- [ ] Submit form
- [ ] Business created successfully
- [ ] Redirect to business dashboard
- [ ] Success toast appears

### View Business Dashboard

- [ ] Navigate to `/business/[businessId]`
- [ ] Dashboard loads without errors
- [ ] Business details display correctly
- [ ] Subaccount count shows correctly
- [ ] Business goal progress bar displays
- [ ] Charts render (even with no data)

### Update Business Settings

- [ ] Navigate to `/business/[businessId]/settings`
- [ ] Edit business name
- [ ] Upload new logo
- [ ] Update contact information
- [ ] Save changes
- [ ] Changes persist after page refresh
- [ ] Success toast appears

### Business Goal Tracking

- [ ] Set business goal for subaccounts
- [ ] Verify goal displays on dashboard
- [ ] Progress bar calculates correctly

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 3. Subaccount Management

### Create Subaccount

- [ ] Navigate to `/business/[businessId]/all-subaccounts`
- [ ] Click "Create Subaccount"
- [ ] Fill in subaccount details form
- [ ] Upload subaccount logo
- [ ] Submit form
- [ ] Subaccount created successfully
- [ ] Appears in subaccounts list
- [ ] Success toast appears

### View Subaccount Dashboard

- [ ] Navigate to `/subaccount/[subaccountId]`
- [ ] Dashboard loads without errors
- [ ] Subaccount details display
- [ ] Metrics display (income, conversions, etc.)
- [ ] Charts render correctly
- [ ] Funnel performance chart shows

### Update Subaccount Settings

- [ ] Navigate to `/subaccount/[subaccountId]/settings`
- [ ] Edit subaccount details
- [ ] Update logo
- [ ] Save changes
- [ ] Changes persist after refresh

### Subaccount Switcher

- [ ] Click subaccount dropdown in sidebar
- [ ] List of subaccounts appears
- [ ] Switch to different subaccount
- [ ] URL updates correctly
- [ ] Dashboard loads for new subaccount
- [ ] Sidebar updates with new subaccount context

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 4. Team Management & Invitations

### View Team

- [ ] Navigate to `/business/[businessId]/team`
- [ ] Team members table displays
- [ ] User avatars show correctly
- [ ] Roles display correctly
- [ ] Actions column works

### Send Invitation

- [ ] Click "Send Invitation"
- [ ] Fill in email and select role
- [ ] Submit invitation form
- [ ] Invitation sent successfully
- [ ] Success toast appears
- [ ] Invited user receives email

### Accept Invitation

- [ ] Click invitation link (in email)
- [ ] Redirected to sign-up/sign-in
- [ ] After auth, user added to business
- [ ] User has correct role assigned
- [ ] User can access business routes

### Update User Details

- [ ] Open user details form
- [ ] Update user name
- [ ] Change user role
- [ ] Update permissions
- [ ] Save changes
- [ ] Changes persist

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 5. CRM & Pipeline Management

### Create Pipeline

- [ ] Navigate to `/subaccount/[subaccountId]/pipelines`
- [ ] Click "Create Pipeline"
- [ ] Enter pipeline name
- [ ] Submit form
- [ ] Pipeline created successfully
- [ ] Appears in pipelines list

### Create Lane

- [ ] Open pipeline detail view
- [ ] Click "Create Lane"
- [ ] Enter lane name
- [ ] Submit form
- [ ] Lane added to pipeline
- [ ] Lane appears in correct order

### Create Ticket

- [ ] Click "Create Ticket" in a lane
- [ ] Fill in ticket details (name, description, value, customer)
- [ ] Submit form
- [ ] Ticket appears in lane
- [ ] Ticket details display correctly

### Drag & Drop Tickets

- [ ] Drag ticket between lanes
- [ ] Ticket moves successfully
- [ ] Drop animation works
- [ ] Ticket order updates
- [ ] Changes persist after refresh

### Pipeline Value Calculation

- [ ] Add multiple tickets with values
- [ ] Verify total pipeline value calculates correctly
- [ ] Check pipeline value component updates

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 6. Contact Management

### Create Contact

- [ ] Navigate to `/subaccount/[subaccountId]/contacts`
- [ ] Click "Create Contact"
- [ ] Fill in contact form (name, email, phone)
- [ ] Submit form
- [ ] Contact created successfully
- [ ] Appears in contacts list

### View Contact Details

- [ ] Click on contact in list
- [ ] Contact details display correctly
- [ ] Associated tickets show (if any)
- [ ] Activity history displays

### Update Contact

- [ ] Edit contact information
- [ ] Update email/phone
- [ ] Save changes
- [ ] Changes persist after refresh

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 7. Funnel Builder

### Create Funnel

- [ ] Navigate to `/subaccount/[subaccountId]/funnels`
- [ ] Click "Create Funnel"
- [ ] Fill in funnel name
- [ ] Enter subdomain name
- [ ] Upload favicon (optional)
- [ ] Submit form
- [ ] Funnel created successfully
- [ ] Appears in funnels list

### View Funnel Pages

- [ ] Click on funnel to view details
- [ ] Funnel pages list displays
- [ ] Funnel steps visualization shows
- [ ] Page visit counts display

### Create Funnel Page

- [ ] Click "Create Page"
- [ ] Enter page name
- [ ] Enter path name
- [ ] Submit form
- [ ] Page added to funnel
- [ ] Appears in funnel steps

### Open Funnel Editor

- [ ] Click on funnel page to edit
- [ ] Navigate to editor
- [ ] Editor loads without errors
- [ ] Sidebar shows component tabs
- [ ] Canvas area displays
- [ ] Layer tree displays

### Add Components in Editor

- [ ] Drag component from sidebar
- [ ] Drop on canvas
- [ ] Component renders on canvas
- [ ] Component appears in layers tree
- [ ] Select component shows properties

### Edit Component Properties

- [ ] Select text component
- [ ] Change text content
- [ ] Update font size/color
- [ ] Changes reflect on canvas
- [ ] Changes save automatically

### Preview Funnel

- [ ] Click preview/visit URL
- [ ] Funnel loads on custom domain
- [ ] URL format: `{scheme}{subdomain}.{domain}/{path}`
- [ ] Page renders correctly
- [ ] Navigation between pages works

### Funnel Performance Metrics

- [ ] Visit funnel pages multiple times
- [ ] Return to funnel dashboard
- [ ] Visit counts increment correctly
- [ ] Funnel performance chart updates

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 8. Media Library

### Upload Media

- [ ] Navigate to `/subaccount/[subaccountId]/media`
- [ ] Click "Upload Media"
- [ ] Select image file
- [ ] File uploads to UploadThing
- [ ] Upload progress shows
- [ ] Media appears in library
- [ ] Thumbnail generates correctly

### View Media Card

- [ ] Media card displays in grid
- [ ] Thumbnail shows correctly
- [ ] File name displays
- [ ] Created date shows
- [ ] Actions menu accessible

### Delete Media

- [ ] Click media actions menu
- [ ] Click "Delete"
- [ ] Confirm deletion in alert dialog
- [ ] Media removed from library
- [ ] Changes persist after refresh

### Copy Media URL

- [ ] Click media actions menu
- [ ] Click "Copy Link"
- [ ] URL copied to clipboard
- [ ] Success toast appears
- [ ] URL is valid UploadThing CDN URL

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 9. Stripe Integration & Billing

### Connect Stripe Account (Business)

- [ ] Navigate to `/business/[businessId]/kickstart`
- [ ] Click "Connect Stripe"
- [ ] Redirected to Stripe OAuth
- [ ] Authorize Stripe account
- [ ] Redirected back to application
- [ ] Stripe account connected successfully
- [ ] Success toast appears

### View Billing Page

- [ ] Navigate to `/business/[businessId]/billing`
- [ ] Billing page loads
- [ ] Subscription plans display
- [ ] Current plan shows (if subscribed)

### Create Subscription

- [ ] Open subscription modal
- [ ] Select plan
- [ ] Enter payment details (Stripe test card: 4242 4242 4242 4242)
- [ ] Submit payment
- [ ] Subscription created successfully
- [ ] Redirected to confirmation
- [ ] Plan updates in database

### Stripe Webhook Processing

- [ ] Trigger webhook event (use Stripe CLI or dashboard)
- [ ] Event: `customer.subscription.created`
- [ ] Webhook endpoint receives event
- [ ] Signature verification succeeds
- [ ] Database updates correctly
- [ ] Check console for webhook logs

### Checkout Session

- [ ] Create checkout session from funnel
- [ ] Redirected to Stripe checkout
- [ ] Complete test payment
- [ ] Redirected back to success page
- [ ] Order recorded correctly

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 10. Forms & Validation

Test all 12 forms identified in audit:

### Business Details Form

- [ ] Open business details form
- [ ] Submit empty form (validation errors appear)
- [ ] Fill in required fields
- [ ] Submit form
- [ ] Success response
- [ ] Data saves to database

### Subaccount Details Form

- [ ] Test form validation
- [ ] Submit with valid data
- [ ] Verify data persists

### User Details Form

- [ ] Test email validation
- [ ] Test role selection
- [ ] Submit and verify

### Send Invitation Form

- [ ] Test email validation
- [ ] Send invitation
- [ ] Verify email sent

### Contact User Form

- [ ] Test phone validation
- [ ] Create contact
- [ ] Verify in contacts list

### Contact Form

- [ ] Similar to contact user form
- [ ] Test and verify

### Ticket Form

- [ ] Test value field (number validation)
- [ ] Create ticket
- [ ] Verify in pipeline

### Pipeline Form

- [ ] Create pipeline
- [ ] Verify name saves

### Lane Form

- [ ] Create lane
- [ ] Verify in pipeline

### Funnel Form

- [ ] Test subdomain validation
- [ ] Create funnel
- [ ] Verify subdomain unique

### Funnel Page Form

- [ ] Test path validation
- [ ] Create page
- [ ] Verify path unique within funnel

### Upload Media Form

- [ ] Upload file
- [ ] Verify metadata saves

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 11. Navigation & Routing

### Dynamic Routes

- [ ] Navigate to `/business/[businessId]`
- [ ] Verify businessId param accessible
- [ ] Navigate to `/subaccount/[subaccountId]`
- [ ] Verify subaccountId param accessible
- [ ] Navigate to `/subaccount/[subaccountId]/pipelines/[pipelineId]`
- [ ] Multiple params work correctly
- [ ] Navigate to `/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]`
- [ ] Triple nested params work

### Custom Domain Routing

- [ ] Navigate to `{subdomain}.{domain}/{path}`
- [ ] Middleware extracts subdomain
- [ ] Correct funnel page loads
- [ ] Domain routing works

### Sidebar Navigation

- [ ] Click sidebar menu items
- [ ] Navigation works
- [ ] Active state highlights correctly
- [ ] Icons display correctly

### Breadcrumbs

- [ ] Navigate deep into app
- [ ] Breadcrumb trail shows (if implemented)
- [ ] Clicking breadcrumb navigates back

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 12. Image Loading & Optimization

### Static Images

- [ ] WorkPipe logo displays on landing page
- [ ] Hero image loads on site page
- [ ] Integration logos show (Stripe, App Store)
- [ ] No broken image icons

### Dynamic Images

- [ ] Business logos display in sidebar
- [ ] Subaccount logos display in switcher
- [ ] User avatars display in team table
- [ ] Media thumbnails display in media library
- [ ] Upload preview shows correctly

### Image Performance

- [ ] Images lazy load below fold
- [ ] No layout shift when images load
- [ ] Images optimize correctly (check Network tab)
- [ ] CDN URLs work (UploadThing)

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 13. UI Components & Interactions

### Modals & Dialogs

- [ ] Open modal
- [ ] Modal overlay appears
- [ ] Close modal with X button
- [ ] Close modal by clicking outside
- [ ] Modal content renders correctly

### Dropdowns & Selects

- [ ] Open dropdown menu
- [ ] Options display correctly
- [ ] Select option
- [ ] Dropdown closes
- [ ] Selected value displays

### Toasts & Notifications

- [ ] Success toast appears after form submit
- [ ] Error toast appears on error
- [ ] Toast auto-dismisses
- [ ] Multiple toasts stack correctly

### Tables

- [ ] Table renders with data
- [ ] Sorting works (if implemented)
- [ ] Pagination works (if implemented)
- [ ] Row actions work
- [ ] Empty state shows when no data

### Tabs

- [ ] Click tab to switch
- [ ] Active tab highlights
- [ ] Tab content updates
- [ ] Tabs work in nested components

**Pass/Fail**: **\_\_\_**

**Issues Found**: **\_\_\_**

---

## 14. Performance & Build

### Development Build

- [ ] Run `npm run dev`
- [ ] App starts without errors
- [ ] Hot reload works
- [ ] No TypeScript errors in console

### Production Build

- [ ] Run `npm run build`
- [ ] Build completes successfully
- [ ] No build errors
- [ ] Bundle size reasonable
- [ ] Run `npm run start`
- [ ] Production app runs
- [ ] All features work in production mode

### Type Checking

- [ ] Run `npm run type-check`
- [ ] No TypeScript errors
- [ ] All types resolve correctly

### Linting

- [ ] Run `npm run lint`
- [ ] No linting errors
- [ ] Or only expected warnings

**Pass/Fail**: **\_\_\_**

**Build Time**: **\_\_\_** seconds

**Bundle Sizes**: **\_\_\_**

---

## Test Results Summary

### Overall Status

**Date Tested**: **\_\_\_**

**Tester**: **\_\_\_**

**Total Tests**: 14 categories

**Passed**: **\_\_\_** / 14

**Failed**: **\_\_\_** / 14

### Critical Issues Found

1. ***
2. ***
3. ***

### Known Issues (Non-Blocking)

1. ***
2. ***

### Notes

---

---

## Post-Upgrade Testing

After completing the Next.js 15 upgrade:

1. Return to this document
2. Re-run ALL tests in the same order
3. Compare results with baseline
4. Document any regressions
5. Fix any issues before proceeding to next week

### Regression Tracking Template

| Feature  | Baseline (14.1.4) | After Upgrade (15.x) | Regression? | Fixed? |
| -------- | ----------------- | -------------------- | ----------- | ------ |
| Auth     | Pass              |                      |             |        |
| Business | Pass              |                      |             |        |
| ...      | ...               |                      |             |        |

---

## Files Generated

- ✅ `BASELINE-COMPATIBILITY-TESTS.md` - This file

## Next Steps

1. **NOW**: Complete all tests above to establish baseline
2. **Document** any issues found (these exist in current version)
3. **Fix** any critical issues before upgrade
4. **Week 2**: After upgrade, re-run all tests
5. **Week 3**: After Clerk v5 migration, re-run auth tests
6. **Week 4**: Final regression testing

**DO NOT PROCEED WITH UPGRADE UNTIL BASELINE TESTING IS COMPLETE!**
