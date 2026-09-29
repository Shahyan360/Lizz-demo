-- AlterEnum: Add DECLINED to TaskStatus
-- MySQL stores enums as columns, so we modify the column definition directly.
ALTER TABLE `Task` MODIFY COLUMN `status` ENUM('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'DECLINED') NOT NULL DEFAULT 'TODO';
