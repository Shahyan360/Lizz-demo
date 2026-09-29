-- AlterTable
ALTER TABLE `Task` ADD COLUMN `sourceBody` TEXT NULL,
    ADD COLUMN `sourceFrom` VARCHAR(191) NULL,
    ADD COLUMN `sourceSubject` TEXT NULL;
