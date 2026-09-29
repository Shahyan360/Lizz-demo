-- AlterTable
ALTER TABLE `Task` ADD COLUMN `assignee` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Task_assignee_idx` ON `Task`(`assignee`);
