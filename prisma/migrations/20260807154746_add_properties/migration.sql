-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Property` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `propertyType` ENUM('APARTMENT', 'MULTIFAMILY', 'HOA', 'CONDO_COMMUNITY') NOT NULL,
    `managementCompany` VARCHAR(191) NULL,
    `streetAddress` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `zipCode` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `numberOfUnits` INTEGER NULL,
    `estimatedResidents` INTEGER NULL,
    `yearBuilt` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Property_propertyType_idx`(`propertyType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyContact` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PropertyContact_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExistingSystem` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `callBoxBrand` VARCHAR(191) NULL,
    `callBoxModel` VARCHAR(191) NULL,
    `callBoxQuantity` INTEGER NULL,
    `accessControlBrand` VARCHAR(191) NULL,
    `accessControlModel` VARCHAR(191) NULL,
    `surveillanceBrand` VARCHAR(191) NULL,
    `surveillanceModel` VARCHAR(191) NULL,
    `credentials` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExistingSystem_propertyId_key`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceCount` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `accessControlledDoors` INTEGER NULL,
    `additionalDoorsToSecure` INTEGER NULL,
    `vehicleGates` INTEGER NULL,
    `pedestrianGates` INTEGER NULL,
    `garageDoors` INTEGER NULL,
    `adaDoorOperators` INTEGER NULL,
    `cameras` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeviceCount_propertyId_key`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyOpportunity` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `butterflyMxRating` ENUM('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `invisibleIntercomRating` ENUM('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `opportunityNotes` TEXT NULL,
    `qualificationStatus` ENUM('NEW_PROSPECT', 'RESEARCHING', 'QUALIFIED', 'PROPOSAL_READY', 'PROPOSAL_SENT', 'CUSTOMER', 'LOST') NOT NULL DEFAULT 'NEW_PROSPECT',
    `lastContactDate` DATETIME(3) NULL,
    `nextFollowUpDate` DATETIME(3) NULL,
    `internalNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PropertyOpportunity_propertyId_key`(`propertyId`),
    INDEX `PropertyOpportunity_qualificationStatus_idx`(`qualificationStatus`),
    INDEX `PropertyOpportunity_nextFollowUpDate_idx`(`nextFollowUpDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PropertyContact` ADD CONSTRAINT `PropertyContact_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExistingSystem` ADD CONSTRAINT `ExistingSystem_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceCount` ADD CONSTRAINT `DeviceCount_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyOpportunity` ADD CONSTRAINT `PropertyOpportunity_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
