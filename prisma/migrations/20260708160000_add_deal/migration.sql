-- CreateTable
CREATE TABLE `Deal` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NULL,
    `title` TEXT NOT NULL,
    `stage` ENUM('NEW', 'QUOTED', 'WON', 'LOST') NOT NULL DEFAULT 'NEW',
    `value` DOUBLE NULL,
    `notes` TEXT NULL,
    `sourceFrom` VARCHAR(191) NULL,
    `sourceSubject` TEXT NULL,
    `sourceBody` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,

    INDEX `Deal_tenantId_idx`(`tenantId`),
    INDEX `Deal_contactId_idx`(`contactId`),
    INDEX `Deal_stage_idx`(`stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Deal` ADD CONSTRAINT `Deal_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deal` ADD CONSTRAINT `Deal_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
