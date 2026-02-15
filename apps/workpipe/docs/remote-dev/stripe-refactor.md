Title: refactor: Make Stripe billing optional during business signup

Description:

Summary
Decouples Stripe customer creation from the business onboarding flow. Businesses can now sign up and start using the platform without being forced through Stripe setup. Billing becomes an on-demand action from the dashboard.

Problem
Previously, creating a business required an immediate Stripe customer creation API call during signup. If Stripe was unavailable or the user wasn't ready to set up billing, signup would fail or stall. This created unnecessary friction for new business onboarding.

Changes
Schema
prisma/schema.prisma — customerId changed from String to String? (nullable), allowing businesses to exist without a Stripe customer
Signup Flow
business-details.tsx — Removed the 35-line Stripe customer creation block from handleSubmit. Businesses now save directly without hitting /api/stripe/create-customer
business/page.tsx — Removed auto-redirect to billing page when ?plan= param exists. Users land on their dashboard after signup
Dashboard
business/[businessId]/page.tsx — Added a "Set Up Billing" CTA card that appears when no Stripe customer is configured. Links to the billing page
Guards
subscription-helper.tsx — Subscription modal only auto-opens if customerId exists
subscription-form-wrapper.tsx — Guards against subscription creation without a customer ID; shows a prompt to set up billing first
What's preserved
All Stripe infrastructure (/api/stripe/create-customer, /api/stripe/create-subscription, billing page) remains intact for on-demand use
Existing businesses with Stripe configured are unaffected
