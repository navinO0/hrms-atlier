"use client";

import React, { useState, useEffect } from "react";
import { 
  User, 
  Users, 
  Clock, 
  CheckCircle, 
  Plus, 
  Trash2, 
  Briefcase, 
  FolderSync,
  ClipboardList,
  UserCheck,
  Timer
} from "lucide-react";

// Types
interface Employee {
  id: string;
  name: string;
  code: string;
  department: string;
  designation: string;
}

interface Order {
  id: string;
  orderNumber: string;
  productName: string;
}

interface Assignment {
  id: string;
  employeeId: string;
  orderId: string;
  assignedDate: string;
  notes?: string;
}

interface AttendanceLog {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: "Clocked In" | "Clocked Out";
}

interface TimesheetEntry {
  id: string;
  orderId: string;
  description: string;
  hours: number;
  image?: string;
}

interface Timesheet {
  id: string;
  employeeId: string;
  date: string;
  entries: TimesheetEntry[];
  submittedAt: string;
}

// Initial Mock Seed Data
const SEED_EMPLOYEES: Employee[] = [
  { id: "emp-1", name: "Amit Verma", code: "EMP-101", department: "Stitching Section", designation: "Lead Stitcher" },
  { id: "emp-2", name: "Priya Gupta", code: "EMP-102", department: "Stitching Section", designation: "Stitching Operator" },
  { id: "emp-3", name: "Sunita Kumar", code: "EMP-103", department: "Quality Assurance", designation: "QC Inspector" },
  { id: "emp-4", name: "Vijay Singh", code: "EMP-104", department: "Cutting Department", designation: "Fabric Cutter" }
];

const SEED_ORDERS: Order[] = [
  { id: "ord-1", orderNumber: "ORD-001", productName: "Haute Couture Evening Gown" },
  { id: "ord-2", orderNumber: "ORD-002", productName: "Linen Summer Blazer" },
  { id: "ord-3", orderNumber: "ORD-003", productName: "Silk Kimono Robe" },
  { id: "ord-4", orderNumber: "ORD-004", productName: "Raw Denim Utility Jacket" },
  { id: "ord-5", orderNumber: "ORD-005", productName: "Classic Leather Jacket" }
];

const SEED_ASSIGNMENTS: Assignment[] = [
  { id: "asg-1", employeeId: "emp-1", orderId: "ord-1", assignedDate: "2026-07-24", notes: "Focus on collar embroidery alignment." },
  { id: "asg-2", employeeId: "emp-2", orderId: "ord-2", assignedDate: "2026-07-24", notes: "Inner lining stitching review." }
];

const SEED_ATTENDANCE: AttendanceLog[] = [
  { id: "att-1", employeeId: "emp-1", date: "2026-07-24", checkIn: "09:05 AM", status: "Clocked In" },
  { id: "att-2", employeeId: "emp-2", date: "2026-07-24", checkIn: "08:58 AM", status: "Clocked In" }
];

const SEED_TIMESHEETS: Timesheet[] = [
  {
    id: "ts-1",
    employeeId: "emp-1",
    date: "2026-07-23",
    entries: [
      { id: "tse-1", orderId: "ord-1", description: "Seam stitchings on couture gown", hours: 4.5 },
      { id: "tse-2", orderId: "ord-3", description: "Fabric preparations and layout review", hours: 3.5 }
    ],
    submittedAt: "2026-07-23 05:15 PM"
  }
];

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
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
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6); // 60% quality JPEG
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

export default function Home() {
  // Navigation & Role State
  const [currentRole, setCurrentRole] = useState<"Admin" | "Employee">("Admin");
  const [activeEmpId, setActiveEmpId] = useState<string>("emp-1");
  const [adminTab, setAdminTab] = useState<"assign" | "status" | "logs" | "customers">("assign");
  const [mounted, setMounted] = useState<boolean>(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Core Databases (Local Storage synchronized)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  // Form State: Add Employee
  const [empFormName, setEmpFormName] = useState("");
  const [empFormCode, setEmpFormCode] = useState("");
  const [empFormDept, setEmpFormDept] = useState("Stitching Section");
  const [empFormDesg, setEmpFormDesg] = useState("Stitching Operator");

  // Form State: Work Assignment
  const [assignFormEmp, setAssignFormEmp] = useState<string>("emp-1");
  const [assignFormOrder, setAssignFormOrder] = useState<string>("ord-1");
  const [assignFormNotes, setAssignFormNotes] = useState<string>("");

  // Form State: Add Order
  const [orderFormNo, setOrderFormNo] = useState("");
  const [orderFormProduct, setOrderFormProduct] = useState("");

  // Form State: Timesheet Submission
  const [timesheetDate, setTimesheetDate] = useState<string>("");
  const [timesheetEntries, setTimesheetEntries] = useState<Omit<TimesheetEntry, "id">[]>([
    { orderId: "ord-1", description: "", hours: 4 }
  ]);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string>("");

  // Set mounted state and load from local storage
  useEffect(() => {
    setMounted(true);
    setTimesheetDate(new Date().toISOString().split("T")[0]);

    const savedAsg = localStorage.getItem("hrms_v1_assignments");
    const savedAtt = localStorage.getItem("hrms_v1_attendance");
    const savedTs = localStorage.getItem("hrms_v1_timesheets");
    const savedOrders = localStorage.getItem("hrms_v1_orders");
    const savedEmployees = localStorage.getItem("hrms_v1_employees");

    if (savedAsg) setAssignments(JSON.parse(savedAsg));
    else setAssignments(SEED_ASSIGNMENTS);

    if (savedAtt) setAttendance(JSON.parse(savedAtt));
    else setAttendance(SEED_ATTENDANCE);

    if (savedTs) setTimesheets(JSON.parse(savedTs));
    else setTimesheets(SEED_TIMESHEETS);

    if (savedOrders) setOrders(JSON.parse(savedOrders));
    else setOrders(SEED_ORDERS);

    if (savedEmployees) setEmployees(JSON.parse(savedEmployees));
    else setEmployees(SEED_EMPLOYEES);
  }, []);

  // Save changes helpers
  const saveAssignments = (data: Assignment[]) => {
    setAssignments(data);
    localStorage.setItem("hrms_v1_assignments", JSON.stringify(data));
  };

  const saveAttendance = (data: AttendanceLog[]) => {
    setAttendance(data);
    localStorage.setItem("hrms_v1_attendance", JSON.stringify(data));
  };

  const saveTimesheets = (data: Timesheet[]) => {
    setTimesheets(data);
    localStorage.setItem("hrms_v1_timesheets", JSON.stringify(data));
  };

  const saveOrders = (data: Order[]) => {
    setOrders(data);
    localStorage.setItem("hrms_v1_orders", JSON.stringify(data));
  };

  const saveEmployees = (data: Employee[]) => {
    setEmployees(data);
    localStorage.setItem("hrms_v1_employees", JSON.stringify(data));
  };

  // Submit Handlers
  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empFormName.trim() || !empFormCode.trim()) return;

    // Check duplicate code
    const duplicate = employees.some(emp => emp.code.toUpperCase() === empFormCode.toUpperCase());
    if (duplicate) {
      alert("An employee with this code already exists.");
      return;
    }

    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: empFormName,
      code: empFormCode.toUpperCase(),
      department: empFormDept,
      designation: empFormDesg
    };

    saveEmployees([...employees, newEmp]);
    setEmpFormName("");
    setEmpFormCode("");
    alert(`Employee ${newEmp.name} (${newEmp.code}) registered successfully!`);
  };

  const handleAddOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderFormNo.trim() || !orderFormProduct.trim()) {
      alert("Please check that order number and product description are filled.");
      return;
    }

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: orderFormNo.toUpperCase(),
      productName: orderFormProduct
    };

    saveOrders([...orders, newOrder]);
    setOrderFormNo("");
    setOrderFormProduct("");
    alert(`Order ${newOrder.orderNumber} successfully registered!`);
  };

  // Admin: Assign Order
  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFormEmp || !assignFormOrder) return;

    // Check if duplicate assignment exists
    const duplicate = assignments.some(a => a.employeeId === assignFormEmp && a.orderId === assignFormOrder);
    if (duplicate) {
      alert("This order is already assigned to this employee.");
      return;
    }

    const newAsg: Assignment = {
      id: `asg-${Date.now()}`,
      employeeId: assignFormEmp,
      orderId: assignFormOrder,
      assignedDate: new Date().toISOString().split("T")[0],
      notes: assignFormNotes
    };

    saveAssignments([...assignments, newAsg]);
    setAssignFormNotes("");
    alert(`Assigned ${orders.find(o => o.id === assignFormOrder)?.orderNumber} successfully!`);
  };

  // Admin: Remove Assignment
  const handleRemoveAssignment = (id: string) => {
    if (confirm("Are you sure you want to remove this assignment?")) {
      saveAssignments(assignments.filter(a => a.id !== id));
    }
  };

  // Employee: Clock-in / Clock-out
  const handleClockIn = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const log = attendance.find(a => a.employeeId === activeEmpId && a.date === todayStr);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!log) {
      const newLog: AttendanceLog = {
        id: `att-${Date.now()}`,
        employeeId: activeEmpId,
        date: todayStr,
        checkIn: timeStr,
        status: "Clocked In"
      };
      saveAttendance([...attendance, newLog]);
    } else {
      const updated = attendance.map(a => 
        a.id === log.id 
          ? { ...a, checkIn: timeStr, checkOut: undefined, status: "Clocked In" as const }
          : a
      );
      saveAttendance(updated);
    }
  };

  const handleClockOut = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const log = attendance.find(a => a.employeeId === activeEmpId && a.date === todayStr);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!log) {
      const newLog: AttendanceLog = {
        id: `att-${Date.now()}`,
        employeeId: activeEmpId,
        date: todayStr,
        checkOut: timeStr,
        status: "Clocked Out"
      };
      saveAttendance([...attendance, newLog]);
    } else {
      const updated = attendance.map(a => 
        a.id === log.id 
          ? { ...a, checkOut: timeStr, status: "Clocked Out" as const }
          : a
      );
      saveAttendance(updated);
    }
  };

  // Employee: Add Row to Timesheet
  const handleAddTimesheetRow = () => {
    setTimesheetEntries([...timesheetEntries, { orderId: "ord-1", description: "", hours: 1 }]);
  };

  // Employee: Remove Row
  const handleRemoveTimesheetRow = (idx: number) => {
    if (timesheetEntries.length === 1) return;
    setTimesheetEntries(timesheetEntries.filter((_, i) => i !== idx));
  };

  // Employee: Submit Timesheet
  const handleTimesheetSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate entries
    const invalid = timesheetEntries.some(t => !t.description.trim() || isNaN(Number(t.hours)) || Number(t.hours) <= 0);
    if (invalid) {
      alert("Please ensure all rows have work descriptions and positive hour counts.");
      return;
    }

    const newTs: Timesheet = {
      id: `ts-${Date.now()}`,
      employeeId: activeEmpId,
      date: timesheetDate,
      entries: timesheetEntries.map((t, idx) => ({ 
        ...t, 
        hours: Number(t.hours),
        id: `tse-${Date.now()}-${idx}` 
      })),
      submittedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    saveTimesheets([...timesheets, newTs]);
    setTimesheetEntries([{ orderId: "ord-1", description: "", hours: 4 }]);
    setSubmitSuccessMsg("Timesheet submitted successfully to Admin records!");
    setTimeout(() => setSubmitSuccessMsg(""), 4000);
  };

  // Pre-hydration load guard
  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-xs font-semibold font-mono tracking-wider text-zinc-400">
        LOADING HRMS PORTAL...
      </div>
    );
  }

  // Computed data
  const currentEmployee = employees.find(e => e.id === activeEmpId);
  const employeeClockState = (() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const log = attendance.find(a => a.employeeId === activeEmpId && a.date === todayStr);
    return log || null;
  })();

  const employeeAssignments = assignments.filter(a => a.employeeId === activeEmpId);
  const employeeTimesheets = timesheets.filter(t => t.employeeId === activeEmpId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      
      {/* Sleek Minimalist Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-150 dark:border-zinc-850 bg-white dark:bg-zinc-900 px-4 py-2.5 flex flex-col sm:flex-row justify-between items-center gap-3">
        
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
          <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Atelier HRMS</h1>
        </div>

        {/* Sandbox switcher */}
        <div className="flex items-center gap-2 bg-zinc-150/40 dark:bg-zinc-800/45 p-1 rounded-md">
          <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase px-1 select-none">Role:</span>
          
          <div className="flex gap-0.5">
            <button
              onClick={() => setCurrentRole("Admin")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                currentRole === "Admin"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-650"
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => setCurrentRole("Employee")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                currentRole === "Employee"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-650"
              }`}
            >
              Employee
            </button>
          </div>

          {currentRole === "Employee" && (
            <select
              value={activeEmpId}
              onChange={e => setActiveEmpId(e.target.value)}
              className="h-6 text-[10px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-1 focus:outline-none font-bold text-zinc-700 dark:text-zinc-250 cursor-pointer"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          )}
        </div>

      </header>

      {/* Main Page Layout Container */}
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        
        {/* ===================================== */}
        {/*           ADMIN CONSOLE PANEL         */}
        {/* ===================================== */}
        {currentRole === "Admin" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            {/* Minimal KPI Stats Row */}
            <div className="grid grid-cols-3 gap-3 text-left">
              <div className="bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
                <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-bold uppercase tracking-wider block">Total Roster</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-550 block mt-0.5">{employees.length} operators</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
                <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-bold uppercase tracking-wider block">Today Present</span>
                <span className="text-base font-bold text-emerald-600 block mt-0.5">
                  {attendance.filter(a => a.date === new Date().toISOString().split("T")[0] && a.status === "Clocked In").length} active
                </span>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
                <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-bold uppercase tracking-wider block">Active Orders</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-50 block mt-0.5">{orders.length} batches</span>
              </div>
            </div>

            {/* Admin Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold gap-3 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap">
              <button 
                onClick={() => setAdminTab("assign")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer ${
                  adminTab === "assign" 
                    ? "border-amber-500 text-zinc-950 dark:text-zinc-50" 
                    : "border-transparent text-zinc-400"
                }`}
              >
                Assignments
              </button>
              <button 
                onClick={() => setAdminTab("status")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer ${
                  adminTab === "status" 
                    ? "border-amber-500 text-zinc-950 dark:text-zinc-50" 
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
                onClick={() => setAdminTab("customers")} 
                className={`py-1.5 px-1 border-b-2 font-bold tracking-tight transition-all shrink-0 whitespace-nowrap uppercase cursor-pointer ${
                  adminTab === "customers" 
                    ? "border-amber-500 text-zinc-955 dark:text-zinc-50" 
                    : "border-transparent text-zinc-400"
                }`}
              >
                Roster & Orders
              </button>
            </div>

            {/* Admin TAB: Assignments */}
            {adminTab === "assign" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-left animate-in fade-in duration-150">
                
                {/* Form to Assign Work */}
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3 shadow-sm">
                    <div>
                      <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">Assign Order</h3>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Link style batches to operator lines.</p>
                    </div>
                    
                    <form onSubmit={handleAssignSubmit} className="space-y-3 pt-1 text-xs">
                      
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Employee Name</label>
                        <select
                          value={assignFormEmp}
                          onChange={e => setAssignFormEmp(e.target.value)}
                          className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-805 rounded px-2 focus:outline-none text-xs font-semibold text-zinc-800 dark:text-zinc-250 cursor-pointer"
                        >
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Select Production Order</label>
                        <select
                          value={assignFormOrder}
                          onChange={e => setAssignFormOrder(e.target.value)}
                          className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-805 rounded px-2 focus:outline-none text-xs font-semibold text-zinc-800 dark:text-zinc-250 cursor-pointer"
                        >
                          {orders.map(o => (
                            <option key={o.id} value={o.id}>{o.orderNumber} &mdash; {o.productName}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Instructions / Notes</label>
                        <input
                          placeholder="E.g. Check stitching alignment..."
                          value={assignFormNotes}
                          onChange={e => setAssignFormNotes(e.target.value)}
                          className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-805 rounded px-2 focus:outline-none text-xs text-zinc-800 dark:text-zinc-250"
                        />
                      </div>

                      <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold h-8 rounded text-xs cursor-pointer transition-colors uppercase tracking-wider">Assign Order</button>
                    </form>
                  </div>
                </div>

                {/* Assignments List */}
                <div className="lg:col-span-2">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
                      <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Active Work Assignments Roster</span>
                    </div>

                    {assignments.length === 0 ? (
                      <div className="p-6 text-center text-zinc-450 italic text-[11px]">No active work assignments found.</div>
                    ) : (
                      <div className="overflow-x-auto text-[11px]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wide">
                              <th className="p-2">Employee</th>
                              <th className="p-2">Order Description</th>
                              <th className="p-2">Assigned Date</th>
                              <th className="p-2">Notes</th>
                              <th className="p-2 text-right pr-4">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                            {assignments.map(asg => {
                              const emp = employees.find(e => e.id === asg.employeeId);
                              const ord = orders.find(o => o.id === asg.orderId);
                              return (
                                <tr key={asg.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10">
                                  <td className="p-2">
                                    <p className="font-bold text-zinc-900 dark:text-zinc-100">{emp?.name}</p>
                                    <p className="text-[9px] text-zinc-400 font-mono">{emp?.code}</p>
                                  </td>
                                  <td className="p-2">
                                    <span className="font-bold text-amber-500 mr-1">{ord?.orderNumber}</span>
                                    <span className="text-zinc-600 dark:text-zinc-400">{ord?.productName}</span>
                                  </td>
                                  <td className="p-2 font-mono text-zinc-400">{asg.assignedDate}</td>
                                  <td className="p-2 text-zinc-550 max-w-[130px] truncate">{asg.notes || "—"}</td>
                                  <td className="p-2 text-right pr-4">
                                    <button 
                                      onClick={() => handleRemoveAssignment(asg.id)}
                                      className="p-1 hover:bg-red-50 text-red-500 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors"
                                      title="Delete assignment"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Admin TAB: Attendance Logs */}
            {adminTab === "status" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm text-left animate-in fade-in duration-150">
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
                  <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Today's Punch logs</span>
                </div>
                <div className="overflow-x-auto text-[11px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wide">
                        <th className="p-2">Employee</th>
                        <th className="p-2">Department</th>
                        <th className="p-2">Clock In</th>
                        <th className="p-2">Clock Out</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                      {employees.map(emp => {
                        const todayStr = new Date().toISOString().split("T")[0];
                        const log = attendance.find(a => a.employeeId === emp.id && a.date === todayStr);
                        return (
                          <tr key={emp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10">
                            <td className="p-2">
                              <p className="font-bold text-zinc-900 dark:text-zinc-100">{emp.name}</p>
                              <p className="text-[9px] text-zinc-450 font-mono">{emp.code}</p>
                            </td>
                            <td className="p-2 text-zinc-550">{emp.department}</td>
                            <td className="p-2 font-mono text-zinc-600 dark:text-zinc-400">{log?.checkIn || "—"}</td>
                            <td className="p-2 font-mono text-zinc-600 dark:text-zinc-400">{log?.checkOut || "—"}</td>
                            <td className="p-2 text-center">
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                log?.status === "Clocked In"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/10 dark:text-emerald-400 dark:border-emerald-900/40"
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
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm text-left animate-in fade-in duration-150">
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
                  <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Timesheet ledger logs</span>
                </div>

                {timesheets.length === 0 ? (
                  <div className="p-6 text-center text-zinc-400 italic text-[11px]">No timesheets submitted yet.</div>
                ) : (
                  <div className="divide-y divide-zinc-150 dark:divide-zinc-850 text-xs">
                    {timesheets.map(ts => {
                      const emp = employees.find(e => e.id === ts.employeeId);
                      const totalHrs = ts.entries.reduce((sum, e) => sum + e.hours, 0);

                      return (
                        <div key={ts.id} className="p-4 space-y-2 hover:bg-zinc-50/40 dark:hover:bg-zinc-850/10 transition-colors">
                          
                          <div className="flex justify-between items-center text-[11px]">
                            <div>
                              <span className="font-bold text-zinc-900 dark:text-zinc-50">{emp?.name}</span>
                              <span className="text-[10px] text-zinc-400 ml-2 font-mono">{ts.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded font-bold text-[10px] border border-zinc-200 dark:border-zinc-700">
                                {totalHrs} Hrs
                              </span>
                              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
                                Sub: {ts.submittedAt}
                              </span>
                            </div>
                          </div>

                          <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded p-2.5 space-y-2">
                            {ts.entries.map((entry, idx) => {
                              const ord = orders.find(o => o.id === entry.orderId);
                              return (
                                <div key={entry.id || idx} className="flex justify-between items-start gap-3 text-[11px]">
                                  <div className="flex gap-2.5 items-start">
                                    {entry.image && (
                                      <img 
                                        src={entry.image} 
                                        alt="Work proof" 
                                        className="h-8 w-8 object-cover rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:opacity-80 shrink-0"
                                        onClick={() => setPreviewImageUrl(entry.image || null)}
                                      />
                                    )}
                                    <div className="space-y-0.5 text-left">
                                      <span className="font-bold text-amber-500 font-mono mr-1">{ord?.orderNumber}</span>
                                      <span className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">{entry.description}</span>
                                    </div>
                                  </div>
                                  <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 shrink-0">{entry.hours} hr</span>
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Admin TAB: Workforce & Orders Directory */}
            {adminTab === "customers" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-left animate-in fade-in duration-150">
                
                {/* Left Forms column */}
                <div className="lg:col-span-1 space-y-4">
                  
                  {/* Create Employee */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3 shadow-sm">
                    <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-550 uppercase tracking-wider">Register Employee</h3>
                    <form onSubmit={handleAddEmployeeSubmit} className="space-y-2.5 pt-1 text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Full Name</label>
                        <input required placeholder="E.g. Rajesh Kumar" value={empFormName} onChange={e => setEmpFormName(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-805 rounded px-2.5 focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Employee Code</label>
                        <input required placeholder="E.g. EMP-105" value={empFormCode} onChange={e => setEmpFormCode(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded px-2.5 focus:outline-none font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Department</label>
                          <select value={empFormDept} onChange={e => setEmpFormDept(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded px-1 focus:outline-none font-bold text-zinc-700 dark:text-zinc-350 cursor-pointer">
                            <option value="Stitching Section">Stitching</option>
                            <option value="Quality Assurance">Quality QA</option>
                            <option value="Cutting Department">Cutting</option>
                            <option value="Finishing Section">Finishing</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Designation</label>
                          <input required placeholder="E.g. Stitcher" value={empFormDesg} onChange={e => setEmpFormDesg(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded px-2 focus:outline-none" />
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold h-8 rounded text-xs cursor-pointer transition-colors uppercase tracking-wide">Register</button>
                    </form>
                  </div>

                  {/* Create Order */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3 shadow-sm">
                    <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-550 uppercase tracking-wider">Register Order</h3>
                    <form onSubmit={handleAddOrderSubmit} className="space-y-2.5 pt-1 text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Order Number</label>
                        <input required placeholder="ORD-006" value={orderFormNo} onChange={e => setOrderFormNo(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded px-2.5 focus:outline-none font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Product Description</label>
                        <input required placeholder="E.g. Heavy Cotton Hoodie" value={orderFormProduct} onChange={e => setOrderFormProduct(e.target.value)} className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-955 dark:border-zinc-805 rounded px-2.5 focus:outline-none" />
                      </div>
                      <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold h-8 rounded text-xs cursor-pointer transition-colors uppercase tracking-wide">Register</button>
                    </form>
                  </div>

                </div>

                {/* Right lists column */}
                <div className="lg:col-span-2 space-y-4">
                  
                  {/* Workforce Directory */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
                      <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Employee roster Directory</span>
                    </div>
                    <div className="overflow-x-auto text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wide">
                            <th className="p-2.5">Name</th>
                            <th className="p-2.5">Code</th>
                            <th className="p-2.5">Department</th>
                            <th className="p-2.5 font-semibold">Designation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                          {employees.map(emp => (
                            <tr key={emp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10">
                              <td className="p-2.5 font-bold text-zinc-900 dark:text-zinc-150">{emp.name}</td>
                              <td className="p-2.5 font-mono text-zinc-550">{emp.code}</td>
                              <td className="p-2.5 text-zinc-550">{emp.department}</td>
                              <td className="p-2.5 text-zinc-550 font-semibold">{emp.designation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Registered Orders List */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955/20">
                      <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Garment Orders Book</span>
                    </div>
                    <div className="overflow-x-auto text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wide">
                            <th className="p-2.5">Order Number</th>
                            <th className="p-2.5">Product Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                          {orders.map(o => (
                            <tr key={o.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10">
                              <td className="p-2.5 font-bold text-amber-500 font-mono">{o.orderNumber}</td>
                              <td className="p-2.5 text-zinc-550 font-semibold">{o.productName}</td>
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
          <div className="space-y-4 animate-in fade-in duration-150 text-left">
            
            {/* Success notifications */}
            {submitSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-250 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-3 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-350 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-650" />
                <span>{submitSuccessMsg}</span>
              </div>
            )}

            {/* Profile greeting & Biometric Attendance card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-55 leading-tight">Welcome, {currentEmployee.name}</h2>
                  <p className="text-[10px] text-zinc-400 font-bold mt-0.5 uppercase tracking-wider">{currentEmployee.code} &bull; {currentEmployee.designation} &bull; {currentEmployee.department}</p>
                </div>
                {/* Status Indicator Dot */}
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                  employeeClockState?.status === "Clocked In"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/10 dark:text-emerald-450 dark:border-emerald-900/40"
                    : "bg-red-50 text-red-750 border-red-250 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30"
                }`}>
                  <span className={`h-1 w-1 rounded-full ${employeeClockState?.status === "Clocked In" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                  {employeeClockState?.status === "Clocked In" ? "Active" : "Offline"}
                </span>
              </div>

              {/* Big Attendance Click Target */}
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      onClick={handleClockOut}
                      className="w-full sm:w-44 py-2.5 bg-red-600 hover:bg-red-750 text-white font-bold rounded cursor-pointer transition-colors uppercase tracking-wider text-[10px] text-center select-none"
                    >
                      Clock Out
                    </button>
                  ) : (
                    <button
                      onClick={handleClockIn}
                      className="w-full sm:w-44 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer transition-colors uppercase tracking-wider text-[10px] text-center select-none"
                    >
                      Clock In
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column: My Assignments & History */}
              <div className="lg:col-span-1 space-y-4">
                
                {/* My Assignments list */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3 shadow-sm">
                  <span className="font-bold text-[10px] text-zinc-450 dark:text-zinc-500 uppercase tracking-wide block">My Active Jobs</span>
                  
                  {employeeAssignments.length === 0 ? (
                    <div className="p-3 text-center text-zinc-450 italic text-[11px] bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">No assignments.</div>
                  ) : (
                    <div className="space-y-2 text-xs font-semibold">
                      {employeeAssignments.map(asg => {
                        const ord = orders.find(o => o.id === asg.orderId);
                        return (
                          <div key={asg.id} className="p-2.5 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded">
                            <span className="font-bold text-amber-500 font-mono">{ord?.orderNumber}</span>
                            <h4 className="font-bold text-zinc-800 dark:text-zinc-300 mt-0.5 leading-tight">{ord?.productName}</h4>
                            {asg.notes && (
                              <p className="text-[9px] bg-amber-500/10 text-amber-600 border border-amber-500/10 p-1 rounded mt-1.5 font-medium leading-normal italic">
                                &ldquo;{asg.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* My Submission History */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3 shadow-sm">
                  <span className="font-bold text-[10px] text-zinc-455 dark:text-zinc-500 uppercase tracking-wide block">My Timesheet History</span>
                  
                  {employeeTimesheets.length === 0 ? (
                    <div className="text-zinc-400 italic text-[11px] p-2 bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center">No logs found.</div>
                  ) : (
                    <div className="space-y-2 text-xs font-semibold">
                      {employeeTimesheets.map(ts => {
                        const totalHours = ts.entries.reduce((sum, e) => sum + e.hours, 0);
                        return (
                          <div key={ts.id} className="flex justify-between items-center py-1.5 border-b border-zinc-150 dark:border-zinc-800">
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-zinc-300">{ts.date}</p>
                              <p className="text-[9px] text-zinc-400 font-mono mt-0.5">{ts.entries.length} items logged</p>
                            </div>
                            <span className="bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-300 px-1.5 py-0.5 rounded font-bold font-mono">
                              {totalHours} hrs
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Fill Timesheet Form */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-lg p-4 space-y-4 shadow-sm">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">Log Work Timesheet</h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Select orders to log hours worked and progress details.</p>
                  </div>

                  <form onSubmit={handleTimesheetSubmit} className="space-y-3 text-xs">
                    
                    {/* Date select */}
                    <div className="max-w-[150px] space-y-1">
                      <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Date</label>
                      <input
                        type="date"
                        value={timesheetDate}
                        onChange={e => setTimesheetDate(e.target.value)}
                        className="w-full h-8 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 rounded px-2 focus:outline-none font-bold"
                      />
                    </div>

                    {/* Timesheet Rows list */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block">Work Entries</span>
                      
                      {timesheetEntries.map((row, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-end sm:items-center bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 relative">
                          
                          {/* Order Select */}
                          <div className="w-full sm:w-1/3 text-left space-y-1">
                            <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Order</label>
                            <select
                              value={row.orderId}
                              onChange={e => {
                                const copy = [...timesheetEntries];
                                copy[idx].orderId = e.target.value;
                                setTimesheetEntries(copy);
                              }}
                              className="w-full h-8 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded px-1.5 text-xs font-semibold focus:outline-none focus:border-zinc-400 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                            >
                              {orders.map(o => {
                                const isAssigned = employeeAssignments.some(a => a.orderId === o.id);
                                return (
                                  <option key={o.id} value={o.id}>
                                    {o.orderNumber} {isAssigned ? "(Assigned)" : ""} &mdash; {o.productName}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Hours */}
                          <div className="w-full sm:w-16 text-left space-y-1">
                            <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Hours</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Hours"
                              value={row.hours}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                  const copy = [...timesheetEntries];
                                  copy[idx].hours = val as any;
                                  setTimesheetEntries(copy);
                                }
                              }}
                              className="w-full h-8 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded px-1 text-xs text-center focus:outline-none focus:border-zinc-400 text-zinc-800 dark:text-zinc-200 font-bold"
                            />
                          </div>

                          {/* Work Done */}
                          <div className="flex-1 w-full text-left space-y-1">
                            <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Work Done Description</label>
                            <input
                              required
                              placeholder="E.g. Stitched sleeves, finished lining..."
                              value={row.description}
                              onChange={e => {
                                const copy = [...timesheetEntries];
                                copy[idx].description = e.target.value;
                                setTimesheetEntries(copy);
                              }}
                              className="w-full h-8 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded px-2 text-xs focus:outline-none focus:border-zinc-400 font-semibold text-zinc-800 dark:text-zinc-250"
                            />
                          </div>

                          {/* Proof Photo */}
                          <div className="w-full sm:w-auto text-left space-y-1">
                            <label className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block">Proof Photo</label>
                            {row.image ? (
                              <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded h-8 text-xs font-semibold">
                                <img src={row.image} alt="Thumb" className="h-6 w-6 object-cover rounded cursor-pointer" onClick={() => setPreviewImageUrl(row.image || null)} />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...timesheetEntries];
                                    delete copy[idx].image;
                                    setTimesheetEntries(copy);
                                  }}
                                  className="text-[9px] text-red-500 hover:underline px-1 font-bold cursor-pointer"
                                >
                                  Clear
                                </button>
                              </div>
                            ) : (
                              <div className="relative h-8 w-24 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded flex items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-850">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async e => {
                                    const file = e.target.files?.[0] || null;
                                    if (file) {
                                      const compressed = await compressImage(file);
                                      const copy = [...timesheetEntries];
                                      copy[idx] = { ...copy[idx], image: compressed };
                                      setTimesheetEntries(copy);
                                    }
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <span className="text-[10px] font-bold text-zinc-400">Add Photo</span>
                              </div>
                            )}
                          </div>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveTimesheetRow(idx)}
                            disabled={timesheetEntries.length === 1}
                            className="absolute top-2 right-2 sm:relative sm:top-auto sm:right-auto sm:mt-4 p-1 hover:bg-red-50 text-red-500 dark:hover:bg-red-950/20 rounded cursor-pointer disabled:opacity-30 shrink-0"
                            title="Delete row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={handleAddTimesheetRow}
                        className="w-full sm:w-auto px-3 py-1.5 border border-zinc-200 hover:border-zinc-300 dark:border-zinc-850 text-zinc-700 dark:text-zinc-300 font-bold rounded flex items-center justify-center gap-1 h-8 cursor-pointer transition-colors text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Entry Line
                      </button>

                      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        <span className="font-extrabold text-[10px] text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                          Logged: <strong className="text-amber-500 text-xs font-mono font-black">{timesheetEntries.reduce((sum, e) => sum + e.hours, 0)}</strong> hrs
                        </span>
                        
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-205 text-white dark:text-zinc-900 font-bold rounded text-xs cursor-pointer shadow-sm shadow-zinc-500/10 h-8 uppercase tracking-wider"
                        >
                          Submit Log
                        </button>
                      </div>
                    </div>

                  </form>
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-150 dark:border-zinc-850">
              <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-wide">Work Proof Image</span>
              <button 
                onClick={() => setPreviewImageUrl(null)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-250 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pt-2 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImageUrl} alt="Attachment Proof Preview" className="max-h-[60vh] object-contain rounded" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
