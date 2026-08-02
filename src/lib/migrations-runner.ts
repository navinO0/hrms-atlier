import { sequelize } from "./sequelize";
import * as initSchemas from "../migrations/00_init_schemas";

interface Migration {
  name: string;
  up: (queryInterface: any) => Promise<void>;
  down: (queryInterface: any) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: "00_init_schemas.ts",
    up: initSchemas.up,
    down: initSchemas.down
  }
];

/**
 * Ensures the SequelizeMeta table exists in the database.
 */
async function ensureMetaTable(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  
  // Create table if not exists using standard Sequelize queryInterface
  const isPostgres = !!process.env.DATABASE_URL;
  const varcharType = isPostgres ? "VARCHAR(255)" : "TEXT";

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
      "name" ${varcharType} PRIMARY KEY
    )
  `);
}

/**
 * Runs all pending migrations in transaction blocks.
 */
export async function runMigrations(): Promise<void> {
  console.log("[MIGRATIONS] Starting migrations check...");
  
  await ensureMetaTable();

  // Fetch completed migrations
  const completed = (await sequelize.query(
    `SELECT "name" FROM "SequelizeMeta"`,
    { type: "SELECT" as any }
  )) as unknown as Array<{ name: string }>;

  const completedNames = new Set(completed.map(row => row.name));

  for (const migration of MIGRATIONS) {
    if (!completedNames.has(migration.name)) {
      console.log(`[MIGRATIONS] Executing pending migration: ${migration.name}`);
      const transaction = await sequelize.transaction();

      try {
        await migration.up(sequelize.getQueryInterface());
        
        await sequelize.query(
          `INSERT INTO "SequelizeMeta" ("name") VALUES (:name)`,
          {
            replacements: { name: migration.name },
            transaction
          }
        );

        await transaction.commit();
        console.log(`[MIGRATIONS] Completed migration: ${migration.name}`);
      } catch (err) {
        await transaction.rollback();
        console.error(`[MIGRATIONS] Error in migration ${migration.name}:`, err);
        throw err;
      }
    }
  }

  console.log("[MIGRATIONS] All migrations verified up-to-date!");
}

/**
 * Reverts all migrations in reverse order to clean database.
 */
export async function undoAllMigrations(): Promise<void> {
  console.log("[MIGRATIONS] Reverting all migrations...");
  
  await ensureMetaTable();

  // Run in reverse order
  const reversedMigrations = [...MIGRATIONS].reverse();

  for (const migration of reversedMigrations) {
    const transaction = await sequelize.transaction();

    try {
      // Revert schema changes
      await migration.down(sequelize.getQueryInterface());
      
      // Delete from metadata
      await sequelize.query(
        `DELETE FROM "SequelizeMeta" WHERE "name" = :name`,
        {
          replacements: { name: migration.name },
          transaction
        }
      );

      await transaction.commit();
      console.log(`[MIGRATIONS] Reverted migration: ${migration.name}`);
    } catch (err) {
      await transaction.rollback();
      console.error(`[MIGRATIONS] Error reverting migration ${migration.name}:`, err);
      // Continue trying to clean tables if one fails, or throw to block
      throw err;
    }
  }
  
  // Finally drop the SequelizeMeta table itself
  try {
    await sequelize.getQueryInterface().dropTable("SequelizeMeta");
  } catch (e) {
    // Ignore if already dropped
  }

  console.log("[MIGRATIONS] Database schema wiped successfully!");
}
