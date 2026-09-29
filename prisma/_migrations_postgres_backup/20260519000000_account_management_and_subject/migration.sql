-- Migration: account_management_and_subject
--
-- Change 2 (Gmail account management) + Change 3 (correct subject extraction).

-- --------------------------------------------------------------------------
-- Change 2: per-tenant "active mailbox" selection.
-- --------------------------------------------------------------------------
ALTER TABLE "GmailAccount" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

-- Enforce at most one active GmailAccount per tenant. Prisma's schema DSL
-- cannot express partial (filtered) indexes, so it is declared here directly.
CREATE UNIQUE INDEX "GmailAccount_tenantId_active_key"
  ON "GmailAccount" ("tenantId")
  WHERE "isActive" = true;

-- --------------------------------------------------------------------------
-- Change 2: an EmailThread (and its message/draft history) must survive the
-- disconnection of its GmailAccount. The FK becomes nullable + ON DELETE SET NULL.
-- --------------------------------------------------------------------------
ALTER TABLE "EmailThread" DROP CONSTRAINT "EmailThread_gmailAccountId_fkey";

ALTER TABLE "EmailThread" ALTER COLUMN "gmailAccountId" DROP NOT NULL;

ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_gmailAccountId_fkey"
  FOREIGN KEY ("gmailAccountId") REFERENCES "GmailAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Change 3: store the raw per-message subject (may differ from the normalized
-- thread subject).
-- --------------------------------------------------------------------------
ALTER TABLE "EmailMessage" ADD COLUMN "subject" TEXT;
