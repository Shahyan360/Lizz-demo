-- Migration: gmail_account_last_synced
--
-- Change 5 (scheduled batch sync): track when each mailbox was last synced.

ALTER TABLE "GmailAccount" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
