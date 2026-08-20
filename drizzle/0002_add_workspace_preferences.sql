CREATE TABLE IF NOT EXISTS `workspacePreferences` (
  `workspaceId` VARCHAR(36) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `revision` INT NOT NULL DEFAULT 1,
  `preferencesJson` TEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`workspaceId`),
  CONSTRAINT `workspacePreferences_workspaceId_workspaces_id_fk`
    FOREIGN KEY (`workspaceId`) REFERENCES `workspaces` (`id`)
    ON DELETE CASCADE
);
