"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  RotateCcw
} from "lucide-react";

// ── Toast System ──────────────────────────────────────────────
type ToastType = "success" | "error" | "info";
import { toast, Toaster } from "sonner";
// ─────────────────────────────────────────────────────────────
import { 
  loginAction, 
  logoutAction, 
  addEmployeeAction,
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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Login form state
  const [loginUsername, setLoginUsername] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

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

  // Form State: Add Employee
  const [empFormName, setEmpFormName] = useState("");
  const [empFormCode, setEmpFormCode] = useState("");
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
    setLoginError("");

    const res = await loginAction(loginUsername, loginPassword);
    if (res.success && res.session) {
      setSession(res.session as { isAuthenticated: boolean; authRole: "Admin" | "Employee" | null; authEmployeeId: string | null });
      setCurrentRole(res.session.authRole as "Admin" | "Employee");
      if (res.session.authEmployeeId) {
        setActiveEmpId(res.session.authEmployeeId);
      }
      setLoginUsername("");
      setLoginPassword("");
    } else {
      setLoginError(res.error || "An error occurred during login.");
    }
  };

  const handleLogout = async () => {
    await logoutAction();
    setSession(null);
    setEditingTimesheetId(null);
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
    if (!empFormName.trim() || !empFormCode.trim()) return;

    const res = await addEmployeeAction(empFormName, empFormCode, empFormDept, empFormDesg);
    if (res.success) {
      setEmpFormName("");
      setEmpFormCode("");
      showToast(`Employee "${empFormName}" registered successfully!`, "success");
    } else {
      showToast(res.error || "Failed to register employee.", "error");
    }
  };



  // Employee: Clock-in / Clock-out (or Admin on behalf of employee)
  const handleClockIn = async (empId?: string) => {
    const targetEmpId = empId || activeEmpId;
    const todayStr = getLocalTodayString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const res = await clockInAction(targetEmpId, todayStr, timeStr);
    if (res.success && res.attendanceLog) {
      setAttendance(prev => {
        const filtered = prev.filter(a => !(a.employeeId === targetEmpId && a.date === todayStr));
        return [res.attendanceLog, ...filtered];
      });
      showToast("Clocked in successfully!", "success");
    } else {
      showToast(res.error || "Failed to clock in.", "error");
    }
    if (empId) {
      setManualCheckIn(timeStr);
    }
  };

  const handleClockOut = async (empId?: string) => {
    const targetEmpId = empId || activeEmpId;
    const todayStr = getLocalTodayString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const res = await clockOutAction(targetEmpId, todayStr, timeStr);
    if (res.success && res.attendanceLog) {
      setAttendance(prev => {
        const filtered = prev.filter(a => !(a.employeeId === targetEmpId && a.date === todayStr));
        return [res.attendanceLog, ...filtered];
      });
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
  const employeeClockState = (() => {
    const todayStr = getLocalTodayString();
    const log = attendance.find(a => a.employeeId === activeEmpId && a.date === todayStr);
    return log || null;
  })();

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
                  placeholder="E.g. admin or EMP-101"
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
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-black rounded-none text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/15 cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              <UserCheck className="h-4 w-4 text-white" />
              Sign In
            </button>
          </form>

          {/* Helper details */}
          <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-none text-[11px] text-zinc-550 space-y-2.5 leading-relaxed">
            <span className="font-extrabold uppercase text-amber-600 tracking-wider text-[10px] flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
              Sign In Credentials Reference
            </span>
            <p>Admin Profile: Use username <strong className="text-zinc-800 font-mono font-bold">admin</strong> and password <strong className="text-zinc-800 font-mono font-bold">admin</strong>.</p>
            <p>Employee Profiles: Enter employee code and password <strong className="text-zinc-800 font-mono font-bold">password</strong>.</p>
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
      <header className="sticky top-0 z-40 w-full border-b border-zinc-150 dark:border-zinc-850 bg-white dark:bg-zinc-900 px-2.5 py-2.5 flex justify-between items-center gap-2">
        
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
          <p className="text-xs sm:text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Staff Portal</p>
        </div>

        {/* User context & Logout */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/40 px-2.5 py-1 rounded-none-none">
            <span className={`h-1.5 w-1.5 rounded-full ${session.authRole === "Admin" ? "bg-amber-550 animate-pulse" : "bg-emerald-500"}`}></span>
            <span className="text-[10px] font-bold text-zinc-650 dark:text-zinc-300">
              {session.authRole === "Admin" ? "Administrator" : `${currentEmployee?.name} (${currentEmployee?.code})`}
            </span>
          </div>

          {session.authRole === "Admin" && (
            <button
              onClick={handleResetDatabase}
              className="px-2.5 py-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 border border-amber-200 dark:border-amber-900/40 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-none cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset DB
            </button>
          )}

          <button
            onClick={handleLogout}
            className="px-2.5 py-1 text-[10px] font-bold text-red-500 hover:text-red-650 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-none cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
          >
            <LogOut className="h-3 w-3" />
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
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold gap-2 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap">
              <button 
                onClick={() => setAdminTab("status")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer ${
                  adminTab === "status" 
                    ? "border-amber-500 text-zinc-955 dark:text-zinc-50" 
                    : "border-transparent text-zinc-400"
                }`}
              >
                Attendance logs
              </button>
              <button 
                onClick={() => setAdminTab("logs")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer ${
                  adminTab === "logs" 
                    ? "border-amber-500 text-zinc-955 dark:text-zinc-50" 
                    : "border-transparent text-zinc-400"
                }`}
              >
                Timesheet Ledger
              </button>
              <button 
                onClick={() => setAdminTab("roster")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer ${
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
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none-none overflow-hidden shadow-sm text-left animate-in fade-in duration-150">
                <div className="flex justify-between items-center p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955/20">
                  <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Daily Attendance</span>
                  <span className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded-none animate-pulse">Click row to manage</span>
                </div>
                <div className="overflow-x-auto text-[11px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wide">
                        <th className="p-2">Employee</th>
                        <th className="p-2 hidden sm:table-cell">Department</th>
                        <th className="p-2">Clock In</th>
                        <th className="p-2">Clock Out</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                      {employees.map(emp => {
                        const todayStr = getLocalTodayString();
                        const log = attendance.find(a => a.employeeId === emp.id && a.date === todayStr);
                        return (
                          <tr 
                            key={emp.id} 
                            className="hover:bg-zinc-150/40 dark:hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="p-2 cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>
                              <p className="font-bold text-zinc-900 dark:text-zinc-100">{emp.name}</p>
                              <p className="text-[9px] text-zinc-450 font-mono">{emp.code}</p>
                            </td>
                            <td className="p-2 text-zinc-550 cursor-pointer hidden sm:table-cell" onClick={() => handleSelectAdminEmp(emp)}>{emp.department}</td>
                            {/* Clock In cell */}
                            <td className="p-2">
                              {log?.checkIn ? (
                                <span className="font-mono text-zinc-600 dark:text-zinc-400">{log.checkIn}</span>
                              ) : (
                                <span
                                  onClick={(e) => { e.stopPropagation(); if (emp.id) handleClockIn(String(emp.id)); }}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded cursor-pointer whitespace-nowrap font-bold uppercase tracking-wide border border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors text-[9px]"
                                >
                                  Check In
                                </span>
                              )}
                            </td>
                            {/* Clock Out cell */}
                            <td className="p-2">
                              {log?.checkOut ? (
                                <span className="font-mono text-zinc-600 dark:text-zinc-400">{log.checkOut}</span>
                              ) : log?.checkIn ? (
                                <span
                                  onClick={(e) => { e.stopPropagation(); if (emp.id) handleClockOut(String(emp.id)); }}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded cursor-pointer whitespace-nowrap font-bold uppercase tracking-wide border border-red-455 text-red-600 dark:text-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors text-[9px]"
                                >
                                  Check Out
                                </span>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-700">—</span>
                              )}
                            </td>
                            <td className="p-2 text-center cursor-pointer" onClick={() => handleSelectAdminEmp(emp)}>
                              <span className={`inline-flex items-center rounded-none px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                log?.status === "Clocked In"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-205 dark:bg-emerald-950/10 dark:text-emerald-400 dark:border-emerald-900/40"
                                  : log?.status === "Clocked Out"
                                  ? "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700"
                                  : "bg-red-50 text-red-650 border-red-200 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30"
                              }`}>
                                {log?.status || "Absent"}
                              </span>
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
            {adminTab === "logs" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none-none overflow-hidden shadow-sm text-left animate-in fade-in duration-150">
                <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
                  <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Timesheets List</span>
                </div>

                {timesheets.length === 0 ? (
                  <div className="p-4 text-center text-zinc-400 italic text-[11px]">No timesheets submitted yet.</div>
                ) : (
                  <div className="divide-y divide-zinc-150 dark:divide-zinc-850 text-xs">
                    {timesheets.map(ts => {
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

                          <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-none p-2.5 space-y-2">
                            {ts.entries.map((entry, idx) => (
                              <div key={entry.id || idx} className="flex justify-between items-start gap-2 text-[11px]">
                                <div className="flex gap-2.5 items-start">
                                  <div className="flex flex-wrap gap-1 shrink-0">
                                    {(entry.images || []).map((imgUrl, imgIdx) => (
                                      <img 
                                        key={imgIdx}
                                        src={imgUrl} 
                                        alt="Work proof" 
                                        className="h-8 w-8 object-cover rounded-none border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:opacity-80 shrink-0"
                                        onClick={() => setPreviewImageUrl(imgUrl)}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-zinc-655 dark:text-zinc-400 font-medium leading-relaxed">{entry.description}</span>
                                </div>
                                <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 shrink-0">{entry.hours} hr</span>
                              </div>
                            ))}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Admin TAB: Workforce & Orders Directory */}
            {adminTab === "roster" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 text-left animate-in fade-in duration-150">
                
                {/* Left Forms column: Create Employee */}
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none-none p-2.5 space-y-3 shadow-sm">
                    <p className="font-bold text-[10px] sm:text-xs text-zinc-900 dark:text-zinc-55 uppercase tracking-wider">Add Staff Member</p>
                    <form onSubmit={handleAddEmployeeSubmit} className="space-y-2.5 pt-1 text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Full Name</label>
                        <input required placeholder="E.g. Rajesh Kumar" value={empFormName} onChange={e => setEmpFormName(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-805 rounded-none px-2.5 focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Employee Code</label>
                        <input required placeholder="E.g. EMP-105" value={empFormCode} onChange={e => setEmpFormCode(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded-none px-2.5 focus:outline-none font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Department</label>
                          <select value={empFormDept} onChange={e => setEmpFormDept(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded-none px-1 focus:outline-none font-bold text-zinc-705 dark:text-zinc-350 cursor-pointer">
                            <option value="Stitching Section">Stitching</option>
                            <option value="Quality Assurance">Quality QA</option>
                            <option value="Cutting Department">Cutting</option>
                            <option value="Finishing Section">Finishing</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Designation</label>
                          <input required placeholder="E.g. Stitcher" value={empFormDesg} onChange={e => setEmpFormDesg(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded-none px-2 focus:outline-none" />
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold h-8 rounded-none text-xs cursor-pointer transition-colors uppercase tracking-wide">Register</button>
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                          {employees.map(emp => (
                            <tr 
                              key={emp.id} 
                              onClick={() => handleSelectAdminEmp(emp)}
                              className="hover:bg-zinc-150/40 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                              title="Click to manage employee clocking & work logs"
                            >
                              <td className="p-2.5 font-bold text-zinc-900 dark:text-zinc-150">{emp.name}</td>
                              <td className="p-2.5 font-mono text-zinc-550">{emp.code}</td>
                              <td className="p-2.5 text-zinc-550 hidden sm:table-cell">{emp.department}</td>
                              <td className="p-2.5 text-zinc-550 font-semibold">{emp.designation}</td>
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
          <div className="space-y-3 animate-in fade-in duration-150 text-left">
            
            {/* Success notifications */}
            {submitSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-250 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-2 rounded-none-none text-xs font-bold text-emerald-800 dark:text-emerald-350 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-650" />
                <span>{submitSuccessMsg}</span>
              </div>
            )}

            {/* Profile greeting & Biometric Attendance card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none-none p-2.5 space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-55 leading-tight">Welcome, {currentEmployee.name}</p>
                  <p className="text-[10px] text-zinc-400 font-bold mt-0.5 uppercase tracking-wider">{currentEmployee.code} &bull; {currentEmployee.designation} &bull; {currentEmployee.department}</p>
                </div>
                {/* Status Indicator Dot */}
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-none border ${
                  employeeClockState?.status === "Clocked In"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/10 dark:text-emerald-450 dark:border-emerald-900/40"
                    : "bg-red-50 text-red-750 border-red-250 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30"
                }`}>
                  <span className={`h-1 w-1 rounded-full ${employeeClockState?.status === "Clocked In" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                  {employeeClockState?.status === "Clocked In" ? "Active" : "Offline"}
                </span>
              </div>

              {/* Big Attendance Click Target */}
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-2.5 rounded-none-none flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-left space-y-0.5">
                  <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Attendance Card</span>
                  <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 block">
                    {employeeClockState?.status === "Clocked In" 
                      ? `Clocked In at ${employeeClockState.checkIn}`
                      : employeeClockState?.status === "Clocked Out"
                      ? `Clocked Out at ${employeeClockState.checkOut}`
                      : "Not Clocked In Today"}
                  </span>
                </div>
                <div className="flex w-full sm:w-auto shrink-0">
                  {employeeClockState?.status === "Clocked In" ? (
                    <button
                      onClick={() => handleClockOut()}
                      className="w-full sm:w-44 py-2.5 bg-red-600 hover:bg-red-755 text-white font-bold rounded-none cursor-pointer transition-colors uppercase tracking-wider text-[10px] text-center select-none"
                    >
                      Check Out
                    </button>
                  ) : (
                    <button
                      onClick={() => handleClockIn()}
                      className="w-full sm:w-44 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-none cursor-pointer transition-colors uppercase tracking-wider text-[10px] text-center select-none"
                    >
                      Check In
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              
              {/* Fill Timesheet Form (Full Width) */}
              <div className="col-span-1 lg:col-span-3">
                <div id="timesheet-form-section" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-none-none p-2.5 space-y-3 shadow-sm">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <p className="font-bold text-[10px] sm:text-xs text-zinc-900 dark:text-zinc-55 uppercase tracking-wider">
                      {editingTimesheetId ? "Edit Log Entries" : "Log Hours"}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-zinc-400 mt-0.5">
                      {editingTimesheetId 
                        ? "Update your log entries."
                        : "Enter hours and work details."}
                    </p>
                  </div>

                  <form onSubmit={handleTimesheetSubmit} className="space-y-3 text-xs">
                    
                    {/* Date select (Read-only) */}
                    <div className="max-w-[150px] space-y-1">
                      <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Date</label>
                      <input
                        type="date"
                        disabled
                        value={timesheetDate}
                        onChange={e => setTimesheetDate(e.target.value)}
                        className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 rounded-none px-2 focus:outline-none font-bold disabled:opacity-60 cursor-not-allowed"
                      />
                    </div>

                    {/* Timesheet Rows list */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block">Work Entries</span>
                                       {timesheetEntries.map((row, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-end sm:items-center bg-zinc-50 dark:bg-zinc-955 p-2 rounded-none-none border border-zinc-200 dark:border-zinc-800 relative">
                          
                          {/* Work Done */}
                          <div className="flex-1 w-full text-left space-y-1">
                            <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Work Done Description</label>
                            <textarea
                              required
                              rows={5}
                              placeholder="Describe the work you did..."
                              value={row.description}
                              onChange={e => {
                                const copy = [...timesheetEntries];
                                copy[idx].description = e.target.value;
                                setTimesheetEntries(copy);
                              }}
                              className="w-full bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-none p-2 text-xs focus:outline-none focus:border-zinc-400 font-semibold text-zinc-800 dark:text-zinc-250 resize-y"
                            />
                          </div>

                          {/* Proof Photos */}
                          <div className="w-full sm:w-auto text-left space-y-1">
                            <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-505 block">Proof Photos</label>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {/* Display all existing/new images */}
                              {(row.images || []).map((imgUrl, imgIdx) => (
                                <div key={imgIdx} className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-none h-8 text-xs font-semibold">
                                  <img 
                                    src={imgUrl} 
                                    alt="Thumb" 
                                    className="h-6 w-6 object-cover rounded-none cursor-pointer" 
                                    onClick={() => setPreviewImageUrl(imgUrl)} 
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const copy = [...timesheetEntries];
                                      const currentList = copy[idx].images || [];
                                      const updatedList = currentList.filter((_, i) => i !== imgIdx);
                                      copy[idx] = { 
                                        ...copy[idx], 
                                        images: updatedList,
                                      };
                                      setTimesheetEntries(copy);
                                    }}
                                    className="text-[12px] text-red-500 hover:text-red-755 px-1 font-bold cursor-pointer font-sans"
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}

                              {/* Button to add/append images */}
                              <div className="relative h-8 w-24 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-none flex items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-850">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
                                  onChange={async e => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length > 0) {
                                      setIsUploading(true);
                                      try {
                                        const compressedBase64s = await Promise.all(
                                          files.map(file => compressImage(file))
                                        );
                                        const cloudUrls = await Promise.all(
                                          compressedBase64s.map(b64 => uploadToCloud(b64))
                                        );
                                        const copy = [...timesheetEntries];
                                        const existingImages = copy[idx].images || [];
                                        copy[idx] = { 
                                          ...copy[idx], 
                                          images: [...existingImages, ...cloudUrls],
                                        };
                                        setTimesheetEntries(copy);
                                        e.target.value = "";
                                      } catch (err) {
                                        console.error("Upload error:", err);
                                        showToast("Image upload failed. Please try again.", "error");
                                      } finally {
                                        setIsUploading(false);
                                      }
                                    }
                                  }}
                                  disabled={isUploading}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <span className="text-[10px] font-bold text-zinc-400">
                                  {isUploading ? "Uploading..." : "+ Add Photos"}
                                </span>
                              </div>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end items-center gap-2 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                      {editingTimesheetId ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-705 text-zinc-655 dark:text-zinc-300 font-bold rounded-none text-xs cursor-pointer h-8 uppercase tracking-wider transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isUploading}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-none text-xs cursor-pointer shadow-sm shadow-zinc-500/10 h-8 uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Update Log
                          </button>
                        </div>
                      ) : (
                        <button
                          type="submit"
                          disabled={isUploading}
                          className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-855 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-none text-xs cursor-pointer shadow-sm shadow-zinc-500/10 h-8 uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Submit Log
                        </button>
                      )}
                    </div>

                  </form>
                </div>
              </div>

              {/* My Timesheet History (At the Bottom) */}
              <div className="col-span-1 lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none-none p-2.5 space-y-3 shadow-sm">
                <span className="font-bold text-[10px] text-zinc-455 dark:text-zinc-500 uppercase tracking-wide block">My Timesheet History</span>
                
                {employeeTimesheets.length === 0 ? (
                  <div className="text-zinc-400 italic text-[11px] p-2 bg-zinc-50 dark:bg-zinc-955 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-none-none text-center">No logs found.</div>
                ) : (
                  <div className="space-y-3 text-xs">
                    {employeeTimesheets.map(ts => {
                      const totalHours = ts.entries.reduce((sum, e) => sum + e.hours, 0);
                      const isExpanded = !!expandedTimesheets[ts.id];
                      const todayStr = getLocalTodayString();
                      const isToday = ts.date === todayStr;

                      return (
                        <div key={ts.id} className="border-b border-zinc-150 dark:border-zinc-800 pb-2.5 last:border-b-0 last:pb-0">
                          <div 
                            onClick={() => setExpandedTimesheets(prev => ({ ...prev, [ts.id]: !prev[ts.id] }))}
                            className="flex justify-between items-center cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 p-1.5 rounded-none transition-all"
                          >
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-zinc-900 dark:text-zinc-100">{ts.date}</p>
                                {isToday ? (
                                  <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded-none font-bold uppercase tracking-wider">Today</span>
                                ) : (
                                  <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.2 rounded-none font-bold uppercase tracking-wider">Locked</span>
                                )}
                              </div>
                              <p className="text-[9px] text-zinc-400 font-mono mt-0.5">{ts.entries.length} items &bull; Sub: {ts.submittedAt}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-zinc-100 text-zinc-655 dark:bg-zinc-800 dark:text-zinc-300 px-1.5 py-0.5 rounded-none font-mono font-bold">
                                {totalHours} hrs
                              </span>
                              <span className="text-[10px] text-zinc-400">{isExpanded ? "▲" : "▼"}</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 pl-2 pr-1 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 space-y-2 animate-in slide-in-from-top-1 duration-150">
                              <div className="space-y-1.5">
                                {ts.entries.map((entry, idx) => (
                                  <div key={entry.id || idx} className="text-[11px] leading-relaxed bg-zinc-50 dark:bg-zinc-950 p-2 rounded-none border border-zinc-200 dark:border-zinc-850 flex justify-between items-start gap-2">
                                    <div className="flex gap-2 items-start text-left">
                                      <div className="flex gap-1 shrink-0 mt-0.5">
                                        {(entry.images || []).map((imgUrl, imgIdx) => (
                                          <img 
                                            key={imgIdx}
                                            src={imgUrl} 
                                            alt="Proof" 
                                            className="h-6 w-6 object-cover rounded-none border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:opacity-85"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPreviewImageUrl(imgUrl);
                                            }}
                                          />
                                        ))}
                                      </div>
                                      <span className="text-zinc-650 dark:text-zinc-400 font-medium">{entry.description}</span>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-355 whitespace-nowrap shrink-0">{entry.hours} hr</span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex justify-between items-center pt-1.5">
                                {isToday ? (
                                  <button
                                    onClick={() => handleStartEditTimesheet(ts)}
                                    className="px-2.5 py-1 text-[9px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-none cursor-pointer transition-colors uppercase tracking-wider flex items-center gap-1 shadow-sm"
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                    Edit Work Log
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-zinc-400 dark:text-zinc-550 font-bold flex items-center gap-1 italic select-none">
                                    Locked (EOD Passed)
                                  </span>
                                )}
                                <span className="text-[9px] text-zinc-400">Total: {totalHours} hrs</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Admin: Employee Management Console Modal */}
      {selectedAdminEmp && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 animate-in fade-in duration-150 animate-out duration-100"
          onClick={() => setSelectedAdminEmp(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none-none max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col relative text-left shadow-xl animate-in zoom-in-95 duration-150" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-2.5 border-b border-zinc-150 dark:border-zinc-850">
              <div>
                <p className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-55 uppercase tracking-wider">
                  Staff Profile: {selectedAdminEmp.name}
                </p>
                <p className="text-[10px] text-zinc-400 font-bold mt-0.5 uppercase tracking-wider">
                  {selectedAdminEmp.code} &bull; {selectedAdminEmp.designation} &bull; {selectedAdminEmp.department}
                </p>
              </div>
              <button 
                onClick={() => setSelectedAdminEmp(null)}
                className="px-2.5 py-1 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-800 rounded-none cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-2.5 space-y-6">
              
              {/* Row 1: Attendance punch status & edit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                
                {/* Attendance Summary */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200 dark:border-zinc-850 rounded-none-none space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Today&apos;s Attendance</span>
                    {/* Status badge */}
                    {(() => {
                      const todayStr = getLocalTodayString();
                      const log = attendance.find(a => a.employeeId === selectedAdminEmp.id && a.date === todayStr);
                      return (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-none border ${
                          log?.status === "Clocked In"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-255 dark:bg-emerald-950/10 dark:text-emerald-455 dark:border-emerald-900/40"
                            : "bg-red-50 text-red-750 border-red-255 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${log?.status === "Clocked In" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
                          {log?.status === "Clocked In" ? "Active" : log?.status === "Clocked Out" ? "Offline" : "Absent"}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Punch logs status */}
                  {(() => {
                    const todayStr = getLocalTodayString();
                    const log = attendance.find(a => a.employeeId === selectedAdminEmp.id && a.date === todayStr);
                    return (
                      <div className="space-y-1.5 py-1">
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          Punch In: <span className="font-mono text-zinc-900 dark:text-zinc-100">{log?.checkIn || "—"}</span>
                        </p>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          Punch Out: <span className="font-mono text-zinc-900 dark:text-zinc-100">{log?.checkOut || "—"}</span>
                        </p>
                      </div>
                    );
                  })()}

                  {/* Punch Buttons */}
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex">
                    {(() => {
                      const todayStr = getLocalTodayString();
                      const log = attendance.find(a => a.employeeId === selectedAdminEmp.id && a.date === todayStr);
                      const isCheckedIn = log?.status === "Clocked In";
                      return isCheckedIn ? (
                        <button
                          onClick={() => handleClockOut(selectedAdminEmp.id)}
                          className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-none cursor-pointer transition-colors text-[10px] uppercase tracking-wider text-center"
                        >
                          Check Out
                        </button>
                      ) : (
                        <button
                          onClick={() => handleClockIn(selectedAdminEmp.id)}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-none cursor-pointer transition-colors text-[10px] uppercase tracking-wider text-center"
                        >
                          Check In
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Attendance Corrections Form */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200 dark:border-zinc-855 rounded-none-none space-y-3">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Manual Attendance Adjustment</span>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Check In Time</label>
                      <input
                        placeholder="E.g. 09:05 AM"
                        value={manualCheckIn}
                        onChange={e => setManualCheckIn(e.target.value)}
                        className="w-full h-8 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-none px-2.5 focus:outline-none font-semibold font-mono text-zinc-800 dark:text-zinc-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Check Out Time</label>
                      <input
                        placeholder="E.g. 05:15 PM"
                        value={manualCheckOut}
                        onChange={e => setManualCheckOut(e.target.value)}
                        className="w-full h-8 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-none px-2.5 focus:outline-none font-semibold font-mono text-zinc-800 dark:text-zinc-200"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleSaveManualAttendance(selectedAdminEmp.id)}
                    className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-none cursor-pointer transition-colors text-[10px] uppercase tracking-wider text-center"
                  >
                    Save Attendance Times
                  </button>
                </div>

              </div>



              {/* Row 3: Admin Log Work */}
              <div className="bg-zinc-50 dark:bg-zinc-955 p-2.5 border border-zinc-200 dark:border-zinc-850 rounded-none-none space-y-3">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Log Work on behalf of Employee</span>
                  <p className="text-[9px] text-zinc-400">Fill in the employee timesheet directly here.</p>
                </div>

                <form onSubmit={handleAdminTimesheetSubmit} className="space-y-3 text-xs">
                  
                  {/* Date select (Read-only) */}
                  <div className="max-w-[150px] space-y-1">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Date</label>
                    <input
                      type="date"
                      disabled
                      value={adminTimesheetDate}
                      onChange={e => setAdminTimesheetDate(e.target.value)}
                      className="w-full h-8 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-none px-2 focus:outline-none font-bold disabled:opacity-60 cursor-not-allowed"
                    />
                  </div>

                  {/* Entries */}
                  <div className="space-y-2">
                    {adminTimesheetEntries.map((row, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-end sm:items-center bg-white dark:bg-zinc-900 p-2 rounded-none-none border border-zinc-200 dark:border-zinc-800 relative">
                        
                        {/* Description */}
                        <div className="flex-1 w-full text-left space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-550">Work Description</label>
                          <textarea
                            required
                            rows={5}
                            placeholder="Describe the work done..."
                            value={row.description}
                            onChange={e => {
                              const copy = [...adminTimesheetEntries];
                              copy[idx].description = e.target.value;
                              setAdminTimesheetEntries(copy);
                            }}
                            className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-250 dark:border-zinc-800 rounded-none p-2 text-xs focus:outline-none focus:border-zinc-400 font-semibold text-zinc-800 dark:text-zinc-250 resize-y"
                          />
                        </div>

                        {/* Proof Photos */}
                        <div className="w-full sm:w-auto text-left space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-505 block">Proof Photos</label>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {(row.images || []).map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-955 border border-zinc-205 dark:border-zinc-800 p-1 rounded-none h-8 text-xs font-semibold">
                                <img 
                                  src={imgUrl} 
                                  alt="Thumb" 
                                  className="h-6 w-6 object-cover rounded-none cursor-pointer" 
                                  onClick={() => setPreviewImageUrl(imgUrl)} 
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...adminTimesheetEntries];
                                    const currentList = copy[idx].images || [];
                                    const updatedList = currentList.filter((_, i) => i !== imgIdx);
                                    copy[idx] = { 
                                      ...copy[idx], 
                                      images: updatedList,
                                    };
                                    setAdminTimesheetEntries(copy);
                                  }}
                                  className="text-[12px] text-red-500 hover:text-red-755 px-1 font-bold cursor-pointer font-sans"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}

                            {/* Button to add photos */}
                            <div className="relative h-8 w-24 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none flex items-center justify-center cursor-pointer hover:bg-zinc-150 dark:hover:bg-zinc-800">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
                                onChange={async e => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 0) {
                                    setIsUploading(true);
                                    try {
                                      const compressedBase64s = await Promise.all(
                                        files.map(file => compressImage(file))
                                      );
                                      const cloudUrls = await Promise.all(
                                        compressedBase64s.map(b64 => uploadToCloud(b64))
                                      );
                                      const copy = [...adminTimesheetEntries];
                                      const existingImages = copy[idx].images || [];
                                      copy[idx] = { 
                                        ...copy[idx], 
                                        images: [...existingImages, ...cloudUrls],
                                      };
                                      setAdminTimesheetEntries(copy);
                                      e.target.value = "";
                                    } catch (err) {
                                      console.error("Upload error:", err);
                                      showToast("Image upload failed. Please try again.", "error");
                                    } finally {
                                      setIsUploading(false);
                                    }
                                  }
                                }}
                                disabled={isUploading}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span className="text-[10px] font-bold text-zinc-400">
                                {isUploading ? "Uploading..." : "+ Add Photos"}
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>

                  {/* Actions row */}
                  <div className="flex justify-end items-center gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    {editingAdminTimesheetId ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAdminTimesheetId(null);
                            setAdminTimesheetEntries([{ description: "", images: [] }]);
                            setAdminTimesheetDate(getLocalTodayString());
                          }}
                          className="px-3 py-1.5 border border-zinc-205 dark:border-zinc-705 text-zinc-655 dark:text-zinc-300 font-bold rounded-none text-xs cursor-pointer h-8 uppercase tracking-wider transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isUploading}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-none text-xs cursor-pointer shadow-sm shadow-zinc-500/10 h-8 uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Update Log
                        </button>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={isUploading}
                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-855 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-none text-xs cursor-pointer shadow-sm shadow-zinc-500/10 h-8 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Submit Log for Employee
                      </button>
                    )}
                  </div>

                </form>
              </div>

              {/* Row 4: Timesheet History */}
              <div className="bg-zinc-50 dark:bg-zinc-955 p-2.5 border border-zinc-200 dark:border-zinc-850 rounded-none-none space-y-3">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Timesheet History Ledger</span>
                
                {(() => {
                  const empTs = timesheets.filter(t => t.employeeId === selectedAdminEmp.id);
                  if (empTs.length === 0) {
                    return <p className="text-zinc-400 italic text-[11px] py-1">No timesheets submitted yet for this employee.</p>;
                  }
                  return (
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs font-semibold">
                      {empTs.map(ts => {
                        const totalHours = ts.entries.reduce((sum, e) => sum + e.hours, 0);
                        return (
                          <div key={ts.id} className="py-3 space-y-2">
                            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-455">
                              <span>Date: {ts.date}</span>
                              <span>Total: {totalHours} Hrs (Sub: {ts.submittedAt})</span>
                            </div>
                            
                            <div className="space-y-1.5 pl-2 border-l border-amber-500/30">
                              {ts.entries.map((entry, idx) => (
                                <div key={entry.id || idx} className="flex justify-between items-start gap-2">
                                  <div className="flex gap-2 items-start">
                                    <div className="flex flex-wrap gap-1 shrink-0">
                                      {(entry.images || []).map((imgUrl, imgIdx) => (
                                        <img 
                                          key={imgIdx}
                                          src={imgUrl} 
                                          alt="Work proof" 
                                          className="h-7 w-7 object-cover rounded-none border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:opacity-80 shrink-0"
                                          onClick={() => setPreviewImageUrl(imgUrl)}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-zinc-655 dark:text-zinc-400">{entry.description}</span>
                                  </div>
                                  <span className="font-mono font-bold text-zinc-700 dark:text-zinc-350">{entry.hours} hr</span>
                                </div>
                              ))}
                            </div>
                            {/* Edit / Lock timesheet action */}
                            <div className="flex justify-between items-center pt-1 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                              {ts.date === getLocalTodayString() ? (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditAdminTimesheet(ts)}
                                  className="px-2 py-0.5 text-[9px] font-bold bg-amber-500 hover:bg-amber-650 text-white rounded-none cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1 shadow-sm mt-1"
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                  Edit Work Log
                                </button>
                              ) : (
                                <span className="text-[9px] text-zinc-450 dark:text-zinc-550 font-bold italic select-none mt-1">
                                  Locked (EOD Passed)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 animate-in fade-in duration-150"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-none-none max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-150 dark:border-zinc-850">
              <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-wide">Work Proof Image</span>
              <button 
                onClick={() => setPreviewImageUrl(null)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-250 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pt-2 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImageUrl} alt="Attachment Proof Preview" className="max-h-[60vh] object-contain rounded-none" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
