import { getSequelize } from "./sequelize";
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
  const sequelize = await getSequelize();
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

  const sequelize = await getSequelize();
  await ensureMetaTable();

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

  const sequelize = await getSequelize();
  await ensureMetaTable();

  const reversedMigrations = [...MIGRATIONS].reverse();

  for (const migration of reversedMigrations) {
    const transaction = await sequelize.transaction();

    try {
      await migration.down(sequelize.getQueryInterface());

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
      throw err;
    }
  }

  try {
    await (await getSequelize()).getQueryInterface().dropTable("SequelizeMeta");
  } catch (e) {
    // Ignore if already dropped
  }

  console.log("[MIGRATIONS] Database schema wiped successfully!");
}
