# WorkPipe — Product Requirements Document (PRD)

**Version:** v0.1  
**Owner:** WorkPipe maintainer  

---

## 1) Product vision & positioning
**Vision.** WorkPipe is the all-in-one, multi-tenant operating system for businesses and service organizations. It unifies marketing sites, lead capture, CRM pipelines, payments, and automation into a single, white-label platform that businesses can extend to their clients (subaccounts) and monetize.

**Differentiation.**
- Deep multi-tenant model (Business → Subaccounts) with role-scoped permissions and billing.
- Built-in funnel/page builder with drag-and-drop, responsive previews, and payment components.
- Stripe Connect at the core: businesses and subaccounts can take payments; WorkPipe captures platform fees and supports add-ons.
- Opinionated CRM (pipelines, tickets, contacts) that’s tightly linked to funnels and payments.
- Extensible automation layer with triggers/actions from first release; n8n/agentic integrations in Phase 2.

**Primary users.**
- **Business Owner:** sets up the Business workspace, billing, teams, and client subaccounts.
- **Business Staff:** day-to-day operations—pipelines, tickets, media, funnel editing.
- **Client/Subaccount User:** limited access to their own workspace and funnels.
- **Platform Admin (WorkPipe internal):** oversight, support/debug, and marketplace config.

---

## 2) Goals & non-goals
**MVP Goals (V1):**
1) Stand up the multi-tenant skeleton (Business, Subaccount, Users/Roles, Domain routing).  
2) Business onboarding + subscription billing (Stripe) with add-on product support.  
3) Subaccount onboarding including Stripe Connect (account linking) and product sync.  
4) Funnel builder (drag-and-drop), responsive preview, form/contact capture, Stripe checkout component, and live hosting on custom subdomains/domains.  
5) CRM: Contacts + Pipelines (kanban lanes & tickets), assignment, tags, and estimated value.  
6) Media bucket with asset browser and link-copy for builder use.  
7) Notifications and theming (light/dark).  
8) Audit trails and role-based access controls (RBAC).

**Non-goals (MVP):**
- Advanced A/B testing, versioned publishing, or template marketplace (Phase 2).  
- Native telephony, AI dialers, or conversational agents (Phase 2; integrate via n8n/Vapi/Bland).  
- Complex invoicing/billing beyond Stripe subscriptions and simple add-ons (Phase 2).  
- HIPAA/PCI scope: we’ll rely on Stripe for card data and avoid storing sensitive health/payment data directly.

---

## 3) Scope & feature set (V1)
### 3.1 Multi-tenant foundation
- **Entities:** Business (top-level organization), Subaccount (client/project), User, Role/Permission, Domain, Funnel, FunnelStep, Pipeline, Lane, Ticket, Contact, MediaAsset, Notification, Product (synced from Stripe), Subscription, AddOn, AuditLog.
- **Tenant boundaries:** Every entity belongs to a Business; Subaccount entities are scoped to Subaccount ID. Enforce via DB constraints + application checks.
- **Domain routing:** Map `subdomain.workpipe.orbit.example` and custom apex/subdomains to specific Subaccounts. Dynamic router resolves `[domain]/[path]` to funnel steps.
- **RBAC:** Roles include BusinessOwner, BusinessAdmin, Staff, SubUser, BillingOnly. Fine-grain permissions at Business vs Subaccount level (view/edit pipelines, funnels, contacts, billing, team, media).

### 3.2 Authentication & onboarding
- **Auth:** Clerk (email, OAuth) with themeable UI.  
- **Business onboarding:** Create Business → Stripe subscription (plan + optional add-ons) → Launchpad checklist.  
- **Team invites:** Invite staff to Business; granular access to Subaccounts (on/off per subaccount).
- **Subaccount onboarding:** Create Subaccount → connect Stripe (Connect Onboarding) → choose products to expose in funnels.

### 3.3 Business Billing & monetization
- **Stripe:**
  - Business pays WorkPipe monthly for platform plans (e.g., Starter/Pro) plus add-ons (e.g., extra subaccounts, higher limits).
  - Subaccounts connect their own Stripe accounts for taking payments in funnels.  
  - Platform application_fee on subaccount transactions (percentage + flat $), configurable per product type; revenues settle to business/subaccount via Connect.
- **Add-on catalog:** Admin-configurable; Businesses enable/disable for their Business.
- **Invoices & transactions UI:** Transaction table and plan management, one-click plan upgrade at renewal.

#### 3.3.1 Invoices & Payments
- Businesses receive monthly invoices via Stripe; invoices list base plan, add-ons, taxes, and credits.
- UI: Invoice history with PDF download, status (paid/unpaid), and retry payment button.
- Notifications: Failed payment emails and in-app alerts to Business Owner.

#### 3.3.2 Add-ons & Upgrades
- Add-ons available as recurring (e.g., additional subaccounts) or usage-based (future).
- Business Owner can enable/disable add-ons from billing UI; changes prorate into next invoice cycle.
- Plan upgrade: Immediate access to higher-tier entitlements, cost adjustment at next billing date.

#### 3.3.3 Subaccount Billing Integration
- Each Subaccount may optionally pass payment fees to their connected Stripe account via Stripe Connect.
- Businesses configure platform fees in settings; WorkPipe captures percentage and flat fees per transaction.
- Dashboard: Subaccount billing overview with gross revenue, net payouts, and WorkPipe fee summary.

#### 3.3.4 UI & Controls
- Dedicated **Business Billing Dashboard** showing:
  - Current plan, renewal date, and limits.
  - Invoice history with filtering.
  - Add-on management panel with toggles.
  - Payment method management (add/remove cards).
  - Alerts for failed payments, expiring cards, or exceeded limits.

### 3.4 Funnel & website builder
- **Editor:** Drag & drop, element selection badges, properties panel (CSS props + custom props), components library (Layouts, Text/Media, Contact Form, Video, Stripe Checkout), responsive breakpoints, preview mode, undo/redo history, layers tree, duplicate page, autosave with last-updated timestamp.
- **Funnel model:** Multi-step flows with per-step path, ordering (reorderable), auto-redirect to next step after form submit, SEO meta per step.
- **Assets:** Media browser directly embedded; paste URLs to set background images.
- **Publishing:** Serve under assigned domain/subdomain; 404 for unknown paths; basic cache headers.  

### 3.5 CRM & contacts
- **Contacts:** Leads captured from forms; fields include status (Active/Inactive), est. value, source, last activity.
- **Pipelines:** Kanban boards per Subaccount; lanes are reorderable; tickets have title, description, service request details, tags/labels, assignees (team), linked contact, due dates.
- **Drag & drop:** Move tickets across lanes; recalc stage timestamps; simple WIP limits (Phase 2).

### 3.6 Media management
- **UploadThing integration:** Images/docs/mp4; per-tenant quotas; CDN URLs; file preview; folders/tags (Phase 2).

### 3.7 Notifications & themes
- **Notifications:** Filterable by current Subaccount; system events (invites, failed payments, form submissions, ticket assignments).  
- **Theming:** Light/Dark toggle; extendable theme tokens.

### 3.8 Automation (V1)
- **Trigger catalog:** Form submitted, payment succeeded/failed (Stripe webhooks), ticket created/moved, contact status changed.
- **Actions:** Email notification, create/update contact/ticket, add tag, send webhook.  
- **Event bus:** Persisted events table; idempotent processors; retry & DLQ.  
- **Phase 2:** Visual workflow builder; n8n bridge; AI steps (lead scoring, auto-summaries, copy suggestions) powered by LLMs.

---

## 4) User stories & acceptance criteria (selected)
**Business Owner**
1. *As a Business Owner, I can subscribe to a WorkPipe plan and optional add-ons so that my Business unlocks features.*  
   - AC: Successful payment creates active subscription; plan entitlements propagate; transaction visible; upgrading defers to end of current period.
2. *As a Business Owner, I can create Subaccounts for clients and invite sub-users; each gets only their Subaccount’s data.*  
   - AC: Invited users land on an “awaiting access” screen until toggled on; RBAC tests pass.
3. *As a Business Owner, I can connect my client’s Stripe account (Connect) to collect payments on their site and share platform fees with WorkPipe.*  
   - AC: Connect onboarding redirect works; products sync; products can be toggled live in a funnel.

**Business Staff**
4. *As Business Staff, I can build a funnel with multiple steps, drag in components, preview responsive states, and publish.*  
   - AC: Undo/redo works; preview URL is live; forms route to contacts; checkout renders Stripe Payment Element and completes a test charge.
5. *As Business Staff, I can manage a pipeline (lanes, tickets), tag tickets, assign to teammates, and link to contacts.*  
   - AC: Drag-drop persists; linked contact shows est. value on contacts list; audit log captures changes.

**Subaccount User**
6. *As a Subaccount User, I can upload media and reuse it in the builder via a media browser.*  
   - AC: Uploaded asset yields a CDN URL; inserting URL updates background image in editor and live page.

**Business Billing**
7. *As a Business Owner, I can view invoices and payment history so that I can track charges and resolve billing issues.*  
   - AC: Invoices display line items (plan, add-ons, taxes), payment status, and PDF download; unpaid invoices show retry option.
8. *As a Business Owner, I can manage add-ons and upgrade/downgrade my plan so that my Business can adjust features as needed.*  
   - AC: Enabling/disabling add-ons updates entitlements immediately; plan upgrade grants features instantly with proration applied to next invoice.
9. *As a Business Owner, I receive alerts for failed payments or expiring cards so that I can avoid service disruption.*  
   - AC: Failed payments trigger in-app and email notifications; Business Billing Dashboard highlights issues until resolved.

---

## 5) System architecture & tech decisions
- **Frontend:** Next.js 14 (App Router), React Server Components where possible; shadcn/ui for primitives; Tailwind CSS; Tremor for charts.
- **UI Components:** **MANDATORY** - Use shadcn MCP (Model Context Protocol) for all UI component additions, modifications, and selections. This ensures consistent component usage and proper integration with the shadcn/ui system.
- **Auth:** Clerk.
- **Storage & DB:** **PostgreSQL** (Neon or equivalent) via Prisma; single DB with tenant_id scoping; migrations with Prisma Migrate.
- **File uploads:** UploadThing → blob storage/CDN.
- **Payments:** Stripe (Billing + Connect).
- **Routing:** Middleware resolves custom subdomains/domains and public routes; dynamic `[domain]/[path]` for funnels.
- **Observability:** Request logging, structured app logs, metrics, error tracking (Sentry), audit log entities.

**Why Postgres (vs the tutorial’s MySQL example):** WorkPipe will use Postgres from day one for strong JSON, window functions, and ecosystem fit (Neon, RLS if desired later). Prisma abstracts most differences; we’ll design schemas with explicit foreign keys and composite tenant keys.

---

6) Data model (initial)

High-level tables (non-exhaustive):

business(id, name, slug, owner_user_id, stripe_customer_id, plan_tier, created_at, …)

subaccount(id, business_id FK, name, slug, stripe_connect_account_id, domain_id, created_at, …)

user(id, clerk_user_id, email, name, avatar_url, …)

user_business_role(user_id, business_id, role)

user_subaccount_role(user_id, subaccount_id, role)

domain(id, business_id, subaccount_id, hostname, verified, is_primary, …)

funnel(id, subaccount_id, name, status, …)

funnel_step(id, funnel_id, name, path, order, seo_meta, component_tree_json, updated_at, …)

contact(id, subaccount_id, name, email, phone, status, est_value, source, …)

pipeline(id, subaccount_id, name, …)

lane(id, pipeline_id, name, order)

ticket(id, pipeline_id, lane_id, contact_id, assignee_id, title, description, tags[], due_at, est_value, …)

media_asset(id, owner_business_id, subaccount_id, key, url, mime, size, …)

product_catalog_item(id, subaccount_id, stripe_product_id, stripe_price_id, active)

subscription(id, business_id, stripe_subscription_id, tier, status, current_period_end, …)

transaction(id, business_id or subaccount_id, amount, currency, type, stripe_charge_id, …)

notification(id, business_id, subaccount_id, type, payload_json, read_at, …)

audit_log(id, actor_user_id, scope, entity, entity_id, action, diff_json, created_at)

event(id, type, scope_ids, payload_json, status, attempts, created_at)

invoice(id, business_id, stripe_invoice_id, amount_due, amount_paid, currency, status, pdf_url, period_start, period_end, created_at)

addon(id, business_id, name, description, price, billing_interval, active, created_at)

business_payment_method(id, business_id, stripe_payment_method_id, type, last4, exp_month, exp_year, is_default, created_at)

6.1 Field-level notes (billing models)

invoice

stripe_invoice_id is unique; store Stripe expand payload separately if needed.

amount_due/amount_paid stored in cents; currency ISO-4217.

Index: (business_id, created_at) for dashboard queries.

addon

billing_interval is an enum (e.g., MONTHLY, YEARLY).

Index: (business_id, active) to filter active add-ons quickly.

business_payment_method

stripe_payment_method_id unique; only one is_default = true per business (enforced by app logic or partial index when supported).

Consider masking display fields (e.g., last4).

6.2 Prisma models (initial)
model Invoice {
  id               String   @id @default(cuid())
  businessId       String
  business         Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  stripeInvoiceId  String   @unique
  amountDue        Int      // in cents
  amountPaid       Int      // in cents
  currency         String   @default("usd")
  status           String
  pdfUrl           String?
  periodStart      DateTime
  periodEnd        DateTime
  createdAt        DateTime @default(now())


  @@index([businessId, createdAt])
}


model AddOn {
  id              String         @id @default(cuid())
  businessId      String
  business        Business       @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name            String
  description     String?
  price           Int            // in cents
  billingInterval BillingInterval
  active          Boolean        @default(true)
  createdAt       DateTime       @default(now())


  @@index([businessId, active])
}


enum BillingInterval {
  MONTHLY
  YEARLY
}


model BusinessPaymentMethod {
  id                   String   @id @default(cuid())
  businessId           String
  business             Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  stripePaymentMethodId String  @unique
  type                 String
  last4                String?
  expMonth             Int?
  expYear              Int?
  isDefault            Boolean  @default(false)
  createdAt            DateTime @default(now())


  @@index([businessId, isDefault])
}
6.3 Migration considerations

Backfill existing Businesses with a default payment method record only after Stripe PM attaches successfully.

Create invoices from historical Stripe events by replaying the webhook logs (idempotent writes keyed by stripe_invoice_id).

Guard downgrades: soft-validate limits (e.g., subaccount count) before committing subscription changes; block or queue enforcement.

6.4 Indexing & (optional) RLS notes

Add composite indexes on (business_id, created_at) for time-series billing queries.

If adopting Postgres RLS later, apply USING (business_id = current_setting('app.current_business_id')::uuid) policies on billing tables.

7) Domain & routing requirements

Public routes: marketing site, Connect webhooks, upload endpoints, and domain-served funnel pages.

Rewrite rules: root → marketing site; /site → marketing site; subdomain/custom domain → [domain]/[path] funnel resolver.

Unknown domain/path → 404; friendly dev 404 in preview.

8) Security, privacy, compliance

Rely on Clerk for auth flows, sessions, MFA options.

Strict tenant scoping on all queries; enforce via business_id/subaccount_id filters and optimistic checks.

Do not store card data; Stripe hosted elements only.

Encrypt secrets at rest; rotate keys; principle of least privilege for API keys.

PII minimization: collect only what’s necessary for lead/contact management.

9) Analytics & reporting

Dashboards:

Business: MRR, active add-ons, subaccount count, top sources, funnel conversions.

Subaccount: traffic, form conversions, pipeline velocity, revenue via Stripe charges.

Instrumentation: GA4 (marketing), first-party events for funnels, Stripe events for revenue.

Charts: Tremor components with standard KPIs + time selection.

10) Non-functional requirements (NFRs)

Availability: 99.9% target for app & CDN content once GA.

Performance: P50 TTFB < 300ms on cached funnel pages; editor interactions < 100ms visual response; pipeline DnD < 100ms commit.

Scalability: Horizontal Next.js instances; DB connection pooling; CDN for assets.

Backups: Daily DB backups; object storage versioning; tested restore runbook.

Observability: Centralized logs, traces, error alerts; webhook DLQ monitoring.

Accessibility: WCAG 2.1 AA for editor surfaces and public pages where feasible.

11) Rollout plan (sequenced milestones)

M0 – Foundation: App shell, Clerk, RBAC model, Postgres schema, domain router, marketing site.

M1 – Business Billing: Stripe subscriptions + add-ons, plan gates, transaction table, invoice history UI, payment method management, add-on toggles, upgrade flow, and alerts for failed payments.
