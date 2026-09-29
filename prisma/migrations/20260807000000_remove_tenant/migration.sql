-- =============================================================================
-- Migration: remove_tenant
-- Removes the Tenant model and all tenantId foreign keys, indexes, and columns
-- from every table. Also drops the AuditLog table which was tenant-scoped and
-- is no longer in the Prisma schema.
--
-- SAFE on both:
--   - A FRESH database (runs after all previous migrations create the tables
--     with tenantId, then this migration cleans them up)
--   - An EXISTING database that already had `prisma db push` applied
--     (columns are already gone, so we use IF EXISTS throughout)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop all foreign keys that reference the Tenant table
--    (must happen before we can drop tenantId columns or the Tenant table)
-- -----------------------------------------------------------------------------

-- User
ALTER TABLE `User`
  DROP FOREIGN KEY IF EXISTS `User_tenantId_fkey`;

-- GmailAccount
ALTER TABLE `GmailAccount`
  DROP FOREIGN KEY IF EXISTS `GmailAccount_tenantId_fkey`;

-- Contact
ALTER TABLE `Contact`
  DROP FOREIGN KEY IF EXISTS `Contact_tenantId_fkey`;

-- EmailThread
ALTER TABLE `EmailThread`
  DROP FOREIGN KEY IF EXISTS `EmailThread_tenantId_fkey`;

-- MemoryEpisodic
ALTER TABLE `MemoryEpisodic`
  DROP FOREIGN KEY IF EXISTS `MemoryEpisodic_tenantId_fkey`;

-- MemorySemantic
ALTER TABLE `MemorySemantic`
  DROP FOREIGN KEY IF EXISTS `MemorySemantic_tenantId_fkey`;

-- CommunicationProfile
ALTER TABLE `CommunicationProfile`
  DROP FOREIGN KEY IF EXISTS `CommunicationProfile_tenantId_fkey`;

-- AuditLog (entire table is removed below, but drop FK first)
ALTER TABLE `AuditLog`
  DROP FOREIGN KEY IF EXISTS `AuditLog_tenantId_fkey`;

-- AITrace
ALTER TABLE `AITrace`
  DROP FOREIGN KEY IF EXISTS `AITrace_tenantId_fkey`;

-- Task
ALTER TABLE `Task`
  DROP FOREIGN KEY IF EXISTS `Task_tenantId_fkey`;

-- Meeting
ALTER TABLE `Meeting`
  DROP FOREIGN KEY IF EXISTS `Meeting_tenantId_fkey`;

-- StoredEmail
ALTER TABLE `StoredEmail`
  DROP FOREIGN KEY IF EXISTS `StoredEmail_tenantId_fkey`;

-- Deal
ALTER TABLE `Deal`
  DROP FOREIGN KEY IF EXISTS `Deal_tenantId_fkey`;

-- Company
ALTER TABLE `Company`
  DROP FOREIGN KEY IF EXISTS `Company_tenantId_fkey`;

-- TaskAuditLog
ALTER TABLE `TaskAuditLog`
  DROP FOREIGN KEY IF EXISTS `TaskAuditLog_tenantId_fkey`;

-- TeamMember
ALTER TABLE `TeamMember`
  DROP FOREIGN KEY IF EXISTS `TeamMember_tenantId_fkey`;

-- -----------------------------------------------------------------------------
-- 2. Drop tenantId indexes
-- -----------------------------------------------------------------------------

ALTER TABLE `User`
  DROP INDEX IF EXISTS `User_tenantId_idx`;

ALTER TABLE `GmailAccount`
  DROP INDEX IF EXISTS `GmailAccount_tenantId_idx`;

ALTER TABLE `Contact`
  DROP INDEX IF EXISTS `Contact_tenantId_idx`,
  DROP INDEX IF EXISTS `Contact_tenantId_email_key`;

ALTER TABLE `EmailThread`
  DROP INDEX IF EXISTS `EmailThread_tenantId_idx`;

ALTER TABLE `MemoryEpisodic`
  DROP INDEX IF EXISTS `MemoryEpisodic_tenantId_idx`;

ALTER TABLE `MemorySemantic`
  DROP INDEX IF EXISTS `MemorySemantic_tenantId_idx`;

ALTER TABLE `CommunicationProfile`
  DROP INDEX IF EXISTS `CommunicationProfile_tenantId_key`;

ALTER TABLE `AITrace`
  DROP INDEX IF EXISTS `AITrace_tenantId_idx`;

ALTER TABLE `Task`
  DROP INDEX IF EXISTS `Task_tenantId_idx`;

ALTER TABLE `Meeting`
  DROP INDEX IF EXISTS `Meeting_tenantId_idx`;

ALTER TABLE `StoredEmail`
  DROP INDEX IF EXISTS `StoredEmail_tenantId_idx`;

ALTER TABLE `Deal`
  DROP INDEX IF EXISTS `Deal_tenantId_idx`;

ALTER TABLE `Company`
  DROP INDEX IF EXISTS `Company_tenantId_idx`,
  DROP INDEX IF EXISTS `Company_tenantId_domain_key`;

ALTER TABLE `TaskAuditLog`
  DROP INDEX IF EXISTS `TaskAuditLog_tenantId_idx`;

ALTER TABLE `TeamMember`
  DROP INDEX IF EXISTS `TeamMember_tenantId_idx`,
  DROP INDEX IF EXISTS `TeamMember_tenantId_roleKey_idx`,
  DROP INDEX IF EXISTS `TeamMember_tenantId_isActive_idx`,
  DROP INDEX IF EXISTS `TeamMember_tenantId_email_key`;

-- Add the replacement unique index on TeamMember.email (now unique without tenantId scope)
CREATE UNIQUE INDEX IF NOT EXISTS `TeamMember_email_key` ON `TeamMember`(`email`);

-- Add the replacement unique index on Contact.email (now unique without tenantId scope)
CREATE UNIQUE INDEX IF NOT EXISTS `Contact_email_key` ON `Contact`(`email`);

-- Add the replacement unique index on Company.domain (now unique without tenantId scope)
CREATE UNIQUE INDEX IF NOT EXISTS `Company_domain_key` ON `Company`(`domain`);

-- -----------------------------------------------------------------------------
-- 3. Drop tenantId columns from all tables
-- -----------------------------------------------------------------------------

ALTER TABLE `User`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `GmailAccount`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `Contact`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `EmailThread`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `MemoryEpisodic`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `MemorySemantic`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `CommunicationProfile`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `AITrace`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `Task`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `Meeting`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `StoredEmail`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `Deal`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `Company`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `TaskAuditLog`
  DROP COLUMN IF EXISTS `tenantId`;

ALTER TABLE `TeamMember`
  DROP COLUMN IF EXISTS `tenantId`;

-- -----------------------------------------------------------------------------
-- 4. Drop tables that are fully removed from the schema
-- -----------------------------------------------------------------------------

-- AuditLog was tenant-scoped and is no longer in schema.prisma
DROP TABLE IF EXISTS `AuditLog`;

-- Tenant is the root table being removed
DROP TABLE IF EXISTS `Tenant`;
