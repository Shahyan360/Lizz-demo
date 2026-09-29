-- AlterEnum
-- Adds the intermediate SENDING status used as the idempotency lock while a
-- draft reply is being dispatched through the Gmail API.
ALTER TYPE "DraftStatus" ADD VALUE 'SENDING';
