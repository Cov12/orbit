# Day 14: Feature-Specific Testing

> **Date**: 2026-01-23
> **Phase**: Phase 6 - Testing & Validation (Week 4, Day 14)
> **Time Estimate**: 4-5 hours
> **Priority**: ⚠️ HIGH

---

## Overview

Day 14 focuses on systematic testing of every major feature in the WorkPipe platform. This ensures that all functionality works correctly after the Next.js 15 + React 18 upgrade.

**Testing Approach**:

- Test each feature systematically using CRUD operations
- Verify data integrity and persistence
- Check for regressions from baseline functionality
- Document all issues found

**Before Starting**:

- [ ] Day 13 user journeys completed
- [ ] Development server running: `npm run dev`
- [ ] Database accessible and healthy
- [ ] Browser DevTools console open
- [ ] Clean browser session (incognito mode recommended)

---

## Feature Category 1: Business Management

**Priority**: 🚨 CRITICAL
**Focus**: Business-level operations, settings, and configuration

### Feature 1.1: Business Settings

#### Create/Update Business Details

- [ ] Navigate to Business Settings
- [ ] **Verify**: Settings page loads
- [ ] Update business name
- [ ] Update business email
- [ ] Update address fields
- [ ] Update logo (upload new image)
- [ ] Click "Save"
- [ ] **Verify**: Changes saved successfully
- [ ] **Verify**: Database updated
- [ ] Refresh page
- [ ] **Verify**: Changes persisted

**Expected**: Business details update successfully
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Console Errors**: YES / NO
**Database Verified**: YES / NO
**Status**: ✅ PASS / ❌ FAIL

---

#### Business Logo Management

- [ ] Navigate to Business Settings
- [ ] Remove current logo
- [ ] **Verify**: Logo removed
- [ ] Upload new logo
- [ ] **Verify**: Upload successful
- [ ] **Verify**: Logo displays correctly
- [ ] **Verify**: Logo URL saved to database
- [ ] Check logo in other parts of UI (sidebar, header)
- [ ] **Verify**: Logo displays everywhere

**Expected**: Logo management works correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Business Deletion (if applicable)

- [ ] Find business deletion option
- [ ] Attempt to delete business
- [ ] **Verify**: Confirmation dialog shown
- [ ] **Verify**: Warning about data loss shown
- [ ] Cancel deletion
- [ ] **Verify**: Business not deleted
- [ ] (Optional) Complete deletion in test account
- [ ] **Verify**: Business and related data removed

**Expected**: Business deletion works with proper warnings
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

### Feature 1.2: Business Billing & Subscriptions

#### View Current Subscription

- [ ] Navigate to Billing page
- [ ] **Verify**: Current plan displayed
- [ ] **Verify**: Subscription status shown (Active/Inactive)
- [ ] **Verify**: Next billing date shown
- [ ] **Verify**: Payment method shown
- [ ] **Verify**: No console errors

**Expected**: Billing information displays correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Change Subscription Plan

- [ ] Click "Change Plan" or similar
- [ ] Select different plan
- [ ] **Verify**: Price change shown
- [ ] Confirm plan change
- [ ] **Verify**: Stripe processing successful
- [ ] **Verify**: Plan updated in database
- [ ] **Verify**: New features unlocked (or restricted)

**Expected**: Plan change works correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / ⏭️ SKIPPED

---

#### View Billing History

- [ ] Navigate to billing history/invoices
- [ ] **Verify**: Past invoices displayed
- [ ] **Verify**: Invoice dates correct
- [ ] **Verify**: Invoice amounts correct
- [ ] Click to view invoice details
- [ ] **Verify**: Invoice opens (PDF or Stripe hosted)

**Expected**: Billing history accessible
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 1.3: Business Team Management

#### View Team Members

- [ ] Navigate to Team page
- [ ] **Verify**: All team members listed
- [ ] **Verify**: Roles displayed correctly
- [ ] **Verify**: Status shown (Active/Pending/Invited)
- [ ] **Verify**: No console errors

**Expected**: Team list displays correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Update Team Member Roles

- [ ] Select a team member
- [ ] Click "Edit" or similar
- [ ] Change role/permissions
- [ ] Click "Save"
- [ ] **Verify**: Role updated successfully
- [ ] **Verify**: Database updated
- [ ] Sign in as that team member (if possible)
- [ ] **Verify**: Permissions reflect new role

**Expected**: Role updates work correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / ⏭️ SKIPPED

---

#### Remove Team Member

- [ ] Select a team member
- [ ] Click "Remove" or "Delete"
- [ ] **Verify**: Confirmation shown
- [ ] Confirm removal
- [ ] **Verify**: Member removed from list
- [ ] **Verify**: Database updated
- [ ] Sign in as removed member (if possible)
- [ ] **Verify**: Access to business revoked

**Expected**: Team member removal works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / ⏭️ SKIPPED

---

### Business Management Summary

**Tests Completed**: **\_/9
**Tests Passed**: \_**/9
**Tests Failed**: **\_/9
**Critical Issues**: **\_\***\*
**Overall\*\*: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

---

## Feature Category 2: Subaccount Management

**Priority**: 🚨 CRITICAL
**Focus**: Subaccount CRUD operations, settings, access control

### Feature 2.1: Subaccount CRUD

#### Create Subaccount

- [ ] Navigate to Subaccounts
- [ ] Click "Create Subaccount"
- [ ] Fill in subaccount name
- [ ] Fill in subaccount details
- [ ] Upload subaccount logo (if applicable)
- [ ] Click "Create"
- [ ] **Verify**: Subaccount created successfully
- [ ] **Verify**: Redirected to subaccount or list
- [ ] **Verify**: Database record created
- [ ] **Verify**: No console errors

**Expected**: Subaccount creation works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Read/View Subaccount

- [ ] Navigate to Subaccounts list
- [ ] Click on a subaccount
- [ ] **Verify**: Subaccount details page loads
- [ ] **Verify**: All details displayed correctly
- [ ] **Verify**: Logo displays (if set)
- [ ] **Verify**: Settings accessible
- [ ] **Verify**: No console errors

**Expected**: Subaccount details display correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Update Subaccount

- [ ] Navigate to subaccount settings
- [ ] Update subaccount name
- [ ] Update other details
- [ ] Update logo
- [ ] Click "Save"
- [ ] **Verify**: Changes saved successfully
- [ ] **Verify**: Database updated
- [ ] Refresh page
- [ ] **Verify**: Changes persisted

**Expected**: Subaccount updates work
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Delete Subaccount

- [ ] Navigate to subaccount settings
- [ ] Find "Delete Subaccount" option
- [ ] Click delete
- [ ] **Verify**: Confirmation dialog shown
- [ ] **Verify**: Warning about data loss shown
- [ ] Confirm deletion
- [ ] **Verify**: Subaccount removed from list
- [ ] **Verify**: Database record deleted
- [ ] **Verify**: Related data handled (cascade delete or preserved)

**Expected**: Subaccount deletion works with warnings
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 2.2: Subaccount Permissions

#### Assign Users to Subaccount

- [ ] Navigate to subaccount settings
- [ ] Find "Team" or "Access" section
- [ ] Assign user to subaccount
- [ ] Set permissions level
- [ ] Click "Save"
- [ ] **Verify**: User assigned successfully
- [ ] **Verify**: Database updated
- [ ] Sign in as assigned user
- [ ] **Verify**: Can access subaccount

**Expected**: User assignment works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / ⏭️ SKIPPED

---

#### Remove User from Subaccount

- [ ] Navigate to subaccount team settings
- [ ] Select user to remove
- [ ] Click "Remove"
- [ ] Confirm removal
- [ ] **Verify**: User removed from subaccount
- [ ] **Verify**: Database updated
- [ ] Sign in as removed user
- [ ] **Verify**: Cannot access subaccount

**Expected**: User removal works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / ⏭️ SKIPPED

---

### Subaccount Management Summary

**Tests Completed**: **\_/6
**Tests Passed**: \_**/6
**Tests Failed**: **\_/6
**Critical Issues**: **\_\***\*
**Overall\*\*: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

---

## Feature Category 3: Funnel Builder

**Priority**: 🚨 CRITICAL
**Focus**: Funnel CRUD, page builder, publishing, @dnd-kit functionality

### Feature 3.1: Funnel CRUD Operations

#### Create Funnel

- [ ] Navigate to Funnels
- [ ] Click "Create Funnel"
- [ ] Enter funnel name
- [ ] Enter funnel description
- [ ] Configure subdomain (if applicable)
- [ ] Click "Create"
- [ ] **Verify**: Funnel created successfully
- [ ] **Verify**: Database record created
- [ ] **Verify**: No console errors

**Expected**: Funnel creation works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### View Funnel List

- [ ] Navigate to Funnels page
- [ ] **Verify**: All funnels displayed
- [ ] **Verify**: Funnel names shown
- [ ] **Verify**: Status shown (Published/Draft)
- [ ] **Verify**: Actions available (Edit, Delete, etc.)
- [ ] **Verify**: No console errors

**Expected**: Funnel list displays correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Update Funnel Settings

- [ ] Open a funnel
- [ ] Navigate to funnel settings
- [ ] Update funnel name
- [ ] Update description
- [ ] Update subdomain
- [ ] Click "Save"
- [ ] **Verify**: Changes saved
- [ ] **Verify**: Database updated
- [ ] Refresh page
- [ ] **Verify**: Changes persisted

**Expected**: Funnel updates work
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Delete Funnel

- [ ] Navigate to funnel settings
- [ ] Click "Delete Funnel"
- [ ] **Verify**: Confirmation shown
- [ ] Confirm deletion
- [ ] **Verify**: Funnel removed from list
- [ ] **Verify**: Database record deleted
- [ ] **Verify**: Related pages deleted (cascade)

**Expected**: Funnel deletion works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 3.2: Funnel Page Management

#### Add Page to Funnel

- [ ] Open a funnel
- [ ] Click "Add Page"
- [ ] Enter page name
- [ ] Select template (if applicable)
- [ ] Click "Create"
- [ ] **Verify**: Page created successfully
- [ ] **Verify**: Page appears in funnel pages list
- [ ] **Verify**: Database record created

**Expected**: Page creation works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Reorder Funnel Pages

- [ ] In funnel page list
- [ ] Drag page to reorder (if drag-drop available)
- [ ] **Verify**: Page order changes
- [ ] **Verify**: Order saved to database
- [ ] Refresh page
- [ ] **Verify**: Order persisted

**Expected**: Page reordering works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

#### Delete Funnel Page

- [ ] Select a funnel page
- [ ] Click "Delete"
- [ ] **Verify**: Confirmation shown
- [ ] Confirm deletion
- [ ] **Verify**: Page removed from list
- [ ] **Verify**: Database record deleted

**Expected**: Page deletion works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 3.3: Page Editor (@dnd-kit Critical)

#### Add Components to Page

- [ ] Open page editor
- [ ] Drag "Text" component to canvas
- [ ] **Verify**: Component added successfully
- [ ] Drag "Image" component to canvas
- [ ] **Verify**: Component added successfully
- [ ] Drag "Container" component to canvas
- [ ] **Verify**: Component added successfully
- [ ] **Verify**: All drag-drop operations smooth
- [ ] **Verify**: No console errors

**Expected**: Component addition via drag-drop works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Drag-Drop Performance**: SMOOTH / LAGGY / BROKEN
**Status**: ✅ PASS / ❌ FAIL

---

#### Edit Component Properties

- [ ] Click on a component
- [ ] **Verify**: Properties panel opens
- [ ] Update text content
- [ ] Update styles (color, font, etc.)
- [ ] Update spacing/padding
- [ ] Click "Save" or auto-save
- [ ] **Verify**: Changes reflected in canvas
- [ ] **Verify**: Changes saved to database

**Expected**: Component editing works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Reorder Components (Drag-Drop)

- [ ] Drag component to different position
- [ ] **Verify**: Component moves
- [ ] **Verify**: Smooth drag animation
- [ ] Drop component
- [ ] **Verify**: New position saved
- [ ] Refresh page
- [ ] **Verify**: Position persisted

**Expected**: Component reordering works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Delete Component

- [ ] Select a component
- [ ] Click "Delete" or press Delete key
- [ ] **Verify**: Component removed from canvas
- [ ] **Verify**: Database updated
- [ ] **Verify**: No orphaned data

**Expected**: Component deletion works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 3.4: Funnel Publishing

#### Publish Funnel

- [ ] Open a funnel with pages
- [ ] Click "Publish"
- [ ] **Verify**: Publishing process initiated
- [ ] **Verify**: Success message shown
- [ ] **Verify**: Status changed to "Published"
- [ ] **Verify**: Database updated
- [ ] Open funnel URL in new tab
- [ ] **Verify**: Funnel accessible publicly

**Expected**: Funnel publishing works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Funnel URL**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Unpublish Funnel

- [ ] Open published funnel
- [ ] Click "Unpublish" or "Draft"
- [ ] **Verify**: Status changed to "Draft"
- [ ] **Verify**: Database updated
- [ ] Open funnel URL
- [ ] **Verify**: Funnel not accessible publicly (or shows draft message)

**Expected**: Unpublishing works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

### Funnel Builder Summary

**Tests Completed**: **\_/14
**Tests Passed**: \_**/14
**Tests Failed**: **\_/14
**Drag-Drop Issues**: YES / NO
**Critical Issues**: **\_\***\*
**Overall\*\*: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

---

## Feature Category 4: Pipeline & CRM

**Priority**: ⚠️ HIGH
**Focus**: Pipeline/Lane/Ticket CRUD, @dnd-kit drag-drop, CRM functionality

### Feature 4.1: Pipeline CRUD

#### Create Pipeline

- [ ] Navigate to Pipelines
- [ ] Click "Create Pipeline"
- [ ] Enter pipeline name
- [ ] Click "Create"
- [ ] **Verify**: Pipeline created successfully
- [ ] **Verify**: Database record created
- [ ] **Verify**: No console errors

**Expected**: Pipeline creation works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Update Pipeline

- [ ] Open pipeline settings
- [ ] Update pipeline name
- [ ] Update description (if applicable)
- [ ] Click "Save"
- [ ] **Verify**: Changes saved
- [ ] **Verify**: Database updated

**Expected**: Pipeline updates work
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Delete Pipeline

- [ ] Open pipeline settings
- [ ] Click "Delete Pipeline"
- [ ] **Verify**: Confirmation shown
- [ ] Confirm deletion
- [ ] **Verify**: Pipeline removed
- [ ] **Verify**: Database record deleted
- [ ] **Verify**: Related lanes/tickets deleted (cascade)

**Expected**: Pipeline deletion works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 4.2: Lane Management

#### Create Lane

- [ ] Open a pipeline
- [ ] Click "Add Lane"
- [ ] Enter lane name
- [ ] Click "Create"
- [ ] **Verify**: Lane created successfully
- [ ] **Verify**: Lane appears in pipeline
- [ ] **Verify**: Database record created

**Expected**: Lane creation works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Update Lane

- [ ] Click on lane settings
- [ ] Update lane name
- [ ] Update lane color (if applicable)
- [ ] Click "Save"
- [ ] **Verify**: Changes saved
- [ ] **Verify**: Database updated

**Expected**: Lane updates work
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Delete Lane

- [ ] Click on lane settings
- [ ] Click "Delete Lane"
- [ ] **Verify**: Confirmation shown (especially if tickets exist)
- [ ] Confirm deletion
- [ ] **Verify**: Lane removed
- [ ] **Verify**: Database record deleted
- [ ] **Verify**: Tickets handled (deleted or moved)

**Expected**: Lane deletion works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 4.3: Ticket Management

#### Create Ticket

- [ ] In a lane, click "Add Ticket"
- [ ] Enter ticket title
- [ ] Enter ticket description
- [ ] Enter ticket value (if applicable)
- [ ] Assign to user (if applicable)
- [ ] Click "Create"
- [ ] **Verify**: Ticket created successfully
- [ ] **Verify**: Ticket appears in lane
- [ ] **Verify**: Database record created

**Expected**: Ticket creation works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Update Ticket

- [ ] Click on a ticket
- [ ] Update ticket title
- [ ] Update ticket description
- [ ] Update ticket value
- [ ] Add tags (if applicable)
- [ ] Click "Save"
- [ ] **Verify**: Changes saved
- [ ] **Verify**: Database updated
- [ ] **Verify**: Changes reflected in lane

**Expected**: Ticket updates work
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Move Ticket Between Lanes (Drag-Drop - CRITICAL)

- [ ] Drag ticket from one lane to another
- [ ] **Verify**: Smooth drag animation
- [ ] **Verify**: Drop zone highlighted
- [ ] Drop ticket
- [ ] **Verify**: Ticket moved to new lane
- [ ] **Verify**: Database updated
- [ ] Refresh page
- [ ] **Verify**: Ticket still in new lane (persisted)

**Expected**: Ticket drag-drop works smoothly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Drag-Drop Performance**: SMOOTH / LAGGY / BROKEN
**Status**: ✅ PASS / ❌ FAIL

---

#### Delete Ticket

- [ ] Open ticket details
- [ ] Click "Delete Ticket"
- [ ] **Verify**: Confirmation shown
- [ ] Confirm deletion
- [ ] **Verify**: Ticket removed from lane
- [ ] **Verify**: Database record deleted

**Expected**: Ticket deletion works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 4.4: Ticket Details & Comments

#### Add Comment to Ticket

- [ ] Open ticket details
- [ ] Find comments section
- [ ] Add a comment
- [ ] Click "Submit"
- [ ] **Verify**: Comment appears
- [ ] **Verify**: Comment saved to database
- [ ] **Verify**: Timestamp correct
- [ ] **Verify**: Author shown

**Expected**: Comments work correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Delete Comment

- [ ] Find a comment
- [ ] Click "Delete" (if available)
- [ ] **Verify**: Confirmation shown
- [ ] Confirm deletion
- [ ] **Verify**: Comment removed
- [ ] **Verify**: Database updated

**Expected**: Comment deletion works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

### Pipeline & CRM Summary

**Tests Completed**: **\_/12
**Tests Passed**: \_**/12
**Tests Failed**: **\_/12
**Drag-Drop Issues**: YES / NO
**Critical Issues**: **\_\***\*
**Overall\*\*: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

---

## Feature Category 5: Media Management

**Priority**: ⚠️ HIGH
**Focus**: Media library, UploadThing integration, file CRUD

### Feature 5.1: Media Upload

#### Upload Single Image

- [ ] Navigate to Media library
- [ ] Click "Upload"
- [ ] Select single image file
- [ ] **Verify**: Upload progress shown
- [ ] **Verify**: Upload completes successfully
- [ ] **Verify**: Image appears in library
- [ ] **Verify**: Thumbnail generated
- [ ] **Verify**: Database record created

**Expected**: Single image upload works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Upload Multiple Images

- [ ] Click "Upload"
- [ ] Select multiple images (3-5)
- [ ] **Verify**: All uploads start
- [ ] **Verify**: Progress shown for each
- [ ] **Verify**: All complete successfully
- [ ] **Verify**: All appear in library
- [ ] **Verify**: Database records created

**Expected**: Batch upload works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Upload Success Rate**: **_/_**
**Status**: ✅ PASS / ❌ FAIL

---

#### Upload PDF/Document

- [ ] Click "Upload"
- [ ] Select PDF file
- [ ] **Verify**: Upload completes
- [ ] **Verify**: PDF appears in library
- [ ] **Verify**: Correct icon/preview shown
- [ ] **Verify**: File size shown

**Expected**: PDF upload works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 5.2: Media Management

#### View Media Details

- [ ] Click on uploaded media
- [ ] **Verify**: Detail view opens
- [ ] **Verify**: Full preview shown
- [ ] **Verify**: File name shown
- [ ] **Verify**: File size shown
- [ ] **Verify**: Upload date shown
- [ ] **Verify**: URL accessible

**Expected**: Media details display correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Update Media Metadata

- [ ] Open media details
- [ ] Update file name/title
- [ ] Update alt text (if applicable)
- [ ] Add tags (if applicable)
- [ ] Click "Save"
- [ ] **Verify**: Changes saved
- [ ] **Verify**: Database updated

**Expected**: Metadata updates work
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

#### Delete Media

- [ ] Select a media file
- [ ] Click "Delete"
- [ ] **Verify**: Confirmation shown
- [ ] Confirm deletion
- [ ] **Verify**: File removed from library
- [ ] **Verify**: Database record deleted
- [ ] Try to access file URL directly
- [ ] **Verify**: File not accessible (404)

**Expected**: Media deletion works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Feature 5.3: Media Usage

#### Use Media in Funnel

- [ ] Open funnel editor
- [ ] Add image component
- [ ] Click to select from media library
- [ ] **Verify**: Media library modal opens
- [ ] Select an image
- [ ] **Verify**: Image inserted into page
- [ ] **Verify**: Image displays correctly
- [ ] Save page
- [ ] **Verify**: Image URL saved

**Expected**: Media library integration works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

### Media Management Summary

**Tests Completed**: **\_/7
**Tests Passed**: \_**/7
**Tests Failed**: **\_/7
**Upload Issues**: YES / NO
**Critical Issues**: **\_\***\*
**Overall\*\*: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

---

## Feature Category 6: Analytics & Reports

**Priority**: 🟡 MEDIUM
**Focus**: Dashboard widgets, reports, data visualization

### Feature 6.1: Dashboard Analytics

#### View Business Dashboard

- [ ] Navigate to business dashboard
- [ ] **Verify**: Dashboard loads
- [ ] **Verify**: All widgets load
- [ ] **Verify**: Data displayed (revenue, users, etc.)
- [ ] **Verify**: Charts render correctly
- [ ] **Verify**: No console errors

**Expected**: Dashboard displays correctly
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### View Subaccount Dashboard

- [ ] Navigate to subaccount dashboard
- [ ] **Verify**: Dashboard loads
- [ ] **Verify**: Subaccount-specific data shown
- [ ] **Verify**: Widgets display correctly
- [ ] **Verify**: No console errors

**Expected**: Subaccount dashboard works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Filter Dashboard Data

- [ ] Find date range filter
- [ ] Change date range
- [ ] **Verify**: Dashboard updates
- [ ] **Verify**: Data reflects new range
- [ ] **Verify**: Charts update correctly

**Expected**: Dashboard filtering works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

### Feature 6.2: Reports

#### Generate Report

- [ ] Navigate to Reports (if available)
- [ ] Select report type
- [ ] Configure report parameters
- [ ] Click "Generate"
- [ ] **Verify**: Report generates
- [ ] **Verify**: Data displays correctly
- [ ] **Verify**: Export options available (if applicable)

**Expected**: Report generation works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

#### Export Report

- [ ] Generate a report
- [ ] Click "Export" (PDF/CSV/etc.)
- [ ] **Verify**: Export completes
- [ ] **Verify**: File downloads
- [ ] Open exported file
- [ ] **Verify**: Data correct and formatted

**Expected**: Report export works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

### Analytics & Reports Summary

**Tests Completed**: **\_/5
**Tests Passed**: \_**/5
**Tests Failed**: **\_/5
**Critical Issues**: **\_\***\*
**Overall\*\*: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

---

## Feature Category 7: Settings & Configuration

**Priority**: ⚠️ HIGH
**Focus**: User settings, preferences, integrations

### Feature 7.1: User Settings

#### Update Profile

- [ ] Navigate to user settings/profile
- [ ] Update name
- [ ] Update email
- [ ] Upload profile picture
- [ ] Click "Save"
- [ ] **Verify**: Changes saved
- [ ] **Verify**: Database updated (via Clerk)
- [ ] Refresh page
- [ ] **Verify**: Changes persisted

**Expected**: Profile updates work
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL

---

#### Change Password

- [ ] Navigate to security settings
- [ ] Click "Change Password"
- [ ] Enter current password
- [ ] Enter new password
- [ ] Confirm new password
- [ ] Click "Save"
- [ ] **Verify**: Password changed (via Clerk)
- [ ] Sign out and sign in with new password
- [ ] **Verify**: New password works

**Expected**: Password change works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

### Feature 7.2: Integrations

#### View Connected Integrations

- [ ] Navigate to Integrations
- [ ] **Verify**: Integration list loads
- [ ] **Verify**: Connected integrations shown
- [ ] **Verify**: Status displayed (Connected/Disconnected)

**Expected**: Integrations page works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

#### Connect Integration

- [ ] Select an integration to connect
- [ ] Click "Connect"
- [ ] Complete OAuth flow (if applicable)
- [ ] **Verify**: Integration connected
- [ ] **Verify**: Status updated
- [ ] **Verify**: Database updated

**Expected**: Integration connection works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

#### Disconnect Integration

- [ ] Select connected integration
- [ ] Click "Disconnect"
- [ ] **Verify**: Confirmation shown
- [ ] Confirm disconnection
- [ ] **Verify**: Integration disconnected
- [ ] **Verify**: Status updated
- [ ] **Verify**: Database updated

**Expected**: Integration disconnection works
**Actual**: **\*\*\*\***\*\***\*\*\*\***\_\_\_**\*\*\*\***\*\***\*\*\*\***
**Status**: ✅ PASS / ❌ FAIL / N/A

---

### Settings & Configuration Summary

**Tests Completed**: **\_/5
**Tests Passed**: \_**/5
**Tests Failed**: **\_/5
**Critical Issues**: **\_\***\*
**Overall\*\*: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

---

## Day 14 Feature Testing Summary

### Overall Results by Category

| Category                    | Tests  | Passed        | Failed        | Status     |
| --------------------------- | ------ | ------------- | ------------- | ---------- |
| 1. Business Management      | 9      | \_\_\_/9      | \_\_\_/9      | ✅/⚠️/❌   |
| 2. Subaccount Management    | 6      | \_\_\_/6      | \_\_\_/6      | ✅/⚠️/❌   |
| 3. Funnel Builder           | 14     | \_\_\_/14     | \_\_\_/14     | ✅/⚠️/❌   |
| 4. Pipeline & CRM           | 12     | \_\_\_/12     | \_\_\_/12     | ✅/⚠️/❌   |
| 5. Media Management         | 7      | \_\_\_/7      | \_\_\_/7      | ✅/⚠️/❌   |
| 6. Analytics & Reports      | 5      | \_\_\_/5      | \_\_\_/5      | ✅/⚠️/❌   |
| 7. Settings & Configuration | 5      | \_\_\_/5      | \_\_\_/5      | ✅/⚠️/❌   |
| **TOTAL**                   | **58** | **\_\_\_/58** | **\_\_\_/58** | **\_\_\_** |

### Feature Test Pass Rate

**Overall Pass Rate**: **_/58 (_**%)
**Target**: 90% (52/58)
**Met Target**: YES / NO

### Critical Features Status

| Feature                  | Status   | Notes   |
| ------------------------ | -------- | ------- |
| Business CRUD            | ✅/⚠️/❌ | [notes] |
| Subaccount CRUD          | ✅/⚠️/❌ | [notes] |
| Funnel Builder           | ✅/⚠️/❌ | [notes] |
| @dnd-kit (Funnel)        | ✅/⚠️/❌ | [notes] |
| Pipeline CRUD            | ✅/⚠️/❌ | [notes] |
| @dnd-kit (Pipeline)      | ✅/⚠️/❌ | [notes] |
| Media Upload/Management  | ✅/⚠️/❌ | [notes] |
| Settings & Configuration | ✅/⚠️/❌ | [notes] |

### Issues Found

**🚨 CRITICAL Issues**:

1. [Issue] - [Feature] - [Description]

**⚠️ HIGH Priority Issues**:

1. [Issue] - [Feature] - [Description]

**🟡 MEDIUM Priority Issues**:

1. [Issue] - [Feature] - [Description]

**🟢 LOW Priority Issues**:

1. [Issue] - [Feature] - [Description]

### Data Integrity Assessment

**CRUD Operations**: ✅ PASS / ⚠️ ISSUES / ❌ FAIL
**Data Persistence**: ✅ PASS / ⚠️ ISSUES / ❌ FAIL
**Cascade Deletes**: ✅ PASS / ⚠️ ISSUES / ❌ FAIL
**Database Consistency**: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

### Day 14 Status

- [ ] ✅ **PASS** - All features working correctly
- [ ] ⚠️ **PASS WITH ISSUES** - Minor issues found
- [ ] ❌ **FAIL** - Critical feature failures

**Next Steps**:

- If PASS: Proceed to Day 14 Part 2 (Regression Analysis)
- If PASS WITH ISSUES: Document issues, proceed to regression analysis
- If FAIL: Fix critical issues before continuing

---

**Sign-Off**: **\*\***\_\_\_\_**\*\*** Date: \***\*\_\_\*\***

---

**Document Status**: ⏳ IN PROGRESS / ✅ COMPLETE
**Completed By**: **\*\***\_\_\_\_**\*\***
**Completion Date**: **\*\***\_\_\_\_**\*\***
