import { z } from "zod";

// Date validation regex (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
// Time validation regex (H:MM AM/PM or HH:MM AM/PM, case-insensitive)
const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i;

export const EmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name must be under 255 characters").trim(),
  code: z.string().min(1, "Employee code is required").max(50, "Code must be under 50 characters").trim(),
  department: z.string().min(1, "Department is required").max(255, "Department must be under 255 characters").trim(),
  designation: z.string().min(1, "Designation is required").max(255, "Designation must be under 255 characters").trim(),
  password: z.string().min(4, "Password must be at least 4 characters").max(100, "Password must be under 100 characters").trim().optional().or(z.literal("")),
});

export const OrderSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required").max(50, "Order number must be under 50 characters").trim(),
  productName: z.string().min(1, "Product name is required").max(255, "Product name must be under 255 characters").trim(),
});

export const AssignmentSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required").trim(),
  orderId: z.string().min(1, "Order ID is required").trim(),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
});

export const ClockInSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required").trim(),
  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  timeStr: z.string().regex(timeRegex, "Time must be in HH:MM AM/PM format"),
});

export const ClockOutSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required").trim(),
  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  timeStr: z.string().regex(timeRegex, "Time must be in HH:MM AM/PM format"),
});

export const ManualAttendanceSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required").trim(),
  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  checkIn: z.string().regex(timeRegex, "Check-in time must be in HH:MM AM/PM format").or(z.literal("")).optional().nullable(),
  checkOut: z.string().regex(timeRegex, "Check-out time must be in HH:MM AM/PM format").or(z.literal("")).optional().nullable(),
});

export const TimesheetEntrySchema = z.object({
  id: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required").max(2000, "Description cannot exceed 2000 characters").trim(),
  hours: z.number().nonnegative("Hours must be non-negative").optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
});

export const SubmitTimesheetSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required").trim(),
  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  entries: z.array(TimesheetEntrySchema).min(1, "At least one timesheet entry is required"),
  submittedAt: z.string().min(1, "Submission time is required").trim(),
});

export const UpdateTimesheetSchema = z.object({
  timesheetId: z.string().min(1, "Timesheet ID is required").trim(),
  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  entries: z.array(TimesheetEntrySchema).min(1, "At least one timesheet entry is required"),
  submittedAt: z.string().min(1, "Submission time is required").trim(),
});

/**
 * Formats a ZodError into a human-readable list of validation failures.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((err) => {
      const field = err.path.join(".");
      return field ? `${field}: ${err.message}` : err.message;
    })
    .join("; ");
}
