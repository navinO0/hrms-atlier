"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  User, 
  Users, 
  Clock, 
  CheckCircle, 
  ClipboardList,
  UserCheck,
  Timer,
  Lock,
  LogOut,
  Pencil,
  Eye,
  EyeOff,
  RotateCcw,
  AlarmClock,
  FileText,
  History,
  ChevronDown,
  ChevronUp,
  Camera,
  Fingerprint,
  TrendingUp,
  X,
  Trash2,
  Banknote,
  Settings
} from "lucide-react";

// ── Toast System ──────────────────────────────────────────────
type ToastType = "success" | "error" | "info";
import { toast, Toaster } from "sonner";
// ─────────────────────────────────────────────────────────────
import { 
  loginAction, 
  logoutAction, 
  addEmployeeAction,
  editEmployeeAction,
  clockInAction, 
  clockOutAction, 
  saveManualAttendanceAction, 
  submitTimesheetAction,
  updateTimesheetAction,
  resetDatabaseAction,
  deleteEmployeeAction,
  processPayrollPaymentAction,
  addDepartmentAction,
  deleteDepartmentAction,
  addPayStructureAction,
  deletePayStructureAction,
  addEmploymentTypeAction,
  deleteEmploymentTypeAction,
  editEmploymentTypeAction,
  editDepartmentAction,
  editPayStructureAction
} from "@/app/actions";

interface Employee {
  id: string;
  name: string;
  code: string;
  department: string;
  designation: string;
  profilePhoto?: string | null;
  payType?: string;
  payRate?: number;
  lastPaidAt?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  employmentType?: string;
  breakTime?: number;
}



interface AttendanceLog {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: "Clocked In" | "Clocked Out";
  employee?: Employee;
}

interface TimesheetEntry {
  id: string;
  timesheetId: string;
  orderId?: string;
  description: string;
  hours: number;
  images?: string[];
}

interface Timesheet {
  id: string;
  employeeId: string;
  date: string;
  entries: TimesheetEntry[];
  submittedAt: string;
  employee?: Employee;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  amount: number;
  netHours: number;
  grossHours: number;
  lunchDeductionHours: number;
  payType: string;
  payRate: number;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
  notes?: string | null;
  employee?: Employee;
}

interface EmploymentType {
  id: string;
  name: string;
  standardHours: number;
  minHoursForBreak: number;
}

interface Department {
  id: string;
  name: string;
}

interface PayStructure {
  id: string;
  name: string;
  daysPerPeriod: number;
}

interface HRMSPortalProps {
  initialEmployees: Employee[];
  initialAttendance: AttendanceLog[];
  initialTimesheets: Timesheet[];
  initialPayrollRecords?: PayrollRecord[];
  initialEmploymentTypes?: EmploymentType[];
  initialDepartments?: Department[];
  initialPayStructures?: PayStructure[];
  initialSession: {
    isAuthenticated: boolean;
    authRole: "Admin" | "Employee" | null;
    authEmployeeId: string | null;
  } | null;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85); // Compress to 85% Jpeg quality
          resolve(dataUrl);
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const uploadToCloud = async (base64Data: string): Promise<string> => {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dzapdxkgc";
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "demo_store";

  const formData = new FormData();
  formData.append("file", base64Data);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Failed to upload image to cloud");
  }

  const data = await res.json();
  return data.secure_url;
};

// ── Avatar Helpers for Premium Operator Visuals ──
const getInitials = (name: string) => {
  if (!name) return "OP";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatTime12h = (date: Date): string => {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
};

const getAvatarBg = (name: string) => {
  if (!name) return "from-zinc-500 to-zinc-650";
  const colors = [
    "from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700",
    "from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700",
    "from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700",
    "from-purple-500 to-pink-600 dark:from-purple-600 dark:to-pink-700",
    "from-rose-500 to-red-600 dark:from-rose-600 dark:to-red-700",
    "from-indigo-500 to-violet-600 dark:from-indigo-600 dark:to-violet-700",
    "from-cyan-500 to-blue-600 dark:from-cyan-600 dark:to-blue-700",
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

export default function HRMSPortal({
  initialEmployees,
  initialAttendance,
  initialTimesheets,
  initialPayrollRecords,
  initialEmploymentTypes,
  initialDepartments,
  initialPayStructures,
  initialSession,
}: HRMSPortalProps) {
  // ── Sonner Toast System ──────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    if (type === "success") {
      toast.success(message);
    } else if (type === "error") {
      toast.error(message);
    } else {
      toast(message);
    }
  }, []);
  // ─────────────────────────────────────────────────────────────

  // Navigation & Role State (synchronized with session)
  const [session, setSession] = useState(initialSession);
  const [currentRole, setCurrentRole] = useState<"Admin" | "Employee">(
    initialSession?.authRole || "Admin"
  );
  const [activeEmpId, setActiveEmpId] = useState<string>(
    initialSession?.authEmployeeId || initialEmployees[0]?.id || ""
  );
  const [adminTab, setAdminTab] = useState<"status" | "logs" | "roster" | "payroll" | "settings">("status");
  const [activePreviewImages, setActivePreviewImages] = useState<string[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  const handleOpenPreview = (images: string[], index: number) => {
    setActivePreviewImages(images);
    setActivePreviewIndex(index);
  };
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isClocking, setIsClocking] = useState<boolean>(false);
  const [isSubmittingTimesheet, setIsSubmittingTimesheet] = useState<boolean>(false);

  // Live clock for the attendance card
  const [liveTime, setLiveTime] = useState<string>("");
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    tick();
    clockRef.current = setInterval(tick, 1000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  // Employee portal: which section is open (attendance / log / history)
  const [empSection, setEmpSection] = useState<"attendance" | "log" | "history">("attendance");

  // Login form state
  const [loginUsername, setLoginUsername] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showFormPassword, setShowFormPassword] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isSavingEmployee, setIsSavingEmployee] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Edit / Expand Timesheets State
  const [editingTimesheetId, setEditingTimesheetId] = useState<string | null>(null);
  const [editingAdminTimesheetId, setEditingAdminTimesheetId] = useState<string | null>(null);
  const [expandedTimesheets, setExpandedTimesheets] = useState<Record<string, boolean>>({});

  // DB Props mapped directly (revalidation triggers updates through server component)
  const employees = initialEmployees;
  const [attendance, setAttendance] = useState<any[]>(initialAttendance);
  const [timesheets, setTimesheets] = useState<Timesheet[]>(initialTimesheets);

  useEffect(() => {
    setAttendance(initialAttendance);
  }, [initialAttendance]);

  useEffect(() => {
    setTimesheets(initialTimesheets);
  }, [initialTimesheets]);

  // Form State: Add/Edit Employee
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [empFormName, setEmpFormName] = useState("");
  const [empFormCode, setEmpFormCode] = useState("");
  const [empFormPassword, setEmpFormPassword] = useState("");
  const [empFormDept, setEmpFormDept] = useState("Stitching Section");
  const [empFormDesg, setEmpFormDesg] = useState("Stitching Operator");
  const [empFormPhoto, setEmpFormPhoto] = useState("");
  const [empFormPayType, setEmpFormPayType] = useState<string>("Monthly");
  const [empFormPayRate, setEmpFormPayRate] = useState<number | string>("");
  const [empFormCheckInTime, setEmpFormCheckInTime] = useState("09:00");
  const [empFormCheckOutTime, setEmpFormCheckOutTime] = useState("18:00");
  const [empFormEmploymentType, setEmpFormEmploymentType] = useState<string>("Full-Time");
  const [empFormBreakTime, setEmpFormBreakTime] = useState<number | string>(60);

  // Settings & Custom Employment Types State
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>(initialEmploymentTypes || []);
  const [newEtName, setNewEtName] = useState("");
  const [newEtHours, setNewEtHours] = useState<number | string>(8);
  const [newEtBreakThreshold, setNewEtBreakThreshold] = useState<number | string>(5);
  const [isSavingEt, setIsSavingEt] = useState(false);
  const [editingEtId, setEditingEtId] = useState<string | null>(null);

  useEffect(() => {
    setEmploymentTypes(initialEmploymentTypes || []);
  }, [initialEmploymentTypes]);

  // Settings & Custom Departments State
  const [departments, setDepartments] = useState<Department[]>(initialDepartments || []);
  const [newDeptName, setNewDeptName] = useState("");
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);

  useEffect(() => {
    setDepartments(initialDepartments || []);
  }, [initialDepartments]);

  // Settings & Custom Pay Structures State
  const [payStructures, setPayStructures] = useState<PayStructure[]>(initialPayStructures || []);
  const [newPsName, setNewPsName] = useState("");
  const [newPsDays, setNewPsDays] = useState<number | string>(26);
  const [isSavingPs, setIsSavingPs] = useState(false);
  const [editingPsId, setEditingPsId] = useState<string | null>(null);

  useEffect(() => {
    setPayStructures(initialPayStructures || []);
  }, [initialPayStructures]);

  // Form State: Timesheet Submission
  const [timesheetDate, setTimesheetDate] = useState<string>("");
  const [timesheetEntries, setTimesheetEntries] = useState<Array<{ orderId?: string; description: string; hours?: number; images: string[] }>>([
    { description: "", images: [] }
  ]);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string>("");

  // Admin employee details management states
  const [selectedAdminEmp, setSelectedAdminEmp] = useState<Employee | null>(null);
  const [adminTimesheetDate, setAdminTimesheetDate] = useState<string>("");
  const [adminTimesheetEntries, setAdminTimesheetEntries] = useState<Array<{ orderId?: string; description: string; hours?: number; images: string[] }>>([
    { description: "", images: [] }
  ]);
  const [manualCheckIn, setManualCheckIn] = useState<string>("");
  const [manualCheckOut, setManualCheckOut] = useState<string>("");

  // Ledger Filter States
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Payroll & Payout Modal State
  const [selectedPayEmp, setSelectedPayEmp] = useState<Employee | null>(null);
  const [payModalNotes, setPayModalNotes] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(initialPayrollRecords || []);

  useEffect(() => {
    setPayrollRecords(initialPayrollRecords || []);
  }, [initialPayrollRecords]);

  // Payroll Filter States
  const [payrollFilterEmployeeId, setPayrollFilterEmployeeId] = useState("");
  const [payrollFilterDate, setPayrollFilterDate] = useState("");

  // Last Login Persistence States
  const [lastLoginCode, setLastLoginCode] = useState<string | null>(null);
  const [lastLoginPass, setLastLoginPass] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLastLoginCode(localStorage.getItem("last_login_code"));
      setLastLoginPass(localStorage.getItem("last_login_pass"));
    }
  }, []);

  // Timezone-safe local date string helper YYYY-MM-DD
  const getLocalTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Initialize dates on mount
  useEffect(() => {
    const todayStr = getLocalTodayString();
    setTimeout(() => {
      setTimesheetDate(todayStr);
      setAdminTimesheetDate(todayStr);
    }, 0);
  }, []);

  // Auth Action handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const res = await loginAction(loginUsername, loginPassword);
      if (res.success && res.session) {
        if (typeof window !== "undefined") {
          localStorage.setItem("last_login_code", loginUsername);
          localStorage.setItem("last_login_pass", loginPassword);
        }
        setSession(res.session as { isAuthenticated: boolean; authRole: "Admin" | "Employee" | null; authEmployeeId: string | null });
        setCurrentRole(res.session.authRole as "Admin" | "Employee");
        if (res.session.authEmployeeId) {
          setActiveEmpId(res.session.authEmployeeId);
        }
        setLoginUsername("");
        setLoginPassword("");
        window.location.reload();
      } else {
        setLoginError(res.error || "An error occurred during login.");
      }
    } catch (err) {
      console.error(err);
      setLoginError("An unexpected error occurred.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleProceedLastLogin = async () => {
    if (!lastLoginCode || !lastLoginPass || isLoggingIn) return;
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await loginAction(lastLoginCode, lastLoginPass);
      if (res.success && res.session) {
        setSession(res.session as any);
        setCurrentRole(res.session.authRole as any);
        if (res.session.authEmployeeId) {
          setActiveEmpId(res.session.authEmployeeId);
        }
        window.location.reload();
      } else {
        setLoginError(res.error || "Last login session has expired or is invalid.");
      }
    } catch (err) {
      console.error(err);
      setLoginError("An unexpected error occurred.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleClearLastLogin = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("last_login_code");
      localStorage.removeItem("last_login_pass");
    }
    setLastLoginCode(null);
    setLastLoginPass(null);
    showToast("Login history cleared successfully.", "success");
  };

  const handleLogout = async () => {
    await logoutAction();
    setSession(null);
    setEditingTimesheetId(null);
    window.location.reload();
  };

  const handleResetDatabase = async () => {
    if (!window.confirm("Are you sure you want to reset the database? This will delete all custom records and restore the seed data.")) {
      return;
    }
    const res = await resetDatabaseAction();
    if (res.success) {
      showToast("Database reset successfully! Reloading...", "success");
      window.location.reload();
    } else {
      showToast(res.error || "Failed to reset database.", "error");
    }
  };

  // Submit Handlers
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empFormName.trim() || !empFormCode.trim() || isSavingEmployee) return;
    setIsSavingEmployee(true);

    try {
      if (editingEmployeeId) {
        const res = await editEmployeeAction(
          editingEmployeeId,
          empFormName,
          empFormCode,
          empFormDept,
          empFormDesg,
          empFormPassword,
          empFormPhoto,
          empFormPayType,
          Number(empFormPayRate) || 0,
          empFormCheckInTime,
          empFormCheckOutTime,
          empFormEmploymentType,
          Number(empFormBreakTime) || 60
        );
        if (res.success) {
          setEmpFormName("");
          setEmpFormCode("");
          setEmpFormPassword("");
          setEmpFormPhoto("");
          setEmpFormPayType("Monthly");
          setEmpFormPayRate("");
          setEmpFormCheckInTime("09:00");
          setEmpFormCheckOutTime("18:00");
          setEmpFormEmploymentType("Full-Time");
          setEmpFormBreakTime(60);
          setEditingEmployeeId(null);
          showToast(`Employee "${empFormName}" updated successfully!`, "success");
          window.location.reload();
        } else {
          showToast(res.error || "Failed to update employee.", "error");
        }
      } else {
        const res = await addEmployeeAction(
          empFormName,
          empFormCode,
          empFormDept,
          empFormDesg,
          empFormPassword,
          empFormPhoto,
          empFormPayType,
          Number(empFormPayRate) || 0,
          empFormCheckInTime,
          empFormCheckOutTime,
          empFormEmploymentType,
          Number(empFormBreakTime) || 60
        );
        if (res.success) {
          setEmpFormName("");
          setEmpFormCode("");
          setEmpFormPassword("");
          setEmpFormPhoto("");
          setEmpFormPayType("Monthly");
          setEmpFormPayRate("");
          setEmpFormCheckInTime("09:00");
          setEmpFormCheckOutTime("18:00");
          setEmpFormEmploymentType("Full-Time");
          setEmpFormBreakTime(60);
          showToast(`Employee "${empFormName}" registered successfully!`, "success");
          window.location.reload();
        } else {
          showToast(res.error || "Failed to register employee.", "error");
        }
      }
    } catch (err) {
      console.error(err);
      showToast("An unexpected error occurred while saving.", "error");
    } finally {
      setIsSavingEmployee(false);
    }
  };

  const handleDeleteEmployee = async (empId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete employee "${name}"? This will delete all of their attendance logs, timesheets, and assignments.`)) {
      return;
    }
    try {
      const res = await deleteEmployeeAction(empId);
      if (res.success) {
        showToast(`Employee "${name}" deleted successfully!`, "success");
        if (selectedAdminEmp?.id === empId) {
          setSelectedAdminEmp(null);
        }
        window.location.reload();
      } else {
        showToast(res.error || "Failed to delete employee.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("An unexpected error occurred while deleting.", "error");
    }
  };

  const handleCreateEmploymentType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEtName.trim() || isSavingEt) return;
    setIsSavingEt(true);
    try {
      const hours = Number(newEtHours) || 8.0;
      const breakThreshold = Number(newEtBreakThreshold) || 5.0;
      const res = editingEtId
        ? await editEmploymentTypeAction(editingEtId, newEtName, hours, breakThreshold)
        : await addEmploymentTypeAction(newEtName, hours, breakThreshold);
      if (res.success) {
        showToast(`Employment type "${newEtName}" ${editingEtId ? "updated" : "created"} successfully!`, "success");
        setNewEtName("");
        setNewEtHours(8);
        setNewEtBreakThreshold(5);
        setEditingEtId(null);
        window.location.reload();
      } else {
        showToast(res.error || `Failed to ${editingEtId ? "update" : "create"} employment type.`, "error");
      }
    } catch (err: any) {
      showToast(err.message || "An error occurred.", "error");
    } finally {
      setIsSavingEt(false);
    }
  };

  const handleDeleteEmploymentType = async (etId: string, etName: string) => {
    if (!window.confirm(`Are you sure you want to delete employment type "${etName}"?`)) return;
    try {
      const res = await deleteEmploymentTypeAction(etId);
      if (res.success) {
        showToast(`Employment type "${etName}" deleted successfully!`, "success");
        window.location.reload();
      } else {
        showToast(res.error || "Failed to delete employment type.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "An error occurred.", "error");
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || isSavingDept) return;
    setIsSavingDept(true);
    try {
      const res = editingDeptId
        ? await editDepartmentAction(editingDeptId, newDeptName)
        : await addDepartmentAction(newDeptName);
      if (res.success) {
        showToast(`Department "${newDeptName}" ${editingDeptId ? "updated" : "created"} successfully!`, "success");
        setNewDeptName("");
        setEditingDeptId(null);
        window.location.reload();
      } else {
        showToast(res.error || `Failed to ${editingDeptId ? "update" : "create"} department.`, "error");
      }
    } catch (err: any) {
      showToast(err.message || "An error occurred.", "error");
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleDeleteDepartment = async (deptId: string, deptName: string) => {
    if (!window.confirm(`Are you sure you want to delete department "${deptName}"?`)) return;
    try {
      const res = await deleteDepartmentAction(deptId);
      if (res.success) {
        showToast(`Department "${deptName}" deleted successfully!`, "success");
        window.location.reload();
      } else {
        showToast(res.error || "Failed to delete department.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "An error occurred.", "error");
    }
  };

  const handleCreatePayStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPsName.trim() || isSavingPs) return;
    setIsSavingPs(true);
    try {
      const days = Number(newPsDays) || 0;
      const res = editingPsId
        ? await editPayStructureAction(editingPsId, newPsName, days)
        : await addPayStructureAction(newPsName, days);
      if (res.success) {
        showToast(`Pay structure "${newPsName}" ${editingPsId ? "updated" : "created"} successfully!`, "success");
        setNewPsName("");
        setNewPsDays(26);
        setEditingPsId(null);
        window.location.reload();
      } else {
        showToast(res.error || `Failed to ${editingPsId ? "update" : "create"} pay structure.`, "error");
      }
    } catch (err: any) {
      showToast(err.message || "An error occurred.", "error");
    } finally {
      setIsSavingPs(false);
    }
  };

  const handleDeletePayStructure = async (psId: string, psName: string) => {
    if (!window.confirm(`Are you sure you want to delete pay structure "${psName}"?`)) return;
    try {
      const res = await deletePayStructureAction(psId);
      if (res.success) {
        showToast(`Pay structure "${psName}" deleted successfully!`, "success");
        window.location.reload();
      } else {
        showToast(res.error || "Failed to delete pay structure.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "An error occurred.", "error");
    }
  };



  // Employee: Clock-in / Clock-out (or Admin on behalf of employee)
  const handleClockIn = async (empId?: string) => {
    if (isClocking) return;
    setIsClocking(true);
    try {
      const targetEmpId = empId || activeEmpId;
      const todayStr = getLocalTodayString();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const res = await clockInAction(targetEmpId, todayStr, timeStr) as any;
      if (res.success && res.attendanceLog) {
        if (res.todayLogs) {
          // Server returned all today's punch records — sync the full list
          setAttendance(prev => {
            const otherDays = prev.filter(a => !(a.employeeId === targetEmpId && a.date === todayStr));
            return [...res.todayLogs!, ...otherDays];
          });
        } else {
          // Fallback: just append the new record
          setAttendance(prev => [res.attendanceLog, ...prev]);
        }
        showToast("Clocked in successfully!", "success");
      } else {
        showToast(res.error || "Failed to clock in.", "error");
      }
      if (empId) {
        setManualCheckIn(timeStr);
      }
    } catch (err) {
      console.error(err);
      showToast("An error occurred during check in.", "error");
    } finally {
      setIsClocking(false);
    }
  };

  const handleClockOut = async (empId?: string) => {
    if (isClocking) return;
    setIsClocking(true);
    try {
      const targetEmpId = empId || activeEmpId;
      const todayStr = getLocalTodayString();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const res = await clockOutAction(targetEmpId, todayStr, timeStr) as any;
      if (res.success && res.attendanceLog) {
        if (res.todayLogs) {
          // Server returned all today's punch records — sync the full list
          setAttendance(prev => {
            const otherDays = prev.filter(a => !(a.employeeId === targetEmpId && a.date === todayStr));
            return [...res.todayLogs!, ...otherDays];
          });
        } else {
          // Fallback: update the specific record by id
          setAttendance(prev => prev.map(a => a.id === res.attendanceLog.id ? res.attendanceLog : a));
        }
        if (res.timesheet) {
          setTimesheets(prev => prev.map(ts => ts.id === res.timesheet.id ? (res.timesheet as unknown as Timesheet) : ts));
        }
        showToast("Clocked out successfully!", "success");
      } else {
        showToast(res.error || "Failed to clock out.", "error");
      }
      if (empId) {
        setManualCheckOut(timeStr);
      }
    } catch (err) {
      console.error(err);
      showToast("An error occurred during check out.", "error");
    } finally {
      setIsClocking(false);
    }
  };


  // Admin select employee details
  const handleSelectAdminEmp = (emp: Employee) => {
    setSelectedAdminEmp(emp);
    setEditingAdminTimesheetId(null);
    const todayStr = getLocalTodayString();
    const log = attendance.find(a => a.employeeId === emp.id && a.date === todayStr);
    setManualCheckIn(log?.checkIn || "");
    setManualCheckOut(log?.checkOut || "");
    setAdminTimesheetDate(todayStr);
    setAdminTimesheetEntries([{ description: "", hours: 4, images: [] }]);
  };

  // Admin save manual attendance corrections
  const handleSaveManualAttendance = async (empId: string) => {
    const todayStr = getLocalTodayString();
    const res = await saveManualAttendanceAction(empId, todayStr, manualCheckIn, manualCheckOut);
    if (res.success) {
      showToast("Attendance updated successfully!", "success");
    } else {
      showToast(res.error || "Failed to update attendance.", "error");
    }
  };

  
  // Employee: Submit Timesheet
  const handleTimesheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate entries
    const invalid = timesheetEntries.some(t => !t.description.trim());
    if (invalid) {
      showToast("Please write a description of the work you did.", "error");
      return;
    }

    const timeStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (editingTimesheetId) {
      const res = await updateTimesheetAction(editingTimesheetId, timesheetDate, timesheetEntries, timeStr + " (Updated)");
      if (res.success && res.timesheet) {
        setTimesheets(prev => prev.map(ts => ts.id === editingTimesheetId ? (res.timesheet as unknown as Timesheet) : ts));
        setEditingTimesheetId(null);
        setTimesheetEntries([{ description: "", images: [] }]);
        setTimesheetDate(getLocalTodayString());
        setSubmitSuccessMsg("Work log updated successfully!");
        setTimeout(() => setSubmitSuccessMsg(""), 4000);
      } else {
        showToast((res.error || "Update failed."), "error");
      }
    } else {
      const res = await submitTimesheetAction(activeEmpId, timesheetDate, timesheetEntries, timeStr);
      if (res.success && res.timesheet) {
        setTimesheets(prev => [res.timesheet as unknown as Timesheet, ...prev]);
        setTimesheetEntries([{ description: "", images: [] }]);
        setSubmitSuccessMsg("Work log submitted successfully!");
        setTimeout(() => setSubmitSuccessMsg(""), 4000);
      } else {
        showToast((res.error || "Submit failed."), "error");
      }
    }
  };

  // Timesheet Edit Handlers
  const handleStartEditTimesheet = (ts: Timesheet) => {
    setEditingTimesheetId(ts.id);
    setTimesheetDate(ts.date);
    setTimesheetEntries(ts.entries.map(e => ({
      description: e.description,
      images: e.images || [],
    })));
    const formElement = document.getElementById("timesheet-form-section");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCancelEdit = () => {
    setEditingTimesheetId(null);
    setTimesheetEntries([{ description: "", images: [] }]);
    setTimesheetDate(getLocalTodayString());
  };

  const handleStartEditAdminTimesheet = (ts: Timesheet) => {
    setEditingAdminTimesheetId(ts.id);
    setAdminTimesheetDate(ts.date);
    setAdminTimesheetEntries(ts.entries.map(e => ({
      description: e.description,
      images: e.images || [],
    })));
  };

  // Admin: Submit / Update Timesheet on behalf of selected employee
  const handleAdminTimesheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminEmp || isSubmittingTimesheet) return;

    // Validate entries
    const invalid = adminTimesheetEntries.some(t => !t.description.trim());
    if (invalid) {
      showToast("Please write a description of the work.", "error");
      return;
    }

    setIsSubmittingTimesheet(true);
    const timeStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      if (editingAdminTimesheetId) {
        const res = await updateTimesheetAction(editingAdminTimesheetId, adminTimesheetDate, adminTimesheetEntries, timeStr + " (Updated)");
        if (res.success && res.timesheet) {
          setTimesheets(prev => prev.map(ts => ts.id === editingAdminTimesheetId ? (res.timesheet as unknown as Timesheet) : ts));
          showToast(`Work log updated for ${selectedAdminEmp.name}!`, "success");
        } else {
          showToast((res.error || "Update failed."), "error");
        }
      } else {
        const res = await submitTimesheetAction(selectedAdminEmp.id, adminTimesheetDate, adminTimesheetEntries, timeStr);
        if (res.success && res.timesheet) {
          setTimesheets(prev => [res.timesheet as unknown as Timesheet, ...prev]);
          setEditingAdminTimesheetId(res.timesheet.id);
          showToast(`Work log submitted for ${selectedAdminEmp.name}!`, "success");
        } else {
          showToast((res.error || "Submit failed."), "error");
        }
      }
    } catch (err: any) {
      showToast(err.message || "An error occurred.", "error");
    } finally {
      setIsSubmittingTimesheet(false);
    }
  };

  // Computed data
  const currentEmployee = employees.find(e => e.id === activeEmpId);

  // All today's attendance punch pairs for the active employee (sorted chronologically)
  const todayAttendanceLogs = (() => {
    const todayStr = getLocalTodayString();
    return attendance
      .filter(a => a.employeeId === activeEmpId && a.date === todayStr)
      .sort((a, b) => a.id.localeCompare(b.id));
  })();

  // The latest punch — determines button state
  const latestTodayLog = todayAttendanceLogs[todayAttendanceLogs.length - 1] || null;
  const isCurrentlyClocked = latestTodayLog?.status === "Clocked In";

  // Pure client-side time parser → seconds since midnight
  const parseTimeSec = (t?: string): number | null => {
    if (!t) return null;
    const m = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    if (m[3].toUpperCase() === "PM" && h < 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return h * 3600 + min * 60;
  };

  const calculateHoursFromAttendance = (checkIn?: string, checkOut?: string): number => {
    if (!checkIn || !checkOut) return 0;
    const inSec = parseTimeSec(checkIn);
    if (inSec === null) return 0;
    const outSec = parseTimeSec(checkOut);
    if (outSec === null) return 0;
    const diffSec = outSec - inSec;
    return Math.max(0, parseFloat((diffSec / 3600).toFixed(2)));
  };

  const calculateEmpPayDetails = useCallback((emp: Employee) => {
    const empLogs = attendance.filter(a => a.employeeId === emp.id);

    // A helper to parse checkIn/checkOut time with log date into a local Date object
    const parseDateTime = (dateStr: string, timeStr?: string): Date | null => {
      if (!timeStr) return null;
      const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (!match) return null;
      let [_, hours, minutes, ampm] = match;
      let h = parseInt(hours, 10);
      const m = parseInt(minutes, 10);
      if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
      if (ampm.toUpperCase() === "AM" && h === 12) h = 0;

      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const day = parseInt(parts[2], 10);

      return new Date(year, month, day, h, m, 0, 0);
    };

    // Calculate exact unpaid hours for a single log based on emp.lastPaidAt
    const getUnpaidHoursForLog = (l: typeof attendance[0]): number => {
      if (!l.checkIn) return 0;
      const inTime = parseDateTime(l.date, l.checkIn);
      if (!inTime) return 0;

      let outTime = parseDateTime(l.date, l.checkOut);
      if (!outTime) {
        // If currently clocked in, we use current time for calculations
        outTime = new Date();
      }

      if (!emp.lastPaidAt) {
        const diffMs = outTime.getTime() - inTime.getTime();
        return diffMs > 0 ? parseFloat((diffMs / 3600000).toFixed(2)) : 0;
      }

      const lastPaidTime = new Date(emp.lastPaidAt);

      if (outTime.getTime() <= lastPaidTime.getTime()) {
        return 0;
      }

      if (inTime.getTime() >= lastPaidTime.getTime()) {
        const diffMs = outTime.getTime() - inTime.getTime();
        return diffMs > 0 ? parseFloat((diffMs / 3600000).toFixed(2)) : 0;
      }

      // Partial unpaid: from lastPaidTime to outTime
      const diffMs = outTime.getTime() - lastPaidTime.getTime();
      return diffMs > 0 ? parseFloat((diffMs / 3600000).toFixed(2)) : 0;
    };

    // Unpaid logs: has unpaid hours
    const unpaidLogs = empLogs.filter(a => {
      return getUnpaidHoursForLog(a) > 0;
    });

    const logsByDate: Record<string, typeof attendance> = {};
    unpaidLogs.forEach(l => {
      if (!logsByDate[l.date]) logsByDate[l.date] = [];
      logsByDate[l.date].push(l);
    });

    const uniqueDates = Object.keys(logsByDate).sort();
    const workedDaysCount = uniqueDates.length;

    const etConfig = employmentTypes.find(et => et.name === emp.employmentType);
    const standardLimit = etConfig ? etConfig.standardHours : (emp.employmentType === "Part-Time" ? 4 : 8);
    const breakTriggerLimit = etConfig ? etConfig.minHoursForBreak : 5.0;

    let totalGrossHours = 0;
    let totalLunchDeductions = 0;
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;

    uniqueDates.forEach(d => {
      const dayLogs = logsByDate[d];
      let dayGross = 0;
      dayLogs.forEach(l => {
        dayGross += getUnpaidHoursForLog(l);
      });

      if (dayGross > 0) {
        // Exclude custom break time per worked day only if worked breakTriggerLimit hours or more
        const breakMins = emp.breakTime !== undefined ? Number(emp.breakTime) : 60;
        const breakHours = breakMins / 60;
        const lunchDeduction = dayGross >= breakTriggerLimit ? Math.min(dayGross, breakHours) : 0;
        
        const dayNet = Math.max(0, dayGross - lunchDeduction);
        
        const regularHours = Math.min(dayNet, standardLimit);
        const overtimeHours = Math.max(0, dayNet - standardLimit);

        totalGrossHours += dayGross;
        totalLunchDeductions += lunchDeduction;
        totalRegularHours += regularHours;
        totalOvertimeHours += overtimeHours;
      }
    });

    const totalNetHours = Math.max(0, parseFloat((totalGrossHours - totalLunchDeductions).toFixed(2)));

    const payType = emp.payType || "Monthly";
    const payRate = Number(emp.payRate) || 0;

    const psConfig = payStructures.find(ps => ps.name === payType);
    let effectiveHourlyRate = 0;
    if (psConfig) {
      if (psConfig.daysPerPeriod <= 0) {
        effectiveHourlyRate = payRate;
      } else {
        effectiveHourlyRate = payRate > 0 ? payRate / (psConfig.daysPerPeriod * standardLimit) : 0;
      }
    } else {
      if (payType === "Hourly") {
        effectiveHourlyRate = payRate;
      } else if (payType === "Weekly") {
        effectiveHourlyRate = payRate > 0 ? payRate / (6 * standardLimit) : 0;
      } else {
        effectiveHourlyRate = payRate > 0 ? payRate / (26 * standardLimit) : 0;
      }
    }

    const pendingAmount = parseFloat((totalNetHours * effectiveHourlyRate).toFixed(2));
    const periodStart = uniqueDates[0] || getLocalTodayString();
    const periodEnd = uniqueDates[uniqueDates.length - 1] || getLocalTodayString();

    return {
      workedDaysCount,
      totalGrossHours: parseFloat(totalGrossHours.toFixed(2)),
      totalLunchDeductions: parseFloat(totalLunchDeductions.toFixed(2)),
      totalNetHours,
      totalRegularHours: parseFloat(totalRegularHours.toFixed(2)),
      totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
      payType,
      payRate,
      effectiveHourlyRate: parseFloat(effectiveHourlyRate.toFixed(2)),
      pendingAmount,
      periodStart,
      periodEnd
    };
  }, [attendance]);

  const handleProcessPayment = async () => {
    if (!selectedPayEmp || isProcessingPayment) return;
    const emp = selectedPayEmp;
    const calc = calculateEmpPayDetails(emp);

    if (calc.pendingAmount <= 0) {
      showToast("No pending balance to pay for this staff member.", "info");
      return;
    }

    setIsProcessingPayment(true);
    try {
      const res = await processPayrollPaymentAction(
        emp.id,
        calc.pendingAmount,
        calc.totalNetHours,
        calc.totalGrossHours,
        calc.totalLunchDeductions,
        calc.periodStart,
        calc.periodEnd,
        payModalNotes
      );

      if (res.success && res.payrollRecord) {
        showToast(`Payment of ₹${calc.pendingAmount.toLocaleString('en-IN')} for ${emp.name} completed successfully!`, "success");
        setPayrollRecords(prev => [res.payrollRecord, ...prev]);
        setSelectedPayEmp(null);
        setPayModalNotes("");
        window.location.reload();
      } else {
        showToast(res.error || "Failed to process payment.", "error");
      }
    } catch (err: any) {
      console.error("Payment Exception:", err);
      showToast(err?.message || "An error occurred while processing payment.", "error");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Total effective milliseconds worked today (recomputes every second via liveTime)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effectiveMsToday = React.useMemo(() => {
    const now = new Date();
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    return todayAttendanceLogs.reduce((total, log) => {
      const inSec = parseTimeSec(log.checkIn);
      if (inSec === null) return total;
      const outSec = parseTimeSec(log.checkOut);
      const diff = Math.max(0, (outSec ?? nowSec) - inSec);
      return total + diff * 1000;
    }, 0);
  // liveTime is a dep so this recomputes every second for the live timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayAttendanceLogs, liveTime]);

  const fmtMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const getEmployeeTodayPunches = useCallback((empId: string) => {
    const todayStr = getLocalTodayString();
    return attendance
      .filter(a => a.employeeId === empId && a.date === todayStr)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [attendance]);

  const getEmployeeLatestPunch = useCallback((empId: string) => {
    const logs = getEmployeeTodayPunches(empId);
    return logs[logs.length - 1] || null;
  }, [getEmployeeTodayPunches]);

  const getEmployeeEffectiveMsToday = useCallback((empId: string) => {
    const logs = getEmployeeTodayPunches(empId);
    const now = new Date();
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    return logs.reduce((total, log) => {
      const inSec = parseTimeSec(log.checkIn);
      if (inSec === null) return total;
      const outSec = parseTimeSec(log.checkOut);
      const diff = Math.max(0, (outSec ?? nowSec) - inSec);
      return total + diff * 1000;
    }, 0);
  }, [getEmployeeTodayPunches]);

  const employeeTimesheets = timesheets.filter(t => t.employeeId === activeEmpId);


  // Login view if not authenticated
  if (!session || !session.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-105 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-850 dark:text-zinc-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        <Toaster richColors position="top-right" closeButton />
        
        {/* Modern blur blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[130px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-8 rounded-2xl shadow-xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Title and Badge */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 px-3 py-1 rounded-full text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Security Verification
            </div>
            <h1 className="text-2.5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight mt-1">Staff Portal</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Garment Production Management System</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-650 dark:text-red-400 p-3.5 rounded-xl text-xs font-semibold text-center animate-in fade-in slide-in-from-top-1 duration-200">
                {loginError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Username or Employee Code
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Enter Username or Employee Code"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  className="w-full h-11 bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 dark:focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-11 pr-4 focus:outline-none text-xs font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 transition-all focus:bg-white dark:focus:bg-zinc-950"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full h-11 bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 dark:focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-11 pr-11 focus:outline-none text-xs font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 transition-all focus:bg-white dark:focus:bg-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-250 transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {isLoggingIn ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <UserCheck className="h-4 w-4 text-white" />
              )}
              {isLoggingIn ? "Signing In..." : "Sign In"}
            </button>
          </form>

          {/* Saved Session Section */}
          {lastLoginCode && (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850 rounded-xl space-y-3 text-xs text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Saved Session</span>
                <button
                  type="button"
                  onClick={handleClearLastLogin}
                  className="text-[9px] uppercase font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 tracking-wider transition-colors cursor-pointer"
                >
                  Clear History
                </button>
              </div>
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={handleProceedLastLogin}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/10"
              >
                {isLoggingIn ? (
                  <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <UserCheck className="h-3.5 w-3.5" />
                )}
                {isLoggingIn ? "Logging In..." : `Proceed as ${lastLoginCode}`}
              </button>
            </div>
          )}


        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-955 text-zinc-800 dark:text-zinc-200 transition-colors duration-200 font-sans">
      <Toaster richColors position="top-right" closeButton />
      
      {/* Premium Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-zinc-850 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 sm:px-6 py-3 flex justify-between items-center gap-4">
        
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
          <p className="text-xs sm:text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Staff Portal</p>
        </div>

        {/* User context & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/40 px-3 py-1.5 rounded-xl shadow-xs">
            <span className={`h-1.5 w-1.5 rounded-full ${session.authRole === "Admin" ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}></span>
            <span className="text-[10px] sm:text-xs font-bold text-zinc-700 dark:text-zinc-200">
              {session.authRole === "Admin" ? "Admin Console" : `${currentEmployee?.name} (${currentEmployee?.code})`}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-[10px] sm:text-xs font-bold text-red-500 hover:text-white border border-red-200 dark:border-red-900/40 hover:bg-red-550 rounded-xl cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1.5 shadow-xs"
          >
            <LogOut className="h-3 w-3" />
            Logout
          </button>
        </div>

      </header>

      {/* Main Page Layout Container */}
      <main className="max-w-5xl mx-auto px-4 py-5 sm:py-7 space-y-6">
        
        {/* ===================================== */}
        {/*           ADMIN CONSOLE PANEL         */}
        {/* ===================================== */}
        {currentRole === "Admin" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            
            {/* Compact Summary Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 flex items-center justify-between text-[11px] font-bold text-zinc-550 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-500" />
                <span>Total Staff: <span className="text-zinc-900 dark:text-white font-extrabold">{employees.length} Staff</span></span>
              </div>
              <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800"></div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                <span>Present Today: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{attendance.filter(a => a.date === getLocalTodayString() && a.status === "Clocked In").length} Active</span></span>
              </div>
            </div>

            {/* Admin Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap">
              {([
                { id: "status", label: "Attendance", icon: ClipboardList },
                { id: "logs", label: "Ledger", icon: Clock },
                { id: "roster", label: "Staff", icon: Users },
                { id: "payroll", label: "Payroll", icon: Banknote },
                { id: "settings", label: "Settings", icon: Settings }
              ] as const).map(tab => {
                const Icon = tab.icon;
                const isActive = adminTab === tab.id;
                return (
                  <button 
                    key={tab.id}
                    onClick={() => setAdminTab(tab.id)} 
                    className={`py-2.5 px-3.5 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer text-[10px] sm:text-xs flex items-center gap-1.5 ${
                      isActive 
                        ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                        : "border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            
            {/* Admin TAB: Attendance Logs */}
            {adminTab === "status" && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="font-black text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Live Attendance Feed</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {employees.map(emp => {
                    const todayPunches = getEmployeeTodayPunches(emp.id);
                    const latestLog = getEmployeeLatestPunch(emp.id);
                    const isCurrentlyClockedIn = latestLog?.status === "Clocked In";

                    return (
                      <div 
                        key={emp.id} 
                        onClick={() => handleSelectAdminEmp(emp)}
                        className="relative border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3 sm:p-4.5 rounded-2xl shadow-xs hover:shadow-md hover:border-amber-500/50 transition-all duration-250 cursor-pointer flex flex-col justify-between gap-3 sm:gap-4 group"
                      >
                        {/* Top Section: Profile Info and Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 sm:gap-3.5">
                            {emp.profilePhoto ? (
                              <img 
                                src={emp.profilePhoto} 
                                alt={emp.name} 
                                className="h-9 w-9 sm:h-11 sm:w-11 object-cover border border-zinc-150 dark:border-zinc-800 shrink-0 rounded-xl shadow-3xs group-hover:scale-105 transition-transform duration-250" 
                              />
                            ) : (
                              <div className={`h-9 w-9 sm:h-11 sm:w-11 bg-gradient-to-br ${getAvatarBg(emp.name)} text-white flex items-center justify-center font-bold text-xs shadow-3xs shrink-0 rounded-xl group-hover:scale-105 transition-transform duration-250`}>
                                {getInitials(emp.name)}
                              </div>
                            )}
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-zinc-900 dark:text-zinc-50 leading-snug text-xs sm:text-sm group-hover:text-amber-500 transition-colors duration-200">{emp.name}</p>
                              <p className="text-[9px] sm:text-[10px] text-zinc-405 dark:text-zinc-500 font-mono leading-none">
                                {emp.code} · {emp.designation}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span className={`inline-flex items-center rounded-lg px-2 py-0.5 sm:px-2.5 sm:py-1 text-[8px] sm:text-[9px] font-black uppercase tracking-wider border shadow-3xs ${
                            isCurrentlyClockedIn
                              ? "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400"
                              : todayPunches.length > 0
                              ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                              : "bg-red-500/10 text-red-655 border-red-500/20 dark:text-red-400"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full mr-1 sm:mr-1.5 ${
                              isCurrentlyClockedIn ? "bg-green-500 animate-pulse" : todayPunches.length > 0 ? "bg-zinc-400" : "bg-red-500"
                            }`} />
                            {isCurrentlyClockedIn ? "Active" : todayPunches.length > 0 ? "Offline" : "Absent"}
                          </span>
                        </div>

                        {/* Bottom Section: Clocking metrics and Action button */}
                        <div className="pt-2 sm:pt-3 border-t border-dashed border-zinc-155 dark:border-zinc-800 flex items-center justify-between gap-3 sm:gap-4">
                          {/* Metrics Info */}
                          <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 flex-1">
                            {todayPunches.length > 0 ? (
                              <>
                                <div className="space-y-0.5">
                                  <span className="text-[8px] uppercase font-black text-zinc-400 dark:text-zinc-500 block tracking-wider leading-none">In</span>
                                  <span className="font-mono text-[9px] sm:text-[9.5px] font-bold text-zinc-700 dark:text-zinc-350">{todayPunches[0].checkIn}</span>
                                </div>
                                {(() => {
                                  const lastCheckOut = [...todayPunches].reverse().find(p => p.checkOut)?.checkOut;
                                  if (lastCheckOut) {
                                    return (
                                      <div className="space-y-0.5">
                                        <span className="text-[8px] uppercase font-black text-zinc-400 dark:text-zinc-500 block tracking-wider leading-none">Out</span>
                                        <span className="font-mono text-[9px] sm:text-[9.5px] font-bold text-zinc-700 dark:text-zinc-350">{lastCheckOut}</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                <div className="space-y-0.5">
                                  <span className="text-[8px] uppercase font-black text-zinc-400 dark:text-zinc-500 block tracking-wider leading-none">
                                    {isCurrentlyClockedIn ? "Active" : "Worked"}
                                  </span>
                                  <span className="font-mono text-[9px] sm:text-[9.5px] font-bold text-zinc-900 dark:text-zinc-150">
                                    {isMounted ? fmtMs(getEmployeeEffectiveMsToday(emp.id)) : "00s"}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <span className="text-[9px] sm:text-[10px] text-zinc-350 dark:text-zinc-650 font-bold italic py-0.5">
                                No check-in logs today
                              </span>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0">
                            {isCurrentlyClockedIn ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); if (!isClocking) handleClockOut(emp.id); }}
                                disabled={isClocking}
                                className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-red-50 hover:bg-red-100/80 dark:bg-red-950/20 dark:hover:bg-red-950/45 border border-red-200 dark:border-red-900/40 text-red-650 hover:text-red-700 dark:text-red-400 font-black uppercase tracking-wider text-[8px] sm:text-[9px] rounded-xl transition-all shadow-3xs hover:scale-103 active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none animate-in fade-in duration-100"
                              >
                                <LogOut className="h-3 w-3 shrink-0" />
                                Check Out
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); if (!isClocking) handleClockIn(emp.id); }}
                                disabled={isClocking}
                                className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/45 border border-emerald-250 dark:border-emerald-900/40 text-emerald-650 hover:text-emerald-700 dark:text-emerald-400 font-black uppercase tracking-wider text-[8px] sm:text-[9px] rounded-xl transition-all shadow-3xs hover:scale-103 active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none animate-in fade-in duration-100"
                              >
                                <Fingerprint className="h-3 w-3 shrink-0" />
                                Check In
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Admin TAB: Timesheet Ledger */}
            {adminTab === "logs" && (() => {
              const filteredTimesheets = timesheets.filter(ts => {
                if (filterEmployeeId && ts.employeeId !== filterEmployeeId) return false;
                if (filterDate && ts.date !== filterDate) return false;
                return true;
              });

              return (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs text-left animate-in fade-in duration-200">
                  {/* Title & Filters panel */}
                  <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Timesheets Ledger</span>
                      <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-350 px-2 py-0.5 rounded-lg font-mono font-semibold shadow-xs">
                        Showing {filteredTimesheets.length} of {timesheets.length}
                      </span>
                    </div>

                    {/* Filter Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Staff filter select */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block">Filter by Staff</label>
                        <div className="relative">
                          <select
                            value={filterEmployeeId}
                            onChange={e => setFilterEmployeeId(e.target.value)}
                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 pr-8 focus:outline-none text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer appearance-none"
                          >
                            <option value="">All Staff</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.code})
                              </option>
                            ))}
                          </select>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                            <ChevronDown className="h-4 w-4" />
                          </span>
                        </div>
                      </div>

                      {/* Date filter picker */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block">Filter by Date</label>
                        <div className="relative flex items-center">
                          <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 focus:outline-none font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                          />
                          {filterDate && (
                            <button
                              type="button"
                              onClick={() => setFilterDate("")}
                              className="absolute right-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-bold text-xs cursor-pointer"
                              title="Clear Date Filter"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const getLastThreeDays = () => {
                      const dates: string[] = [];
                      for (let i = 0; i < 3; i++) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        dates.push(`${yyyy}-${mm}-${dd}`);
                      }
                      return dates;
                    };

                    const lastThreeDays = getLastThreeDays();
                    const targetDates = filterDate ? [filterDate] : lastThreeDays;

                    const formatDateFriendly = (dateStr: string) => {
                      const today = getLocalTodayString();
                      
                      const yesterdayDate = new Date();
                      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                      const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
                      
                      const dbyDate = new Date();
                      dbyDate.setDate(dbyDate.getDate() - 2);
                      const dbyStr = dbyDate.toISOString().split('T')[0];

                      if (dateStr === today) return `${dateStr} (Today)`;
                      if (dateStr === yesterdayStr) return `${dateStr} (Yesterday)`;
                      if (dateStr === dbyStr) return `${dateStr} (Day Before)`;
                      
                      try {
                        const d = new Date(dateStr);
                        return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
                      } catch {
                        return dateStr;
                      }
                    };

                    const allTargetTimesheets = targetDates.flatMap(d => filteredTimesheets.filter(ts => ts.date === d));

                    if (allTargetTimesheets.length === 0) {
                      return (
                        <div className="p-10 text-center text-zinc-400 italic text-xs">
                          No timesheets found matching the selected filters.
                        </div>
                      );
                    }

                    return (
                      <div className="p-4 sm:p-5 space-y-5">
                        {targetDates.map(dayStr => {
                          const dayTimesheets = filteredTimesheets.filter(ts => ts.date === dayStr);

                          if (dayTimesheets.length === 0 && filterDate) {
                            return null;
                          }

                          return (
                            <div key={dayStr} className="space-y-2 text-left">
                              {/* Date Group Header */}
                              <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-955 p-2.5 border border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-555 rounded-none">
                                <span>{formatDateFriendly(dayStr)}</span>
                                <span className="font-mono text-[9px] bg-zinc-200/50 dark:bg-zinc-800/85 px-2 py-0.5 text-zinc-650 dark:text-zinc-400 rounded-none">
                                  {dayTimesheets.length} Logs
                                </span>
                              </div>

                              {dayTimesheets.length === 0 ? (
                                <div className="p-4 text-center text-zinc-400 italic text-[11px] border border-dashed border-zinc-200 dark:border-zinc-800 rounded-none">
                                  No work logs submitted for this date.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {(() => {
                                    const groupedTimesheets: Record<string, Timesheet[]> = {};
                                    dayTimesheets.forEach(ts => {
                                      if (!groupedTimesheets[ts.employeeId]) {
                                        groupedTimesheets[ts.employeeId] = [];
                                      }
                                      groupedTimesheets[ts.employeeId].push(ts);
                                    });

                                    const employeeIds = Object.keys(groupedTimesheets);

                                    return employeeIds.map(empId => {
                                      const emp = employees.find(e => e.id === empId);
                                      const empTimesheets = groupedTimesheets[empId];
                                      
                                      // Combine all entries from all timesheets of this employee on this date
                                      const allEntries = empTimesheets.flatMap(ts => ts.entries || []);
                                      const totalHrs = allEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
                                      
                                      const collapseKey = `${dayStr}_${empId}`;
                                      const isExpanded = !!expandedTimesheets[collapseKey];

                                      return (
                                        <div 
                                          key={empId} 
                                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-350 dark:hover:border-zinc-700 transition-all duration-200 rounded-none"
                                        >
                                          {/* Collapsible Header Row */}
                                          <div 
                                            onClick={() => setExpandedTimesheets(prev => ({ ...prev, [collapseKey]: !prev[collapseKey] }))}
                                            className="p-3 flex items-center justify-between cursor-pointer select-none"
                                          >
                                            <div className="flex items-center gap-3">
                                              {emp?.profilePhoto ? (
                                                <img 
                                                  src={emp.profilePhoto} 
                                                  alt={emp.name} 
                                                  className="h-8 w-8 object-cover border border-zinc-200 dark:border-zinc-800 shrink-0 rounded-none" 
                                                />
                                              ) : (
                                                <div className={`h-8 w-8 bg-gradient-to-br ${getAvatarBg(emp?.name || "")} text-white flex items-center justify-center font-bold text-[10px] shadow-2xs shrink-0 rounded-none`}>
                                                  {getInitials(emp?.name || "")}
                                                </div>
                                              )}
                                              <div>
                                                <p className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-50 leading-tight">
                                                  {emp?.name}
                                                </p>
                                                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                                                  {emp?.department || "Staff"} · {emp?.code}
                                                </p>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                              <span className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 font-bold text-xs font-mono rounded-none">
                                                {totalHrs.toFixed(2)} Hrs
                                              </span>
                                              {isExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" />
                                              ) : (
                                                <ChevronDown className="h-4 w-4 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 transition-colors" />
                                              )}
                                            </div>
                                          </div>

                                          {/* Expanded Body: Work Log details & images */}
                                          {isExpanded && (
                                            <div className="p-3 border-t border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-950/20 space-y-2.5 animate-in slide-in-from-top-1 duration-150 rounded-none">
                                              {allEntries.map((entry, idx) => (
                                                <div key={entry.id || idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 space-y-2 shadow-2xs rounded-none">
                                                  <div className="flex justify-between items-start gap-3">
                                                    <div className="space-y-1 flex-1">
                                                      {entry.orderId && (
                                                        <span className="inline-flex px-1.5 py-0.5 bg-zinc-200/50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-mono text-[9px] font-bold tracking-wider mr-1.5 rounded-none">
                                                          {entry.orderId}
                                                        </span>
                                                      )}
                                                      <p className="text-xs text-zinc-750 dark:text-zinc-300 font-medium leading-relaxed">
                                                        {entry.description}
                                                      </p>
                                                    </div>
                                                    <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-955 px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 shrink-0 rounded-none">
                                                      {entry.hours} hr
                                                    </span>
                                                  </div>

                                                  {/* Proof Images Gallery */}
                                                  {(entry.images || []).length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/50 mt-1.5">
                                                      {(entry.images || []).map((imgUrl, imgIdx) => (
                                                        <div key={imgIdx} className="relative group shrink-0">
                                                          <img 
                                                            src={imgUrl} 
                                                            alt="Work proof" 
                                                            className="h-12 w-12 object-cover border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-xs rounded-none"
                                                            onClick={() => handleOpenPreview(entry.images || [], imgIdx)}
                                                          />
                                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-none">
                                                            <Eye className="h-3.5 w-3.5 text-white" />
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Admin TAB: Workforce & Orders Directory */}
            {adminTab === "roster" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-left animate-in fade-in duration-200">
                
                {/* Left Forms column: Create Employee */}
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <p className="font-bold text-xs text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
                        {editingEmployeeId ? "Edit Staff Profile" : "Register Staff"}
                      </p>
                      {editingEmployeeId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEmployeeId(null);
                            setEmpFormName("");
                            setEmpFormCode("");
                            setEmpFormPassword("");
                          }}
                          className="text-[10px] font-black text-red-500 hover:text-red-750 uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <form onSubmit={handleAddEmployeeSubmit} className="space-y-3.5 pt-1 text-xs">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Full Name</label>
                        <input 
                          required 
                          placeholder="E.g. Rajesh Kumar" 
                          value={empFormName} 
                          onChange={e => setEmpFormName(e.target.value)} 
                          className="w-full h-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Employee Code</label>
                        <input 
                          required 
                          placeholder="E.g. EMP-105" 
                          value={empFormCode} 
                          onChange={e => setEmpFormCode(e.target.value)} 
                          className="w-full h-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-mono font-semibold" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Password</label>
                        <div className="relative">
                          <input 
                            type={showFormPassword ? "text" : "password"}
                            required={!editingEmployeeId}
                            placeholder={editingEmployeeId ? "Leave blank to keep current" : "Password"} 
                            value={empFormPassword} 
                            onChange={e => setEmpFormPassword(e.target.value)} 
                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pr-10 focus:outline-none focus:border-amber-500 transition-colors font-semibold" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowFormPassword(!showFormPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650 transition-colors focus:outline-none cursor-pointer"
                          >
                            {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Profile Photo</label>
                        <div className="flex items-center gap-3">
                          {empFormPhoto ? (
                            <div className="relative group shrink-0 h-10 w-10 border border-zinc-250 dark:border-zinc-800">
                              <img src={empFormPhoto} className="h-full w-full object-cover" alt="Profile preview" />
                              <button 
                                type="button" 
                                onClick={() => setEmpFormPhoto("")}
                                className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-red-500 text-white text-[8px] flex items-center justify-center cursor-pointer shadow-xs font-bold"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <label className="h-10 w-10 border border-dashed border-zinc-350 dark:border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors bg-zinc-50 dark:bg-zinc-950">
                              <Camera className="h-4 w-4 text-zinc-450" />
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setIsSavingEmployee(true);
                                    try {
                                      const base64 = await compressImage(file);
                                      const url = await uploadToCloud(base64);
                                      setEmpFormPhoto(url);
                                      showToast("Profile photo uploaded successfully!", "success");
                                    } catch (err) {
                                      console.error(err);
                                      showToast("Failed to upload profile photo.", "error");
                                    } finally {
                                      setIsSavingEmployee(false);
                                    }
                                  }
                                }}
                              />
                            </label>
                          )}
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
                            Optional photo URL (auto-uploaded)
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Department</label>
                          <div className="relative">
                            <select 
                              value={empFormDept} 
                              onChange={e => setEmpFormDept(e.target.value)} 
                              className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pr-8 focus:outline-none focus:border-amber-500 transition-colors font-bold text-zinc-700 dark:text-zinc-355 cursor-pointer appearance-none"
                            >
                              {departments.map(d => (
                                <option key={d.id} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-450 pointer-events-none">
                              <ChevronDown className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Designation</label>
                          <input 
                            required 
                            placeholder="E.g. Stitcher" 
                            value={empFormDesg} 
                            onChange={e => setEmpFormDesg(e.target.value)} 
                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-805 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold" 
                          />
                        </div>
                      </div>

                      {/* Employment Type & Break Time */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Employment Type</label>
                          <div className="relative">
                            <select
                              value={empFormEmploymentType}
                              onChange={e => setEmpFormEmploymentType(e.target.value)}
                              className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pr-8 focus:outline-none focus:border-amber-500 transition-colors font-bold text-zinc-700 dark:text-zinc-350 cursor-pointer appearance-none"
                            >
                              {employmentTypes.map(et => (
                                <option key={et.id} value={et.name}>
                                  {et.name} ({et.standardHours}h)
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-450 pointer-events-none">
                              <ChevronDown className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Break Time (Mins)</label>
                          <input
                            type="number"
                            required
                            placeholder="60"
                            value={empFormBreakTime}
                            onChange={e => setEmpFormBreakTime(e.target.value)}
                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-805 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                          />
                        </div>
                      </div>

                      {/* Shift Timings */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Check-In Time</label>
                          <input
                            type="time"
                            required
                            value={empFormCheckInTime}
                            onChange={e => setEmpFormCheckInTime(e.target.value)}
                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-805 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Check-Out Time</label>
                          <input
                            type="time"
                            required
                            value={empFormCheckOutTime}
                            onChange={e => setEmpFormCheckOutTime(e.target.value)}
                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                          />
                        </div>
                      </div>

                      {/* Pay Structure & Pay Rate */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Pay Structure</label>
                          <div className="relative">
                            <select
                              value={empFormPayType}
                              onChange={e => setEmpFormPayType(e.target.value)}
                              className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pr-8 focus:outline-none focus:border-amber-500 transition-colors font-bold text-zinc-700 dark:text-zinc-355 cursor-pointer appearance-none"
                            >
                              {payStructures.map(ps => (
                                <option key={ps.id} value={ps.name}>
                                  {ps.name} {ps.daysPerPeriod > 0 ? `(${ps.daysPerPeriod}d)` : "(Hourly)"}
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-450 pointer-events-none">
                              <ChevronDown className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Rate (₹)</label>
                          <input
                            type="number"
                            required
                            placeholder="E.g., 15000"
                            value={empFormPayRate}
                            onChange={e => setEmpFormPayRate(e.target.value)}
                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-805 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isSavingEmployee}
                          className="flex-1 bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-zinc-950 hover:to-zinc-850 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-950 text-white font-bold h-10 rounded-xl text-xs cursor-pointer transition-all uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          {isSavingEmployee && (
                            <span className="h-3.5 w-3.5 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin"></span>
                          )}
                          {isSavingEmployee 
                            ? (editingEmployeeId ? "Saving..." : "Registering...") 
                            : (editingEmployeeId ? "Save Changes" : "Register Staff")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEmployeeId(null);
                            setEmpFormName("");
                            setEmpFormCode("");
                            setEmpFormPassword("");
                            setEmpFormPhoto("");
                            setEmpFormDept("Stitching Section");
                            setEmpFormDesg("");
                            setEmpFormPayType("Monthly");
                            setEmpFormPayRate("");
                            setEmpFormCheckInTime("09:00");
                            setEmpFormCheckOutTime("18:00");
                            setEmpFormEmploymentType("Full-Time");
                            setEmpFormBreakTime(60);
                          }}
                          className="px-3.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-bold h-10 rounded-xl text-xs cursor-pointer transition-all uppercase tracking-wide flex items-center justify-center shadow-xs"
                        >
                          Reset
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Right lists column: Workforce Directory */}
                <div className="lg:col-span-2">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-805 rounded-2xl overflow-hidden shadow-xs">
                    <div className="flex justify-between items-center px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955/20">
                      <span className="font-bold text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Staff List</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg animate-pulse">Click row to manage</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-50/40 dark:bg-zinc-955/20 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">
                            <th className="px-3 py-2.5 sm:px-4 sm:py-3">Name</th>
                            <th className="px-3 py-2.5 sm:px-4 sm:py-3 hidden sm:table-cell">Code</th>
                            <th className="px-3 py-2.5 sm:px-4 sm:py-3 hidden sm:table-cell">Department</th>
                            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold">Designation</th>
                            <th className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-medium text-[11px] sm:text-xs">
                          {employees.map(emp => (
                            <tr 
                              key={emp.id} 
                              className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 transition-colors"
                            >
                              <td className="px-3 py-2.5 sm:px-4 sm:py-3 cursor-pointer font-bold text-zinc-900 dark:text-zinc-100" onClick={() => handleSelectAdminEmp(emp)} title="Click to manage staff member">
                                <div className="flex items-center gap-2.5">
                                  {emp.profilePhoto ? (
                                    <img 
                                      src={emp.profilePhoto} 
                                      alt={emp.name} 
                                      className="h-7 w-7 sm:h-8 sm:w-8 object-cover border border-zinc-200 dark:border-zinc-800 shrink-0" 
                                    />
                                  ) : (
                                    <div className={`h-7 w-7 sm:h-8 sm:w-8 bg-gradient-to-br ${getAvatarBg(emp.name)} text-white flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-xs shrink-0`}>
                                      {getInitials(emp.name)}
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{emp.name}</p>
                                    <p className="sm:hidden font-mono text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-none">{emp.code}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 sm:px-4 sm:py-3 font-mono text-zinc-500 dark:text-zinc-400 cursor-pointer hidden sm:table-cell" onClick={() => handleSelectAdminEmp(emp)}>{emp.code}</td>
                              <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-zinc-500 dark:text-zinc-400 hidden sm:table-cell cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>{emp.department}</td>
                              <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-zinc-650 dark:text-zinc-350 font-semibold cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>{emp.designation}</td>
                              <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingEmployeeId(emp.id);
                                      setEmpFormName(emp.name);
                                      setEmpFormCode(emp.code);
                                      setEmpFormDept(emp.department);
                                      setEmpFormDesg(emp.designation);
                                      setEmpFormPassword(""); // Leave empty for password override placeholder
                                      setEmpFormPhoto(emp.profilePhoto || "");
                                      setEmpFormPayType(emp.payType || "Monthly");
                                      setEmpFormPayRate(emp.payRate !== undefined ? emp.payRate : "");
                                      setEmpFormCheckInTime(emp.checkInTime || "09:00");
                                      setEmpFormCheckOutTime(emp.checkOutTime || "18:00");
                                      setEmpFormEmploymentType(emp.employmentType || "Full-Time");
                                      setEmpFormBreakTime(emp.breakTime !== undefined ? emp.breakTime : 60);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="inline-flex items-center justify-center p-1.5 sm:p-2 text-zinc-505 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 bg-white dark:bg-zinc-900 rounded-lg cursor-pointer transition-all shadow-xs"
                                    title="Edit Employee Profile"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEmployee(emp.id, emp.name);
                                    }}
                                    className="inline-flex items-center justify-center p-1.5 sm:p-2 text-red-500 hover:text-white border border-red-200 dark:border-red-900/40 hover:bg-red-500 rounded-lg cursor-pointer transition-all shadow-xs"
                                    title="Delete Employee"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Admin TAB: Payroll Management */}
            {adminTab === "payroll" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Payroll Calculator Card Directory */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 space-y-3.5 shadow-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-150 dark:border-zinc-800">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-105 flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-amber-500" /> Pending Payroll Calculator
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-400">Real-Time Accruals</span>
                  </div>

                  {employees.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 italic text-xs border border-dashed border-zinc-200 dark:border-zinc-800">
                      No registered staff members found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {employees.map(emp => {
                        const calc = calculateEmpPayDetails(emp);
                        return (
                          <div 
                            key={emp.id}
                            className="border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-3 flex flex-col justify-between hover:border-zinc-350 dark:hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-2.5">
                                {emp.profilePhoto ? (
                                  <img src={emp.profilePhoto} alt={emp.name} className="h-9 w-9 object-cover border border-zinc-200 dark:border-zinc-800" />
                                ) : (
                                  <div className={`h-9 w-9 bg-gradient-to-br ${getAvatarBg(emp.name)} text-white flex items-center justify-center font-bold text-xs`}>
                                    {getInitials(emp.name)}
                                  </div>
                                )}
                                <div className="text-left">
                                  <p className="font-bold text-zinc-900 dark:text-zinc-105 leading-none">{emp.name}</p>
                                  <p className="text-[9px] text-zinc-405 font-mono mt-1.5 uppercase font-bold">{emp.code} · {emp.department}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-505">
                                  ₹{calc.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="block text-[8px] text-zinc-400 uppercase font-bold font-sans mt-1">Pending</span>
                              </div>
                            </div>

                            {/* Worked Breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[10px] font-mono bg-white dark:bg-zinc-900 p-2.5 border border-zinc-200/80 dark:border-zinc-800">
                              <div>
                                <span className="text-zinc-400 block text-[9px] uppercase font-sans">Worked Days</span>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">{calc.workedDaysCount} Days</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[9px] uppercase font-sans">Gross Hours</span>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">{calc.totalGrossHours} hr</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[9px] uppercase font-sans">Break Excl.</span>
                                <span className="font-bold text-red-500">-{calc.totalLunchDeductions} hr</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[9px] uppercase font-sans">Regular Hours</span>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">{calc.totalRegularHours} hr</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[9px] uppercase font-sans">Overtime</span>
                                <span className="font-bold text-amber-600 dark:text-amber-505">+{calc.totalOvertimeHours} hr</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[9px] uppercase font-sans">Net Paid Hours</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{calc.totalNetHours} hr</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedPayEmp(emp)}
                              disabled={calc.pendingAmount <= 0}
                              className={`w-full py-2 px-3 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                                calc.pendingAmount > 0
                                  ? "bg-amber-500 hover:bg-amber-600 text-black cursor-pointer active:scale-98"
                                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                              }`}
                            >
                              <Banknote className="h-4 w-4" />
                              {calc.pendingAmount > 0 ? `Process Payout (₹${calc.pendingAmount.toLocaleString('en-IN')})` : "Fully Paid (₹0.00)"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Payroll History Log Table */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 space-y-3.5 shadow-xs text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-150 dark:border-zinc-800">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-101 flex items-center gap-2">
                      <History className="h-4 w-4 text-emerald-505" /> Historical Payout Transactions Log
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-400">{payrollRecords.length} Completed Payouts</span>
                  </div>

                  {/* Filters Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-955/40 p-3 border border-zinc-200 dark:border-zinc-800 text-xs text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-450 dark:text-zinc-550 block">Filter by Staff</label>
                      <div className="relative">
                        <select
                          value={payrollFilterEmployeeId}
                          onChange={e => setPayrollFilterEmployeeId(e.target.value)}
                          className="w-full h-9 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 pr-8 focus:outline-none focus:border-amber-500 font-bold text-zinc-700 dark:text-zinc-355 cursor-pointer appearance-none"
                        >
                          <option value="">All Staff</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} ({emp.code})
                            </option>
                          ))}
                        </select>
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-455 pointer-events-none">
                          <ChevronDown className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-455 dark:text-zinc-500 block">Filter by Date</label>
                      <div className="relative flex items-center">
                        <input
                          type="date"
                          value={payrollFilterDate}
                          onChange={e => setPayrollFilterDate(e.target.value)}
                          className="w-full h-9 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 focus:outline-none focus:border-amber-500 font-semibold"
                        />
                        {payrollFilterDate && (
                          <button
                            onClick={() => setPayrollFilterDate("")}
                            className="absolute right-2.5 text-zinc-450 hover:text-zinc-650 cursor-pointer text-xs font-bold focus:outline-none"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const filteredRecords = payrollRecords.filter(pr => {
                      if (payrollFilterEmployeeId && pr.employeeId !== payrollFilterEmployeeId) return false;
                      if (payrollFilterDate) {
                        const recordDate = pr.paidAt ? pr.paidAt.split('T')[0] : '';
                        if (recordDate !== payrollFilterDate) return false;
                      }
                      return true;
                    });

                    if (filteredRecords.length === 0) {
                      return (
                        <div className="p-8 text-center text-zinc-400 italic text-xs border border-dashed border-zinc-200 dark:border-zinc-800">
                          {payrollRecords.length === 0 
                            ? "No payout transactions recorded yet. Once staff members are paid, completed records will be logged here."
                            : "No payouts match the filter criteria."}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left border-collapse font-sans text-xs">
                            <thead>
                              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                                <th className="p-2.5">Date Paid</th>
                                <th className="p-2.5">Staff Member</th>
                                <th className="p-2.5">Pay Structure</th>
                                <th className="p-2.5">Gross / Net Hours</th>
                                <th className="p-2.5">Paid Amount</th>
                                <th className="p-2.5">Notes</th>
                                <th className="p-2.5 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                              {filteredRecords.map(pr => {
                                const emp = pr.employee || employees.find(e => e.id === pr.employeeId);
                                const paidDateFormatted = pr.paidAt ? new Date(pr.paidAt).toLocaleDateString("en-US", {
                                  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
                                }) : pr.periodEnd;

                                return (
                                  <tr key={pr.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                                    <td className="p-2.5 font-mono text-[10px] text-zinc-505 dark:text-zinc-400 whitespace-nowrap">
                                      {paidDateFormatted}
                                    </td>
                                    <td className="p-2.5 font-bold text-zinc-900 dark:text-zinc-105">
                                      <div className="flex items-center gap-2">
                                        {emp?.profilePhoto ? (
                                          <img src={emp.profilePhoto} alt={emp.name} className="h-6 w-6 object-cover border border-zinc-200 dark:border-zinc-800" />
                                        ) : (
                                          <div className={`h-6 w-6 bg-gradient-to-br ${getAvatarBg(emp?.name || "")} text-white flex items-center justify-center font-bold text-[9px]`}>
                                            {getInitials(emp?.name || "")}
                                          </div>
                                        )}
                                        <span>{emp?.name || pr.employeeId} <span className="text-[9px] text-zinc-400 font-mono">({emp?.code})</span></span>
                                      </div>
                                    </td>
                                    <td className="p-2.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-350">
                                      {pr.payType}: ₹{pr.payRate}
                                    </td>
                                    <td className="p-2.5 font-mono text-[10px] text-zinc-550 dark:text-zinc-400">
                                      {pr.grossHours}h / <strong className="text-zinc-700 dark:text-zinc-300">{pr.netHours}h</strong>
                                    </td>
                                    <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      ₹{pr.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2.5 text-[10px] text-zinc-500 dark:text-zinc-400 max-w-xs truncate">
                                      {pr.notes || "—"}
                                    </td>
                                    <td className="p-2.5 text-right">
                                      <span className="inline-flex px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase">
                                        Paid
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Card List View */}
                        <div className="block md:hidden space-y-2.5">
                          {filteredRecords.map(pr => {
                            const emp = pr.employee || employees.find(e => e.id === pr.employeeId);
                            const paidDateFormatted = pr.paidAt ? new Date(pr.paidAt).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
                            }) : pr.periodEnd;

                            return (
                              <div key={pr.id} className="p-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-2 text-xs">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-2">
                                    {emp?.profilePhoto ? (
                                      <img src={emp.profilePhoto} alt={emp.name} className="h-8 w-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-800" />
                                    ) : (
                                      <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${getAvatarBg(emp?.name || "")} text-white flex items-center justify-center font-bold text-xs`}>
                                        {getInitials(emp?.name || "")}
                                      </div>
                                    )}
                                    <div>
                                      <p className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                                        {emp?.name || pr.employeeId} <span className="text-[10px] text-zinc-400 font-mono">({emp?.code})</span>
                                      </p>
                                      <p className="text-[10px] font-mono text-zinc-400">{paidDateFormatted}</p>
                                    </div>
                                  </div>
                                  <span className="inline-flex px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase rounded shrink-0">
                                    Paid
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 text-[11px]">
                                  <div>
                                    <span className="text-[9px] text-zinc-400 uppercase font-semibold block">Pay Structure</span>
                                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{pr.payType}: ₹{pr.payRate}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[9px] text-zinc-400 uppercase font-semibold block">Paid Amount</span>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                      ₹{pr.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1">
                                  <span>Hours: {pr.grossHours}h gross / <strong className="text-zinc-700 dark:text-zinc-300">{pr.netHours}h net</strong></span>
                                  {pr.notes && <span className="italic truncate max-w-[150px]">"{pr.notes}"</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Process Payment Confirmation Modal */}
            {selectedPayEmp && (() => {
              const emp = selectedPayEmp;
              const calc = calculateEmpPayDetails(emp);

              return (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 max-w-md w-full space-y-4 shadow-xl text-left animate-in zoom-in-95 duration-150">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-150 dark:border-zinc-800">
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-101 flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-amber-500" /> Confirm Salary Payout
                      </h4>
                      <button 
                        type="button" 
                        onClick={() => setSelectedPayEmp(null)}
                        className="text-zinc-405 hover:text-zinc-650 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer font-sans"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="bg-zinc-50 dark:bg-zinc-955 p-3 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                        {emp.profilePhoto ? (
                          <img src={emp.profilePhoto} alt={emp.name} className="h-10 w-10 object-cover border border-zinc-200 dark:border-zinc-800 shrink-0" />
                        ) : (
                          <div className={`h-10 w-10 bg-gradient-to-br ${getAvatarBg(emp.name)} text-white flex items-center justify-center font-bold text-xs shrink-0`}>
                            {getInitials(emp.name)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{emp.name}</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold">{emp.code} · {emp.department}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 font-mono text-[11px] bg-amber-500/5 border border-amber-500/20 p-3 text-amber-800 dark:text-amber-300">
                        <div className="flex justify-between">
                          <span className="font-sans text-zinc-500">Pay Structure:</span>
                          <span className="font-bold">{calc.payType} (₹{calc.payRate.toLocaleString('en-IN')})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-zinc-500">Worked Period:</span>
                          <span>{calc.periodStart} to {calc.periodEnd} ({calc.workedDaysCount} days)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-zinc-500">Gross Hours:</span>
                          <span>{calc.totalGrossHours} hrs</span>
                        </div>
                        <div className="flex justify-between text-red-500">
                          <span className="font-sans text-zinc-500">Break Exclusion:</span>
                          <span>-{calc.totalLunchDeductions} hrs ({emp.breakTime || 60} mins/day)</span>
                        </div>
                        <div className="flex justify-between text-zinc-650 dark:text-zinc-400">
                          <span className="font-sans">Regular Hours:</span>
                          <span>{calc.totalRegularHours} hrs</span>
                        </div>
                        <div className="flex justify-between text-amber-600 dark:text-amber-500 font-semibold">
                          <span className="font-sans">Overtime Hours:</span>
                          <span>+{calc.totalOvertimeHours} hrs</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold border-t border-amber-500/20 pt-1 mt-1">
                          <span className="font-sans">Net Paid Hours:</span>
                          <span>{calc.totalNetHours} hrs</span>
                        </div>
                        <div className="flex justify-between text-amber-600 dark:text-amber-400 font-black text-sm border-t border-amber-500/30 pt-1 mt-1">
                          <span className="font-sans">Total Amount Payable:</span>
                          <span>₹{calc.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-400">Transaction Notes (Optional)</label>
                        <input
                          type="text"
                          placeholder="E.g., Weekly salary settlement via UPI / Cash"
                          value={payModalNotes}
                          onChange={e => setPayModalNotes(e.target.value)}
                          className="w-full h-9 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 font-medium text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setSelectedPayEmp(null)}
                        className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 font-bold text-xs uppercase text-zinc-505 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleProcessPayment}
                        disabled={isProcessingPayment}
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 font-bold text-xs uppercase text-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {isProcessingPayment && (
                          <span className="h-3.5 w-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        )}
                        {isProcessingPayment ? "Processing..." : `Confirm & Pay ₹${calc.pendingAmount.toLocaleString('en-IN')}`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Admin TAB: Settings */}
            {adminTab === "settings" && (
              <div className="space-y-8 text-left animate-in fade-in duration-200">
                {/* Section 1: Employment Types */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-500" /> Configure Employment Types
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Form */}
                    <div className="lg:col-span-1 bg-zinc-50/50 dark:bg-zinc-955/20 p-4 border border-zinc-100 dark:border-zinc-850 rounded-xl space-y-3.5">
                      <p className="font-bold text-[11px] text-zinc-500 uppercase tracking-wide">
                        {editingEtId ? "Update Employment Type" : "Add Custom Type"}
                      </p>
                      <form onSubmit={handleCreateEmploymentType} className="space-y-3 pt-1 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Type Name</label>
                          <input
                            required
                            type="text"
                            placeholder="E.g. Half-Time"
                            value={newEtName}
                            onChange={e => setNewEtName(e.target.value)}
                            className="w-full h-10 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Standard Shift Hours</label>
                          <input
                            required
                            type="number"
                            step="0.5"
                            min="1"
                            max="24"
                            placeholder="8.0"
                            value={newEtHours}
                            onChange={e => setNewEtHours(e.target.value)}
                            className="w-full h-10 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-805 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Break Trigger (Hours)</label>
                          <input
                            required
                            type="number"
                            step="0.5"
                            min="1"
                            max="24"
                            placeholder="5.0"
                            value={newEtBreakThreshold}
                            onChange={e => setNewEtBreakThreshold(e.target.value)}
                            className="w-full h-10 bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-805 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isSavingEt}
                            className="flex-1 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-950 text-white font-bold h-9 rounded-xl text-xs cursor-pointer transition-all uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            {isSavingEt && <span className="h-3.5 w-3.5 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin"></span>}
                            {isSavingEt ? "Saving..." : editingEtId ? "Update" : "Add"}
                          </button>
                          {editingEtId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEtId(null);
                                setNewEtName("");
                                setNewEtHours(8);
                                setNewEtBreakThreshold(5);
                              }}
                              className="px-3 border border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold h-9 rounded-xl text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors uppercase"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                    {/* Table */}
                    <div className="lg:col-span-2 overflow-x-auto border border-zinc-100 dark:border-zinc-850 rounded-xl">
                      <table className="w-full text-left border-collapse font-sans text-xs">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-955 border-b border-zinc-150 dark:border-zinc-800 text-zinc-405 dark:text-zinc-500 font-bold uppercase tracking-wider text-[9px]">
                            <th className="px-4 py-3">Type Name</th>
                            <th className="px-4 py-3">Standard Shift Hours</th>
                            <th className="px-4 py-3">Break Trigger Threshold</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-medium text-[11px] sm:text-xs">
                          {employmentTypes.map(et => {
                            const isCore = et.name === "Full-Time" || et.name === "Part-Time";
                            return (
                              <tr key={et.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 transition-colors">
                                <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-105">
                                  {et.name} {isCore && <span className="text-[9px] uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 ml-1 rounded-none">Core</span>}
                                </td>
                                <td className="px-4 py-3 font-mono text-zinc-650 dark:text-zinc-400">{et.standardHours} hours/day</td>
                                <td className="px-4 py-3 font-mono text-zinc-650 dark:text-zinc-400">&gt;= {et.minHoursForBreak} hours</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingEtId(et.id);
                                        setNewEtName(et.name);
                                        setNewEtHours(et.standardHours);
                                        setNewEtBreakThreshold(et.minHoursForBreak);
                                      }}
                                      className="p-1.5 text-zinc-650 hover:text-white border border-zinc-200 dark:border-zinc-800 hover:bg-amber-500 hover:border-amber-500 rounded-lg cursor-pointer transition-all"
                                      title="Edit"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteEmploymentType(et.id, et.name)}
                                      className="p-1.5 text-red-500 hover:text-white border border-red-200 dark:border-red-900/40 hover:bg-red-500 hover:border-red-500 rounded-lg cursor-pointer transition-all"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Section 2: Departments */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-amber-500" /> Configure Departments
                    </h3>
                    <div className="space-y-4">
                      {/* Form */}
                      <form onSubmit={handleCreateDepartment} className="flex gap-2 text-xs">
                        <input
                          required
                          type="text"
                          placeholder="E.g. Sales Section"
                          value={newDeptName}
                          onChange={e => setNewDeptName(e.target.value)}
                          className="flex-1 h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                        />
                        <button
                          type="submit"
                          disabled={isSavingDept}
                          className="px-4 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-950 text-white font-bold h-10 rounded-xl cursor-pointer transition-all uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                        >
                          {isSavingDept && <span className="h-3 w-3 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin"></span>}
                          {editingDeptId ? "Update" : "Add"}
                        </button>
                        {editingDeptId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDeptId(null);
                              setNewDeptName("");
                            }}
                            className="px-3 border border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold h-10 rounded-xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors uppercase shrink-0"
                          >
                            Cancel
                          </button>
                        )}
                      </form>
                      {/* List */}
                      <div className="border border-zinc-100 dark:border-zinc-850 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-left border-collapse font-sans text-xs">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-150 dark:border-zinc-800 text-zinc-405 dark:text-zinc-500 font-bold uppercase tracking-wider text-[9px]">
                              <th className="px-4 py-3">Department Name</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-medium text-[11px] sm:text-xs">
                            {departments.map(d => {
                              const isCore = [
                                "Stitching Section",
                                "Quality Assurance",
                                "Cutting Department",
                                "Finishing Section",
                                "House Keeping",
                                "Others"
                              ].includes(d.name);
                              return (
                                <tr key={d.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 transition-colors">
                                  <td className="px-4 py-2.5 font-bold text-zinc-900 dark:text-zinc-105">
                                    {d.name} {isCore && <span className="text-[9px] uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 ml-1 rounded-none">Core</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <div className="inline-flex gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDeptId(d.id);
                                          setNewDeptName(d.name);
                                        }}
                                        className="p-1.5 text-zinc-650 hover:text-white border border-zinc-200 dark:border-zinc-800 hover:bg-amber-500 hover:border-amber-500 rounded-lg cursor-pointer transition-all"
                                        title="Edit"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDepartment(d.id, d.name)}
                                        className="p-1.5 text-red-500 hover:text-white border border-red-200 dark:border-red-900/40 hover:bg-red-550 rounded-lg cursor-pointer transition-all"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Pay Structures */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-amber-500" /> Configure Pay Structures
                    </h3>
                    <div className="space-y-4">
                      {/* Form */}
                      <form onSubmit={handleCreatePayStructure} className="space-y-3 pt-1 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-zinc-400">Name</label>
                            <input
                              required
                              type="text"
                              placeholder="E.g. Daily Wage"
                              value={newPsName}
                              onChange={e => setNewPsName(e.target.value)}
                              className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-zinc-400">Days per Period</label>
                            <input
                              required
                              type="number"
                              min="0"
                              max="365"
                              placeholder="26"
                              value={newPsDays}
                              onChange={e => setNewPsDays(e.target.value)}
                              className="w-full h-10 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-855 rounded-xl px-3 focus:outline-none focus:border-amber-500 transition-colors font-semibold"
                            />
                          </div>
                        </div>
                        <span className="text-[9px] text-zinc-450 dark:text-zinc-500 block leading-tight">
                          Set to 0 if Hourly pay. Standard Weekly is 6; Monthly is 26.
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isSavingPs}
                            className="flex-1 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-950 text-white font-bold h-10 rounded-xl cursor-pointer transition-all uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            {isSavingPs && <span className="h-3.5 w-3.5 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin"></span>}
                            {editingPsId ? "Update Pay Structure" : "Add Pay Structure"}
                          </button>
                          {editingPsId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPsId(null);
                                setNewPsName("");
                                setNewPsDays(26);
                              }}
                              className="px-3 border border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold h-10 rounded-xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors uppercase"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </form>
                      {/* List */}
                      <div className="border border-zinc-100 dark:border-zinc-850 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-left border-collapse font-sans text-xs">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-955 border-b border-zinc-150 dark:border-zinc-800 text-zinc-405 dark:text-zinc-500 font-bold uppercase tracking-wider text-[9px]">
                              <th className="px-4 py-3">Structure Name</th>
                              <th className="px-4 py-3">Days Divisor</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-medium text-[11px] sm:text-xs">
                            {payStructures.map(ps => {
                              const isCore = ["Monthly", "Weekly", "Hourly"].includes(ps.name);
                              return (
                                <tr key={ps.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 transition-colors">
                                  <td className="px-4 py-2.5 font-bold text-zinc-900 dark:text-zinc-105">
                                    {ps.name} {isCore && <span className="text-[9px] uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 ml-1 rounded-none">Core</span>}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-zinc-650 dark:text-zinc-400">
                                    {ps.daysPerPeriod > 0 ? `${ps.daysPerPeriod} days` : "Hourly"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <div className="inline-flex gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPsId(ps.id);
                                          setNewPsName(ps.name);
                                          setNewPsDays(ps.daysPerPeriod);
                                        }}
                                        className="p-1.5 text-zinc-650 hover:text-white border border-zinc-200 dark:border-zinc-800 hover:bg-amber-500 hover:border-amber-500 rounded-lg cursor-pointer transition-all"
                                        title="Edit"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePayStructure(ps.id, ps.name)}
                                        className="p-1.5 text-red-500 hover:text-white border border-red-200 dark:border-red-900/40 hover:bg-red-550 rounded-lg cursor-pointer transition-all"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ===================================== */}
        {/*          EMPLOYEE PORTAL PANEL        */}
        {/* ===================================== */}
        {currentRole === "Employee" && currentEmployee && (
          <div className="space-y-4 animate-in fade-in duration-200 text-left max-w-xl mx-auto">

            {/* ── Profile Header Card ─────────────────────── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                {currentEmployee.profilePhoto ? (
                  <img 
                    src={currentEmployee.profilePhoto} 
                    alt={currentEmployee.name} 
                    className="h-10 w-10 object-cover border border-zinc-200 dark:border-zinc-800 shrink-0" 
                  />
                ) : (
                  <div className={`h-10 w-10 bg-gradient-to-br ${getAvatarBg(currentEmployee.name)} text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0`}>
                    {getInitials(currentEmployee.name)}
                  </div>
                )}
                <div>
                  <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50 leading-none">
                    {currentEmployee.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-1.5 leading-none">
                    {currentEmployee.code} · {currentEmployee.designation}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                  isCurrentlyClocked ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                }`}>
                  <span className={`h-1 w-1 rounded-full mr-1.5 ${isCurrentlyClocked ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`}></span>
                  {isCurrentlyClocked ? "On Shift" : latestTodayLog?.status === "Clocked Out" ? "Done" : "Offline"}
                </span>
              </div>
            </div>

            {/* ── Section Tab Bar ──────────────────────────── */}
            <div className="flex bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-250/60 dark:border-zinc-800/80 p-1 rounded-xl">
              {([
                { id: "attendance", label: "Attendance" },
                { id: "log",        label: "Log Work"   },
                { id: "history",    label: "History"    },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setEmpSection(tab.id)}
                  className={`flex-1 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    empSection === tab.id
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs"
                      : "text-zinc-450 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ══════════════════════════════════════════════ */}
            {/*   SECTION 1: ATTENDANCE                       */}
            {/* ══════════════════════════════════════════════ */}
            {empSection === "attendance" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">

                {/* Live Clock Card */}
                <div className="px-5 py-6 flex flex-col items-center gap-1 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-950/20">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-0.5">
                    <AlarmClock className="h-3.5 w-3.5 text-amber-500" /> Current Local Time
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums tracking-tight font-mono leading-none">
                    {isMounted ? liveTime : "—"}
                  </span>
                  <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-medium mt-1.5">
                    {isMounted ? new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}
                  </span>
                </div>

                {/* Today's Punch Summary Progress */}
                {todayAttendanceLogs.length > 0 && (
                  <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 space-y-3">
                    {/* Total effective row */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Total Effective Today
                      </span>
                      <span className="font-bold text-base font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                        {isMounted ? fmtMs(effectiveMsToday) : "00h 00m 00s"}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${effectiveMsToday >= 8 * 3600000 ? "bg-gradient-to-r from-emerald-500 to-green-400 shadow-sm" : "bg-gradient-to-r from-amber-400 to-emerald-400 shadow-sm"}`}
                          style={{ width: `${Math.min(100, (effectiveMsToday / (8 * 3600000)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <p className="text-zinc-400 dark:text-zinc-500 font-mono">
                          {Math.min(100, Math.floor((effectiveMsToday / (8 * 3600000)) * 100))}% of 8h shift
                        </p>
                        {effectiveMsToday >= 8 * 3600000 && (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">✓ Shift Target Met</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Clock In / Clock Out Action Button */}
                <div className="p-4 sm:p-5">
                  {isCurrentlyClocked ? (
                    /* Currently on shift — show Check Out (Red Button) */
                    <button
                      onClick={() => handleClockOut()}
                      disabled={isClocking}
                      className="w-full py-3.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold rounded-xl cursor-pointer transition-all uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2 shadow-md shadow-red-650/10 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Timer className="h-4 w-4" />
                      {isClocking ? "Checking Out..." : "Clock Out / Check Out"}
                    </button>
                  ) : (
                    /* Not on shift — show Check In (Green Button) */
                    <button
                      onClick={() => handleClockIn()}
                      disabled={isClocking}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white font-bold rounded-xl cursor-pointer transition-all uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-650/10 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Fingerprint className="h-4 w-4" />
                      {isClocking ? "Checking In..." : "Clock In / Check In"}
                    </button>
                  )}
                </div>

                {/* Success message */}
                {submitSuccessMsg && (
                  <div className="mx-4 mb-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-2.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    {submitSuccessMsg}
                  </div>
                )}
              </div>
            )}


            {/* ══════════════════════════════════════════════ */}
            {/*   SECTION 2: LOG TIMESHEET                    */}
            {/* ══════════════════════════════════════════════ */}
            {empSection === "log" && (
              <div
                id="timesheet-form-section"
                className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs animate-in fade-in slide-in-from-top-1 duration-200"
              >
                {/* Form Header */}
                <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
                        {editingTimesheetId ? "✏️ Edit Work Log" : "📋 Log Today's Work"}
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-mono">
                        {timesheetDate || getLocalTodayString()}
                      </p>
                    </div>
                    {editingTimesheetId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-zinc-250 dark:border-zinc-850 px-2.5 py-1 rounded-lg uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {/* Attendance summary inline hint */}
                  {todayAttendanceLogs.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-bold text-zinc-450 dark:text-zinc-500 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 px-3 py-2 rounded-xl">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-500" />
                        First In: <span className="text-zinc-705 dark:text-zinc-300 font-mono ml-0.5">{todayAttendanceLogs[0]?.checkIn || "—"}</span>
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span className="flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5 text-red-400" />
                        Last Out: <span className="text-zinc-705 dark:text-zinc-300 font-mono ml-0.5">
                          {(() => {
                            const lastCheckOut = [...todayAttendanceLogs].reverse().find(p => p.checkOut)?.checkOut;
                            return lastCheckOut || (isCurrentlyClocked ? "Active" : "—");
                          })()}
                        </span>
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span className="text-zinc-705 dark:text-zinc-300 font-mono flex items-center gap-1">
                        Total Clocked: <strong className="font-extrabold">{isMounted ? fmtMs(effectiveMsToday) : "00h 00m 00s"}</strong>
                      </span>
                    </div>
                  )}
                  {todayAttendanceLogs.length === 0 && (
                    <div className="mt-2.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                      ⚠ You haven't clocked in today yet.
                    </div>
                  )}
                </div>

                {/* Form Body */}
                <form onSubmit={handleTimesheetSubmit} className="px-4 py-4 space-y-4">

                  {/* Work Entries */}
                  <div className="space-y-3">
                    {timesheetEntries.map((row, idx) => (
                      <div key={idx} className="space-y-2.5">

                        {/* Description */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" /> Work Description
                          </label>
                          <textarea
                            required
                            rows={4}
                            placeholder="Describe the work you did today — e.g. 'Completed collar stitching for 12 units of ORD-002 Linen Blazer'"
                            value={row.description}
                            onChange={e => {
                              const copy = [...timesheetEntries];
                              copy[idx].description = e.target.value;
                              setTimesheetEntries(copy);
                            }}
                            className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl p-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 resize-y focus:outline-none placeholder-zinc-300 dark:placeholder-zinc-700 transition-colors leading-relaxed"
                          />
                        </div>

                        {/* Proof Photos */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1.5">
                            <Camera className="h-3.5 w-3.5" /> Proof Photos
                            <span className="normal-case font-medium text-zinc-300 dark:text-zinc-650 ml-1">(optional)</span>
                          </label>
                          <div className="flex flex-wrap gap-2 items-center">
                            {(row.images || []).map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="relative group shrink-0">
                                <img
                                  src={imgUrl}
                                  alt="Proof"
                                  className="h-14 w-14 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-85 transition-opacity"
                                  onClick={() => handleOpenPreview(row.images || [], imgIdx)}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...timesheetEntries];
                                    copy[idx].images = (copy[idx].images || []).filter((_, i) => i !== imgIdx);
                                    setTimesheetEntries(copy);
                                  }}
                                  className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs font-bold"
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            {/* Upload trigger */}
                            <label className={`relative h-14 w-14 border-2 border-dashed border-zinc-305 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={isUploading}
                                onClick={e => { (e.currentTarget as HTMLInputElement).value = ""; }}
                                onChange={async e => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 0) {
                                    setIsUploading(true);
                                    try {
                                      const compressed = await Promise.all(files.map(f => compressImage(f)));
                                      const urls = await Promise.all(compressed.map(b64 => uploadToCloud(b64)));
                                      const copy = [...timesheetEntries];
                                      copy[idx].images = [...(copy[idx].images || []), ...urls];
                                      setTimesheetEntries(copy);
                                    } catch {
                                      showToast("Image upload failed.", "error");
                                    } finally {
                                      setIsUploading(false);
                                      e.target.value = "";
                                    }
                                  }
                                }}
                                className="sr-only"
                              />
                              {isUploading ? (
                                <span className="text-[9px] text-zinc-400 dark:text-zinc-550 font-bold text-center leading-tight">Wait...</span>
                              ) : (
                                <>
                                  <Camera className="h-4 w-4 text-zinc-400" />
                                  <span className="text-[8px] text-zinc-400 dark:text-zinc-500 font-bold mt-0.5">Add</span>
                                </>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Submit / Update Button */}
                  <div className="pt-3.5 border-t border-zinc-150 dark:border-zinc-800/85">
                    {submitSuccessMsg && (
                      <div className="mb-3 bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-250 dark:border-emerald-900/40 p-2.5 rounded-xl text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                        {submitSuccessMsg}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="w-full py-3.5 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-950 text-white font-black rounded-xl cursor-pointer transition-all uppercase tracking-widest text-xs shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      {editingTimesheetId ? "Update Work Log" : "Submit Work Log"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── SECTION 3: HISTORY ────────────────────────── */}
            {empSection === "history" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">

                <div className="px-4 py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">My Work History</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-mono">{employeeTimesheets.length} log{employeeTimesheets.length !== 1 ? "s" : ""} recorded</p>
                  </div>
                  {/* Summary stats */}
                  <div className="text-right flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-150 dark:border-zinc-850 shadow-xs">
                    <div>
                      <p className="text-lg font-black text-zinc-900 dark:text-zinc-50 font-mono tabular-nums leading-none">
                        {employeeTimesheets.reduce((s, ts) => s + ts.entries.reduce((es, e) => es + e.hours, 0), 0).toFixed(1)}
                      </p>
                      <p className="text-[8px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider mt-1 text-center">Total Hrs</p>
                    </div>
                  </div>
                </div>

                {employeeTimesheets.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <History className="h-8 w-8 text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-xs text-zinc-450 dark:text-zinc-500 font-bold">No work logs yet.</p>
                    <button
                      onClick={() => setEmpSection("log")}
                      className="mt-3 text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer transition-colors"
                    >
                      Submit your first log →
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {employeeTimesheets.map(ts => {
                      const totalHours = ts.entries.reduce((sum, e) => sum + e.hours, 0);
                      const isExpanded = !!expandedTimesheets[ts.id];
                      const isToday = ts.date === getLocalTodayString();

                      return (
                        <div key={ts.id}>
                          {/* Row header — click to expand */}
                          <button
                            type="button"
                            onClick={() => setExpandedTimesheets(prev => ({ ...prev, [ts.id]: !prev[ts.id] }))}
                            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50/55 dark:hover:bg-zinc-800/25 transition-colors cursor-pointer text-left focus:outline-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-2 w-2 rounded-full shrink-0 ${isToday ? "bg-amber-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-700"}`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono leading-none">{ts.date}</p>
                                  {isToday ? (
                                    <span className="text-[8px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded font-black uppercase tracking-wider leading-none">Today</span>
                                  ) : (
                                    <span className="text-[8px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700/80 px-1.5 py-0.5 rounded font-black uppercase tracking-wider leading-none flex items-center gap-0.5">
                                      <Lock className="h-2 w-2" />Locked
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-550 font-mono mt-1 leading-none">
                                  {ts.entries.length} log entr{ts.entries.length !== 1 ? "ies" : "y"} · Sub {ts.submittedAt}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 border border-zinc-150 dark:border-zinc-850 rounded-lg">
                                {totalHours.toFixed(1)}<span className="text-[9px] text-zinc-400 font-bold ml-0.5">h</span>
                              </span>
                              {isExpanded
                                ? <ChevronUp className="h-4 w-4 text-zinc-400" />
                                : <ChevronDown className="h-4 w-4 text-zinc-400" />
                              }
                            </div>
                          </button>

                          {/* Expanded entries */}
                          {isExpanded && (
                            <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border-t border-zinc-100 dark:border-zinc-800/80 px-4 py-4 space-y-4 animate-in slide-in-from-top-1 duration-150">
                              
                              {/* Work Details Section */}
                              <div className="space-y-3">
                                <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 dark:border-zinc-850 pb-1.5">
                                  Work Details
                                </p>
                                {ts.entries.map((entry, idx) => (
                                  <div key={entry.id || idx} className="relative pl-4 border-l-2 border-zinc-100 dark:border-zinc-800/80 py-1 space-y-1">
                                    <span className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                    <div className="flex justify-between items-start gap-4 text-xs">
                                      <p className="flex-1 text-zinc-650 dark:text-zinc-400 font-medium leading-relaxed">
                                        {entry.description}
                                      </p>
                                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 shrink-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 px-2 py-0.5 rounded text-[10px]">
                                        {entry.hours}h
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Proof Images Section */}
                              {(() => {
                                const allImages = ts.entries.flatMap(entry => entry.images || []);
                                if (allImages.length === 0) return null;
                                return (
                                  <div className="space-y-3">
                                    <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 dark:border-zinc-850 pb-1.5">
                                      Proof Images
                                    </p>
                                    <div className="flex flex-wrap gap-2 pt-0.5">
                                      {allImages.map((url, i) => (
                                        <div key={i} className="relative group shrink-0">
                                          <img
                                            src={url}
                                            alt="Proof"
                                            className="h-14 w-14 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:scale-105 transition-all shadow-xs"
                                            onClick={() => handleOpenPreview(allImages, i)}
                                          />
                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-lg">
                                            <Eye className="h-4 w-4 text-white" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Edit button — only today's logs */}
                              {isToday && (
                                <div className="pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800/80 flex justify-between items-center">
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Total: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{totalHours}h</strong></span>
                                  <button
                                    onClick={() => {
                                      handleStartEditTimesheet(ts);
                                      setEmpSection("log");
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white uppercase tracking-wider rounded-lg cursor-pointer transition-all shadow-sm shadow-amber-500/10"
                                  >
                                    <Pencil className="h-3 w-3" /> Edit Work Log
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </main>

      {/* Image Preview Modal */}
      {activePreviewImages.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActivePreviewImages([])}
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-3.5 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col relative shadow-xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2.5 border-b border-zinc-150 dark:border-zinc-850">
              <span className="font-bold text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Work Proof Image ({activePreviewIndex + 1} of {activePreviewImages.length})
              </span>
              <button 
                onClick={() => setActivePreviewImages([])}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer flex items-center gap-1 focus:outline-none"
              >
                <X className="h-4 w-4" /> Close
              </button>
            </div>
            <div className="relative flex-1 overflow-hidden mt-3 flex items-center justify-center bg-zinc-50 dark:bg-zinc-955 rounded-xl min-h-[300px] border border-zinc-100 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={activePreviewImages[activePreviewIndex]} 
                alt="Attachment Proof Preview" 
                className="max-h-[60vh] object-contain rounded-lg select-none" 
              />

              {/* Navigation arrows */}
              {activePreviewImages.length > 1 && (
                <>
                  {/* Prev Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePreviewIndex(prev => (prev === 0 ? activePreviewImages.length - 1 : prev - 1));
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center text-lg font-black transition-all cursor-pointer select-none backdrop-blur-xs shadow-xs focus:outline-none"
                    title="Previous Image"
                  >
                    ‹
                  </button>
                  {/* Next Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePreviewIndex(prev => (prev === activePreviewImages.length - 1 ? 0 : prev + 1));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center text-lg font-black transition-all cursor-pointer select-none backdrop-blur-xs shadow-xs focus:outline-none"
                    title="Next Image"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Employee Admin Management Modal */}
      {selectedAdminEmp && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedAdminEmp(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-5 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col relative text-left shadow-xl animate-in zoom-in-95 duration-200 space-y-4" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-zinc-150 dark:border-zinc-850">
              <div>
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-50 uppercase tracking-wider block">
                  Manage Staff
                </span>
                <span className="text-[10px] text-zinc-405 dark:text-zinc-500 font-mono font-semibold mt-0.5 block">
                  {selectedAdminEmp.name} ({selectedAdminEmp.code})
                </span>
              </div>
              <button 
                onClick={() => setSelectedAdminEmp(null)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer flex items-center gap-1 focus:outline-none"
              >
                <X className="h-4 w-4" /> Close
              </button>
            </div>

            <div className="space-y-4 pt-1 text-xs">
              {/* Profile Details Card */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200/60 dark:border-zinc-850 rounded-xl space-y-1.5 shadow-2xs">
                <p className="text-zinc-450 dark:text-zinc-500 font-bold uppercase text-[9px] tracking-wider leading-none">Staff Profile</p>
                <p className="font-bold text-sm text-zinc-900 dark:text-zinc-105 leading-none">{selectedAdminEmp.name}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Department: <strong className="text-zinc-700 dark:text-zinc-350">{selectedAdminEmp.department}</strong></p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Designation: <strong className="text-zinc-700 dark:text-zinc-350">{selectedAdminEmp.designation}</strong></p>
              </div>

              {/* Attendance management */}
              {(() => {
                const todayPunches = getEmployeeTodayPunches(selectedAdminEmp.id);
                const latestLog = getEmployeeLatestPunch(selectedAdminEmp.id);
                const isCurrentlyClockedIn = latestLog?.status === "Clocked In";
                const totalMs = getEmployeeEffectiveMsToday(selectedAdminEmp.id);

                return (
                  <div className="p-3 border border-zinc-200/60 dark:border-zinc-800 rounded-xl space-y-3.5">
                    <p className="text-zinc-450 dark:text-zinc-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5 leading-none">
                      <Fingerprint className="h-3.5 w-3.5 text-amber-500" /> Today's Attendance Status
                    </p>
                    
                    <div className="bg-zinc-50 dark:bg-zinc-950 p-3 border border-zinc-150 dark:border-zinc-850 rounded-lg space-y-2.5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-mono leading-none">Current Status</p>
                          <p className={`font-bold text-[11px] uppercase mt-1 leading-none ${isCurrentlyClockedIn ? "text-green-600 dark:text-green-400 animate-pulse" : "text-zinc-500"}`}>
                            {isCurrentlyClockedIn ? "Clocked In" : todayPunches.length > 0 ? "Clocked Out" : "Absent"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-mono leading-none">Effective Today</p>
                          <p className="font-bold text-xs font-mono tabular-nums text-zinc-850 dark:text-zinc-100 mt-1 leading-none">
                            {isMounted ? fmtMs(totalMs) : "00h 00m 00s"}
                          </p>
                        </div>
                      </div>

                      {todayPunches.length > 0 && (
                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 text-[10px] text-zinc-455 dark:text-zinc-500 space-y-1">
                          <p className="font-bold uppercase text-[8px] tracking-wider text-zinc-400 mb-1 leading-none">Today's Punch History:</p>
                          {todayPunches.map((log, pIdx) => (
                            <div key={log.id} className="flex justify-between items-center font-mono text-[9px]">
                              <span>Punch {pIdx + 1}:</span>
                              <span>{log.checkIn || "—"} → {log.checkOut || (log.status === "Clocked In" ? "now…" : "—")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick check-in/out trigger buttons */}
                    <div className="flex gap-2">
                      {!isCurrentlyClockedIn ? (
                        <button
                          onClick={() => handleClockIn(selectedAdminEmp.id)}
                          disabled={isClocking}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                        >
                          <Fingerprint className="h-3.5 w-3.5" />
                          Check In Staff
                        </button>
                      ) : (
                        <button
                          onClick={() => handleClockOut(selectedAdminEmp.id)}
                          disabled={isClocking}
                          className="w-full py-2.5 bg-gradient-to-r from-red-600 to-orange-550 hover:from-red-700 hover:to-orange-650 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                        >
                          <Timer className="h-3.5 w-3.5" />
                          Check Out Staff
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Submit Work Log on Behalf of Staff */}
              <form onSubmit={handleAdminTimesheetSubmit} className="p-3 border border-zinc-200/60 dark:border-zinc-800 rounded-xl space-y-3.5">
                <p className="text-zinc-450 dark:text-zinc-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5 leading-none">
                  <FileText className="h-3.5 w-3.5 text-zinc-400" /> Log Work on Behalf
                </p>

                <div className="space-y-2.5">
                  {adminTimesheetEntries.map((row, idx) => (
                    <div key={idx} className="space-y-2.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-555">Work Description</label>
                        <textarea
                          required
                          rows={3}
                          placeholder="Describe the work done by this staff member..."
                          value={row.description}
                          onChange={e => {
                            const copy = [...adminTimesheetEntries];
                            copy[idx].description = e.target.value;
                            setAdminTimesheetEntries(copy);
                          }}
                          className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-semibold text-zinc-850 dark:text-zinc-200 resize-y focus:outline-none focus:border-amber-500 transition-colors placeholder-zinc-300 dark:placeholder-zinc-700"
                        />
                      </div>

                      {/* Proof photos upload */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-550">Proof Photos</label>
                        <div className="flex flex-wrap gap-2 items-center">
                          {(row.images || []).map((imgUrl, imgIdx) => (
                            <div key={imgIdx} className="relative group shrink-0">
                              <img
                                src={imgUrl}
                                alt="Proof"
                                className="h-10 w-10 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-85 transition-opacity"
                                onClick={() => handleOpenPreview(row.images || [], imgIdx)}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = [...adminTimesheetEntries];
                                  copy[idx].images = (copy[idx].images || []).filter((_, i) => i !== imgIdx);
                                  setAdminTimesheetEntries(copy);
                                }}
                                className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center cursor-pointer shadow-xs font-bold"
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          <label className={`relative h-10 w-10 border-2 border-dashed border-zinc-305 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors ${isUploading ? "opacity-50" : ""}`}>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={isUploading}
                              onClick={e => { (e.currentTarget as HTMLInputElement).value = ""; }}
                              onChange={async e => {
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                  setIsUploading(true);
                                  try {
                                    const compressed = await Promise.all(files.map(f => compressImage(f)));
                                    const urls = await Promise.all(compressed.map(b64 => uploadToCloud(b64)));
                                    const copy = [...adminTimesheetEntries];
                                    copy[idx].images = [...(copy[idx].images || []), ...urls];
                                    setAdminTimesheetEntries(copy);
                                  } catch {
                                    showToast("Image upload failed.", "error");
                                  } finally {
                                    setIsUploading(false);
                                    e.target.value = "";
                                  }
                                }
                              }}
                              className="hidden"
                            />
                            <Camera className="h-3 w-3 text-zinc-400" />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmittingTimesheet}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold text-[10px] uppercase tracking-wide cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingTimesheet && (
                    <span className="h-3.5 w-3.5 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin"></span>
                  )}
                  {isSubmittingTimesheet 
                    ? (editingAdminTimesheetId ? "Updating..." : "Submitting...") 
                    : (editingAdminTimesheetId ? "Update Work Log" : "Submit Work Log")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
