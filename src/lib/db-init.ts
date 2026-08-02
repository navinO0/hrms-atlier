import { sequelize, Employee, Order, Assignment, AttendanceLog, Timesheet, TimesheetEntry, calculateHoursFromAttendance } from "./sequelize";
import { Op } from "sequelize";

const SEED_EMPLOYEES = [
  { id: "emp-1", name: "Amit Verma", code: "EMP-101", department: "Stitching Section", designation: "Lead Stitcher" },
  { id: "emp-2", name: "Priya Gupta", code: "EMP-102", department: "Stitching Section", designation: "Stitching Operator" },
  { id: "emp-3", name: "Sunita Kumar", code: "EMP-103", department: "Quality Assurance", designation: "QC Inspector" },
  { id: "emp-4", name: "Vijay Singh", code: "EMP-104", department: "Cutting Department", designation: "Fabric Cutter" }
];

const SEED_ORDERS = [
  { id: "ord-1", orderNumber: "ORD-001", productName: "Haute Couture Evening Gown" },
  { id: "ord-2", orderNumber: "ORD-002", productName: "Linen Summer Blazer" },
  { id: "ord-3", orderNumber: "ORD-003", productName: "Silk Kimono Robe" },
  { id: "ord-4", orderNumber: "ORD-004", productName: "Raw Denim Utility Jacket" },
  { id: "ord-5", orderNumber: "ORD-005", productName: "Classic Leather Jacket" }
];

const SEED_ASSIGNMENTS = [
  { id: "asg-1", employeeId: "emp-1", orderId: "ord-1", assignedDate: "2026-07-24", notes: "Focus on collar embroidery alignment." },
  { id: "asg-2", employeeId: "emp-2", orderId: "ord-2", assignedDate: "2026-07-24", notes: "Inner lining stitching review." }
];

const SEED_ATTENDANCE = [
  { id: "att-1", employeeId: "emp-1", date: "2026-07-24", checkIn: "09:05 AM", status: "Clocked In" as const },
  { id: "att-2", employeeId: "emp-2", date: "2026-07-24", checkIn: "08:58 AM", status: "Clocked In" as const }
];

const SEED_TIMESHEETS = [
  {
    id: "ts-1",
    employeeId: "emp-1",
    date: "2026-07-23",
    submittedAt: "2026-07-23 05:15 PM"
  }
];

const SEED_TIMESHEET_ENTRIES = [
  { id: "tse-1", timesheetId: "ts-1", orderId: "ord-1", description: "Seam stitchings on couture gown", hours: 4.5, images: [] },
  { id: "tse-2", timesheetId: "ts-1", orderId: "ord-3", description: "Fabric preparations and layout review", hours: 3.5, images: [] }
];

let dbInitPromise: Promise<void> | null = null;

export async function initDb() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      // Ensure data directory exists for SQLite only
      if (!process.env.DATABASE_URL) {
        const path = require("path");
        const fs = require("fs");
        const dataDir = path.join(process.cwd(), "src", "data");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
      }

      // Synchronize models (Safe sync creates tables if not existing, preventing locks and constraint conflicts)
      await sequelize.sync();

      const empCount = await Employee.count();
      if (empCount === 0) {
        // Seed Employees
        await Employee.bulkCreate(SEED_EMPLOYEES);

        // Seed Orders
        await Order.bulkCreate(SEED_ORDERS);

        // Seed Assignments
        await Assignment.bulkCreate(SEED_ASSIGNMENTS);

        // Seed Attendance
        await AttendanceLog.bulkCreate(SEED_ATTENDANCE);

        // Seed Timesheets
        await Timesheet.bulkCreate(SEED_TIMESHEETS);

        // Seed Timesheet Entries
        await TimesheetEntry.bulkCreate(SEED_TIMESHEET_ENTRIES);

        console.log("Database initialized and populated with seed data successfully!");
      }
    })();
  }
  await dbInitPromise;
  await autoCheckoutForgottenLogs();
}

export async function resetDb() {
  // Re-sync with force: true to drop all tables and recreate them
  await sequelize.sync({ force: true });
  
  // Seed Employees
  await Employee.bulkCreate(SEED_EMPLOYEES);

  // Seed Orders
  await Order.bulkCreate(SEED_ORDERS);

  // Seed Assignments
  await Assignment.bulkCreate(SEED_ASSIGNMENTS);

  // Seed Attendance
  await AttendanceLog.bulkCreate(SEED_ATTENDANCE);

  // Seed Timesheets
  await Timesheet.bulkCreate(SEED_TIMESHEETS);

  // Seed Timesheet Entries
  await TimesheetEntry.bulkCreate(SEED_TIMESHEET_ENTRIES);

  console.log("Database reset and populated with seed data successfully!");
}

async function autoCheckoutForgottenLogs() {
  try {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Find all attendance logs that are still "Clocked In" from previous days
    const forgottenLogs = await AttendanceLog.findAll({
      where: {
        status: "Clocked In",
        date: {
          [Op.lt]: todayStr
        }
      }
    });

    if (forgottenLogs.length > 0) {
      console.log(`[EOD AUTO-CHECKOUT] Found ${forgottenLogs.length} forgotten attendance logs. Clocking out...`);
      for (const log of forgottenLogs) {
        // Mark as clocked out at EOD (06:00 PM)
        await log.update({
          checkOut: "06:00 PM",
          status: "Clocked Out"
        });

        // Also auto-calculate/update corresponding timesheet hours if timesheet exists
        const employeeId = log.get('employeeId') as string;
        const logDate = log.get('date') as string;
        const checkInVal = log.get('checkIn') as string;
        
        const ts = await Timesheet.findOne({
          where: { employeeId, date: logDate }
        });
        if (ts) {
          const finalHours = calculateHoursFromAttendance(checkInVal, "06:00 PM");
          await TimesheetEntry.update(
            { hours: finalHours },
            { where: { timesheetId: ts.get('id') as string } }
          );
        }
      }
    }
  } catch (err) {
    console.error("[EOD AUTO-CHECKOUT] Error executing auto-checkout:", err);
  }
}
