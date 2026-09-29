-- AlterTable
ALTER TABLE `Contact` ADD COLUMN `lifecycleStage` ENUM('NEW', 'ACTIVE', 'CUSTOMER') NOT NULL DEFAULT 'NEW';
