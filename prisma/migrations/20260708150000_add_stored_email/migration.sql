-- CreateTable
CREATE TABLE `StoredEmail` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NULL,
    `threadId` VARCHAR(191) NULL,
    `folderId` VARCHAR(191) NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `fromAddress` VARCHAR(191) NOT NULL,
    `fromName` VARCHAR(191) NULL,
    `toAddress` VARCHAR(191) NULL,
    `subject` TEXT NULL,
    `bodyText` LONGTEXT NOT NULL,
    `bodyHtml` LONGTEXT NULL,
    `contactId` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StoredEmail_messageId_key`(`messageId`),
    INDEX `StoredEmail_tenantId_idx`(`tenantId`),
    INDEX `StoredEmail_contactId_idx`(`contactId`),
    INDEX `StoredEmail_threadId_idx`(`threadId`),
    INDEX `StoredEmail_fromAddress_idx`(`fromAddress`),
    INDEX `StoredEmail_receivedAt_idx`(`receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StoredEmail` ADD CONSTRAINT `StoredEmail_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoredEmail` ADD CONSTRAINT `StoredEmail_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
