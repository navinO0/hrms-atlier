import { getSequelize } from "./sequelize";
import * as initSchemas from "../migrations/00_init_schemas";
import * as addPasswordToEmployees from "../migrations/01_add_password_to_employees";
import * as addProfilePhotoToEmployees from "../migrations/02_add_profile_photo_to_employees";
import * as addPayFieldsToEmployees from "../migrations/03_add_pay_fields_to_employees";
import * as createPayrollRecords from "../migrations/04_create_payroll_records";
import * as addShiftTimingsToEmployees from "../migrations/05_add_shift_timings_to_employees";
import * as createEmploymentTypes from "../migrations/06_create_employment_types";
import * as createDepartmentsAndPayStructures from "../migrations/07_create_departments_and_pay_structures";
import * as addPieceCountToAttendance from "../migrations/08_add_piece_count_to_attendance";
import * as addUnitPriceToAttendance from "../migrations/09_add_unit_price_to_attendance";
import * as addAutoCheckoutAndOtOverrideToAttendance from "../migrations/10_add_auto_checkout_and_ot_override_to_attendance";

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
  },
  {
    name: "01_add_password_to_employees.ts",
    up: addPasswordToEmployees.up,
    down: addPasswordToEmployees.down
  },
  {
    name: "02_add_profile_photo_to_employees.ts",
    up: addProfilePhotoToEmployees.up,
    down: addProfilePhotoToEmployees.down
  },
  {
    name: "03_add_pay_fields_to_employees.ts",
    up: addPayFieldsToEmployees.up,
    down: addPayFieldsToEmployees.down
  },
  {
    name: "04_create_payroll_records.ts",
    up: createPayrollRecords.up,
    down: createPayrollRecords.down
  },
  {
    name: "05_add_shift_timings_to_employees.ts",
    up: addShiftTimingsToEmployees.up,
    down: addShiftTimingsToEmployees.down
  },
  {
    name: "06_create_employment_types.ts",
    up: createEmploymentTypes.up,
    down: createEmploymentTypes.down
  },
  {
    name: "07_create_departments_and_pay_structures.ts",
    up: createDepartmentsAndPayStructures.up,
    down: createDepartmentsAndPayStructures.down
  },
  {
    name: "08_add_piece_count_to_attendance.ts",
    up: addPieceCountToAttendance.up,
    down: addPieceCountToAttendance.down
  },
  {
    name: "09_add_unit_price_to_attendance.ts",
    up: addUnitPriceToAttendance.up,
    down: addUnitPriceToAttendance.down
  },
  {
    name: "10_add_auto_checkout_and_ot_override_to_attendance.ts",
    up: addAutoCheckoutAndOtOverrideToAttendance.up,
    down: addAutoCheckoutAndOtOverrideToAttendance.down
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
