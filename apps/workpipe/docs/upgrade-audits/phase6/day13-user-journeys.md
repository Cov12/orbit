# Day 13: Critical User Journey Testing

> **Date**: 2025-12-14
> **Phase**: Phase 6 - Testing & Validation (Week 4, Day 13)
> **Time Estimate**: 6-8 hours
> **Priority**: 🚨 CRITICAL

---

## Overview

This document guides you through testing the 6 critical user journeys that MUST work flawlessly for the application to be production-ready. Each journey represents a complete end-to-end user workflow.

**Testing Approach**:

1. Start with a clean browser session (incognito/private mode recommended)
2. Follow each step exactly as documented
3. Document any deviations, errors, or unexpected behavior
4. Take screenshots of any issues
5. Check browser console for errors at each step
6. Verify database persistence where applicable

**Before Starting**:

- [ ] Development server running: `npm run dev`
- [ ] Database accessible and healthy
- [ ] Browser DevTools console open
- [ ] Notepad ready for issue documentation
- [ ] Clean browser session (incognito mode recommended)

---

## Journey 1: New Business Onboarding

**Duration**: 15-20 minutes
**Priority**: 🚨 CRITICAL
**Focus Area**: Clerk v6 authentication, user metadata, permissions

### Prerequisites

- Use a NEW email address (or clear previous test account)
- Have a test logo image ready (< 5MB)
- Have a test team member email ready

### Test Steps

#### Step 1: Sign Up

- [ ] Navigate to home page
- [ ] Click "Sign Up" or "Get Started"
- [ ] Enter email address
- [ ] Enter password (meet requirements)
- [ ] Click "Sign Up"
- [ ] **Verify**: No console errors
- [ ] **Verify**: Redirected to email verification page

**Expected**: Sign-up form submits successfully, redirected to verification
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 2: Email Verification

- [ ] Check email inbox for verification email
- [ ] Click verification link
- [ ] **Verify**: Email marked as verified in Clerk
- [ ] **Verify**: Redirected to business details form

**Expected**: Email verified, redirected to onboarding
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 3: Business Details Form

- [ ] Fill in business name
- [ ] Fill in business email
- [ ] Fill in address fields
- [ ] Fill in city, state, zip code
- [ ] Fill in country
- [ ] Click "Continue" or "Next"
- [ ] **Verify**: Form validates correctly
- [ ] **Verify**: Required fields enforced
- [ ] **Verify**: No console errors
- [ ] **Verify**: Business created in database

**Expected**: Business details saved, proceed to next step
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Database Check**: Business record created? YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 4: Upload Business Logo

- [ ] Click upload logo button
- [ ] Select test image file
- [ ] **Verify**: Upload progress indicator shown
- [ ] **Verify**: Logo uploads successfully
- [ ] **Verify**: Logo preview displayed
- [ ] **Verify**: Logo saved to UploadThing
- [ ] **Verify**: Database updated with logo URL

**Expected**: Logo uploads and displays correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**UploadThing Success**: YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 5: Invite Team Member

- [ ] Enter team member email
- [ ] Select role/permissions
- [ ] Click "Send Invitation"
- [ ] **Verify**: Invitation sent successfully
- [ ] **Verify**: Success message displayed
- [ ] **Verify**: Invitation appears in pending list
- [ ] **Verify**: Team member receives email (check inbox)

**Expected**: Invitation sent via Clerk, email received
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Email Received**: YES / NO - [time received]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 6: Create First Subaccount

- [ ] Navigate to subaccounts
- [ ] Click "Create Subaccount"
- [ ] Fill in subaccount name
- [ ] Fill in subaccount details
- [ ] Click "Create"
- [ ] **Verify**: Subaccount created successfully
- [ ] **Verify**: Redirected to subaccount or list
- [ ] **Verify**: Subaccount appears in list
- [ ] **Verify**: Database record created

**Expected**: Subaccount created and visible
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Database Check**: Subaccount record exists? YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 7: Verify Dashboard

- [ ] Navigate to business dashboard
- [ ] **Verify**: Dashboard loads without errors
- [ ] **Verify**: Business name displayed
- [ ] **Verify**: Logo displayed
- [ ] **Verify**: Subaccount count correct
- [ ] **Verify**: User metadata accessible
- [ ] **Verify**: Navigation menu works
- [ ] **Verify**: All dashboard widgets load

**Expected**: Dashboard displays all data correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

### Journey 1 Summary

**Total Steps**: 7
**Steps Passed**: **\_/7
**Steps Failed**: \_**/7

**Critical Issues Found**: **\_
**High Priority Issues**: \_**
**Medium/Low Issues**: \_\_\_

**Overall Status**: ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

**Issues**:

1. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]
2. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]

**Notes**: ************\*\*\*\*************\_\_\_************\*\*\*\*************

---

---

## Journey 2: Funnel Creation & Publishing

**Duration**: 20-25 minutes
**Priority**: 🚨 CRITICAL
**Focus Area**: Funnel builder, drag-drop (@dnd-kit), image upload, subdomain routing

### Prerequisites

- Business and subaccount created (from Journey 1)
- Test images ready for upload
- Understanding of funnel structure

### Test Steps

#### Step 1: Navigate to Funnels

- [ ] From dashboard, navigate to Funnels section
- [ ] **Verify**: Funnels page loads
- [ ] **Verify**: Empty state or existing funnels displayed
- [ ] **Verify**: "Create Funnel" button visible
- [ ] **Verify**: No console errors

**Expected**: Funnels page loads successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 2: Create New Funnel

- [ ] Click "Create Funnel"
- [ ] Enter funnel name
- [ ] Enter funnel description
- [ ] Select subdomain (if applicable)
- [ ] Click "Create" or "Save"
- [ ] **Verify**: Funnel created successfully
- [ ] **Verify**: Redirected to funnel details or pages
- [ ] **Verify**: Database record created

**Expected**: Funnel created and saved
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Database Check**: Funnel record exists? YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 3: Add Funnel Pages

- [ ] Click "Add Page" or similar
- [ ] Enter page name
- [ ] Select page template (if applicable)
- [ ] Click "Create Page"
- [ ] **Verify**: Page created successfully
- [ ] **Verify**: Page appears in funnel pages list
- [ ] **Verify**: Can create multiple pages
- [ ] Create at least 2 pages for testing

**Expected**: Pages created and listed
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Pages Created**: \_\_\_
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 4: Customize Page Content (CRITICAL - @dnd-kit testing)

- [ ] Open page editor for first page
- [ ] **Verify**: Editor interface loads correctly
- [ ] **Verify**: Sidebar with components visible
- [ ] **Verify**: Canvas area visible

**Test each component type** (18 total):

- [ ] **Text Placeholder**: Drag onto canvas
- [ ] **Heading Placeholder**: Drag onto canvas
- [ ] **Container Placeholder**: Drag onto canvas
- [ ] **Two Columns Placeholder**: Drag onto canvas
- [ ] **Video Placeholder**: Drag onto canvas
- [ ] **Icon Placeholder**: Drag onto canvas
- [ ] **Link Placeholder**: Drag onto canvas
- [ ] **Rich Text Placeholder**: Drag onto canvas
- [ ] **Contact Form Placeholder**: Drag onto canvas
- [ ] **Checkout Placeholder**: Drag onto canvas
- [ ] **Divider Placeholder**: Drag onto canvas
- [ ] **Spacer Placeholder**: Drag onto canvas
- [ ] **Code Block Placeholder**: Drag onto canvas
- [ ] **QR Code Placeholder**: Drag onto canvas
- [ ] **Animated Text Placeholder**: Drag onto canvas

**For each component**:

- **Verify**: Drag-and-drop works smoothly
- **Verify**: Component drops in correct position
- **Verify**: Component can be selected
- **Verify**: Component can be edited
- **Verify**: Component settings save
- **Verify**: No console errors during drag-drop

**Expected**: All 15+ component types drag, drop, and edit correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Components Working**: \_\_\_/15+
**Drag-Drop Issues**: [list any]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 5: Upload Images to Page

- [ ] Add image component to page
- [ ] Click to upload image
- [ ] Select test image file
- [ ] **Verify**: Upload progress shown
- [ ] **Verify**: Image uploads successfully
- [ ] **Verify**: Image displays in editor
- [ ] **Verify**: Image URL saved correctly
- [ ] **Verify**: UploadThing integration works
- [ ] Test with multiple images

**Expected**: Images upload and display correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Upload Success Rate**: **_/_**
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 6: Configure SEO Settings

- [ ] Open page settings or SEO panel
- [ ] Enter page title
- [ ] Enter meta description
- [ ] Enter keywords (if applicable)
- [ ] Upload OG image (if applicable)
- [ ] Click "Save"
- [ ] **Verify**: SEO settings saved
- [ ] **Verify**: Settings persist on page reload

**Expected**: SEO settings saved successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 7: Publish Funnel

- [ ] Click "Publish" or similar
- [ ] **Verify**: Publishing process initiated
- [ ] **Verify**: Success message displayed
- [ ] **Verify**: Funnel marked as published
- [ ] **Verify**: Publish status updated in database

**Expected**: Funnel publishes successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 8: Verify Funnel on Subdomain

- [ ] Open new browser tab
- [ ] Navigate to funnel subdomain URL
- [ ] **Verify**: Funnel loads on subdomain
- [ ] **Verify**: All pages accessible
- [ ] **Verify**: Images load correctly (CRITICAL - remotePatterns test)
- [ ] **Verify**: Layout renders correctly
- [ ] **Verify**: No console errors
- [ ] **Verify**: SEO meta tags present (view source)

**Expected**: Funnel accessible on subdomain, all content loads
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Subdomain URL**: **********\*\*\*\***********\_\_\_**********\*\*\*\***********
**Images Loading**: **_/_**
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 9: Test Form Submissions

- [ ] If contact form added, fill it out
- [ ] Enter test data in all fields
- [ ] Click "Submit"
- [ ] **Verify**: Form submits successfully
- [ ] **Verify**: Success message shown
- [ ] **Verify**: Data saved to database
- [ ] **Verify**: No console errors

**Expected**: Form submission works correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Database Check**: Submission recorded? YES / NO
**Status**: ✅ PASS / ❌ FAIL / N/A

---

### Journey 2 Summary

**Total Steps**: 9
**Steps Passed**: **\_/9
**Steps Failed**: \_**/9

**Critical Issues Found**: \_\_\_
**Drag-Drop Issues**: YES / NO - [describe]
**Image Loading Issues**: YES / NO - [describe]

**Overall Status**: ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

**Issues**:

1. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]
2. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]

**Notes**: ************\*\*\*\*************\_\_\_************\*\*\*\*************

---

---

## Journey 3: Stripe Subscription Flow

**Duration**: 15-20 minutes
**Priority**: 🚨 CRITICAL
**Focus Area**: Stripe integration, webhook processing (headers() testing)

### Prerequisites

- Stripe test mode configured
- Test card numbers ready (4242 4242 4242 4242)
- Access to Stripe dashboard for webhook monitoring

### Test Steps

#### Step 1: Navigate to Billing

- [ ] From dashboard, navigate to Billing section
- [ ] **Verify**: Billing page loads
- [ ] **Verify**: Available plans displayed
- [ ] **Verify**: Current plan status shown
- [ ] **Verify**: No console errors

**Expected**: Billing page displays correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 2: Select Subscription Plan

- [ ] Choose a subscription plan
- [ ] Review plan details
- [ ] Click "Subscribe" or "Choose Plan"
- [ ] **Verify**: Redirected to checkout
- [ ] **Verify**: Stripe checkout loads

**Expected**: Stripe checkout initiated
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 3: Enter Payment Details (Test Mode)

- [ ] Enter test card: 4242 4242 4242 4242
- [ ] Enter expiry: Any future date
- [ ] Enter CVC: Any 3 digits
- [ ] Enter ZIP: Any valid ZIP
- [ ] Fill billing details if required
- [ ] **Verify**: Form validates correctly

**Expected**: Payment form accepts test card
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 4: Complete Checkout

- [ ] Click "Subscribe" or "Pay"
- [ ] **Verify**: Payment processing initiated
- [ ] **Verify**: No errors during processing
- [ ] **Verify**: Redirected after success
- [ ] **Verify**: Success message displayed

**Expected**: Payment processes successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 5: Verify Webhook Processing (CRITICAL - headers() test)

- [ ] Open Stripe Dashboard → Developers → Webhooks
- [ ] Find the subscription.created event
- [ ] **Verify**: Webhook received by application
- [ ] **Verify**: Webhook signature verified (headers() working)
- [ ] **Verify**: Response 200 OK
- [ ] **Verify**: No webhook errors
- [ ] Check application logs for webhook processing
- [ ] **Verify**: No errors in webhook handler

**Expected**: Webhook processed successfully, signature verified
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Webhook Status**: SUCCESS / FAILED
**Signature Verification**: SUCCESS / FAILED
**Console/Server Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 6: Confirm Subscription Active

- [ ] Return to billing page
- [ ] **Verify**: Subscription status shows "Active"
- [ ] **Verify**: Correct plan displayed
- [ ] **Verify**: Next billing date shown
- [ ] **Verify**: Database updated with subscription
- [ ] Check database subscription record
- [ ] **Verify**: Stripe customer ID saved
- [ ] **Verify**: Subscription ID saved

**Expected**: Subscription active in database and UI
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Database Check**: Subscription record exists? YES / NO
**Stripe Customer ID**: Present? YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 7: Access Premium Features

- [ ] Navigate to a premium-only feature
- [ ] **Verify**: Feature is accessible
- [ ] **Verify**: No "upgrade required" messages
- [ ] **Verify**: Premium feature works correctly
- [ ] Test feature functionality

**Expected**: Premium features unlocked and functional
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Features Accessible**: YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 8: Test Usage Limits (if applicable)

- [ ] Check current usage metrics
- [ ] **Verify**: Usage tracked correctly
- [ ] **Verify**: Limits displayed accurately
- [ ] Perform action that consumes usage
- [ ] **Verify**: Usage increments correctly

**Expected**: Usage tracking works correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Status**: ✅ PASS / ❌ FAIL / N/A

---

#### Step 9: Verify Billing Portal Access

- [ ] Click "Manage Subscription" or portal link
- [ ] **Verify**: Redirected to Stripe billing portal
- [ ] **Verify**: Portal loads correctly
- [ ] **Verify**: Subscription details visible
- [ ] **Verify**: Can view invoices
- [ ] **Verify**: Can update payment method
- [ ] DO NOT cancel (unless testing cancellation)

**Expected**: Billing portal accessible and functional
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Portal Access**: SUCCESS / FAILED
**Status**: ✅ PASS / ❌ FAIL

---

### Journey 3 Summary

**Total Steps**: 9
**Steps Passed**: **\_/9
**Steps Failed**: \_**/9

**Critical Issues Found**: \_\_\_
**Webhook Processing**: SUCCESS / FAILED
**Payment Processing**: SUCCESS / FAILED

**Overall Status**: ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

**Issues**:

1. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]
2. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]

**Notes**: ************\*\*\*\*************\_\_\_************\*\*\*\*************

---

---

## Journey 4: Pipeline & Ticket Management

**Duration**: 15-20 minutes
**Priority**: ⚠️ HIGH
**Focus Area**: Pipeline Kanban, drag-drop (@dnd-kit), data persistence

### Prerequisites

- Subaccount created
- Understanding of pipeline/CRM workflow

### Test Steps

#### Step 1: Navigate to Pipelines

- [ ] Navigate to Pipelines section
- [ ] **Verify**: Pipelines page loads
- [ ] **Verify**: Empty state or existing pipelines shown
- [ ] **Verify**: "Create Pipeline" button visible
- [ ] **Verify**: No console errors

**Expected**: Pipelines page loads successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 2: Create New Pipeline

- [ ] Click "Create Pipeline"
- [ ] Enter pipeline name
- [ ] Enter description (if applicable)
- [ ] Click "Create"
- [ ] **Verify**: Pipeline created successfully
- [ ] **Verify**: Redirected to pipeline view
- [ ] **Verify**: Database record created

**Expected**: Pipeline created and visible
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Database Check**: Pipeline exists? YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 3: Add Lanes

- [ ] Click "Add Lane" or similar
- [ ] Enter lane name (e.g., "Lead")
- [ ] Click "Create"
- [ ] **Verify**: Lane created successfully
- [ ] Repeat to create 3-4 lanes (Lead, Contacted, Qualified, Closed)
- [ ] **Verify**: All lanes display correctly
- [ ] **Verify**: Lanes in correct order
- [ ] **Verify**: Database records created

**Expected**: Multiple lanes created in pipeline
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Lanes Created**: \_\_\_
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 4: Create Tickets

- [ ] In first lane, click "Add Ticket" or similar
- [ ] Enter ticket title
- [ ] Enter ticket description
- [ ] Set ticket value/amount (if applicable)
- [ ] Click "Create"
- [ ] **Verify**: Ticket created successfully
- [ ] **Verify**: Ticket appears in lane
- [ ] Create 2-3 tickets in different lanes

**Expected**: Tickets created and displayed
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Tickets Created**: \_\_\_
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 5: Drag Tickets Between Lanes (CRITICAL - @dnd-kit test)

- [ ] Click and hold a ticket
- [ ] **Verify**: Ticket enters drag state (visual feedback)
- [ ] Drag ticket to different lane
- [ ] **Verify**: Drop zone highlighted
- [ ] Drop ticket in new lane
- [ ] **Verify**: Ticket moves to new lane
- [ ] **Verify**: No console errors
- [ ] **Verify**: Smooth animation
- [ ] Repeat with multiple tickets
- [ ] Test dragging to first lane
- [ ] Test dragging to last lane
- [ ] Test dragging between non-adjacent lanes

**Expected**: Drag-and-drop works smoothly across all lanes
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Drag-Drop Smooth**: YES / NO
**All Lanes Work**: YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 6: Edit Ticket Details

- [ ] Click on a ticket to open details
- [ ] **Verify**: Ticket details modal/panel opens
- [ ] Edit ticket title
- [ ] Edit ticket description
- [ ] Change ticket value
- [ ] Update any other fields
- [ ] Click "Save"
- [ ] **Verify**: Changes saved successfully
- [ ] **Verify**: Updated ticket displays new information
- [ ] **Verify**: Database updated

**Expected**: Ticket edits save successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Database Check**: Changes persisted? YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 7: Add Comments

- [ ] In ticket details, find comments section
- [ ] Add a comment
- [ ] Click "Submit" or "Add Comment"
- [ ] **Verify**: Comment appears immediately
- [ ] **Verify**: Comment saved to database
- [ ] **Verify**: Timestamp correct
- [ ] Add another comment
- [ ] **Verify**: Multiple comments display

**Expected**: Comments save and display correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 8: Assign to Team Member

- [ ] In ticket details, find assignment field
- [ ] Select team member from dropdown
- [ ] **Verify**: Assignment saves
- [ ] **Verify**: Team member name displays on ticket
- [ ] **Verify**: Database updated
- [ ] Change assignment to different member
- [ ] **Verify**: Reassignment works

**Expected**: Ticket assignment works correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 9: Close Ticket

- [ ] Find close/archive option for ticket
- [ ] Click close or change status to closed
- [ ] **Verify**: Ticket status updates
- [ ] **Verify**: Visual indication of closed status
- [ ] **Verify**: Closed tickets filter works (if applicable)
- [ ] **Verify**: Database updated

**Expected**: Ticket closes successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 10: Verify Data Persistence

- [ ] Refresh the page
- [ ] **Verify**: All lanes still present
- [ ] **Verify**: All tickets still in correct lanes
- [ ] **Verify**: Ticket order preserved
- [ ] **Verify**: Ticket details preserved
- [ ] **Verify**: Comments preserved
- [ ] **Verify**: Assignments preserved
- [ ] **Verify**: No data loss

**Expected**: All data persists after page reload
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Data Loss**: YES / NO - [describe if yes]
**Status**: ✅ PASS / ❌ FAIL

---

### Journey 4 Summary

**Total Steps**: 10
**Steps Passed**: **\_/10
**Steps Failed**: \_**/10

**Critical Issues Found**: \_\_\_
**Drag-Drop Performance**: EXCELLENT / GOOD / POOR
**Data Persistence**: SUCCESS / FAILED

**Overall Status**: ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

**Issues**:

1. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]
2. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]

**Notes**: ************\*\*\*\*************\_\_\_************\*\*\*\*************

---

---

## Journey 5: Team Collaboration

**Duration**: 10-15 minutes
**Priority**: ⚠️ HIGH
**Focus Area**: Clerk invitations, permissions, access control

### Test Steps

#### Step 1: Invite Team Member

- [ ] Navigate to Team or Settings
- [ ] Find "Invite Team Member" option
- [ ] Enter team member email
- [ ] Select role/permissions level
- [ ] Click "Send Invitation"
- [ ] **Verify**: Success message displayed
- [ ] **Verify**: No console errors
- [ ] **Verify**: Invitation created in Clerk

**Expected**: Invitation sent successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 2: Team Member Receives Email

- [ ] Check team member email inbox
- [ ] **Verify**: Invitation email received
- [ ] **Verify**: Email contains correct information
- [ ] **Verify**: Sign-up link present
- [ ] **Verify**: Email styling correct (if applicable)
- [ ] Note time from send to receive

**Expected**: Email received within 1-2 minutes
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Email Received**: YES / NO
**Time to Receive**: \_\_\_ minutes
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 3: Team Member Signs Up

- [ ] Click invitation link in email
- [ ] **Verify**: Redirected to sign-up page
- [ ] Complete sign-up process
- [ ] **Verify**: Account created successfully
- [ ] **Verify**: Linked to inviting business
- [ ] **Verify**: Role/permissions assigned

**Expected**: Team member account created and linked
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 4: Assign Permissions

- [ ] As business owner, navigate to team settings
- [ ] Find newly added team member
- [ ] Update permissions/role
- [ ] Assign to specific subaccounts
- [ ] Click "Save"
- [ ] **Verify**: Permissions updated successfully
- [ ] **Verify**: Database updated

**Expected**: Permissions assigned successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 5: Team Member Accesses Assigned Subaccounts

- [ ] As team member, log in
- [ ] **Verify**: Dashboard loads
- [ ] **Verify**: Only assigned subaccounts visible
- [ ] **Verify**: Cannot see unauthorized subaccounts
- [ ] Navigate to assigned subaccount
- [ ] **Verify**: Access granted

**Expected**: Team member sees only authorized content
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Access Control Working**: YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 6: Team Member Creates Content

- [ ] As team member, create a test item (funnel, ticket, etc.)
- [ ] **Verify**: Creation succeeds
- [ ] **Verify**: Item appears in list
- [ ] **Verify**: Proper ownership/creator tracked
- [ ] Switch back to business owner
- [ ] **Verify**: Business owner can see team member's creation

**Expected**: Team member can create content within permissions
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 7: Verify Permissions Working

- [ ] As team member, try to access restricted area
- [ ] **Verify**: Access denied or not visible
- [ ] Try to perform unauthorized action
- [ ] **Verify**: Action blocked
- [ ] **Verify**: Appropriate error message shown

**Expected**: Permissions enforced correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Permissions Bypassed**: YES / NO - [CRITICAL if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 8: Remove Team Member

- [ ] As business owner, navigate to team settings
- [ ] Find team member to remove
- [ ] Click "Remove" or "Delete"
- [ ] **Verify**: Confirmation dialog shown
- [ ] Confirm removal
- [ ] **Verify**: Team member removed from list
- [ ] **Verify**: Database updated

**Expected**: Team member removed successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 9: Verify Access Revoked

- [ ] As removed team member, try to log in
- [ ] **Verify**: Can still log in (own account exists)
- [ ] Try to access previous business
- [ ] **Verify**: Access denied
- [ ] **Verify**: Business not visible
- [ ] **Verify**: Appropriate message shown

**Expected**: Access revoked, cannot see business
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Access Revoked**: YES / NO - [CRITICAL if no]
**Status**: ✅ PASS / ❌ FAIL

---

### Journey 5 Summary

**Total Steps**: 9
**Steps Passed**: **\_/9
**Steps Failed**: \_**/9

**Critical Issues Found**: \_\_\_
**Security Issues**: YES / NO - [CRITICAL if yes]
**Access Control**: WORKING / BROKEN

**Overall Status**: ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

**Issues**:

1. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]
2. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]

**Notes**: ************\*\*\*\*************\_\_\_************\*\*\*\*************

---

---

## Journey 6: Media Management

**Duration**: 10-15 minutes
**Priority**: ⚠️ HIGH
**Focus Area**: UploadThing, file handling, media library

### Prerequisites

- Multiple test images ready (JPG, PNG, different sizes)
- Test PDF file ready

### Test Steps

#### Step 1: Navigate to Media Library

- [ ] Navigate to Media or Assets section
- [ ] **Verify**: Media library page loads
- [ ] **Verify**: Empty state or existing media shown
- [ ] **Verify**: Upload button visible
- [ ] **Verify**: No console errors

**Expected**: Media library accessible
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 2: Upload Multiple Images

- [ ] Click "Upload" or similar
- [ ] Select 3-4 images at once
- [ ] **Verify**: Upload progress shown
- [ ] **Verify**: Multiple files upload simultaneously
- [ ] **Verify**: All uploads complete successfully
- [ ] **Verify**: Files appear in media library
- [ ] **Verify**: UploadThing URLs generated
- [ ] **Verify**: Thumbnails display correctly

**Expected**: Multiple images upload successfully
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Upload Success Rate**: **_/_**
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 3: Upload PDF

- [ ] Click "Upload"
- [ ] Select PDF file
- [ ] **Verify**: PDF uploads successfully
- [ ] **Verify**: PDF appears in library
- [ ] **Verify**: Correct icon/preview shown
- [ ] **Verify**: File size displayed correctly

**Expected**: PDF upload works
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 4: View Uploaded Files

- [ ] Click on an uploaded image
- [ ] **Verify**: Image preview/detail view opens
- [ ] **Verify**: Full-size image loads
- [ ] **Verify**: File details shown (name, size, date)
- [ ] **Verify**: Image URL accessible
- [ ] Test with different file types
- [ ] **Verify**: All file types viewable

**Expected**: Files viewable with correct details
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 5: Use Image in Funnel

- [ ] Navigate to funnel editor (from Journey 2)
- [ ] Add image component
- [ ] Click to select from media library
- [ ] **Verify**: Media library modal opens
- [ ] Select previously uploaded image
- [ ] **Verify**: Image inserted into funnel
- [ ] **Verify**: Image displays correctly
- [ ] **Verify**: Image URL from UploadThing works

**Expected**: Media library integration works in funnel editor
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 6: Attach File to Resource

- [ ] Find any feature that allows file attachments
- [ ] Attach PDF or image from media library
- [ ] **Verify**: File attaches successfully
- [ ] **Verify**: File link/preview shown
- [ ] **Verify**: File downloadable
- [ ] **Verify**: Database relationship created

**Expected**: File attachment works
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL / N/A

---

#### Step 7: Delete File

- [ ] Return to media library
- [ ] Select a file to delete
- [ ] Click "Delete"
- [ ] **Verify**: Confirmation dialog shown
- [ ] Confirm deletion
- [ ] **Verify**: File removed from library
- [ ] **Verify**: Database updated
- [ ] **Verify**: File deleted from UploadThing (check if possible)

**Expected**: File deletion works
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Console Errors**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

#### Step 8: Verify Deletion

- [ ] Try to access deleted file URL directly
- [ ] **Verify**: File no longer accessible (404 or similar)
- [ ] **Verify**: File not in media library
- [ ] Check any places file was used
- [ ] **Verify**: Appropriate handling of deleted file references

**Expected**: Deleted files truly removed and handled correctly
**Actual**: ************\*\*\*\*************\_\_\_************\*\*\*\*************
**Orphaned References**: YES / NO - [list if yes]
**Status**: ✅ PASS / ❌ FAIL

---

### Journey 6 Summary

**Total Steps**: 8
**Steps Passed**: **\_/8
**Steps Failed**: \_**/8

**Critical Issues Found**: \_\_\_
**Upload Success**: EXCELLENT / GOOD / POOR
**File Management**: WORKING / ISSUES

**Overall Status**: ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

**Issues**:

1. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]
2. [Issue description] - Priority: [CRITICAL/HIGH/MEDIUM/LOW]

**Notes**: ************\*\*\*\*************\_\_\_************\*\*\*\*************

---

---

## Day 13 Overall Summary

### All Journeys Summary

| Journey                | Duration       | Steps  | Passed        | Failed        | Status     |
| ---------------------- | -------------- | ------ | ------------- | ------------- | ---------- |
| 1. Business Onboarding | \_\_\_ min     | 7      | \_\_\_/7      | \_\_\_/7      | ✅/⚠️/❌   |
| 2. Funnel Creation     | \_\_\_ min     | 9      | \_\_\_/9      | \_\_\_/9      | ✅/⚠️/❌   |
| 3. Stripe Subscription | \_\_\_ min     | 9      | \_\_\_/9      | \_\_\_/9      | ✅/⚠️/❌   |
| 4. Pipeline Management | \_\_\_ min     | 10     | \_\_\_/10     | \_\_\_/10     | ✅/⚠️/❌   |
| 5. Team Collaboration  | \_\_\_ min     | 9      | \_\_\_/9      | \_\_\_/9      | ✅/⚠️/❌   |
| 6. Media Management    | \_\_\_ min     | 8      | \_\_\_/8      | \_\_\_/8      | ✅/⚠️/❌   |
| **TOTAL**              | **\_\_\_ min** | **52** | **\_\_\_/52** | **\_\_\_/52** | **\_\_\_** |

### Test Pass Rate

**Overall Pass Rate**: **\_/52 (**%)
**Target**: 95% (49/52)
**Met Target**: YES / NO

### Issues by Priority

**🚨 CRITICAL Issues**: \_\_\_ (must fix before proceeding)

1. [Issue] - [Journey] - [Description]
2. [Issue] - [Journey] - [Description]

**⚠️ HIGH Priority Issues**: \_\_\_ (should fix before deployment)

1. [Issue] - [Journey] - [Description]
2. [Issue] - [Journey] - [Description]

**🟡 MEDIUM Priority Issues**: \_\_\_ (can address later)

1. [Issue] - [Journey] - [Description]

**🟢 LOW Priority Issues**: \_\_\_ (future enhancements)

### Critical Focus Areas Performance

| Area                           | Status   | Notes   |
| ------------------------------ | -------- | ------- |
| Clerk v6 Auth                  | ✅/⚠️/❌ | [notes] |
| Stripe Webhooks                | ✅/⚠️/❌ | [notes] |
| @dnd-kit (Funnel)              | ✅/⚠️/❌ | [notes] |
| @dnd-kit (Pipeline)            | ✅/⚠️/❌ | [notes] |
| react-hook-form                | ✅/⚠️/❌ | [notes] |
| Image Loading (remotePatterns) | ✅/⚠️/❌ | [notes] |
| UploadThing                    | ✅/⚠️/❌ | [notes] |

### Recommendation

**Day 13 Status**:

- [ ] ✅ **PASS** - All critical journeys working, ready for Day 14
- [ ] ⚠️ **PASS WITH ISSUES** - Minor issues found, can proceed with caution
- [ ] ❌ **FAIL** - Critical issues found, must fix before proceeding

**Next Steps**:

- If PASS: Proceed to Day 14 (Feature-Specific Testing)
- If PASS WITH ISSUES: Document issues, plan fixes, proceed to Day 14
- If FAIL: STOP - Fix critical issues before continuing

**Blocker Issues**: [List any that prevent continuing]

**Sign-Off**: ****\*\*****\_\_\_\_****\*\***** Date: \***\*\_\_\*\***

---

## Additional Notes

[Any additional observations, patterns, or concerns]

---

**Document Status**: ⏳ IN PROGRESS / ✅ COMPLETE
**Completed By**: ****\*\*****\_\_\_\_****\*\*****
**Completion Date**: ****\*\*****\_\_\_\_****\*\*****
