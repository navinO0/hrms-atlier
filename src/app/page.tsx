import React from "react";
import HRMSPortal from "@/components/HRMSPortal";
import { initDb } from "@/lib/db-init";
import { 
  Employee, 
  Order, 
  Assignment, 
  AttendanceLog, 
  Timesheet, 
  TimesheetEntry 
} from "@/lib/sequelize";
import { getSession } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Initialize Database on server start/request
  await initDb();

  // Load Session
  const session = await getSession();

  // Load Database Records
  const employees = await Employee.findAll({
    order: [["name", "ASC"]]
  });
  
  const orders = await Order.findAll({
    order: [["orderNumber", "ASC"]]
  });

  const assignments = await Assignment.findAll({
    include: [
      { model: Employee, as: "employee" },
      { model: Order, as: "order" }
    ],
    order: [["assignedDate", "DESC"]]
  });

  const attendance = await AttendanceLog.findAll({
    order: [["date", "DESC"], ["createdAt", "DESC"]]
  });

  const timesheets = await Timesheet.findAll({
    include: [
      {
        model: TimesheetEntry,
        as: "entries",
        include: [
          { model: Order, as: "order" }
        ]
      }
    ],
    order: [["date", "DESC"], ["submittedAt", "DESC"]]
  });

  // Serialize Sequelize instances to plain JS objects for Next.js boundary
  const plainEmployees = JSON.parse(JSON.stringify(employees));
  const plainOrders = JSON.parse(JSON.stringify(orders));
  const plainAssignments = JSON.parse(JSON.stringify(assignments));
  const plainAttendance = JSON.parse(JSON.stringify(attendance));
  const plainTimesheets = JSON.parse(JSON.stringify(timesheets));

  return (
    <HRMSPortal
      initialEmployees={plainEmployees}
      initialAttendance={plainAttendance}
      initialTimesheets={plainTimesheets}
      initialSession={session}
    />
  );
}
