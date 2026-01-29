# Funnel Testing - Next.js 15 Upgrade

**Date:** December 4, 2025
**Tester:** [Your Name]
**Priority:** 🚨 CRITICAL
**Feature:** Funnel Builder & Publishing

## Test Overview

The funnel builder is a core feature involving:

- Drag-and-drop page editing
- Image uploads
- Form submissions
- Subdomain routing
- SEO configuration
- Publishing workflow

---

## Test 1: Funnel Creation & Basic Setup

**Priority:** 🚨 CRITICAL
**Time Estimate:** 10-15 minutes

### Prerequisites

- Signed in as business owner or admin
- At least one subaccount created

### Test Steps

1. **Navigate to Funnels**
   - [ ] From dashboard, navigate to funnels section
   - [ ] URL should be: `/subaccount/[subaccountId]/funnels`
   - [ ] **Check:** Page loads without errors
   - [ ] **Check:** List of existing funnels displays (or empty state)

2. **Create New Funnel**
   - [ ] Click "Create Funnel" or "+" button
   - [ ] Modal/form appears
   - [ ] Fill in funnel details:
     - Name: `Test Funnel - Next.js 15`
     - Subdomain: `testfunnel15` (or unique name)
     - Description: `Testing after Next.js 15 upgrade`
   - [ ] Click "Create" or "Save"
   - [ ] **Check:** Success message appears
   - [ ] **Check:** Redirects to funnel detail page
   - [ ] **Check:** No console errors

3. **Verify Funnel Created**
   - [ ] Funnel appears in funnels list
   - [ ] Funnel name is correct
   - [ ] Subdomain is saved correctly
   - [ ] Created date/time is accurate

### Expected Results

- ✅ Can navigate to funnels page
- ✅ Can create new funnel
- ✅ Funnel data saves correctly

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

**Notes:**

```

```

**Console Errors:**

```

```

---

## Test 2: Funnel Page Management

**Priority:** 🚨 CRITICAL
**Time Estimate:** 15-20 minutes

### Test Steps

1. **Add New Page to Funnel**
   - [ ] From funnel detail view, click "Add Page"
   - [ ] Enter page details:
     - Name: `Landing Page`
     - Path: `home` or `/`
   - [ ] Select page type/template (if applicable)
   - [ ] Click "Create Page"
   - [ ] **Check:** Page created successfully
   - [ ] **Check:** Page appears in funnel pages list

2. **Add Multiple Pages**
   - [ ] Create second page: `Thank You`
   - [ ] Create third page: `About`
   - [ ] **Check:** All pages display in correct order
   - [ ] **Check:** Can reorder pages (drag-drop or buttons)

3. **Navigate to Page Editor**
   - [ ] Click "Edit" on Landing Page
   - [ ] **Check:** Editor loads
   - [ ] **Check:** URL is: `/subaccount/[subaccountId]/funnels/[funnelId]/editor/[pageId]`
   - [ ] **Check:** No console errors on editor load

### Expected Results

- ✅ Can add multiple pages
- ✅ Pages save correctly
- ✅ Editor loads without errors

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

**Notes:**

```

```

---

## Test 3: Page Editor - Content & Components

**Priority:** 🚨 CRITICAL
**Time Estimate:** 20-30 minutes

### Test Steps - Text Elements

1. **Add Text Element**
   - [ ] In editor, drag "Text" element onto page
   - [ ] **Check:** Element appears on canvas
   - [ ] Double-click to edit text
   - [ ] Type: `Welcome to Our Funnel`
   - [ ] **Check:** Text updates in real-time
   - [ ] **Check:** Can change font size
   - [ ] **Check:** Can change font color
   - [ ] **Check:** Can change alignment

### Test Steps - Image Elements

2. **Add Image Element**
   - [ ] Drag "Image" element onto page
   - [ ] **Check:** Image placeholder appears
   - [ ] Click to upload image
   - [ ] Select image file (use test image)
   - [ ] **Check:** Image uploads successfully
   - [ ] **Check:** Image displays in editor
   - [ ] **Check:** Can resize image
   - [ ] **Check:** Image optimization working (Next.js Image)

3. **Test Remote Image Loading**
   - [ ] Add image with external URL (if supported)
   - [ ] Use URL from allowed domain (uploadthing, clerk, etc.)
   - [ ] **Check:** Remote image loads correctly
   - [ ] **Check:** No CORS errors
   - [ ] **Check:** remotePatterns config working

### Test Steps - Form Elements

4. **Add Form Element**
   - [ ] Drag "Form" or "Contact Form" onto page
   - [ ] **Check:** Form appears with fields
   - [ ] Configure form fields:
     - Name field
     - Email field
     - Message field
   - [ ] Set form submission action
   - [ ] **Check:** Form saves configuration

### Test Steps - Container & Layout

5. **Add Container/Section**
   - [ ] Drag "Container" or "Section" element
   - [ ] **Check:** Container appears
   - [ ] Add elements inside container
   - [ ] **Check:** Nested elements work
   - [ ] Adjust container width/padding
   - [ ] **Check:** Layout updates correctly

6. **Test Drag & Drop**
   - [ ] Drag element to different position
   - [ ] **Check:** Element moves smoothly
   - [ ] Drop element in new position
   - [ ] **Check:** Position saves
   - [ ] **Check:** No layout breaking

### Test Steps - Styling

7. **Style Elements**
   - [ ] Select an element
   - [ ] Open style panel
   - [ ] Change background color
   - [ ] Add padding/margin
   - [ ] Add border
   - [ ] **Check:** All style changes apply
   - [ ] **Check:** Styles persist on save

### Expected Results

- ✅ All editor components load and work
- ✅ Drag and drop functional
- ✅ Images upload and display
- ✅ Forms can be configured
- ✅ Styling works correctly

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

**Notes:**

```

```

**Console Errors:**

```

```

---

## Test 4: SEO & Settings Configuration

**Priority:** ⚠️ HIGH
**Time Estimate:** 10 minutes

### Test Steps

1. **Configure Page SEO**
   - [ ] In page settings, find SEO section
   - [ ] Set page title: `Test Landing Page | Next.js 15`
   - [ ] Set meta description
   - [ ] Add Open Graph image (if supported)
   - [ ] **Check:** Settings save

2. **Configure Funnel Settings**
   - [ ] Navigate to funnel settings
   - [ ] Set custom domain (if applicable)
   - [ ] Configure analytics/tracking (if applicable)
   - [ ] Set up redirects (if applicable)
   - [ ] **Check:** All settings save correctly

### Expected Results

- ✅ SEO fields save correctly
- ✅ Funnel settings persist

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Test 5: Publishing & Live Preview

**Priority:** 🚨 CRITICAL
**Time Estimate:** 15-20 minutes

### Test Steps - Publishing

1. **Save & Publish Funnel**
   - [ ] Click "Save" in editor
   - [ ] **Check:** Save success message
   - [ ] Click "Publish" button
   - [ ] Confirm publish action
   - [ ] **Check:** Publish success message
   - [ ] Note the published URL

2. **Verify Subdomain Routing**
   - [ ] Open new browser tab
   - [ ] Navigate to published funnel URL
   - [ ] URL should be: `http://[subdomain].localhost:3000` or similar
   - [ ] **Check:** Funnel page loads
   - [ ] **Check:** All content displays correctly
   - [ ] **Check:** Images load (test Next.js Image optimization)
   - [ ] **Check:** No console errors on published page

3. **Test Form Submission on Published Page**
   - [ ] On published funnel page, find form
   - [ ] Fill out form fields:
     - Name: `Test User`
     - Email: `test@example.com`
     - Message: `Testing form after Next.js 15 upgrade`
   - [ ] Click "Submit"
   - [ ] **Check:** Form submits successfully
   - [ ] **Check:** Confirmation message appears
   - [ ] **Check:** Form data saved (check database/admin panel)

### Test Steps - Live vs Draft

4. **Test Draft Mode**
   - [ ] Make changes to page in editor
   - [ ] Save but don't publish
   - [ ] View published page
   - [ ] **Check:** Changes don't appear on live page
   - [ ] Click "Preview" button
   - [ ] **Check:** Preview shows draft changes

5. **Publish Updated Changes**
   - [ ] Publish the changes
   - [ ] Reload published page
   - [ ] **Check:** Updates now visible on live page

### Test Steps - Multiple Pages

6. **Test Page Navigation on Published Funnel**
   - [ ] On published funnel, navigate between pages
   - [ ] Click links to different pages
   - [ ] **Check:** All pages load correctly
   - [ ] **Check:** URLs are correct
   - [ ] **Check:** No broken links

### Expected Results

- ✅ Funnel publishes successfully
- ✅ Subdomain routing works
- ✅ Published page displays all content correctly
- ✅ Images load and are optimized
- ✅ Forms submit successfully
- ✅ Draft vs published mode works
- ✅ Page navigation functional

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

**Subdomain URL:** `__________________________`

**Notes:**

```

```

**Console Errors (Published Page):**

```

```

---

## Test 6: Responsive Design on Funnel

**Priority:** ⚠️ HIGH
**Time Estimate:** 10-15 minutes

### Test Steps

1. **Desktop View**
   - [ ] View published funnel in desktop (1920x1080)
   - [ ] **Check:** Layout looks correct
   - [ ] **Check:** All elements visible
   - [ ] **Check:** No horizontal scrolling

2. **Tablet View**
   - [ ] Open DevTools, set to tablet (768x1024)
   - [ ] **Check:** Layout adjusts appropriately
   - [ ] **Check:** Content readable
   - [ ] **Check:** Navigation works

3. **Mobile View**
   - [ ] Set to mobile view (375x667)
   - [ ] **Check:** Layout is mobile-friendly
   - [ ] **Check:** Text is readable
   - [ ] **Check:** Forms are usable
   - [ ] **Check:** Images scale correctly

### Expected Results

- ✅ Responsive design works across devices
- ✅ No layout breaking at different breakpoints

### Actual Results

**Status:** ✅ PASS / ❌ FAIL

---

## Test 7: Performance & Image Optimization

**Priority:** ⚠️ HIGH
**Time Estimate:** 10 minutes

### Test Steps

1. **Check Next.js Image Optimization**
   - [ ] On published page, open DevTools → Network tab
   - [ ] Reload page
   - [ ] Find image requests
   - [ ] **Check:** Images served from `_next/image` endpoint
   - [ ] **Check:** Images have correct format (WebP if supported)
   - [ ] **Check:** Images have appropriate sizes
   - [ ] **Check:** Lazy loading working (images below fold load on scroll)

2. **Page Load Performance**
   - [ ] Open DevTools → Lighthouse
   - [ ] Run Lighthouse audit on published funnel
   - [ ] Record scores:
     - Performance: \_\_\_/100
     - Accessibility: \_\_\_/100
     - Best Practices: \_\_\_/100
     - SEO: \_\_\_/100
   - [ ] **Check:** No critical issues

### Expected Results

- ✅ Next.js Image optimization working
- ✅ Images properly optimized and lazy loaded
- ✅ Reasonable Lighthouse scores

### Actual Results

**Performance Score:** \_\_\_/100

**Notes:**

```

```

---

## Edge Cases & Error Handling

### Test Edge Cases

1. **Invalid Subdomain**
   - [ ] Try creating funnel with invalid subdomain (spaces, special chars)
   - Expected: Validation error
   - Actual:

2. **Duplicate Subdomain**
   - [ ] Try creating funnel with existing subdomain
   - Expected: Error message
   - Actual:

3. **Image Upload Errors**
   - [ ] Try uploading very large image (>10MB)
   - Expected: Error or automatic compression
   - Actual:

   - [ ] Try uploading unsupported file type
   - Expected: Validation error
   - Actual:

4. **Network Interruption**
   - [ ] Start publishing, disconnect internet
   - Expected: Graceful error handling
   - Actual:

5. **Concurrent Editing**
   - [ ] Open same funnel page in two browser tabs
   - [ ] Make changes in both
   - Expected: Conflict detection or last-write-wins
   - Actual:

---

## Summary

### Funnel Builder Status

- **Status:** ✅ PASS / ⚠️ ISSUES FOUND / ❌ FAIL

### Critical Issues Found

1.
2.
3.

### Minor Issues Found

1.
2.

### Performance Notes

- Editor load time: Fast / Acceptable / Slow
- Publish time: Fast / Acceptable / Slow
- Published page load: Fast / Acceptable / Slow

### Next.js 15 Specific Observations

- **Image Optimization:** Working / Issues
- **Subdomain Routing:** Working / Issues
- **Build Performance:** Better / Same / Worse than before

### Overall Assessment

- **Ready for production?** YES / NO / WITH FIXES
- **Blocker for deployment?** YES / NO
- **Recommended actions:**

---

## Test Environment

- **Date:** December 4, 2025
- **Next.js Version:** 15.5.6
- **Browser:**
- **Subaccount ID:**
- **Funnel ID:**
- **Published URL:**
