import mysql from "mysql2/promise";

const connectionUrl = process.env.DATABASE_URL;
if (!connectionUrl) {
  throw new Error("DATABASE_URL is required");
}

const url = new URL(connectionUrl);
const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!database) {
  throw new Error("DATABASE_URL must include a database name");
}

const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database,
  ssl: { rejectUnauthorized: true },
});

const statements = [
  `CREATE DATABASE IF NOT EXISTS \`${database}\``,
  `CREATE TABLE IF NOT EXISTS \`${database}\`.\`users\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`openId\` VARCHAR(64) NOT NULL,
    \`name\` TEXT NULL,
    \`email\` VARCHAR(320) NULL,
    \`loginMethod\` VARCHAR(64) NULL,
    \`role\` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    \`lastSignedIn\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`users_openId_unique\` (\`openId\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`${database}\`.\`workspaces\` (
    \`id\` VARCHAR(36) NOT NULL,
    \`ownerId\` INT NOT NULL,
    \`name\` VARCHAR(160) NOT NULL,
    \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`workspaces_owner_idx\` (\`ownerId\`),
    CONSTRAINT \`workspaces_ownerId_users_id_fk\`
      FOREIGN KEY (\`ownerId\`) REFERENCES \`${database}\`.\`users\` (\`id\`)
      ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS \`${database}\`.\`workspacePreferences\` (
    \`workspaceId\` VARCHAR(36) NOT NULL,
    \`version\` INT NOT NULL DEFAULT 1,
    \`revision\` INT NOT NULL DEFAULT 1,
    \`preferencesJson\` TEXT NOT NULL,
    \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`workspaceId\`),
    CONSTRAINT \`workspacePreferences_workspaceId_workspaces_id_fk\`
      FOREIGN KEY (\`workspaceId\`) REFERENCES \`${database}\`.\`workspaces\` (\`id\`)
      ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS \`${database}\`.\`researchDrafts\` (
    \`id\` VARCHAR(36) NOT NULL,
    \`workspaceId\` VARCHAR(36) NOT NULL,
    \`title\` VARCHAR(180) NOT NULL,
    \`hypothesis\` TEXT NOT NULL,
    \`condition\` TEXT NOT NULL,
    \`datasetJson\` TEXT NOT NULL,
    \`revision\` INT NOT NULL DEFAULT 1,
    \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`research_drafts_workspace_idx\` (\`workspaceId\`),
    CONSTRAINT \`researchDrafts_workspaceId_workspaces_id_fk\`
      FOREIGN KEY (\`workspaceId\`) REFERENCES \`${database}\`.\`workspaces\` (\`id\`)
      ON DELETE CASCADE
  )`,
];

try {
  for (const statement of statements) {
    await connection.execute(statement);
  }

  const [tables] = await connection.query(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.tables
     WHERE table_schema = ?
       AND table_name IN ('users', 'workspaces', 'workspacePreferences', 'researchDrafts')
     ORDER BY table_name`,
    [database],
  );

  if (tables.length !== 4) {
    throw new Error(`Schema verification failed: expected 4 tables, found ${tables.length}`);
  }

  console.log(JSON.stringify({ database, tables }, null, 2));
} finally {
  await connection.end();
}
