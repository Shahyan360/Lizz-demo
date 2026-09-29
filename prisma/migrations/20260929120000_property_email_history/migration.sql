CREATE TABLE `property_emails` (
  `id` VARCHAR(191) NOT NULL,
  `propertyId` VARCHAR(191) NOT NULL,
  `storedEmailId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `property_emails_propertyId_storedEmailId_key` (`propertyId`, `storedEmailId`),
  INDEX `property_emails_propertyId_createdAt_idx` (`propertyId`, `createdAt`),
  INDEX `property_emails_storedEmailId_idx` (`storedEmailId`),
  CONSTRAINT `property_emails_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `property_emails_storedEmailId_fkey` FOREIGN KEY (`storedEmailId`) REFERENCES `StoredEmail` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
