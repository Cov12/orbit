# Pipeline Testing - Next.js 15 Upgrade

**Date:** December 4, 2025
**Tester:** [Your Name]
**Priority:** 🚨 CRITICAL
**Feature:** Pipeline/CRM & Drag-Drop (react-beautiful-dnd)

## Test Overview

Pipeline/CRM involves:

- Kanban board interface
- Drag-and-drop functionality (react-beautiful-dnd)
- Ticket management
- Lane management
- Real-time updates
- Data persistence

**CRITICAL NOTE:** This uses `react-beautiful-dnd` which we kept working with React 18. This is a key area to test thoroughly since drag-and-drop can be fragile during upgrades.

---

## Test 1: Pipeline Creation & Setup

**Priority:** 🚨 CRITICAL
**Time Estimate:** 10 minutes

### Prerequisites

- Signed in to subaccount
- Access to pipelines section

### Test Steps

1. **Navigate to Pipelines**
   - [ ] From subaccount dashboard, go to Pipelines
   - [ ] URL should be: `/subaccount/[subaccountId]/pipelines`
   - [ ] **Check:** Page loads without errors
   - [ ] **Check:** List of existing pipelines displays

2. **Create New Pipeline**
   - [ ] Click "Create Pipeline" button
   - [ ] Enter pipeline name: `Test Pipeline - Next.js 15`
   - [ ] Click "Create" or "Save"
   - [ ] **Check:** Success message appears
   - [ ] **Check:** Pipeline created
   - [ ] **Check:** Redirects to pipeline view

3. **Verify Pipeline Created**
   - [ ] Pipeline appears in pipelines list
   - [ ] Pipeline name is correct
   - [ ] Can click to view pipeline

### Expected Results

- ✅ Can navigate to pipelines
- ✅ Can create new pipeline
- ✅ Pipeline saves correctly

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

**Notes:**

```

```

---

## Test 2: Lane Management

**Priority:** 🚨 CRITICAL
**Time Estimate:** 10 minutes

### Test Steps

1. **View Default Lanes**
   - [ ] Open pipeline created in Test 1
   - [ ] **Check:** Default lanes appear (if any)
   - [ ] **Check:** Kanban board renders correctly

2. **Add New Lane**
   - [ ] Click "Add Lane" or "+" button
   - [ ] Enter lane name: `Lead`
   - [ ] Enter lane order: `0` (or first position)
   - [ ] Click "Create"
   - [ ] **Check:** Lane appears on board
   - [ ] **Check:** Lane is in correct position

3. **Add Multiple Lanes**
   - [ ] Add lane: `Contacted`
   - [ ] Add lane: `Qualified`
   - [ ] Add lane: `Proposal`
   - [ ] Add lane: `Closed Won`
   - [ ] **Check:** All lanes appear
   - [ ] **Check:** Lanes are in correct order

4. **Edit Lane**
   - [ ] Click edit on "Lead" lane
   - [ ] Change name to: `New Lead`
   - [ ] Save changes
   - [ ] **Check:** Lane name updates
   - [ ] **Check:** No data loss

5. **Reorder Lanes (if supported)**
   - [ ] Try to reorder lanes (drag or buttons)
   - [ ] **Check:** Lanes can be reordered
   - [ ] **Check:** Order persists on refresh

### Expected Results

- ✅ Can add lanes
- ✅ Can edit lanes
- ✅ Can reorder lanes
- ✅ Changes persist

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Test 3: Ticket Creation & Management

**Priority:** 🚨 CRITICAL
**Time Estimate:** 15 minutes

### Test Steps - Creating Tickets

1. **Add Ticket to Lane**
   - [ ] In "New Lead" lane, click "Add Ticket" or "+"
   - [ ] Enter ticket details:
     - Name: `John Doe - Website Inquiry`
     - Value: `$5000`
     - Description: `Interested in new website`
   - [ ] Click "Create"
   - [ ] **Check:** Ticket appears in lane
   - [ ] **Check:** Ticket displays all information

2. **Add Multiple Tickets**
   - [ ] Add ticket: `Jane Smith - SEO Services`
   - [ ] Add ticket: `Bob Johnson - Redesign`
   - [ ] Add ticket: `Alice Brown - Maintenance`
   - [ ] **Check:** All tickets appear in "New Lead" lane
   - [ ] **Check:** Tickets are stacked vertically

3. **View Ticket Details**
   - [ ] Click on a ticket to open details
   - [ ] **Check:** Ticket detail modal/panel opens
   - [ ] **Check:** All ticket information displays
   - [ ] **Check:** Can view/edit fields

### Test Steps - Editing Tickets

4. **Edit Ticket Information**
   - [ ] Open ticket details
   - [ ] Change ticket name
   - [ ] Change ticket value
   - [ ] Update description
   - [ ] Add notes/comments
   - [ ] Save changes
   - [ ] **Check:** Changes save successfully
   - [ ] **Check:** Updates reflected immediately
   - [ ] Close and reopen ticket
   - [ ] **Check:** Changes persisted

5. **Assign Ticket to User**
   - [ ] Open ticket details
   - [ ] Find "Assign to" field
   - [ ] Select a team member
   - [ ] Save assignment
   - [ ] **Check:** Assignment saves
   - [ ] **Check:** Assigned user displays on ticket card

6. **Add Tags to Ticket**
   - [ ] Open ticket details
   - [ ] Add tag: `Hot Lead`
   - [ ] Add tag: `Priority`
   - [ ] Save
   - [ ] **Check:** Tags appear on ticket
   - [ ] **Check:** Tags display in ticket list

### Expected Results

- ✅ Can create tickets
- ✅ Can edit ticket details
- ✅ Can assign tickets
- ✅ Can add tags
- ✅ All changes persist

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

**Notes:**

```

```

---

## Test 4: Drag & Drop Functionality (CRITICAL)

**Priority:** 🚨 CRITICAL - HIGHEST RISK AREA
**Time Estimate:** 20 minutes

### IMPORTANT

This tests `react-beautiful-dnd` which we kept on React 18 for compatibility.
This is the **most critical test** for the pipeline feature.

### Test Steps - Vertical Drag (Within Lane)

1. **Reorder Tickets in Same Lane**
   - [ ] In "New Lead" lane with multiple tickets
   - [ ] Grab first ticket (click and hold)
   - [ ] **Check:** Ticket highlights/shows drag state
   - [ ] Drag ticket down to third position
   - [ ] **Check:** Other tickets shift up
   - [ ] Release ticket (drop)
   - [ ] **Check:** Ticket stays in new position
   - [ ] **Check:** No visual glitches
   - [ ] **Check:** No console errors

2. **Verify Order Persistence**
   - [ ] Refresh page
   - [ ] **Check:** Ticket order maintained
   - [ ] **Check:** No tickets lost
   - [ ] **Check:** No duplicate tickets

### Test Steps - Horizontal Drag (Between Lanes)

3. **Move Ticket to Adjacent Lane**
   - [ ] Grab ticket from "New Lead" lane
   - [ ] **Check:** Drag preview appears
   - [ ] Drag ticket to "Contacted" lane
   - [ ] Hover over "Contacted" lane
   - [ ] **Check:** Lane highlights as drop target
   - [ ] Drop ticket in "Contacted" lane
   - [ ] **Check:** Ticket moves to new lane
   - [ ] **Check:** Ticket removed from old lane
   - [ ] **Check:** No console errors

4. **Move Ticket Across Multiple Lanes**
   - [ ] Grab ticket from "Contacted"
   - [ ] Drag all the way to "Closed Won" lane
   - [ ] **Check:** Can drag across multiple lanes
   - [ ] Drop in "Closed Won"
   - [ ] **Check:** Move successful
   - [ ] Refresh page
   - [ ] **Check:** Ticket is in "Closed Won"

5. **Move Ticket Back**
   - [ ] Grab ticket from "Closed Won"
   - [ ] Move back to "New Lead"
   - [ ] **Check:** Reverse movement works
   - [ ] **Check:** Lane updates correctly

### Test Steps - Drag Edge Cases

6. **Drag to Empty Lane**
   - [ ] Find or create an empty lane
   - [ ] Drag ticket to empty lane
   - [ ] **Check:** Drop zone appears in empty lane
   - [ ] Drop ticket
   - [ ] **Check:** Ticket appears in empty lane

7. **Drag to Specific Position in Lane**
   - [ ] Drag ticket to lane with multiple tickets
   - [ ] Try to place between two specific tickets
   - [ ] **Check:** Drop indicator shows between tickets
   - [ ] Drop in desired position
   - [ ] **Check:** Ticket inserted in correct position
   - [ ] **Check:** Other tickets reorder appropriately

8. **Fast Dragging**
   - [ ] Grab ticket and move very quickly
   - [ ] **Check:** Drag keeps up with mouse movement
   - [ ] **Check:** No lag or stuttering
   - [ ] Drop
   - [ ] **Check:** Ticket ends up in intended location

9. **Cancel Drag**
   - [ ] Start dragging ticket
   - [ ] Press ESC or release outside board
   - [ ] **Check:** Ticket returns to original position
   - [ ] **Check:** No errors

### Test Steps - Multiple Operations

10. **Sequential Drags**
    - [ ] Move 5 tickets in quick succession
    - [ ] **Check:** Each drag completes correctly
    - [ ] **Check:** No conflicts or errors
    - [ ] Refresh page
    - [ ] **Check:** All moves persisted correctly

11. **Drag During Load (if applicable)**
    - [ ] If page loads data dynamically
    - [ ] Try dragging while data is loading
    - [ ] **Check:** Graceful handling (disabled or error message)

### Expected Results

- ✅ Can drag tickets vertically (reorder in lane)
- ✅ Can drag tickets horizontally (between lanes)
- ✅ Drag preview/indicators work correctly
- ✅ Drop zones highlight appropriately
- ✅ All moves persist to database
- ✅ No visual glitches during drag
- ✅ No console errors
- ✅ Performance is smooth

### Actual Results

**Status:** ✅ PASS / ⚠️ ISSUES / ❌ FAIL

**Console Errors During Drag:**

```

```

**Performance Notes:**

- Drag responsiveness: Smooth / Acceptable / Laggy
- Drop animation: Smooth / Acceptable / Broken

**Critical Issues:**

```

```

---

## Test 5: Data Persistence & Updates

**Priority:** 🚨 CRITICAL
**Time Estimate:** 10 minutes

### Test Steps

1. **Verify Database Updates**
   - [ ] Move ticket between lanes
   - [ ] Open browser DevTools → Network tab
   - [ ] **Check:** API call made to update ticket
   - [ ] **Check:** API call succeeds (status 200)
   - [ ] **Check:** Response looks correct

2. **Test Optimistic Updates**
   - [ ] Move ticket
   - [ ] **Check:** UI updates immediately (optimistic)
   - [ ] **Check:** No flickering or rollback
   - [ ] If API fails (test by disconnecting internet):
     - **Check:** Error message appears
     - **Check:** Ticket reverts to original position

3. **Concurrent User Simulation**
   - [ ] Open pipeline in two browser tabs
   - [ ] In tab 1: Move ticket to "Contacted"
   - [ ] In tab 2: Refresh or wait for update
   - [ ] **Check:** Tab 2 shows updated ticket position
   - [ ] (Or document if real-time sync not implemented)

4. **Refresh Consistency**
   - [ ] Perform multiple drag operations
   - [ ] Hard refresh page (Ctrl+Shift+R)
   - [ ] **Check:** All changes persisted
   - [ ] **Check:** No data corruption
   - [ ] **Check:** Ticket order correct in all lanes

### Expected Results

- ✅ All moves save to database
- ✅ Optimistic updates work
- ✅ Data persists across refreshes
- ✅ No data loss or corruption

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Test 6: Pipeline Features

**Priority:** ⚠️ HIGH
**Time Estimate:** 15 minutes

### Test Steps

1. **Search/Filter Tickets**
   - [ ] Find search/filter functionality
   - [ ] Search for ticket by name
   - [ ] **Check:** Matching tickets highlight/filter
   - [ ] Clear search
   - [ ] **Check:** All tickets reappear

2. **Ticket Comments/Notes**
   - [ ] Open ticket details
   - [ ] Add comment/note
   - [ ] Save
   - [ ] **Check:** Comment appears
   - [ ] Add second comment
   - [ ] **Check:** Comments display chronologically

3. **Ticket Contacts/Customers**
   - [ ] Open ticket details
   - [ ] Link ticket to customer/contact
   - [ ] Save
   - [ ] **Check:** Customer info displays on ticket

4. **Delete Ticket**
   - [ ] Create test ticket
   - [ ] Delete ticket
   - [ ] Confirm deletion
   - [ ] **Check:** Ticket removed from board
   - [ ] Refresh page
   - [ ] **Check:** Ticket still deleted (persisted)

5. **Delete Lane (if supported)**
   - [ ] Try to delete lane with tickets
   - [ ] **Check:** Warning about tickets (if any)
   - [ ] Delete empty lane
   - [ ] **Check:** Lane removed
   - [ ] **Check:** No orphaned tickets

### Expected Results

- ✅ Search/filter works
- ✅ Comments functional
- ✅ Customer linking works
- ✅ Delete operations work correctly

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Test 7: Performance & Scalability

**Priority:** ⚠️ HIGH
**Time Estimate:** 10 minutes

### Test Steps

1. **Large Number of Tickets**
   - [ ] Create pipeline with 20+ tickets
   - [ ] Distribute across lanes
   - [ ] **Check:** Board renders all tickets
   - [ ] Try dragging with many tickets
   - [ ] **Check:** Drag performance acceptable
   - [ ] Measure lag/stuttering

2. **Many Lanes**
   - [ ] Create pipeline with 10+ lanes
   - [ ] **Check:** Horizontal scroll works (if applicable)
   - [ ] **Check:** All lanes visible/accessible
   - [ ] Drag ticket across many lanes
   - [ ] **Check:** Performance acceptable

3. **Page Load Time**
   - [ ] Close and reopen pipeline with lots of data
   - [ ] Note load time: \_\_\_ seconds
   - [ ] **Check:** Load time acceptable (<3 seconds)

### Expected Results

- ✅ Handles large datasets
- ✅ Performance acceptable with many tickets/lanes
- ✅ No significant lag

### Actual Results

**Performance with 20 tickets:** Good / Acceptable / Poor
**Performance with 10 lanes:** Good / Acceptable / Poor

---

## Edge Cases & Error Handling

### Test Edge Cases

1. **Network Error During Drag**
   - [ ] Start drag, disconnect internet mid-drag
   - Expected: Graceful error, ticket reverts
   - Actual:

2. **Empty Pipeline**
   - [ ] View pipeline with no lanes or tickets
   - Expected: Empty state message
   - Actual:

3. **Ticket with Very Long Name**
   - [ ] Create ticket with 200+ character name
   - Expected: Text truncates or wraps
   - Actual:

4. **Duplicate Ticket Names**
   - [ ] Create multiple tickets with same name
   - Expected: Allowed (or appropriate handling)
   - Actual:

5. **Rapid Lane Switching**
   - [ ] Move ticket quickly between multiple lanes
   - Expected: All moves process correctly
   - Actual:

---

## react-beautiful-dnd Specific Checks

### Verify Library Working

- [ ] **react-beautiful-dnd version:** Check in package.json
- [ ] **Drag handle appears** when hovering over tickets
- [ ] **Drag preview/ghost** appears when dragging
- [ ] **Drop placeholder** shows where ticket will land
- [ ] **Animations smooth** (no janky transitions)
- [ ] **Touch support** (test on touch device if available)
- [ ] **Keyboard support** (try dragging with keyboard if supported)

### Console Checks

**During drag operations, check for:**

- [ ] No React errors
- [ ] No warning about StrictMode (should be disabled)
- [ ] No deprecation warnings from react-beautiful-dnd

---

## Summary

### Pipeline/CRM Status

- **Status:** ✅ PASS / ⚠️ ISSUES FOUND / ❌ FAIL

### Drag & Drop Status

- **Status:** ✅ FULLY WORKING / ⚠️ ISSUES / ❌ BROKEN

### Critical Issues Found

1.
2.
3.

### Performance Assessment

- Small pipelines (<10 tickets): \_\_\_
- Medium pipelines (10-30 tickets): \_\_\_
- Large pipelines (30+ tickets): \_\_\_

### react-beautiful-dnd Compatibility

- **Working with React 18:** ✅ YES / ❌ NO
- **Any deprecation warnings:** YES / NO
- **Performance:** Good / Acceptable / Poor

### Overall Assessment

- **Ready for production?** YES / NO / WITH FIXES
- **Blocker for deployment?** YES / NO
- **Recommended actions:**

---

## Test Environment

- **Date:** December 4, 2025
- **Next.js Version:** 15.5.6
- **React Version:** 18.3.1
- **react-beautiful-dnd Version:** [check package.json]
- **Browser:**
- **Pipeline ID:**
- **Number of lanes tested:**
- **Number of tickets tested:**
