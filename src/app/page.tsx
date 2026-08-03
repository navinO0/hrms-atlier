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
  let dbError: string | null = null;
  let employees: any[] = [];
  let orders: any[] = [];
  let assignments: any[] = [];
  let attendance: any[] = [];
  let timesheets: any[] = [];
  let session: any = null;

  try {
    // Initialize Database on server start/request
    await initDb();

    // Load Session
    session = await getSession();

    // Load Database Records
    employees = await Employee.findAll({
      order: [["name", "ASC"]]
    });
    
    orders = await Order.findAll({
      order: [["orderNumber", "ASC"]]
    });

    assignments = await Assignment.findAll({
      include: [
        { model: Employee, as: "employee" },
        { model: Order, as: "order" }
      ],
      order: [["assignedDate", "DESC"]]
    });

    attendance = await AttendanceLog.findAll({
      order: [["date", "DESC"], ["createdAt", "DESC"]]
    });

    timesheets = await Timesheet.findAll({
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
  } catch (err: any) {
    console.error("Database connection/init error in Page:", err);
    dbError = err.message || String(err);
  }

  if (dbError) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-6 text-zinc-800 font-sans">
        <div className="w-full max-w-md bg-white border border-red-200 p-6 shadow-xl text-center space-y-4">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-none bg-red-50 text-red-600 border border-red-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-black text-zinc-900 uppercase tracking-wide">Database Connection Failed</p>
            <p className="text-[11px] text-zinc-500">The application could not establish a connection to the database server.</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-150 p-3.5 text-left font-mono text-[9px] text-zinc-650 break-all leading-relaxed whitespace-pre-wrap">
            {dbError}
          </div>
          <div className="text-[10px] text-zinc-500 leading-relaxed text-left border-t border-zinc-100 pt-3 space-y-2">
            <p className="font-extrabold uppercase tracking-wider text-zinc-700">How to resolve:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Ensure your <strong className="text-zinc-800">DATABASE_URL</strong> environment variable is defined in your Vercel Project Dashboard (Settings &rarr; Environment Variables).</li>
              <li>Confirm your PostgreSQL server is active and reachable.</li>
              <li>After adding variables, trigger a <strong className="text-zinc-800">Redeploy</strong> on Vercel to apply the changes.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Serialize Sequelize instances to plain JS objects for Next.js boundary
  const plainEmployees = JSON.parse(JSON.stringify(employees));
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
