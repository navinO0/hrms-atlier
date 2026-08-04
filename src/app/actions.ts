"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Op } from "sequelize";
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
    if (emp && password === emp.password) {
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
      return { success: false, error: "Invalid username or password." };
    }
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("hrms_session");
  revalidatePath("/");
  return { success: true };
}

export async function addEmployeeAction(name: string, code: string, department: string, designation: string, password?: string, profilePhoto?: string) {
  let validatedPassword = "password";
  let validatedProfilePhoto = null;
  try {
    const validated = EmployeeSchema.parse({ name, code, department, designation, password, profilePhoto });
    name = validated.name;
    code = validated.code;
    department = validated.department;
    designation = validated.designation;
    if (validated.password) {
      validatedPassword = validated.password;
    }
    if (validated.profilePhoto) {
      validatedProfilePhoto = validated.profilePhoto;
    }
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
    password: validatedPassword,
    profilePhoto: validatedProfilePhoto,
  });

  revalidatePath("/");
  return { success: true };
}

export async function editEmployeeAction(
  id: string,
  name: string,
  code: string,
  department: string,
  designation: string,
  password?: string,
  profilePhoto?: string
) {
  let validatedProfilePhoto = null;
  try {
    const validated = EmployeeSchema.parse({ name, code, department, designation, password, profilePhoto });
    name = validated.name;
    code = validated.code;
    department = validated.department;
    designation = validated.designation;
    validatedProfilePhoto = validated.profilePhoto || null;
  } catch (err: any) {
    return { success: false, error: formatZodError(err) };
  }

  const existing = await Employee.findOne({
    where: {
      code: code.toUpperCase(),
      id: { [Op.ne]: id }
    }
  });
  if (existing) {
    return { success: false, error: "An employee with this code already exists." };
  }

  const emp = await Employee.findByPk(id);
  if (!emp) {
    return { success: false, error: "Employee not found." };
  }

  const updateFields: any = {
    name,
    code: code.toUpperCase(),
    department,
    designation,
    profilePhoto: validatedProfilePhoto,
  };
  if (password && password.trim() !== "") {
    updateFields.password = password.trim();
  }

  await emp.update(updateFields);

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

export async function calculateTotalHoursForDay(employeeId: string, date: string): Promise<number> {
  const logs = await AttendanceLog.findAll({
    where: { employeeId, date },
    order: [["createdAt", "ASC"]],
  });
  const total = logs.reduce((sum, log) => {
    return sum + calculateHoursFromAttendance(
      log.get("checkIn") as string | undefined,
      log.get("checkOut") as string | undefined
    );
  }, 0);
  return parseFloat(total.toFixed(2));
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


  // Block double clock-in — employee must clock out before clocking in again
  const openLog = await AttendanceLog.findOne({
    where: { employeeId, date, status: "Clocked In" }
  });
  if (openLog) {
    return { success: false, error: "You are already clocked in. Please clock out before clocking in again." };
  }

  // Create a new punch record (multiple allowed per day)
  const log = await AttendanceLog.create({
    id: `att-${Date.now()}`,
    employeeId,
    date,
    checkIn: timeStr,
    status: "Clocked In",
  });

  // Return ALL today's logs so client can rebuild the full punch list
  const todayLogs = await AttendanceLog.findAll({
    where: { employeeId, date },
    order: [["createdAt", "ASC"]],
  });

  revalidatePath("/");
  return { success: true, attendanceLog: log.toJSON(), todayLogs: todayLogs.map(l => l.toJSON()) };
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

  // Find the currently open punch record (latest "Clocked In")
  const log = await AttendanceLog.findOne({
    where: { employeeId, date, status: "Clocked In" },
    order: [["createdAt", "DESC"]],
  });

  if (!log) {
    return { success: false, error: "No active clock-in found. Please clock in first." };
  }

  await log.update({ checkOut: timeStr, status: "Clocked Out" });

  // Recalculate TOTAL effective hours from all today's completed pairs
  const allTodayLogs = await AttendanceLog.findAll({
    where: { employeeId, date },
    order: [["createdAt", "ASC"]],
  });
  const totalEffectiveHours = parseFloat(
    allTodayLogs.reduce((sum, l) => {
      return sum + calculateHoursFromAttendance(
        l.get("checkIn") as string | undefined,
        l.get("checkOut") as string | undefined
      );
    }, 0).toFixed(2)
  );

  // Sync timesheet hours with total effective time
  let updatedTs: any = null;
  const ts = await Timesheet.findOne({
    where: { employeeId, date },
    include: [{ model: TimesheetEntry, as: "entries" }]
  });
  if (ts) {
    await TimesheetEntry.update(
      { hours: totalEffectiveHours },
      { where: { timesheetId: ts.get("id") as string } }
    );
    await ts.reload();
    updatedTs = ts.toJSON();
  }

  revalidatePath("/");
  return {
    success: true,
    attendanceLog: log.toJSON(),
    todayLogs: allTodayLogs.map(l => l.toJSON()),
    timesheet: updatedTs,
  };
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
    const computedHours = await calculateTotalHoursForDay(employeeId, date);

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
    const computedHours = await calculateTotalHoursForDay(employeeId, date);

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

export async function deleteEmployeeAction(id: string) {
  try {
    const session = await getSession();
    if (!session || !session.isAuthenticated || session.authRole !== "Admin") {
      return { success: false, error: "Unauthorized access." };
    }
    const emp = await Employee.findByPk(id);
    if (!emp) {
      return { success: false, error: "Employee not found." };
    }

    // Clean up associations first to prevent foreign key errors
    await AttendanceLog.destroy({ where: { employeeId: id } });
    await Timesheet.destroy({ where: { employeeId: id } });
    await Assignment.destroy({ where: { employeeId: id } });
    
    // Delete the employee record itself
    await emp.destroy();

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("deleteEmployeeAction DB ERROR:", error);
    return { success: false, error: error.message || "Failed to delete employee." };
  }
}
