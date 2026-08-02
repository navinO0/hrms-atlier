import { Sequelize, DataTypes, Model } from "sequelize";
import path from "path";
import fs from "fs";

const isPostgres = !!process.env.DATABASE_URL;

declare global {
  var cachedSequelize: Sequelize | undefined;
}

let conn: Sequelize;

if (isPostgres) {
  if (!global.cachedSequelize) {
    global.cachedSequelize = new Sequelize(process.env.DATABASE_URL!, {
      dialect: "postgres",
      logging: false,
      pool: {
        max: 4,
        min: 0,
        acquire: 30000,
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
  }
  conn = global.cachedSequelize;
} else {
  conn = new Sequelize({
    dialect: "sqlite",
    storage: path.join(process.cwd(), "src", "data", "database.sqlite"),
    logging: false,
  });
}

export const sequelize = conn;

// Models Definitions
export class Employee extends Model {
  public id!: string;
  public name!: string;
  public code!: string;
  public department!: string;
  public designation!: string;
}
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

export class Order extends Model {
  public id!: string;
  public orderNumber!: string;
  public productName!: string;
}
Order.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    orderNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    productName: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: "Order" }
);

export class Assignment extends Model {
  public id!: string;
  public employeeId!: string;
  public orderId!: string;
  public assignedDate!: string;
  public notes?: string;
}
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

export class AttendanceLog extends Model {
  public id!: string;
  public employeeId!: string;
  public date!: string;
  public checkIn?: string;
  public checkOut?: string;
  public status!: "Clocked In" | "Clocked Out";
}
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

export class Timesheet extends Model {
  public id!: string;
  public employeeId!: string;
  public date!: string;
  public submittedAt!: string;
  public readonly entries?: TimesheetEntry[];
}
Timesheet.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    submittedAt: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: "Timesheet" }
);

export class TimesheetEntry extends Model {
  public id!: string;
  public timesheetId!: string;
  public orderId!: string;
  public description!: string;
  public hours!: number;
  public images?: string[];
}
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

// Relationships
Timesheet.hasMany(TimesheetEntry, { foreignKey: "timesheetId", as: "entries", onDelete: "CASCADE" });
TimesheetEntry.belongsTo(Timesheet, { foreignKey: "timesheetId", as: "timesheet" });

Assignment.belongsTo(Employee, { foreignKey: "employeeId", as: "employee" });
Assignment.belongsTo(Order, { foreignKey: "orderId", as: "order" });

TimesheetEntry.belongsTo(Order, { foreignKey: "orderId", as: "order" });

AttendanceLog.belongsTo(Employee, { foreignKey: "employeeId", as: "employee" });

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
    // If not checked out yet, calculate up to current time
    outTime = new Date();
  }

  const diffMs = outTime.getTime() - inTime.getTime();
  if (diffMs <= 0) return 0;
  
  const diffHours = diffMs / (1000 * 60 * 60);
  return parseFloat(diffHours.toFixed(2));
}
