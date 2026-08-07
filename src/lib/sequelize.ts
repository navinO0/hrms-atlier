import { Sequelize, DataTypes, Model } from "sequelize";
// Explicit static import so Next.js/Vercel bundler includes pg in the output.
// Without this, Sequelize's dynamic require('pg') fails at serverless runtime
// with "Please install pg package manually".
import pg from "pg";


// ─── Connection Cache ─────────────────────────────────────────────────────────

declare global {
  var cachedSequelize: Sequelize | undefined;
}

/**
 * Lazily creates and caches a Sequelize connection.
 *
 * IMPORTANT: This must be an async function, NOT module-level `await`.
 * Vercel / Next.js does NOT support top-level await in server modules —
 * using it causes 500 crashes on every request at cold-start.
 */
export async function getSequelize(): Promise<Sequelize> {
  if (global.cachedSequelize) {
    return global.cachedSequelize;
  }

  let conn: Sequelize;

  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable! Relying only on PostgreSQL.");
  }

  // ── PostgreSQL (Vercel / Railway / any hosted DB) ──────────────────────
  conn = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    // Pass the statically imported pg so Sequelize doesn't dynamically
    // require('pg') at runtime — which fails in Vercel serverless bundles.
    dialectModule: pg,
    logging: false,
    pool: {
      max: 4,
      min: 0,
      acquire: 15000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
      keepAlive: true,
    },
  });

  // Verify the connection is reachable before caching
  await conn.authenticate();
  console.log("[DATABASE] Connected to PostgreSQL successfully.");

  global.cachedSequelize = conn;
  return conn;
}

// ─── Model Definitions ────────────────────────────────────────────────────────
// Models are initialized lazily in initModels() called from db-init.ts.

export class Employee extends Model {
  declare id: string;
  declare name: string;
  declare code: string;
  declare department: string;
  declare designation: string;
  declare password: string;
  declare profilePhoto?: string | null;
  declare payType?: "Weekly" | "Monthly" | "Hourly";
  declare payRate?: number;
  declare lastPaidAt?: string | null;
  declare checkInTime?: string | null;
  declare checkOutTime?: string | null;
  declare employmentType?: "Full-Time" | "Part-Time";
  declare breakTime?: number;
}

export class Order extends Model {
  declare id: string;
  declare orderNumber: string;
  declare productName: string;
}

export class Assignment extends Model {
  declare id: string;
  declare employeeId: string;
  declare orderId: string;
  declare assignedDate: string;
  declare notes?: string | null;
}

export class AttendanceLog extends Model {
  declare id: string;
  declare employeeId: string;
  declare date: string;
  declare checkIn?: string;
  declare checkOut?: string;
  declare status: "Clocked In" | "Clocked Out";
  declare pieceCount?: number | null;
  declare unitPrice?: number | null;
}

export class Timesheet extends Model {
  declare id: string;
  declare employeeId: string;
  declare date: string;
  declare submittedAt: string;
  declare readonly entries?: TimesheetEntry[];
}

export class TimesheetEntry extends Model {
  declare id: string;
  declare timesheetId: string;
  declare orderId: string;
  declare description: string;
  declare hours: number;
  declare images?: string[];
}

export class PayrollRecord extends Model {
  declare id: string;
  declare employeeId: string;
  declare amount: number;
  declare netHours: number;
  declare grossHours: number;
  declare lunchDeductionHours: number;
  declare payType: string;
  declare payRate: number;
  declare periodStart: string;
  declare periodEnd: string;
  declare paidAt: string;
  declare notes?: string | null;
}

export class EmploymentType extends Model {
  declare id: string;
  declare name: string;
  declare standardHours: number;
  declare minHoursForBreak: number;
}

export class Department extends Model {
  declare id: string;
  declare name: string;
}

export class PayStructure extends Model {
  declare id: string;
  declare name: string;
  declare daysPerPeriod: number;
}

// ─── Model Initializer ────────────────────────────────────────────────────────

let _modelsInitialized = false;

/**
 * Initializes all Sequelize models against the given connection.
 * Idempotent — safe to call multiple times.
 */
export function initModels(sequelize: Sequelize): void {
  if (_modelsInitialized) return;
  _modelsInitialized = true;

  Employee.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      department: { type: DataTypes.STRING, allowNull: false },
      designation: { type: DataTypes.STRING, allowNull: false },
      password: { type: DataTypes.STRING, allowNull: false, defaultValue: "password" },
      profilePhoto: { type: DataTypes.TEXT, allowNull: true },
      payType: { type: DataTypes.STRING, allowNull: false, defaultValue: "Monthly" },
      payRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      lastPaidAt: { type: DataTypes.STRING, allowNull: true },
      checkInTime: { type: DataTypes.STRING, allowNull: true, defaultValue: "09:00" },
      checkOutTime: { type: DataTypes.STRING, allowNull: true, defaultValue: "18:00" },
      employmentType: { type: DataTypes.STRING, allowNull: false, defaultValue: "Full-Time" },
      breakTime: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    },
    { sequelize, modelName: "Employee" }
  );

  Order.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      orderNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
      productName: { type: DataTypes.STRING, allowNull: false },
    },
    { sequelize, modelName: "Order" }
  );

  Assignment.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      employeeId: { type: DataTypes.STRING, allowNull: false },
      orderId: { type: DataTypes.STRING, allowNull: false },
      assignedDate: { type: DataTypes.STRING, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: "Assignment" }
  );

  AttendanceLog.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      employeeId: { type: DataTypes.STRING, allowNull: false },
      date: { type: DataTypes.STRING, allowNull: false },
      checkIn: { type: DataTypes.STRING, allowNull: true },
      checkOut: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false },
      pieceCount: { type: DataTypes.INTEGER, allowNull: true },
      unitPrice: { type: DataTypes.FLOAT, allowNull: true },
    },
    { sequelize, modelName: "AttendanceLog" }
  );

  Timesheet.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      employeeId: { type: DataTypes.STRING, allowNull: false },
      date: { type: DataTypes.STRING, allowNull: false },
      submittedAt: { type: DataTypes.STRING, allowNull: false },
    },
    { sequelize, modelName: "Timesheet" }
  );

  TimesheetEntry.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      timesheetId: { type: DataTypes.STRING, allowNull: false },
      orderId: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: false },
      hours: { type: DataTypes.FLOAT, allowNull: false },
      images: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const val = this.getDataValue("images");
          return val ? JSON.parse(val) : [];
        },
        set(val) {
          this.setDataValue("images", val ? JSON.stringify(val) : JSON.stringify([]));
        },
      },
    },
    { sequelize, modelName: "TimesheetEntry" }
  );

  PayrollRecord.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      employeeId: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.FLOAT, allowNull: false },
      netHours: { type: DataTypes.FLOAT, allowNull: false },
      grossHours: { type: DataTypes.FLOAT, allowNull: false },
      lunchDeductionHours: { type: DataTypes.FLOAT, allowNull: false },
      payType: { type: DataTypes.STRING, allowNull: false },
      payRate: { type: DataTypes.FLOAT, allowNull: false },
      periodStart: { type: DataTypes.STRING, allowNull: false },
      periodEnd: { type: DataTypes.STRING, allowNull: false },
      paidAt: { type: DataTypes.STRING, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: "PayrollRecord" }
  );

  EmploymentType.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      standardHours: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 8.0 },
      minHoursForBreak: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 5.0 },
    },
    { sequelize, modelName: "EmploymentType" }
  );

  Department.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
    },
    { sequelize, modelName: "Department" }
  );

  PayStructure.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      daysPerPeriod: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, modelName: "PayStructure" }
  );

  // ─── Relationships ──────────────────────────────────────────────────────────
  Timesheet.hasMany(TimesheetEntry, { foreignKey: "timesheetId", as: "entries", onDelete: "CASCADE" });
  TimesheetEntry.belongsTo(Timesheet, { foreignKey: "timesheetId", as: "timesheet" });

  Assignment.belongsTo(Employee, { foreignKey: "employeeId", as: "employee" });
  Assignment.belongsTo(Order, { foreignKey: "orderId", as: "order" });

  TimesheetEntry.belongsTo(Order, { foreignKey: "orderId", as: "order" });

  AttendanceLog.belongsTo(Employee, { foreignKey: "employeeId", as: "employee" });

  PayrollRecord.belongsTo(Employee, { foreignKey: "employeeId", as: "employee" });
  Employee.hasMany(PayrollRecord, { foreignKey: "employeeId", as: "payrollRecords", onDelete: "CASCADE" });
}

// ─── Helper Utilities ─────────────────────────────────────────────────────────

export function calculateHoursFromAttendance(checkInStr?: string, checkOutStr?: string): number {
  if (!checkInStr) return 0;

  const parseTime = (timeStr: string): Date | null => {
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return null;
    let [_, hours, minutes, ampm] = match;
    let h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
    if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const inTime = parseTime(checkInStr);
  if (!inTime) return 0;

  let outTime = checkOutStr ? parseTime(checkOutStr) : null;
  if (!outTime) {
    outTime = new Date();
  }

  const diffMs = outTime.getTime() - inTime.getTime();
  if (diffMs <= 0) return 0;

  const diffHours = diffMs / (1000 * 60 * 60);
  return parseFloat(diffHours.toFixed(2));
}
