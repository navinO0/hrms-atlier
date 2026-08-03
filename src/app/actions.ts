"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { initDb, resetDb } from "@/lib/db-init";
import { 
  Employee, 
  Order, 
  Assignment, 
  AttendanceLog, 
  Timesheet, 
  TimesheetEntry, 
  getSequelize,
  calculateHoursFromAttendance
} from "@/lib/sequelize";
import { 
  EmployeeSchema,
  OrderSchema,
  AssignmentSchema,
  ClockInSchema,
  ClockOutSchema,
  ManualAttendanceSchema,
  SubmitTimesheetSchema,
  UpdateTimesheetSchema,
  formatZodError
} from "@/lib/schemas";

// Helper for session loading
export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("hrms_session");
  if (!sessionCookie) return null;
  try {
    return JSON.parse(sessionCookie.value);
  } catch (err) {
    return null;
  }
}

export async function loginAction(username: string, password: string) {
  const normUsername = username.trim().toLowerCase();

  if (normUsername === "admin") {
    if (password === "admin") {
      const session = {
        isAuthenticated: true,
        authRole: "Admin" as const,
        authEmployeeId: null,
      };
      const cookieStore = await cookies();
      cookieStore.set("hrms_session", JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      return { success: true, session };
    } else {
      return { success: false, error: "Invalid password for admin." };
    }
  } else {
    const emp = await Employee.findOne({
      where: { code: username.trim().toUpperCase() }
    });
    if (emp && password === "password") {
      const session = {
        isAuthenticated: true,
        authRole: "Employee" as const,
        authEmployeeId: emp.id,
      };
      const cookieStore = await cookies();
      cookieStore.set("hrms_session", JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      return { success: true, session };
    } else {
      return { success: false, error: "Invalid username or password. Try EMP-101 and password." };
    }
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("hrms_session");
  revalidatePath("/");
  return { success: true };
}

export async function addEmployeeAction(name: string, code: string, department: string, designation: string) {
  try {
    const validated = EmployeeSchema.parse({ name, code, department, designation });
    name = validated.name;
    code = validated.code;
    department = validated.department;
    designation = validated.designation;
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  const existing = await Employee.findOne({ where: { code: code.toUpperCase() } });
  if (existing) {
    return { success: false, error: "An employee with this code already exists." };
  }

  const id = `emp-${Date.now()}`;
  await Employee.create({
    id,
    name,
    code: code.toUpperCase(),
    department,
    designation,
  });

  revalidatePath("/");
  return { success: true };
}

export async function addOrderAction(orderNumber: string, productName: string) {
  try {
    const validated = OrderSchema.parse({ orderNumber, productName });
    orderNumber = validated.orderNumber;
    productName = validated.productName;
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  const existing = await Order.findOne({ where: { orderNumber: orderNumber.toUpperCase() } });
  if (existing) {
    return { success: false, error: "An order with this number already exists." };
  }

  const id = `ord-${Date.now()}`;
  await Order.create({
    id,
    orderNumber: orderNumber.toUpperCase(),
    productName,
  });

  revalidatePath("/");
  return { success: true };
}

export async function assignOrderAction(employeeId: string, orderId: string, notes?: string) {
  try {
    const validated = AssignmentSchema.parse({ employeeId, orderId, notes });
    employeeId = validated.employeeId;
    orderId = validated.orderId;
    notes = validated.notes ?? undefined;
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  const empExists = await Employee.findByPk(employeeId);
  if (!empExists) {
    return { success: false, error: "Employee not found." };
  }
  const orderExists = await Order.findByPk(orderId);
  if (!orderExists) {
    return { success: false, error: "Order not found." };
  }

  const existing = await Assignment.findOne({ where: { employeeId, orderId } });
  if (existing) {
    return { success: false, error: "This order is already assigned to this employee." };
  }

  const id = `asg-${Date.now()}`;
  await Assignment.create({
    id,
    employeeId,
    orderId,
    assignedDate: new Date().toISOString().split("T")[0],
    notes,
  });

  revalidatePath("/");
  return { success: true };
}

export async function removeAssignmentAction(id: string) {
  if (!id || typeof id !== "string") {
    return { success: false, error: "Invalid assignment ID." };
  }
  const existing = await Assignment.findByPk(id);
  if (!existing) {
    return { success: false, error: "Assignment not found." };
  }

  await Assignment.destroy({ where: { id } });
  revalidatePath("/");
  return { success: true };
}

export async function clockInAction(employeeId: string, date: string, timeStr: string) {
  try {
    const validated = ClockInSchema.parse({ employeeId, date, timeStr });
    employeeId = validated.employeeId;
    date = validated.date;
    timeStr = validated.timeStr;
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  const empExists = await Employee.findByPk(employeeId);
  if (!empExists) {
    return { success: false, error: "Employee not found." };
  }

  let log = await AttendanceLog.findOne({ where: { employeeId, date } });
  if (!log) {
    log = await AttendanceLog.create({
      id: `att-${Date.now()}`,
      employeeId,
      date,
      checkIn: timeStr,
      status: "Clocked In",
    });
  } else {
    await log.update({
      checkIn: timeStr,
      checkOut: null,
      status: "Clocked In",
    });
  }
  revalidatePath("/");
  return { success: true, attendanceLog: log.toJSON() };
}



export async function clockOutAction(employeeId: string, date: string, timeStr: string) {
  try {
    const validated = ClockOutSchema.parse({ employeeId, date, timeStr });
    employeeId = validated.employeeId;
    date = validated.date;
    timeStr = validated.timeStr;
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  const empExists = await Employee.findByPk(employeeId);
  if (!empExists) {
    return { success: false, error: "Employee not found." };
  }

  let log = await AttendanceLog.findOne({ where: { employeeId, date } });
  let checkInVal: string | undefined = undefined;

  if (!log) {
    log = await AttendanceLog.create({
      id: `att-${Date.now()}`,
      employeeId,
      date,
      checkOut: timeStr,
      status: "Clocked Out",
    });
  } else {
    checkInVal = log.checkIn;
    await log.update({
      checkOut: timeStr,
      status: "Clocked Out",
    });
  }

  // Update existing timesheet hours for today to match checkout time
  let updatedTs: any = null;
  const ts = await Timesheet.findOne({ 
    where: { employeeId, date },
    include: [{ model: TimesheetEntry, as: "entries" }]
  });
  if (ts) {
    const finalHours = calculateHoursFromAttendance(checkInVal, timeStr);
    await TimesheetEntry.update(
      { hours: finalHours },
      { where: { timesheetId: ts.get('id') as string } }
    );
    await ts.reload();
    updatedTs = ts.toJSON();
  }

  revalidatePath("/");
  return { success: true, attendanceLog: log.toJSON(), timesheet: updatedTs };
}

export async function saveManualAttendanceAction(employeeId: string, date: string, checkIn: string, checkOut: string) {
  try {
    const validated = ManualAttendanceSchema.parse({ employeeId, date, checkIn, checkOut });
    employeeId = validated.employeeId;
    date = validated.date;
    checkIn = validated.checkIn || "";
    checkOut = validated.checkOut || "";
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  const empExists = await Employee.findByPk(employeeId);
  if (!empExists) {
    return { success: false, error: "Employee not found." };
  }

  const status = checkOut.trim() ? "Clocked Out" : "Clocked In";
  const log = await AttendanceLog.findOne({ where: { employeeId, date } });

  if (!log) {
    await AttendanceLog.create({
      id: `att-${Date.now()}`,
      employeeId,
      date,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      status,
    });
  } else {
    await log.update({
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      status,
    });
  }

  // Sync timesheet hours with manual attendance
  const ts = await Timesheet.findOne({ where: { employeeId, date } });
  if (ts) {
    const finalHours = calculateHoursFromAttendance(checkIn, checkOut);
    await TimesheetEntry.update(
      { hours: finalHours },
      { where: { timesheetId: ts.id } }
    );
  }

  revalidatePath("/");
  return { success: true };
}

interface ServerTimesheetEntry {
  id?: string;
  orderId?: string;
  description: string;
  hours?: number;
  images?: string[];
}

export async function submitTimesheetAction(employeeId: string, date: string, entries: ServerTimesheetEntry[], submittedAt: string) {
  try {
    const validated = SubmitTimesheetSchema.parse({ employeeId, date, entries, submittedAt });
    employeeId = validated.employeeId;
    date = validated.date;
    entries = validated.entries as ServerTimesheetEntry[];
    submittedAt = validated.submittedAt;
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  const empExists = await Employee.findByPk(employeeId);
  if (!empExists) {
    return { success: false, error: "Employee not found." };
  }

  // Validate orderIds reference
  for (const entry of entries) {
    if (entry.orderId && entry.orderId.trim() !== "") {
      const orderExists = await Order.findByPk(entry.orderId);
      if (!orderExists) {
        return { success: false, error: `Order with ID ${entry.orderId} not found.` };
      }
    }
  }

  const sequelize = await getSequelize();
  const t = await sequelize.transaction();
  try {
    const timesheetId = `ts-${Date.now()}`;
    const ts = await Timesheet.create({
      id: timesheetId,
      employeeId,
      date,
      submittedAt,
    }, { transaction: t });

    // Auto-calculate hours from check-in details
    const log = await AttendanceLog.findOne({ where: { employeeId, date } });
    const computedHours = calculateHoursFromAttendance(log?.checkIn, log?.checkOut);

    const formattedEntries = entries.map((entry, idx) => ({
      id: `tse-${Date.now()}-${idx}`,
      timesheetId,
      orderId: (entry.orderId && entry.orderId.trim() !== "") ? entry.orderId : null,
      description: entry.description,
      hours: computedHours,
      images: entry.images || [],
    }));

    const createdEntries = await TimesheetEntry.bulkCreate(formattedEntries, { transaction: t });
    await t.commit();
    revalidatePath("/");
    return { 
      success: true, 
      timesheet: {
        id: ts.get('id') as string,
        employeeId: ts.get('employeeId') as string,
        date: ts.get('date') as string,
        submittedAt: ts.get('submittedAt') as string,
        entries: createdEntries.map(e => ({
          id: e.id,
          timesheetId: e.timesheetId,
          orderId: e.orderId,
          description: e.description,
          hours: e.hours,
          images: e.images,
        }))
      }
    };
  } catch (error: any) {
    try {
      await t.rollback();
    } catch (rollbackError) {
      // transaction already finished
    }
    console.error("submitTimesheetAction DB ERROR:", error);
    if (error.name === "SequelizeValidationError") {
      const details = error.errors.map((e: any) => `${e.path}: ${e.message}`).join("; ");
      return { success: false, error: `Validation error: ${details}` };
    }
    return { success: false, error: error.message };
  }
}

export async function updateTimesheetAction(timesheetId: string, date: string, entries: ServerTimesheetEntry[], submittedAt: string) {
  try {
    const validated = UpdateTimesheetSchema.parse({ timesheetId, date, entries, submittedAt });
    timesheetId = validated.timesheetId;
    date = validated.date;
    entries = validated.entries as ServerTimesheetEntry[];
    submittedAt = validated.submittedAt;
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  // check if timesheet exists
  const timesheet = await Timesheet.findByPk(timesheetId);
  if (!timesheet) {
    return { success: false, error: "Timesheet not found" };
  }

  // Validate orderIds reference
  for (const entry of entries) {
    if (entry.orderId && entry.orderId.trim() !== "") {
      const orderExists = await Order.findByPk(entry.orderId);
      if (!orderExists) {
        return { success: false, error: `Order with ID ${entry.orderId} not found.` };
      }
    }
  }

  const sequelize = await getSequelize();
  const t = await sequelize.transaction();
  try {
    // Delete existing entries
    await TimesheetEntry.destroy({ where: { timesheetId }, transaction: t });

    // Update timesheet header
    timesheet.date = date;
    timesheet.submittedAt = submittedAt;
    await timesheet.save({ transaction: t });

    // Auto-calculate hours from check-in details
    const employeeId = (timesheet.dataValues as any)?.employeeId || timesheet.employeeId;
    const log = employeeId ? await AttendanceLog.findOne({ where: { employeeId, date } }) : null;
    const computedHours = calculateHoursFromAttendance(log?.checkIn, log?.checkOut);

    // Create new entries
    const formattedEntries = entries.map((entry, idx) => ({
      id: entry.id || `tse-${Date.now()}-${idx}`,
      timesheetId,
      orderId: (entry.orderId && entry.orderId.trim() !== "") ? entry.orderId : null,
      description: entry.description,
      hours: computedHours,
      images: entry.images || [],
    }));

    const createdEntries = await TimesheetEntry.bulkCreate(formattedEntries, { transaction: t });
    await t.commit();
    revalidatePath("/");
    return { 
      success: true, 
      timesheet: {
        id: timesheet.get('id') as string,
        employeeId: timesheet.get('employeeId') as string,
        date: timesheet.get('date') as string,
        submittedAt: timesheet.get('submittedAt') as string,
        entries: createdEntries.map(e => ({
          id: e.id,
          timesheetId: e.timesheetId,
          orderId: e.orderId,
          description: e.description,
          hours: e.hours,
          images: e.images,
        }))
      }
    };
  } catch (error: any) {
    try {
      await t.rollback();
    } catch (rollbackError) {
      // transaction already finished
    }
    console.error("updateTimesheetAction DB ERROR:", error);
    if (error.name === "SequelizeValidationError") {
      const details = error.errors.map((e: any) => `${e.path}: ${e.message}`).join("; ");
      return { success: false, error: `Validation error: ${details}` };
    }
    return { success: false, error: error.message };
  }
}

export async function resetDatabaseAction() {
  try {
    const session = await getSession();
    if (!session.isAuthenticated || session.authRole !== "Admin") {
      return { success: false, error: "Unauthorized access." };
    }
    
    await resetDb();
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("resetDatabaseAction DB ERROR:", error);
    return { success: false, error: error.message || "Failed to reset database." };
  }
}
