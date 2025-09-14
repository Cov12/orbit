-- migrations/20250914_add_billing.sql
-- Postgres migration for billing tables
BEGIN;

CREATE TYPE billing_interval AS ENUM ('MONTHLY', 'YEARLY');

CREATE TABLE IF NOT EXISTS "Invoice" (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  businessId       TEXT NOT NULL,
  stripeInvoiceId  TEXT NOT NULL UNIQUE,
  amountDue        INTEGER NOT NULL,
  amountPaid       INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'usd',
  status           TEXT NOT NULL,
  pdfUrl           TEXT,
  periodStart      TIMESTAMPTZ NOT NULL,
  periodEnd        TIMESTAMPTZ NOT NULL,
  createdAt        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_invoice_business
    FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_business_created ON "Invoice" ("businessId", "createdAt");

CREATE TABLE IF NOT EXISTS "AddOn" (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  businessId       TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  price            INTEGER NOT NULL,
  billingInterval  billing_interval NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT true,
  createdAt        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_addon_business
    FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_addon_business_active ON "AddOn" ("businessId", "active");

CREATE TABLE IF NOT EXISTS "BusinessPaymentMethod" (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  businessId             TEXT NOT NULL,
  stripePaymentMethodId  TEXT NOT NULL UNIQUE,
  type                   TEXT NOT NULL,
  last4                  TEXT,
  expMonth               INTEGER,
  expYear                INTEGER,
  isDefault              BOOLEAN NOT NULL DEFAULT false,
  createdAt              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_bpm_business
    FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bpm_business_default ON "BusinessPaymentMethod" ("businessId", "isDefault");

COMMIT;
