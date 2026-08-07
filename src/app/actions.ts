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
  PayrollRecord,
  EmploymentType,
  Department,
  PayStructure,
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
  EmploymentTypeSchema,
  DepartmentSchema,
  PayStructureSchema,
  AdminEditPunchSchema,
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

export async function addEmployeeAction(
  name: string, 
  code: string, 
  department: string, 
  designation: string, 
  password?: string, 
  profilePhoto?: string,
  payType?: string,
  payRate?: number,
  checkInTime?: string,
  checkOutTime?: string,
  employmentType?: string,
  breakTime?: number
) {
  try {
    await initDb();
    let validatedPassword = "password";
    let validatedProfilePhoto = null;
    let validatedPayType = payType || "Monthly";
    let validatedPayRate = payRate !== undefined ? Number(payRate) : 0;
    let validatedCheckInTime = "09:00";
    let validatedCheckOutTime = "18:00";
    let validatedEmploymentType = "Full-Time";
    let validatedBreakTime = 60;

    try {
      const validated = EmployeeSchema.parse({ 
        name, 
        code, 
        department, 
        designation, 
        password, 
        profilePhoto, 
        payType, 
        payRate,
        checkInTime,
        checkOutTime,
        employmentType,
        breakTime
      });
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
      validatedPayType = validated.payType as any;
      validatedPayRate = validated.payRate;
      validatedCheckInTime = validated.checkInTime || "09:00";
      validatedCheckOutTime = validated.checkOutTime || "18:00";
      validatedEmploymentType = validated.employmentType || "Full-Time";
      validatedBreakTime = validated.breakTime || 60;
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
      payType: validatedPayType,
      payRate: validatedPayRate,
      checkInTime: validatedCheckInTime,
      checkOutTime: validatedCheckOutTime,
      employmentType: validatedEmploymentType,
      breakTime: validatedBreakTime,
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("addEmployeeAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to add employee." };
  }
}

export async function editEmployeeAction(
  id: string,
  name: string,
  code: string,
  department: string,
  designation: string,
  password?: string,
  profilePhoto?: string,
  payType?: string,
  payRate?: number,
  checkInTime?: string,
  checkOutTime?: string,
  employmentType?: string,
  breakTime?: number
) {
  try {
    await initDb();
    let validatedProfilePhoto = null;
    let validatedPayType = payType || "Monthly";
    let validatedPayRate = payRate !== undefined ? Number(payRate) : 0;
    let validatedCheckInTime = "09:00";
    let validatedCheckOutTime = "18:00";
    let validatedEmploymentType = "Full-Time";
    let validatedBreakTime = 60;

    try {
      const validated = EmployeeSchema.parse({ 
        name, 
        code, 
        department, 
        designation, 
        password, 
        profilePhoto, 
        payType, 
        payRate,
        checkInTime,
        checkOutTime,
        employmentType,
        breakTime
      });
      name = validated.name;
      code = validated.code;
      department = validated.department;
      designation = validated.designation;
      validatedProfilePhoto = validated.profilePhoto || null;
      validatedPayType = validated.payType as any;
      validatedPayRate = validated.payRate;
      validatedCheckInTime = validated.checkInTime || "09:00";
      validatedCheckOutTime = validated.checkOutTime || "18:00";
      validatedEmploymentType = validated.employmentType || "Full-Time";
      validatedBreakTime = validated.breakTime || 60;
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
      payType: validatedPayType,
      payRate: validatedPayRate,
      checkInTime: validatedCheckInTime,
      checkOutTime: validatedCheckOutTime,
      employmentType: validatedEmploymentType,
      breakTime: validatedBreakTime,
    };
    if (password && password.trim() !== "") {
      updateFields.password = password.trim();
    }

    await emp.update(updateFields);

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("editEmployeeAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to update employee." };
  }
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
    await initDb();

    try {
      const validated = ClockInSchema.parse({ employeeId, date, timeStr });
      employeeId = validated.employeeId;
      date = validated.date;
      timeStr = validated.timeStr;
    } catch (err: any) {
      return { success: false, error: formatZodError(err) };
    }

    if (!employeeId) {
      return { success: false, error: "No employee specified for check in. Please select an employee." };
    }

    const empExists = await Employee.findByPk(employeeId);
    if (!empExists) {
      return { success: false, error: `Employee record (ID: ${employeeId}) was not found in the database. Please select a registered staff member.` };
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
  } catch (err: any) {
    console.error("clockInAction error:", err);
    return { success: false, error: err?.message || (typeof err === "string" ? err : "Failed to clock in due to a database/server error.") };
  }
}

export async function clockOutAction(employeeId: string, date: string, timeStr: string, pieceCount?: number | null, unitPrice?: number | null) {
  try {
    await initDb();

    try {
      const validated = ClockOutSchema.parse({ employeeId, date, timeStr });
      employeeId = validated.employeeId;
      date = validated.date;
      timeStr = validated.timeStr;
    } catch (err: any) {
      return { success: false, error: formatZodError(err) };
    }

    if (!employeeId) {
      return { success: false, error: "No employee specified for check out." };
    }

    const empExists = await Employee.findByPk(employeeId);
    if (!empExists) {
      return { success: false, error: `Employee record (ID: ${employeeId}) was not found in the database.` };
    }

    // Find the currently open punch record (latest "Clocked In")
    const log = await AttendanceLog.findOne({
      where: { employeeId, date, status: "Clocked In" },
      order: [["createdAt", "DESC"]],
    });

    if (!log) {
      return { success: false, error: "No active clock-in session found for today. Please clock in first." };
    }

    const updateData: any = { checkOut: timeStr, status: "Clocked Out" };
    if (pieceCount !== undefined && pieceCount !== null && !isNaN(Number(pieceCount))) {
      updateData.pieceCount = Number(pieceCount);
    }
    if (unitPrice !== undefined && unitPrice !== null && !isNaN(Number(unitPrice))) {
      updateData.unitPrice = Number(unitPrice);
    }
    await log.update(updateData);

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
  } catch (err: any) {
    console.error("clockOutAction error:", err);
    return { success: false, error: err?.message || (typeof err === "string" ? err : "Failed to clock out due to a database/server error.") };
  }
}

export async function saveManualAttendanceAction(
  employeeId: string, 
  date: string, 
  checkIn: string, 
  checkOut: string,
  pieceCount?: number | null,
  unitPrice?: number | null
) {
  try {
    await initDb();

    try {
      const validated = ManualAttendanceSchema.parse({ employeeId, date, checkIn, checkOut, pieceCount, unitPrice });
      employeeId = validated.employeeId;
      date = validated.date;
      checkIn = validated.checkIn || "";
      checkOut = validated.checkOut || "";
    } catch (err: any) {
      return { success: false, error: formatZodError(err) };
    }

    const empExists = await Employee.findByPk(employeeId);
    if (!empExists) {
      return { success: false, error: "Employee record not found in database." };
    }

    const pCount = (pieceCount !== undefined && pieceCount !== null && !isNaN(Number(pieceCount))) ? Number(pieceCount) : null;
    const uPrice = (unitPrice !== undefined && unitPrice !== null && !isNaN(Number(unitPrice))) ? Number(unitPrice) : null;

    // Find the first (earliest) punch log for the employee on this date
    const log = await AttendanceLog.findOne({
      where: { employeeId, date },
      order: [["createdAt", "ASC"]],
    });

    if (!log) {
      // No existing log — create a new one with just checkIn; status = "Clocked In"
      // Only set checkOut if admin explicitly provided one
      await AttendanceLog.create({
        id: `att-${Date.now()}`,
        employeeId,
        date,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        status: checkOut ? "Clocked Out" : "Clocked In",
        pieceCount: pCount,
        unitPrice: uPrice,
      });
    } else {
      // Existing log — only update checkIn and pieceCount/unitPrice.
      // For checkOut: update only if admin provided a value; if empty string, set to null (not "").
      // NEVER change the status — preserve whatever it currently is.
      const updatePayload: Record<string, unknown> = {
        checkIn: checkIn || log.checkIn || null,
        pieceCount: pCount !== null ? pCount : log.pieceCount,
        unitPrice: uPrice !== null ? uPrice : log.unitPrice,
      };
      if (checkOut) {
        // Admin provided a checkout time — update it
        updatePayload.checkOut = checkOut;
      }
      // If checkOut is empty, leave log.checkOut unchanged (do not overwrite)
      await log.update(updatePayload);
    }

    // Sync timesheet hours with manual attendance (only when both times are available)
    if (checkIn && checkOut) {
      const ts = await Timesheet.findOne({ where: { employeeId, date } });
      if (ts) {
        const finalHours = calculateHoursFromAttendance(checkIn, checkOut);
        await TimesheetEntry.update(
          { hours: finalHours },
          { where: { timesheetId: ts.id } }
        );
      }
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("saveManualAttendanceAction error:", err);
    return { success: false, error: err?.message || (typeof err === "string" ? err : "Failed to update attendance due to a database/server error.") };
  }
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

export async function processPayrollPaymentAction(
  employeeId: string,
  amount: number,
  netHours: number,
  grossHours: number,
  lunchDeductionHours: number,
  periodStart: string,
  periodEnd: string,
  notes?: string
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session || !session.isAuthenticated || session.authRole !== "Admin") {
      return { success: false, error: "Unauthorized. Admin privileges required to process payroll." };
    }

    const emp = await Employee.findByPk(employeeId);
    if (!emp) {
      return { success: false, error: "Employee record not found." };
    }

    const paidAt = new Date().toISOString();
    const recordId = `pay-${Date.now()}`;

    const record = await PayrollRecord.create({
      id: recordId,
      employeeId,
      amount: parseFloat(amount.toFixed(2)),
      netHours: parseFloat(netHours.toFixed(2)),
      grossHours: parseFloat(grossHours.toFixed(2)),
      lunchDeductionHours: parseFloat(lunchDeductionHours.toFixed(2)),
      payType: emp.payType || "Monthly",
      payRate: emp.payRate || 0,
      periodStart: periodStart || paidAt,
      periodEnd: periodEnd || paidAt,
      paidAt,
      notes: notes ? notes.trim() : null,
    });

    // Update employee's last paid timestamp so pending amount recalculates from 0.00
    await emp.update({ lastPaidAt: paidAt });

    revalidatePath("/");
    return {
      success: true,
      payrollRecord: record.toJSON(),
      updatedEmployee: emp.toJSON(),
    };
  } catch (err: any) {
    console.error("processPayrollPaymentAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to process payroll payment." };
  }
}

export async function getPayrollRecordsAction() {
  try {
    await initDb();
    const records = await PayrollRecord.findAll({
      order: [["createdAt", "DESC"]],
    });
    return { success: true, records: records.map(r => r.toJSON()) };
  } catch (err: any) {
    console.error("getPayrollRecordsAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to fetch payroll history." };
  }
}

export async function addEmploymentTypeAction(
  name: string,
  standardHours: number,
  minHoursForBreak: number
) {
  try {
    await initDb();
    
    const validated = EmploymentTypeSchema.parse({
      name,
      standardHours,
      minHoursForBreak
    });

    const normName = validated.name.trim();

    const existing = await EmploymentType.findOne({
      where: { name: normName }
    });
    if (existing) {
      return { success: false, error: "An employment type with this name already exists." };
    }

    const id = `et-${Date.now()}`;
    await EmploymentType.create({
      id,
      name: normName,
      standardHours: validated.standardHours,
      minHoursForBreak: validated.minHoursForBreak,
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("addEmploymentTypeAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to add employment type." };
  }
}

export async function deleteEmploymentTypeAction(id: string) {
  try {
    await initDb();

    const et = await EmploymentType.findByPk(id);
    if (!et) {
      return { success: false, error: "Employment type not found." };
    }

    const inUse = await Employee.findOne({
      where: { employmentType: et.name }
    });
    if (inUse) {
      return { success: false, error: `Cannot delete employment type "${et.name}" because it is currently assigned to some employees.` };
    }

    await et.destroy();
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("deleteEmploymentTypeAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to delete employment type." };
  }
}

export async function editEmploymentTypeAction(
  id: string,
  name: string,
  standardHours: number,
  minHoursForBreak: number
) {
  try {
    await initDb();
    const validated = EmploymentTypeSchema.parse({ name, standardHours, minHoursForBreak });
    const et = await EmploymentType.findByPk(id);
    if (!et) {
      return { success: false, error: "Employment type not found." };
    }

    const oldName = et.name;
    const normName = validated.name.trim();

    if (normName !== oldName) {
      const existing = await EmploymentType.findOne({ where: { name: normName } });
      if (existing) {
        return { success: false, error: "Another employment type with this name already exists." };
      }
    }

    await et.update({
      name: normName,
      standardHours: validated.standardHours,
      minHoursForBreak: validated.minHoursForBreak,
    });

    if (normName !== oldName) {
      await Employee.update(
        { employmentType: normName },
        { where: { employmentType: oldName } }
      );
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("editEmploymentTypeAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to update employment type." };
  }
}

export async function addDepartmentAction(name: string) {
  try {
    await initDb();
    const validated = DepartmentSchema.parse({ name });
    const normName = validated.name.trim();

    const existing = await Department.findOne({
      where: { name: normName }
    });
    if (existing) {
      return { success: false, error: "A department with this name already exists." };
    }

    const id = `dept-${Date.now()}`;
    await Department.create({
      id,
      name: normName
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("addDepartmentAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to add department." };
  }
}

export async function deleteDepartmentAction(id: string) {
  try {
    await initDb();
    const dept = await Department.findByPk(id);
    if (!dept) {
      return { success: false, error: "Department not found." };
    }

    const inUse = await Employee.findOne({
      where: { department: dept.name }
    });
    if (inUse) {
      return { success: false, error: `Cannot delete department "${dept.name}" because it is currently assigned to some employees.` };
    }

    await dept.destroy();
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("deleteDepartmentAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to delete department." };
  }
}

export async function editDepartmentAction(id: string, name: string) {
  try {
    await initDb();
    const validated = DepartmentSchema.parse({ name });
    const dept = await Department.findByPk(id);
    if (!dept) {
      return { success: false, error: "Department not found." };
    }

    const oldName = dept.name;
    const normName = validated.name.trim();

    if (normName !== oldName) {
      const existing = await Department.findOne({ where: { name: normName } });
      if (existing) {
        return { success: false, error: "Another department with this name already exists." };
      }
    }

    await dept.update({ name: normName });

    if (normName !== oldName) {
      await Employee.update(
        { department: normName },
        { where: { department: oldName } }
      );
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("editDepartmentAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to update department." };
  }
}

export async function addPayStructureAction(name: string, daysPerPeriod: number) {
  try {
    await initDb();
    const validated = PayStructureSchema.parse({ name, daysPerPeriod });
    const normName = validated.name.trim();

    const existing = await PayStructure.findOne({
      where: { name: normName }
    });
    if (existing) {
      return { success: false, error: "A pay structure with this name already exists." };
    }

    const id = `ps-${Date.now()}`;
    await PayStructure.create({
      id,
      name: normName,
      daysPerPeriod: validated.daysPerPeriod
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("addPayStructureAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to add pay structure." };
  }
}

export async function deletePayStructureAction(id: string) {
  try {
    await initDb();
    const ps = await PayStructure.findByPk(id);
    if (!ps) {
      return { success: false, error: "Pay structure not found." };
    }

    const inUse = await Employee.findOne({
      where: { payType: ps.name }
    });
    if (inUse) {
      return { success: false, error: `Cannot delete pay structure "${ps.name}" because it is currently assigned to some employees.` };
    }

    await ps.destroy();
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("deletePayStructureAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to delete pay structure." };
  }
}

export async function editPayStructureAction(id: string, name: string, daysPerPeriod: number) {
  try {
    await initDb();
    const validated = PayStructureSchema.parse({ name, daysPerPeriod });
    const ps = await PayStructure.findByPk(id);
    if (!ps) {
      return { success: false, error: "Pay structure not found." };
    }

    const oldName = ps.name;
    const normName = validated.name.trim();

    if (normName !== oldName) {
      const existing = await PayStructure.findOne({ where: { name: normName } });
      if (existing) {
        return { success: false, error: "Another pay structure with this name already exists." };
      }
    }

    await ps.update({
      name: normName,
      daysPerPeriod: validated.daysPerPeriod
    });

    if (normName !== oldName) {
      await Employee.update(
        { payType: normName },
        { where: { payType: oldName } }
      );
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("editPayStructureAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to update pay structure." };
  }
}

/**
 * Admin-only: Edit a specific attendance log's punch times and/or piece count.
 * After editing, re-syncs the related timesheet hours for that day.
 */
export async function adminEditPunchAction(
  logId: string,
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  pieceCount?: number | null,
  unitPrice?: number | null
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session || !session.isAuthenticated || session.authRole !== "Admin") {
      return { success: false, error: "Unauthorized. Admin privileges required." };
    }

    try {
      AdminEditPunchSchema.parse({ logId, checkIn, checkOut, pieceCount, unitPrice });
    } catch (err: any) {
      return { success: false, error: formatZodError(err) };
    }

    const log = await AttendanceLog.findByPk(logId);
    if (!log) {
      return { success: false, error: "Attendance log not found." };
    }

    const employeeId = log.get("employeeId") as string;
    const date = log.get("date") as string;

    const updateFields: any = {};
    if (checkIn !== undefined) updateFields.checkIn = checkIn || null;
    if (checkOut !== undefined) updateFields.checkOut = checkOut || null;
    if (pieceCount !== undefined) {
      updateFields.pieceCount = (pieceCount !== null && !isNaN(Number(pieceCount))) ? Number(pieceCount) : null;
    }
    if (unitPrice !== undefined) {
      updateFields.unitPrice = (unitPrice !== null && !isNaN(Number(unitPrice))) ? Number(unitPrice) : null;
    }

    const newCheckOut = checkOut !== undefined ? checkOut : (log.get("checkOut") as string | undefined);
    const newCheckIn  = checkIn  !== undefined ? checkIn  : (log.get("checkIn")  as string | undefined);
    if (newCheckOut) updateFields.status = "Clocked Out";
    else if (newCheckIn) updateFields.status = "Clocked In";

    await log.update(updateFields);

    const allDayLogs = await AttendanceLog.findAll({
      where: { employeeId, date },
      order: [["createdAt", "ASC"]],
    });

    const totalEffectiveHours = parseFloat(
      allDayLogs.reduce((sum, l) => {
        return sum + calculateHoursFromAttendance(
          l.get("checkIn") as string | undefined,
          l.get("checkOut") as string | undefined
        );
      }, 0).toFixed(2)
    );

    const ts = await Timesheet.findOne({
      where: { employeeId, date },
      include: [{ model: TimesheetEntry, as: "entries" }]
    });
    if (ts) {
      await TimesheetEntry.update(
        { hours: totalEffectiveHours },
        { where: { timesheetId: ts.get("id") as string } }
      );
    }

    revalidatePath("/");
    return { success: true, updatedLog: log.toJSON(), allDayLogs: allDayLogs.map(l => l.toJSON()) };
  } catch (err: any) {
    console.error("adminEditPunchAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to update attendance log." };
  }
}

/**
 * Fetch all attendance logs for client-side refresh after admin edits.
 */
export async function getAttendanceLogsAction() {
  try {
    await initDb();
    const logs = await AttendanceLog.findAll({ order: [["createdAt", "DESC"]] });
    return { success: true, logs: logs.map(l => l.toJSON()) };
  } catch (err: any) {
    console.error("getAttendanceLogsAction ERROR:", err);
    return { success: false, error: err?.message || "Failed to fetch attendance logs." };
  }
}
