-- Migration: redesign_property_tables
-- Drops old PascalCase property tables, creates new snake_case tables + follow_ups

ALTER TABLE `PropertyContact` DROP FOREIGN KEY IF EXISTS `PropertyContact_propertyId_fkey`;
ALTER TABLE `ExistingSystem` DROP FOREIGN KEY IF EXISTS `ExistingSystem_propertyId_fkey`;
ALTER TABLE `DeviceCount` DROP FOREIGN KEY IF EXISTS `DeviceCount_propertyId_fkey`;
ALTER TABLE `PropertyOpportunity` DROP FOREIGN KEY IF EXISTS `PropertyOpportunity_propertyId_fkey`;

DROP TABLE IF EXISTS `PropertyOpportunity`;
DROP TABLE IF EXISTS `PropertyContact`;
DROP TABLE IF EXISTS `ExistingSystem`;
DROP TABLE IF EXISTS `DeviceCount`;
DROP TABLE IF EXISTS `Property`;

CREATE TABLE `properties` (`id` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `propertyType` ENUM('APARTMENT','MULTIFAMILY','HOA','CONDO_COMMUNITY') NOT NULL, `managementCompany` VARCHAR(191) NULL, `streetAddress` VARCHAR(191) NULL, `city` VARCHAR(191) NULL, `state` VARCHAR(191) NULL, `zipCode` VARCHAR(191) NULL, `phone` VARCHAR(191) NULL, `website` VARCHAR(191) NULL, `numberOfUnits` INTEGER NULL, `estimatedResidents` INTEGER NULL, `yearBuilt` INTEGER NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, INDEX `properties_propertyType_idx`(`propertyType`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `property_contacts` (`id` VARCHAR(191) NOT NULL, `propertyId` VARCHAR(191) NOT NULL, `role` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NULL, `email` VARCHAR(191) NULL, `phone` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, INDEX `property_contacts_propertyId_idx`(`propertyId`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `existing_systems` (`id` VARCHAR(191) NOT NULL, `propertyId` VARCHAR(191) NOT NULL, `callBoxBrand` VARCHAR(191) NULL, `callBoxModel` VARCHAR(191) NULL, `callBoxQuantity` INTEGER NULL, `accessControlBrand` VARCHAR(191) NULL, `accessControlModel` VARCHAR(191) NULL, `surveillanceBrand` VARCHAR(191) NULL, `surveillanceModel` VARCHAR(191) NULL, `credentials` JSON NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, UNIQUE INDEX `existing_systems_propertyId_key`(`propertyId`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `device_counts` (`id` VARCHAR(191) NOT NULL, `propertyId` VARCHAR(191) NOT NULL, `accessControlledDoors` INTEGER NULL, `additionalDoorsToSecure` INTEGER NULL, `vehicleGates` INTEGER NULL, `pedestrianGates` INTEGER NULL, `garageDoors` INTEGER NULL, `adaDoorOperators` INTEGER NULL, `cameras` INTEGER NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, UNIQUE INDEX `device_counts_propertyId_key`(`propertyId`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `opportunities` (`id` VARCHAR(191) NOT NULL, `propertyId` VARCHAR(191) NOT NULL, `butterflyMxRating` ENUM('HIGH','MEDIUM','LOW','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN', `invisibleIntercomRating` ENUM('HIGH','MEDIUM','LOW','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN', `opportunityNotes` TEXT NULL, `qualificationStatus` ENUM('NEW_PROSPECT','RESEARCHING','QUALIFIED','PROPOSAL_READY','PROPOSAL_SENT','CUSTOMER','LOST') NOT NULL DEFAULT 'NEW_PROSPECT', `nextFollowUpDate` DATETIME(3) NULL, `internalNotes` TEXT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, UNIQUE INDEX `opportunities_propertyId_key`(`propertyId`), INDEX `opportunities_qualificationStatus_idx`(`qualificationStatus`), INDEX `opportunities_nextFollowUpDate_idx`(`nextFollowUpDate`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `follow_ups` (`id` VARCHAR(191) NOT NULL, `opportunityId` VARCHAR(191) NOT NULL, `contactedBy` VARCHAR(191) NULL, `contactMethod` VARCHAR(191) NULL, `notes` TEXT NULL, `nextFollowUpDate` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `follow_ups_opportunityId_idx`(`opportunityId`), INDEX `follow_ups_createdAt_idx`(`createdAt`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `property_contacts` ADD CONSTRAINT `property_contacts_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `existing_systems` ADD CONSTRAINT `existing_systems_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `device_counts` ADD CONSTRAINT `device_counts_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;