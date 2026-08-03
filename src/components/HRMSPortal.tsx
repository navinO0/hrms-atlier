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
  TrendingUp
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
  resetDatabaseAction
} from "@/app/actions";

interface Employee {
  id: string;
  name: string;
  code: string;
  department: string;
  designation: string;
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

interface HRMSPortalProps {
  initialEmployees: Employee[];
  initialAttendance: AttendanceLog[];
  initialTimesheets: Timesheet[];
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


export default function HRMSPortal({
  initialEmployees,
  initialAttendance,
  initialTimesheets,
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
  const [adminTab, setAdminTab] = useState<"status" | "logs" | "roster">("status");
  const [activePreviewImages, setActivePreviewImages] = useState<string[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  const handleOpenPreview = (images: string[], index: number) => {
    setActivePreviewImages(images);
    setActivePreviewIndex(index);
  };
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isClocking, setIsClocking] = useState<boolean>(false);

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
        const res = await editEmployeeAction(editingEmployeeId, empFormName, empFormCode, empFormDept, empFormDesg, empFormPassword);
        if (res.success) {
          setEmpFormName("");
          setEmpFormCode("");
          setEmpFormPassword("");
          setEditingEmployeeId(null);
          showToast(`Employee "${empFormName}" updated successfully!`, "success");
          window.location.reload();
        } else {
          showToast(res.error || "Failed to update employee.", "error");
        }
      } else {
        const res = await addEmployeeAction(empFormName, empFormCode, empFormDept, empFormDesg, empFormPassword);
        if (res.success) {
          setEmpFormName("");
          setEmpFormCode("");
          setEmpFormPassword("");
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
    setAdminTimesheetEntries([{ orderId: "ord-1", description: "", hours: 4, images: [] }]);
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
    if (!selectedAdminEmp) return;

    // Validate entries
    const invalid = adminTimesheetEntries.some(t => !t.description.trim());
    if (invalid) {
      showToast("Please write a description of the work.", "error");
      return;
    }

    const timeStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (editingAdminTimesheetId) {
      const res = await updateTimesheetAction(editingAdminTimesheetId, adminTimesheetDate, adminTimesheetEntries, timeStr + " (Updated)");
      if (res.success && res.timesheet) {
        setTimesheets(prev => prev.map(ts => ts.id === editingAdminTimesheetId ? (res.timesheet as unknown as Timesheet) : ts));
        setEditingAdminTimesheetId(null);
        setAdminTimesheetEntries([{ description: "", images: [] }]);
        showToast(`Work log updated for ${selectedAdminEmp.name}!`, "success");
      } else {
        showToast((res.error || "Update failed."), "error");
      }
    } else {
      const res = await submitTimesheetAction(selectedAdminEmp.id, adminTimesheetDate, adminTimesheetEntries, timeStr);
      if (res.success && res.timesheet) {
        setTimesheets(prev => [res.timesheet as unknown as Timesheet, ...prev]);
        setAdminTimesheetEntries([{ description: "", images: [] }]);
        showToast(`Work log submitted for ${selectedAdminEmp.name}!`, "success");
      } else {
        const res = await submitTimesheetAction(selectedAdminEmp.id, adminTimesheetDate, adminTimesheetEntries, timeStr);
        if (res.success && res.timesheet) {
          setTimesheets(prev => [res.timesheet as unknown as Timesheet, ...prev]);
          setAdminTimesheetEntries([{ description: "", images: [] }]);
          showToast(`Work log submitted for ${selectedAdminEmp.name}!`, "success");
        } else {
          showToast((res.error || "Submit failed."), "error");
        }
      }
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-white to-zinc-50 text-zinc-800 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        <Toaster richColors position="top-right" closeButton swipeDirections={["top", "left", "right"]} />
        
        {/* Decorative Background blur blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-none blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-none blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-white border border-zinc-200 p-6 sm:p-8 rounded-none shadow-2xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Logo / Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-250 px-3 py-1 rounded-none text-[10px] font-black text-amber-700 uppercase tracking-widest shadow-sm">
              <span className="h-1.5 w-1.5 rounded-none bg-amber-500 animate-pulse"></span>
              Security verification
            </div>
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight mt-1">Staff Portal</h1>
            <p className="text-xs text-zinc-500">Garment Production Management System</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-none text-xs font-semibold text-center animate-in fade-in slide-in-from-top-1 duration-200">
                {loginError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
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
                  className="w-full h-11 bg-zinc-50/50 border border-zinc-200 hover:border-zinc-350 focus:border-amber-500/80 rounded-none pl-11 pr-4 focus:outline-none text-sm font-medium text-zinc-900 placeholder-zinc-400 transition-all focus:bg-white focus:shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
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
                  className="w-full h-11 bg-zinc-50/50 border border-zinc-200 hover:border-zinc-350 focus:border-amber-500/80 rounded-none pl-11 pr-11 focus:outline-none text-sm font-medium text-zinc-900 placeholder-zinc-400 transition-all focus:bg-white focus:shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650 transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 disabled:opacity-75 disabled:cursor-not-allowed active:scale-[0.98] text-white font-black rounded-none text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/15 cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {isLoggingIn ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <UserCheck className="h-4 w-4 text-white" />
              )}
              {isLoggingIn ? "Signing In..." : "Sign In"}
            </button>
          </form>

          {/* Quick Persistent Login section */}
          {lastLoginCode && (
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-none space-y-2.5 text-xs text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Saved Session</span>
                <button
                  type="button"
                  onClick={handleClearLastLogin}
                  className="text-[9px] uppercase font-black text-red-500 hover:text-red-700 tracking-wider transition-colors cursor-pointer"
                >
                  Clear History
                </button>
              </div>
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={handleProceedLastLogin}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-extrabold text-[10px] uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isLoggingIn ? (
                  <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <UserCheck className="h-3.5 w-3.5" />
                )}
                {isLoggingIn ? "Logging In..." : `Proceed as ${lastLoginCode}`}
              </button>
            </div>
          )}

          {/* Helper details */}
          <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-none text-[11px] text-zinc-550 space-y-2.5 leading-relaxed">
            <span className="font-extrabold uppercase text-amber-600 tracking-wider text-[10px] flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
              Sign In Credentials Reference
            </span>
            <p>Admin Profile: Use username <strong className="text-zinc-800 font-mono font-bold">admin</strong> and password <strong className="text-zinc-800 font-mono font-bold">admin</strong>.</p>
            <p>Employee Profiles: Enter employee code as username, and password <strong className="text-zinc-800 font-mono font-bold">password</strong>.</p>
            <div className="pt-1.5 border-t border-zinc-200">
              <span className="text-[9px] uppercase font-bold text-zinc-400 block mb-1.5">Available Employee Codes:</span>
              <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                {employees.length > 0 ? (
                  employees.slice(0, 4).map(emp => (
                    <span key={emp.id} className="bg-white border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-none hover:border-amber-500/40 transition-colors">{emp.code} ({emp.name.split(" ")[0]})</span>
                  ))
                ) : (
                  <>
                    <span className="bg-white border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-none">EMP-101 (Amit)</span>
                    <span className="bg-white border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-none">EMP-102 (Priya)</span>
                    <span className="bg-white border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-none">EMP-103 (Sunita)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-955 text-zinc-800 dark:text-zinc-200">
      <Toaster richColors position="top-right" closeButton swipeDirections={["top", "left", "right"]} />
      
      {/* Sleek Minimalist Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-150 dark:border-zinc-850 bg-white dark:bg-zinc-900 px-2 py-1.5 flex justify-between items-center gap-1.5">
        
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <p className="text-[10px] sm:text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Staff Portal</p>
        </div>

        {/* User context & Logout */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/40 px-1.5 py-0.5 rounded-none">
            <span className={`h-1 w-1 rounded-full ${session.authRole === "Admin" ? "bg-amber-550 animate-pulse" : "bg-emerald-500"}`}></span>
            <span className="text-[8px] sm:text-[9px] font-bold text-zinc-650 dark:text-zinc-300">
              {session.authRole === "Admin" ? "Admin" : `${currentEmployee?.name} (${currentEmployee?.code})`}
            </span>
          </div>



          <button
            onClick={handleLogout}
            className="px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold text-red-500 hover:text-red-650 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-none cursor-pointer transition-all uppercase tracking-wider flex items-center gap-0.5"
          >
            <LogOut className="h-2.5 w-2.5" />
            Logout
          </button>
        </div>

      </header>

      {/* Main Page Layout Container */}
      <main className="max-w-5xl mx-auto p-2.5 space-y-3">
        
        {/* ===================================== */}
        {/*           ADMIN CONSOLE PANEL         */}
        {/* ===================================== */}
        {currentRole === "Admin" && (
          <div className="space-y-3 animate-in fade-in duration-150">
            
            {/* Minimal KPI Stats Row */}
            <div className="grid grid-cols-2 gap-2 text-left">
              <div className="bg-white dark:bg-zinc-900 p-2 border border-zinc-200 dark:border-zinc-800 rounded-none-none shadow-sm">
                <span className="text-[10px] text-zinc-455 dark:text-zinc-500 font-bold uppercase tracking-wider block">Total Roster</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-550 block mt-0.5">{employees.length} operators</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-2 border border-zinc-200 dark:border-zinc-800 rounded-none-none shadow-sm">
                <span className="text-[10px] text-zinc-455 dark:text-zinc-500 font-bold uppercase tracking-wider block">Today Present</span>
                <span className="text-base font-bold text-emerald-600 block mt-0.5">
                  {attendance.filter(a => a.date === getLocalTodayString() && a.status === "Clocked In").length} active
                </span>
              </div>
            </div>

            {/* Admin Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-[8px] sm:text-[9px] font-bold gap-2 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap">
              <button 
                onClick={() => setAdminTab("status")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer text-[8.5px] sm:text-[9.5px] ${
                  adminTab === "status" 
                    ? "border-amber-500 text-zinc-955 dark:text-zinc-50" 
                    : "border-transparent text-zinc-400"
                }`}
              >
                Attendance logs
              </button>
              <button 
                onClick={() => setAdminTab("logs")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer text-[8.5px] sm:text-[9.5px] ${
                  adminTab === "logs" 
                    ? "border-amber-500 text-zinc-955 dark:text-zinc-50" 
                    : "border-transparent text-zinc-400"
                }`}
              >
                Timesheet Ledger
              </button>
              <button 
                onClick={() => setAdminTab("roster")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer text-[8.5px] sm:text-[9.5px] ${
                  adminTab === "roster" 
                    ? "border-amber-500 text-zinc-955 dark:text-zinc-50" 
                    : "border-transparent text-zinc-400"
                }`}
              >
                Roster Management
              </button>
            </div>


            {/* Admin TAB: Attendance Logs */}
            {adminTab === "status" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden shadow-sm text-left animate-in fade-in duration-150">
                <div className="flex justify-between items-center p-2 border-b border-zinc-150 dark:border-zinc-805 bg-zinc-50/50 dark:bg-zinc-955/20">
                  <span className="font-bold text-[8.5px] sm:text-[10px] text-zinc-500 uppercase tracking-wider">Daily Attendance</span>
                  <span className="text-[8px] sm:text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded-none animate-pulse">Click row to manage</span>
                </div>
                <div className="overflow-x-auto text-[10px] sm:text-[11px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-955/40 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wide text-[8px] sm:text-[9.5px]">
                        <th className="p-2">Employee</th>
                        <th className="p-2 hidden sm:table-cell">Department</th>
                        <th className="p-2">Clock In</th>
                        <th className="p-2">Clock Out</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                      {employees.map(emp => {
                        const todayPunches = getEmployeeTodayPunches(emp.id);
                        const latestLog = getEmployeeLatestPunch(emp.id);
                        const isCurrentlyClockedIn = latestLog?.status === "Clocked In";
                        const effectiveMs = getEmployeeEffectiveMsToday(emp.id);

                        return (
                          <tr 
                            key={emp.id} 
                            className="hover:bg-zinc-150/40 dark:hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="p-2 cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>
                              <p className="font-bold text-zinc-900 dark:text-zinc-100 text-[10px] sm:text-[11px] leading-tight">{emp.name}</p>
                              <p className="text-[8px] sm:text-[9px] text-zinc-450 font-mono mt-0.5">{emp.code}</p>
                            </td>
                            <td className="p-2 text-zinc-550 cursor-pointer hidden sm:table-cell" onClick={() => handleSelectAdminEmp(emp)}>{emp.department}</td>
                            
                            {/* Clock In cell (First punch in) */}
                            <td className="p-2">
                              {todayPunches.length > 0 ? (
                                <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[9px] sm:text-[11px]">{todayPunches[0].checkIn}</span>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-700 text-[9px] sm:text-[11px]">—</span>
                              )}
                            </td>

                            {/* Clock Out / Action cell */}
                            <td className="p-2 whitespace-nowrap">
                              {isCurrentlyClockedIn ? (
                                <p
                                  onClick={(e) => { e.stopPropagation(); if (!isClocking) handleClockOut(emp.id); }}
                                  className="cursor-pointer inline-block px-1.5 py-0.5 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-700 font-extrabold uppercase tracking-wider text-[7px] sm:text-[8px] rounded-none transition-colors select-none"
                                >
                                  {isClocking ? "…" : "Check Out"}
                                </p>
                              ) : (
                                <p
                                  onClick={(e) => { e.stopPropagation(); if (!isClocking) handleClockIn(emp.id); }}
                                  className="cursor-pointer inline-block px-1.5 py-0.5 border border-green-200 dark:border-green-900/50 hover:bg-green-50 dark:hover:bg-green-950/20 text-green-600 hover:text-green-700 font-extrabold uppercase tracking-wider text-[7px] sm:text-[8px] rounded-none transition-colors select-none"
                                >
                                  {isClocking ? "…" : "Check In"}
                                </p>
                              )}
                            </td>

                            {/* Status and cumulative time */}
                            <td className="p-2 text-center cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`inline-flex items-center rounded-none px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black uppercase tracking-wider border ${
                                  isCurrentlyClockedIn
                                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/10 dark:text-green-400 dark:border-green-900/40"
                                    : todayPunches.length > 0
                                    ? "bg-zinc-150 text-zinc-500 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700"
                                    : "bg-red-55 text-red-600 border-red-200 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30"
                                }`}>
                                  {isCurrentlyClockedIn ? "Active" : todayPunches.length > 0 ? "Offline" : "Absent"}
                                </span>
                                {isMounted && effectiveMs > 0 && (
                                  <span className="text-[7.5px] sm:text-[8.5px] text-zinc-400 font-mono font-bold mt-0.5">
                                    {fmtMs(effectiveMs)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden shadow-sm text-left animate-in fade-in duration-150">
                  {/* Title & Filters panel */}
                  <div className="p-3 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955/25 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Timesheets Ledger</span>
                      <span className="text-[9px] text-zinc-400 font-mono font-bold">
                        Showing {filteredTimesheets.length} of {timesheets.length}
                      </span>
                    </div>

                    {/* Filter Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      {/* Operator filter select */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-550">Filter by Operator</label>
                        <select
                          value={filterEmployeeId}
                          onChange={e => setFilterEmployeeId(e.target.value)}
                          className="w-full h-8 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none px-2 focus:outline-none font-bold text-zinc-700 dark:text-zinc-350 cursor-pointer"
                        >
                          <option value="">All Operators</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} ({emp.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Date filter picker */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-555">Filter by Date</label>
                        <div className="relative flex items-center">
                          <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="w-full h-8 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none px-2 focus:outline-none font-mono font-bold text-zinc-700 dark:text-zinc-350 cursor-pointer"
                          />
                          {filterDate && (
                            <button
                              type="button"
                              onClick={() => setFilterDate("")}
                              className="absolute right-2 text-zinc-400 hover:text-zinc-700 font-bold text-xs cursor-pointer"
                              title="Clear Date Filter"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {filteredTimesheets.length === 0 ? (
                    <div className="p-6 text-center text-zinc-400 italic text-[11px]">
                      No timesheets found matching the selected filters.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-150 dark:divide-zinc-850 text-xs">
                      {filteredTimesheets.map(ts => {
                        const emp = employees.find(e => e.id === ts.employeeId);
                        const totalHrs = ts.entries.reduce((sum, e) => sum + e.hours, 0);

                        return (
                          <div key={ts.id} className="p-2.5 space-y-2 hover:bg-zinc-50/40 dark:hover:bg-zinc-850/10 transition-colors">
                            
                            <div className="flex justify-between items-center text-[11px]">
                              <div>
                                <span className="font-bold text-zinc-900 dark:text-zinc-55">{emp?.name}</span>
                                <span className="text-[10px] text-zinc-400 ml-2 font-mono">{ts.date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-none font-bold text-[10px] border border-zinc-200 dark:border-zinc-700">
                                  {totalHrs} Hrs
                                </span>
                                <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
                                  Sub: {ts.submittedAt}
                                </span>
                              </div>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-855 rounded-none p-2.5 space-y-3">
                              {ts.entries.map((entry, idx) => (
                                <div key={entry.id || idx} className="space-y-1.5 border-b border-zinc-150/40 dark:border-zinc-800/40 pb-2.5 last:border-0 last:pb-0 text-[11px]">
                                  <div className="flex justify-between items-start gap-3">
                                    <span className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed break-words">{entry.description}</span>
                                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 shrink-0">{entry.hours} hr</span>
                                  </div>
                                  {(entry.images || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                      {(entry.images || []).map((imgUrl, imgIdx) => (
                                        <img 
                                          key={imgIdx}
                                          src={imgUrl} 
                                          alt="Work proof" 
                                          className="h-10 w-10 object-cover rounded-none border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:opacity-80 shrink-0"
                                          onClick={() => handleOpenPreview(entry.images || [], imgIdx)}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Admin TAB: Workforce & Orders Directory */}
            {adminTab === "roster" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 text-left animate-in fade-in duration-150">
                
                {/* Left Forms column: Create Employee */}
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none-none p-2.5 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-[10px] sm:text-xs text-zinc-900 dark:text-zinc-55 uppercase tracking-wider">
                        {editingEmployeeId ? "Edit Staff Member" : "Add Staff Member"}
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
                          className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <form onSubmit={handleAddEmployeeSubmit} className="space-y-2.5 pt-1 text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Full Name</label>
                        <input required placeholder="E.g. Rajesh Kumar" value={empFormName} onChange={e => setEmpFormName(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded-none px-2.5 focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Employee Code</label>
                        <input required placeholder="E.g. EMP-105" value={empFormCode} onChange={e => setEmpFormCode(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded-none px-2.5 focus:outline-none font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Password</label>
                        <div className="relative">
                          <input 
                            type={showFormPassword ? "text" : "password"}
                            required={!editingEmployeeId}
                            placeholder={editingEmployeeId ? "Leave blank to keep current" : "Password"} 
                            value={empFormPassword} 
                            onChange={e => setEmpFormPassword(e.target.value)} 
                            className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded-none px-2.5 pr-8 focus:outline-none" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowFormPassword(!showFormPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650 transition-colors focus:outline-none cursor-pointer"
                          >
                            {showFormPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Department</label>
                          <select value={empFormDept} onChange={e => setEmpFormDept(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded-none px-1 focus:outline-none font-bold text-zinc-705 dark:text-zinc-350 cursor-pointer">
                            <option value="Stitching Section">Stitching</option>
                            <option value="Quality Assurance">Quality QA</option>
                            <option value="Cutting Department">Cutting</option>
                            <option value="Finishing Section">Finishing</option>
                            <option value="House Keeping">House Keeping</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Designation</label>
                          <input required placeholder="E.g. Stitcher" value={empFormDesg} onChange={e => setEmpFormDesg(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded-none px-2 focus:outline-none" />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isSavingEmployee}
                        className="w-full bg-zinc-900 hover:bg-zinc-850 disabled:opacity-75 disabled:cursor-not-allowed dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold h-8 rounded-none text-xs cursor-pointer transition-colors uppercase tracking-wide flex items-center justify-center gap-1.5"
                      >
                        {isSavingEmployee && (
                          <span className="h-3.5 w-3.5 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin"></span>
                        )}
                        {isSavingEmployee 
                          ? (editingEmployeeId ? "Saving..." : "Registering...") 
                          : (editingEmployeeId ? "Save Changes" : "Register")}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Right lists column: Workforce Directory */}
                <div className="lg:col-span-2">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none-none overflow-hidden shadow-sm">
                    <div className="flex justify-between items-center p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955/20">
                      <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Staff List</span>
                      <span className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded-none animate-pulse">Click row to manage</span>
                    </div>
                    <div className="overflow-x-auto text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-955/40 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wide">
                            <th className="p-2.5">Name</th>
                            <th className="p-2.5">Code</th>
                            <th className="p-2.5 hidden sm:table-cell">Department</th>
                            <th className="p-2.5 font-semibold">Designation</th>
                            <th className="p-2.5 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                          {employees.map(emp => (
                            <tr 
                              key={emp.id} 
                              className="hover:bg-zinc-150/40 dark:hover:bg-zinc-800/40 transition-colors"
                            >
                              <td className="p-2.5 font-bold text-zinc-900 dark:text-zinc-150 cursor-pointer" onClick={() => handleSelectAdminEmp(emp)} title="Click to manage employee clocking & work logs">{emp.name}</td>
                              <td className="p-2.5 font-mono text-zinc-550 cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>{emp.code}</td>
                              <td className="p-2.5 text-zinc-550 hidden sm:table-cell cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>{emp.department}</td>
                              <td className="p-2.5 text-zinc-550 font-semibold cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>{emp.designation}</td>
                              <td className="p-2.5 text-right whitespace-nowrap">
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
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="inline-flex items-center justify-center p-1.5 text-zinc-550 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 bg-white dark:bg-zinc-900 rounded-none cursor-pointer transition-all"
                                  title="Edit Employee Profile"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
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

          </div>
        )}

        {/* ===================================== */}
        {/*          EMPLOYEE PORTAL PANEL        */}
        {/* ===================================== */}
        {currentRole === "Employee" && currentEmployee && (
          <div className="space-y-0 animate-in fade-in duration-200 text-left max-w-xl mx-auto">

            {/* ── Profile Header Strip ─────────────────────── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  {currentEmployee.name}
                </p>
                <p className="text-[8px] sm:text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                  {currentEmployee.code} · {currentEmployee.designation}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {/* Live status ring */}
                <span className={`relative flex h-1.5 w-1.5 ${isCurrentlyClocked ? "text-emerald-500" : "text-zinc-400"}`}>
                  {isCurrentlyClocked && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isCurrentlyClocked ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}></span>
                </span>
                <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-widest ${isCurrentlyClocked ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
                  {isCurrentlyClocked ? "On Shift" : latestTodayLog?.status === "Clocked Out" ? "Done" : "Offline"}
                </span>
              </div>
            </div>

            {/* ── Section Tab Bar ──────────────────────────── */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 border-x border-zinc-200 dark:border-zinc-800">
              {([
                { id: "attendance", label: "Attendance" },
                { id: "log",        label: "Log Work"   },
                { id: "history",    label: "History"    },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setEmpSection(tab.id)}
                  className={`flex-1 py-2 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    empSection === tab.id
                      ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-50 bg-zinc-50/80 dark:bg-zinc-800/40"
                      : "border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300"
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
              <div className="bg-white dark:bg-zinc-900 border-x border-b border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-200">

                {/* Live Clock */}
                <div className="px-3 pt-4 pb-3 flex flex-col items-center gap-0.5 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                    <AlarmClock className="h-2.5 w-2.5" /> Current Time
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums tracking-tight font-mono">
                    {isMounted ? liveTime : "—"}
                  </span>
                  <span className="text-[8px] sm:text-[10px] text-zinc-400 font-mono mt-0.5">
                    {isMounted ? new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}
                  </span>
                </div>

                {/* Today's Punch Summary */}
                {todayAttendanceLogs.length > 0 && (
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
                    {/* Total effective row */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-2.5 w-2.5" /> Total Effective Today
                      </span>
                      <span className="font-black text-sm font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                        {isMounted ? fmtMs(effectiveMsToday) : "00h 00m 00s"}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${effectiveMsToday >= 8 * 3600000 ? "bg-gradient-to-r from-green-500 to-green-400" : "bg-gradient-to-r from-amber-400 to-green-400"}`}
                          style={{ width: `${Math.min(100, (effectiveMsToday / (8 * 3600000)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] text-zinc-400 font-mono">
                          {Math.min(100, Math.floor((effectiveMsToday / (8 * 3600000)) * 100))}% of 8h shift
                        </p>
                        {effectiveMsToday >= 8 * 3600000 && (
                          <span className="text-[8px] font-black text-green-600 dark:text-green-400 uppercase">✓ Target Met</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Clock In / Clock Out Button */}
                <div className="p-3">
                  {isCurrentlyClocked ? (
                    /* Currently on shift — show Check Out (Red Button) */
                    <button
                      onClick={() => handleClockOut()}
                      disabled={isClocking}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-bold rounded-none cursor-pointer transition-all uppercase tracking-widest text-[9px] sm:text-xs flex items-center justify-center gap-1 shadow-lg shadow-red-600/10 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Timer className="h-3.5 w-3.5" />
                      {isClocking ? "Checking Out..." : "Check Out"}
                    </button>
                  ) : (
                    /* Not on shift — show Check In (Green Button) */
                    <button
                      onClick={() => handleClockIn()}
                      disabled={isClocking}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-bold rounded-none cursor-pointer transition-all uppercase tracking-widest text-[9px] sm:text-xs flex items-center justify-center gap-1 shadow-lg shadow-green-600/25 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Fingerprint className="h-3.5 w-3.5" />
                      {isClocking ? "Checking In..." : "Check In"}
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
                className="bg-white dark:bg-zinc-900 border-x border-b border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                {/* Form Header */}
                <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">
                        {editingTimesheetId ? "✏️ Edit Work Log" : "📋 Log Today's Work"}
                      </p>
                      <p className="text-[9px] text-zinc-400 mt-0.5 font-mono">
                        {timesheetDate || getLocalTodayString()}
                      </p>
                    </div>
                    {editingTimesheetId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-[9px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 px-2 py-1 uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {/* Attendance summary inline hint */}
                  {todayAttendanceLogs.length > 0 && (
                    <div className="mt-2 flex items-center gap-3 text-[9px] font-bold text-zinc-500 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 px-2.5 py-1.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5 text-emerald-500" />
                        First In: <span className="text-zinc-700 dark:text-zinc-300 font-mono ml-0.5">{todayAttendanceLogs[0]?.checkIn || "—"}</span>
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-2.5 w-2.5 text-red-400" />
                        Last Out: <span className="text-zinc-700 dark:text-zinc-300 font-mono ml-0.5">{latestTodayLog?.checkOut || (isCurrentlyClocked ? "Active" : "—")}</span>
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                        Total Clocked: {isMounted ? fmtMs(effectiveMsToday) : "00h 00m 00s"}
                      </span>
                    </div>
                  )}
                  {todayAttendanceLogs.length === 0 && (
                    <div className="mt-2 text-[9px] font-bold text-amber-500 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 px-2.5 py-1.5">
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
                          <label className="text-[9px] uppercase font-black text-zinc-400 tracking-widest flex items-center gap-1.5">
                            <FileText className="h-2.5 w-2.5" /> Work Description
                          </label>
                          <textarea
                            required
                            rows={5}
                            placeholder="Describe the work you did today — e.g. 'Completed collar stitching for 12 units of ORD-002 Linen Blazer'"
                            value={row.description}
                            onChange={e => {
                              const copy = [...timesheetEntries];
                              copy[idx].description = e.target.value;
                              setTimesheetEntries(copy);
                            }}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-600 rounded-none p-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 resize-y focus:outline-none placeholder-zinc-300 dark:placeholder-zinc-700 transition-colors leading-relaxed"
                          />
                        </div>

                        {/* Proof Photos */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-black text-zinc-400 tracking-widest flex items-center gap-1.5">
                            <Camera className="h-2.5 w-2.5" /> Proof Photos
                            <span className="normal-case font-medium text-zinc-300 dark:text-zinc-600 ml-1">(optional)</span>
                          </label>
                          <div className="flex flex-wrap gap-2 items-center">
                            {(row.images || []).map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="relative group">
                                <img
                                  src={imgUrl}
                                  alt="Proof"
                                  className="h-12 w-12 object-cover border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handleOpenPreview(row.images || [], imgIdx)}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...timesheetEntries];
                                    copy[idx].images = (copy[idx].images || []).filter((_, i) => i !== imgIdx);
                                    setTimesheetEntries(copy);
                                  }}
                                  className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            {/* Upload trigger */}
                            <label className={`relative h-12 w-12 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
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
                                <span className="text-[8px] text-zinc-400 font-bold text-center leading-tight">Wait...</span>
                              ) : (
                                <>
                                  <Camera className="h-3.5 w-3.5 text-zinc-400" />
                                  <span className="text-[7px] text-zinc-400 font-bold mt-0.5">Add</span>
                                </>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Submit / Update Button */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    {submitSuccessMsg && (
                      <div className="mb-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-2.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        {submitSuccessMsg}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-black rounded-none cursor-pointer transition-all uppercase tracking-widest text-xs shadow-lg shadow-zinc-900/10 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      {editingTimesheetId ? "Update Work Log" : "Submit Work Log"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ══════════════════════════════════════════════ */}
            {/*   SECTION 3: HISTORY                          */}
            {/* ══════════════════════════════════════════════ */}
            {empSection === "history" && (
              <div className="bg-white dark:bg-zinc-900 border-x border-b border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-200">

                <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">My Work History</p>
                    <p className="text-[9px] text-zinc-400 mt-0.5">{employeeTimesheets.length} log{employeeTimesheets.length !== 1 ? "s" : ""} recorded</p>
                  </div>
                  {/* Summary stats */}
                  <div className="text-right">
                    <p className="text-lg font-black text-zinc-900 dark:text-zinc-50 tabular-nums">
                      {employeeTimesheets.reduce((s, ts) => s + ts.entries.reduce((es, e) => es + e.hours, 0), 0).toFixed(1)}
                    </p>
                    <p className="text-[8px] text-zinc-400 uppercase font-bold tracking-wider">total hrs</p>
                  </div>
                </div>

                {employeeTimesheets.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <History className="h-8 w-8 text-zinc-200 dark:text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400 font-medium">No work logs yet.</p>
                    <button
                      onClick={() => setEmpSection("log")}
                      className="mt-3 text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer transition-colors"
                    >
                      Submit your first log →
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${isToday ? "bg-amber-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 font-mono">{ts.date}</p>
                                  {isToday ? (
                                    <span className="text-[8px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 font-black uppercase tracking-wider">Today</span>
                                  ) : (
                                    <span className="text-[8px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-1.5 py-0.5 font-black uppercase tracking-wider">
                                      <Lock className="h-2 w-2 inline mr-0.5" />Locked
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9px] text-zinc-400 font-mono mt-0.5">
                                  {ts.entries.length} entr{ts.entries.length !== 1 ? "ies" : "y"} · Submitted {ts.submittedAt}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
                                {totalHours.toFixed(1)}<span className="text-[9px] text-zinc-400 font-bold ml-0.5">h</span>
                              </span>
                              {isExpanded
                                ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                              }
                            </div>
                          </button>

                          {/* Expanded entries */}
                          {isExpanded && (
                            <div className="bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-4 animate-in slide-in-from-top-1 duration-150">
                              
                              {/* Work Details Section */}
                              <div className="space-y-2">
                                <p className="text-[8px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-150 dark:border-zinc-850 pb-1">
                                  Work Details
                                </p>
                                {ts.entries.map((entry, idx) => (
                                  <div key={entry.id || idx} className="flex justify-between items-start gap-3 text-xs py-0.5">
                                    <p className="flex-1 text-zinc-650 dark:text-zinc-400 font-medium leading-relaxed text-[11px] break-words">
                                      {idx + 1}. {entry.description}
                                    </p>
                                    <span className="font-black font-mono text-zinc-805 dark:text-zinc-200 shrink-0 text-[11px]">
                                      {entry.hours}h
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Proof Images Section */}
                              {(() => {
                                const allImages = ts.entries.flatMap(entry => entry.images || []);
                                if (allImages.length === 0) return null;
                                return (
                                  <div className="space-y-2">
                                    <p className="text-[8px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-150 dark:border-zinc-855 pb-1">
                                      Proof Images
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                      {allImages.map((url, i) => (
                                        <img
                                          key={i}
                                          src={url}
                                          alt="Proof"
                                          className="h-14 w-14 object-cover border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80"
                                          onClick={() => handleOpenPreview(allImages, i)}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Edit button — only today's logs */}
                              {isToday && (
                                <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                  <span className="text-[9px] text-zinc-400">Total: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{totalHours}h</strong></span>
                                  <button
                                    onClick={() => {
                                      handleStartEditTimesheet(ts);
                                      setEmpSection("log");
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-black bg-amber-500 hover:bg-amber-600 text-white uppercase tracking-wider cursor-pointer transition-colors"
                                  >
                                    <Pencil className="h-2.5 w-2.5" /> Edit Log
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 animate-in fade-in duration-150"
          onClick={() => setActivePreviewImages([])}
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-none-none max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-150 dark:border-zinc-850">
              <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-wide">
                Work Proof Image ({activePreviewIndex + 1} of {activePreviewImages.length})
              </span>
              <button 
                onClick={() => setActivePreviewImages([])}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-250 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="relative flex-1 overflow-y-auto pt-2 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-none min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={activePreviewImages[activePreviewIndex]} 
                alt="Attachment Proof Preview" 
                className="max-h-[60vh] object-contain rounded-none select-none" 
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
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-lg font-black transition-colors cursor-pointer select-none"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-lg font-black transition-colors cursor-pointer select-none"
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 animate-in fade-in duration-150"
          onClick={() => setSelectedAdminEmp(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-none w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col relative text-left" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-zinc-150 dark:border-zinc-850">
              <div>
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-50 uppercase tracking-wide block">
                  Manage Operator
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {selectedAdminEmp.name} ({selectedAdminEmp.code})
                </span>
              </div>
              <button 
                onClick={() => setSelectedAdminEmp(null)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-250 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 pt-3 text-xs">
              {/* Profile Details Card */}
              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 space-y-1">
                <p className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider">Operator Profile</p>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{selectedAdminEmp.name}</p>
                <p className="text-[10px] text-zinc-400 font-medium">Department: <strong className="text-zinc-700 dark:text-zinc-300">{selectedAdminEmp.department}</strong></p>
                <p className="text-[10px] text-zinc-400 font-medium">Designation: <strong className="text-zinc-700 dark:text-zinc-300">{selectedAdminEmp.designation}</strong></p>
              </div>

              {/* Attendance management */}
              {(() => {
                const todayPunches = getEmployeeTodayPunches(selectedAdminEmp.id);
                const latestLog = getEmployeeLatestPunch(selectedAdminEmp.id);
                const isCurrentlyClockedIn = latestLog?.status === "Clocked In";
                const totalMs = getEmployeeEffectiveMsToday(selectedAdminEmp.id);

                return (
                  <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <p className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                      <Fingerprint className="h-3 w-3" /> Today's Attendance Status
                    </p>
                    
                    <div className="bg-zinc-50 dark:bg-zinc-950 p-2 border border-zinc-150 dark:border-zinc-850 space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[8px] text-zinc-400 uppercase tracking-widest font-mono">Current Status</p>
                          <p className={`font-black text-[11px] uppercase ${isCurrentlyClockedIn ? "text-green-600 animate-pulse" : "text-zinc-500"}`}>
                            {isCurrentlyClockedIn ? "Clocked In" : todayPunches.length > 0 ? "Clocked Out" : "Absent"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-zinc-400 uppercase tracking-widest font-mono">Effective Today</p>
                          <p className="font-black text-xs font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                            {isMounted ? fmtMs(totalMs) : "00h 00m 00s"}
                          </p>
                        </div>
                      </div>

                      {todayPunches.length > 0 && (
                        <div className="pt-1.5 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-450 space-y-1">
                          <p className="font-extrabold uppercase text-[8px] tracking-wider text-zinc-400 mb-1">Today's Punch History:</p>
                          {todayPunches.map((log, pIdx) => (
                            <div key={log.id} className="flex justify-between items-center font-mono">
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
                          className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase tracking-wide cursor-pointer transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Fingerprint className="h-3 w-3" />
                          Check In Operator
                        </button>
                      ) : (
                        <button
                          onClick={() => handleClockOut(selectedAdminEmp.id)}
                          disabled={isClocking}
                          className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase tracking-wide cursor-pointer transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Timer className="h-3 w-3" />
                          Check Out Operator
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Submit Work Log on Behalf of Operator */}
              <form onSubmit={handleAdminTimesheetSubmit} className="p-2.5 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <p className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Log Work on Behalf
                </p>

                <div className="space-y-2">
                  {adminTimesheetEntries.map((row, idx) => (
                    <div key={idx} className="space-y-2.5">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-550">Work Description</label>
                        <textarea
                          required
                          rows={3}
                          placeholder="Describe the work done by this operator..."
                          value={row.description}
                          onChange={e => {
                            const copy = [...adminTimesheetEntries];
                            copy[idx].description = e.target.value;
                            setAdminTimesheetEntries(copy);
                          }}
                          className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-850 rounded-none p-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 resize-y focus:outline-none focus:border-zinc-400 transition-colors"
                        />
                      </div>

                      {/* Proof photos upload */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-550">Proof Photos</label>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {(row.images || []).map((imgUrl, imgIdx) => (
                            <div key={imgIdx} className="relative group">
                              <img
                                src={imgUrl}
                                alt="Proof"
                                className="h-9 w-9 object-cover border border-zinc-250 dark:border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handleOpenPreview(row.images || [], imgIdx)}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = [...adminTimesheetEntries];
                                  copy[idx].images = (copy[idx].images || []).filter((_, i) => i !== imgIdx);
                                  setAdminTimesheetEntries(copy);
                                }}
                                className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          <label className={`relative h-9 w-9 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors ${isUploading ? "opacity-50" : ""}`}>
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
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold text-[10px] uppercase tracking-wide cursor-pointer transition-colors shadow-xs"
                >
                  Submit Work Log
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
