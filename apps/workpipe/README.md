# WorkPipe PRD (Repository Overview)

This repository contains the **Product Requirements Document (PRD)** for **WorkPipe**, a multi-tenant SaaS platform for business management.

---

## 📖 Quick Links
- [Full PRD](./WorkPipe_PRD.md)
- [Data Models & Schema](./WorkPipe_PRD.md#6-data-model-initial)
- [Business Billing Section](./WorkPipe_PRD.md#33-business-billing--monetization)
- [User Stories & Acceptance Criteria](./WorkPipe_PRD.md#4-user-stories--acceptance-criteria-selected)
- [Rollout Plan](./WorkPipe_PRD.md#11-rollout-plan-sequenced-milestones)

---

## 🚀 Vision
WorkPipe is the **all-in-one operating system** for businesses. It unifies:
- Marketing sites & funnels
- CRM pipelines & contacts
- Stripe-based payments & billing
- Automation & analytics

---

## 🏗️ Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Auth**: Clerk
- **Database**: PostgreSQL + Prisma
- **Styling/UI**: Tailwind CSS + shadcn/ui
- **Payments**: Stripe Billing + Connect
- **File Uploads**: UploadThing
- **Charts**: Tremor React

---

## 📦 Core Features (MVP)
- Multi-tenant structure (Business → Subaccounts)
- Business Billing Dashboard with subscriptions, invoices, add-ons
- Funnel & website builder (drag-and-drop, Stripe Checkout integration)
- CRM with pipelines, tickets, contacts
- Media asset management
- Notifications & theming
- Automation triggers & actions

---

## 📌 Rollout Milestones
- **M0** – Foundation (RBAC, schema, router, marketing site)
- **M1** – Business Billing (Stripe subscriptions, invoices, add-ons, upgrade flow)
- **M2** – Subaccounts & Stripe Connect
- **M3** – Media & Contacts
- **M4** – Funnel Builder
- **M5** – CRM Pipelines
- **M6** – Automation (V1)
- **M7** – Analytics

---

## 📂 Repo Layout
- `WorkPipe_PRD.md` → Full detailed PRD (requirements, models, user stories)
- `migrations/` → SQL migrations for Postgres (e.g., billing models)
- `app/api/stripe/webhook/route.ts` → Stripe webhook handler
- `README.md` → (this file)

---

## 🔑 Next Steps
1. Implement **M0 Foundation** (Clerk, RBAC, schema, router, marketing site)
2. Integrate **M1 Business Billing** (subscriptions, invoices, add-ons)
3. Track progress against the PRD rollout plan

---

📌 For complete context and technical details, see [WorkPipe_PRD.md](./WorkPipe_PRD.md).
