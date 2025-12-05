# Week 4 Testing Plan - Next.js 15 Upgrade

**Start Date:** December 4, 2025
**Goal:** Comprehensive testing and validation of Next.js 15 upgrade
**Status:** In Progress

## Pre-Testing Status

### Build Status

- ✅ Build compiles successfully
- ✅ Next.js 15.5.6 installed
- ✅ Clerk v6.35.5 working
- ✅ Authentication functional
- ⚠️ 1 non-critical TypeScript warning (Decimal type - doesn't affect runtime)

### Environment

- Node.js: v20.11.0
- npm: Latest
- Database: Connected
- Environment variables: Configured

## Testing Schedule

### Day 13: Monday - Critical User Journeys

**Time Estimate:** 6-8 hours

#### Critical User Journeys to Test

1. **New Business Onboarding** (Priority: CRITICAL)
   - Sign up for new account
   - Complete email verification
   - Fill out business details
   - Upload logo
   - Invite team member
   - Create first subaccount
   - Verify dashboard loads

2. **Funnel Creation & Publishing** (Priority: CRITICAL)
   - Navigate to funnels
   - Create new funnel
   - Add funnel pages
   - Customize page content
   - Upload images to pages
   - Configure SEO settings
   - Publish funnel
   - Verify funnel loads on subdomain
   - Test form submissions

3. **Stripe Subscription Flow** (Priority: CRITICAL)
   - Navigate to billing
   - Select subscription plan
   - Enter payment details (test mode)
   - Complete checkout
   - Verify webhook processes
   - Confirm subscription active
   - Access premium features
   - Test usage limits
   - Verify billing portal access

4. **Pipeline & Ticket Management** (Priority: HIGH)
   - Navigate to pipelines
   - Create new pipeline
   - Add lanes
   - Create tickets
   - Drag tickets between lanes
   - Edit ticket details
   - Add comments
   - Assign to team member
   - Close ticket
   - Verify data persists

5. **Team Collaboration** (Priority: HIGH)
   - Invite team member
   - Team member receives email
   - Team member signs up
   - Assign permissions
   - Team member accesses assigned subaccounts
   - Team member creates content
   - Verify permissions working
   - Remove team member
   - Verify access revoked

6. **Media Management** (Priority: HIGH)
   - Navigate to media library
   - Upload multiple images
   - Upload PDF
   - View uploaded files
   - Use image in funnel
   - Attach file to resource
   - Delete file
   - Verify deletion

#### Edge Case Testing

- Authentication edge cases (wrong password, expired session, etc.)
- Form edge cases (validation, special characters, XSS attempts)
- File upload edge cases (file too large, unsupported types, etc.)
- Payment edge cases (declined card, network timeout, etc.)
- Data edge cases (empty lists, large datasets, null handling)

### Day 14: Tuesday - Feature-Specific Testing

**Time Estimate:** 6-8 hours

#### Features to Test

1. **Business Management**
   - Create/update/delete business
   - Upload logo
   - Configure notifications
   - View analytics

2. **Subaccount Management**
   - Create/update/delete subaccount
   - Transfer ownership
   - Configure permissions

3. **Funnel Builder**
   - Full funnel lifecycle testing
   - Element manipulation
   - Custom domain configuration

4. **Pipeline/CRM**
   - Pipeline operations
   - Ticket management
   - Filtering and search
   - Export functionality

5. **Analytics/Reports**
   - Dashboard rendering
   - Chart accuracy
   - Date filters
   - Export reports

6. **Settings**
   - Profile updates
   - Password changes
   - Notification configuration
   - Billing management
   - API key management

#### Data Integrity Testing

- CRUD operations for all entities
- Database relationship verification
- Transaction handling
- Cascade deletes

#### Regression Analysis

- Compare against Week 1 baseline
- Identify any regressions
- Document new issues vs baseline

### Day 15: Wednesday - Browser & Device Testing

**Time Estimate:** 4-6 hours

#### Browser Compatibility

- Chrome (Latest)
- Firefox (Latest)
- Safari (if available)
- Edge (Latest)

**Test in each browser:**

- Sign in/sign out
- Form submissions
- File uploads
- Drag and drop
- Theme switching
- Images loading
- Stripe checkout

#### Responsive Design Testing

- Desktop (1920x1080, 1366x768)
- Tablet (768x1024)
- Mobile (375x667, 414x896)

### Days 16-17: Performance & Final Validation

#### Performance Testing

- Build time comparison
- Bundle size analysis
- Page load metrics
- Lighthouse scores
- Runtime performance

#### Final Validation

- All critical paths tested
- All regressions addressed
- Documentation updated
- Team sign-off

## Success Criteria

- [ ] All 6 critical user journeys passing
- [ ] No blocking issues found
- [ ] All major features functional
- [ ] No critical regressions
- [ ] Performance within acceptable range
- [ ] Browser compatibility confirmed
- [ ] Responsive design working

## Known Issues

### Non-Blocking

1. **TypeScript Decimal Type Warning** (src/app/(main)/subaccount/[subaccountId]/pipelines/[pipelineId]/page.tsx:56)
   - Impact: None (runtime works correctly)
   - Prisma Decimal type vs JavaScript number type mismatch
   - Action: Can be addressed post-upgrade if needed

### ESLint Warnings

- Multiple unused variable warnings
- No-explicit-any warnings
- These are code quality issues, not functional blockers

## Testing Tools & Resources

### Available

- Manual testing (primary method)
- Chrome DevTools
- Browser developer consoles
- Stripe test mode
- Clerk test environment

### Would Be Nice To Have (Future)

- Playwright/Cypress for E2E automation
- Visual regression testing
- Performance monitoring tools

## Test Execution Log

### Day 13: [DATE]

- [ ] Journey 1: Business Onboarding
- [ ] Journey 2: Funnel Creation
- [ ] Journey 3: Stripe Subscription
- [ ] Journey 4: Pipeline Management
- [ ] Journey 5: Team Collaboration
- [ ] Journey 6: Media Management
- [ ] Edge case testing

**Results:** [To be filled]

### Day 14: [DATE]

- [ ] Feature testing matrix
- [ ] Data integrity testing
- [ ] Regression analysis

**Results:** [To be filled]

### Day 15: [DATE]

- [ ] Browser compatibility
- [ ] Responsive design

**Results:** [To be filled]

## Notes

- The upgrade is functionally complete
- Week 4 is focused on validation and confidence building
- Any issues found should be documented and prioritized
- Critical issues must be fixed before Week 5 (Deployment)
