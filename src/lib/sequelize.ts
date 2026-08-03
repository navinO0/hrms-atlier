import { Sequelize, DataTypes, Model } from "sequelize";

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

  if (process.env.DATABASE_URL) {
    // ── PostgreSQL (Vercel / Railway / any hosted DB) ──────────────────────
    conn = new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
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
  } else {
    // ── SQLite fallback for local development ──────────────────────────────
    const path = require("path") as typeof import("path");
    const fs = require("fs") as typeof import("fs");
    const dataDir = path.join(process.cwd(), "src", "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    conn = new Sequelize({
      dialect: "sqlite",
      storage: path.join(dataDir, "database.sqlite"),
      logging: false,
    });
    console.log("[DATABASE] Using local SQLite database.");
  }

  global.cachedSequelize = conn;
  return conn;
}

// ─── Model Definitions ────────────────────────────────────────────────────────
// Models are initialized lazily in initModels() called from db-init.ts.

export class Employee extends Model {
  public id!: string;
  public name!: string;
  public code!: string;
  public department!: string;
  public designation!: string;
}

export class Order extends Model {
  public id!: string;
  public orderNumber!: string;
  public productName!: string;
}

export class Assignment extends Model {
  public id!: string;
  public employeeId!: string;
  public orderId!: string;
  public assignedDate!: string;
  public notes?: string;
}

export class AttendanceLog extends Model {
  public id!: string;
  public employeeId!: string;
  public date!: string;
  public checkIn?: string;
  public checkOut?: string;
  public status!: "Clocked In" | "Clocked Out";
}

export class Timesheet extends Model {
  public id!: string;
  public employeeId!: string;
  public date!: string;
  public submittedAt!: string;
  public readonly entries?: TimesheetEntry[];
}

export class TimesheetEntry extends Model {
  public id!: string;
  public timesheetId!: string;
  public orderId!: string;
  public description!: string;
  public hours!: number;
  public images?: string[];
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

  // ─── Relationships ──────────────────────────────────────────────────────────
  Timesheet.hasMany(TimesheetEntry, { foreignKey: "timesheetId", as: "entries", onDelete: "CASCADE" });
  TimesheetEntry.belongsTo(Timesheet, { foreignKey: "timesheetId", as: "timesheet" });

  Assignment.belongsTo(Employee, { foreignKey: "employeeId", as: "employee" });
  Assignment.belongsTo(Order, { foreignKey: "orderId", as: "order" });

  TimesheetEntry.belongsTo(Order, { foreignKey: "orderId", as: "order" });

  AttendanceLog.belongsTo(Employee, { foreignKey: "employeeId", as: "employee" });
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
