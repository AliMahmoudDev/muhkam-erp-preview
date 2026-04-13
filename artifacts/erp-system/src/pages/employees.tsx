import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { authFetch } from "@/lib/auth-fetch";
import { safeArray } from "@/lib/safe-data";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import {
  UserCheck, Plus, Search, X, Pencil, Trash2, UserX,
  RefreshCw, FileText, Phone, Mail, IdCard, Building2,
  Briefcase, CalendarDays, Wallet, ChevronRight, CheckCircle,
  AlertCircle, Clock, History, Users,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;

/* ── Types ────────────────────────────────────────────────────── */
interface Employee {
  id: number; company_id: number; employee_code: string;
  first_name_ar: string; last_name_ar: string;
  first_name_en: string; last_name_en: string;
  email: string; phone?: string | null; personal_phone?: string | null;
  national_id?: string | null; job_title_id?: number | null; department_id?: number | null;
  hire_date: string; employment_status: string;
  salary?: number | null; currency: string;
  bank_account?: string | null; address_ar?: string | null; address_en?: string | null;
  city?: string | null; country?: string | null; notes?: string | null;
  department_name?: string | null; job_title_name?: string | null;
  created_at?: string; updated_at?: string;
}
interface Department { id: number; name_ar: string; name_en: string; description_ar?: string | null; created_at?: string; }
interface JobTitle    { id: number; name_ar: string; name_en: string; created_at?: string; }
interface StatusHistoryEntry { id: number; old_status?: string | null; new_status: string; reason?: string | null; changed_at?: string; }
interface EmpDocument { id: number; document_type: string; file_name: string; expiry_date?: string | null; verified_at?: string | null; notes?: string | null; created_at?: string; }

/* ── Status helpers ───────────────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = {
  active: "نشط", on_leave: "في إجازة", suspended: "موقوف", terminated: "منتهي الخدمة",
};
const STATUS_COLORS: Record<string, string> = {
  active: "erp-badge erp-badge-success", on_leave: "erp-badge erp-badge-warning",
  suspended: "erp-badge erp-badge-danger", terminated: "erp-badge erp-badge-info",
};
function StatusBadge({ status }: { status: string }) {
  return <span className={STATUS_COLORS[status] ?? "erp-badge"}>{STATUS_LABELS[status] ?? status}</span>;
}

/* ── Blank form ───────────────────────────────────────────────── */
function blankEmp(): Partial<Employee> {
  return {
    first_name_ar: "", last_name_ar: "", first_name_en: "", last_name_en: "",
    email: "", phone: "", personal_phone: "", national_id: "",
    job_title_id: null, department_id: null,
    hire_date: new Date().toISOString().split("T")[0],
    salary: 0, currency: "EGP", bank_account: "",
    address_ar: "", address_en: "", city: "", country: "مصر", notes: "",
  };
}

/* ══════════════════════════════════════════════════════════════ */
export default function Employees() {
  const { user }        = useAuth();
  const qc              = useQueryClient();
  const { toast }       = useToast();
  const canManage       = hasPermission(user, "can_manage_employees");
  const canViewSalary   = hasPermission(user, "can_view_employee_salary");

  const [tab, setTab]   = useState<"employees" | "departments" | "job-titles">("employees");
  const [search, setSearch]   = useState("");
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "docs" | "contacts" | "history">("info");
  const [showForm, setShowForm] = useState(false);
  const [editEmp, setEditEmp]  = useState<Partial<Employee>>(blankEmp());
  const [editId, setEditId]    = useState<number | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ emp: Employee; open: boolean } | null>(null);
  const [newStatus, setNewStatus]   = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [deleteId, setDeleteId]    = useState<number | null>(null);
  const [docForm, setDocForm]  = useState({ document_type: "", file_name: "", expiry_date: "", notes: "" });
  const [showDocForm, setShowDocForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", relationship: "", phone: "", email: "" });
  const [showContactForm, setShowContactForm] = useState(false);

  /* ── Queries ─────────────────────────────────────────────── */
  const { data: empsRaw, isLoading: empsLoading } = useQuery({
    queryKey: ["/api/employees", search, deptFilter, statusFilter],
    queryFn:  () => authFetch(api(`/api/employees?search=${encodeURIComponent(search)}&department_id=${deptFilter}&status=${statusFilter}`)).then(r => r.json()),
  });
  const employees: Employee[] = safeArray(empsRaw);

  const { data: deptsRaw, isLoading: deptsLoading } = useQuery({
    queryKey: ["/api/departments"],
    queryFn:  () => authFetch(api("/api/departments")).then(r => r.json()),
  });
  const departments: Department[] = safeArray(deptsRaw);

  const { data: jtsRaw, isLoading: jtsLoading } = useQuery({
    queryKey: ["/api/job-titles"],
    queryFn:  () => authFetch(api("/api/job-titles")).then(r => r.json()),
  });
  const jobTitles: JobTitle[] = safeArray(jtsRaw);

  const { data: histRaw } = useQuery({
    queryKey: ["/api/employees", selected?.id, "history"],
    queryFn:  () => selected ? authFetch(api(`/api/employees/${selected.id}/history`)).then(r => r.json()) : Promise.resolve([]),
    enabled:  !!selected && detailTab === "history",
  });
  const history: StatusHistoryEntry[] = safeArray(histRaw);

  const { data: docsRaw } = useQuery({
    queryKey: ["/api/employees", selected?.id, "documents"],
    queryFn:  () => selected ? authFetch(api(`/api/employees/${selected.id}/documents`)).then(r => r.json()) : Promise.resolve([]),
    enabled:  !!selected && detailTab === "docs",
  });
  const documents: EmpDocument[] = safeArray(docsRaw);

  const { data: contactsRaw } = useQuery({
    queryKey: ["/api/employees", selected?.id, "contacts"],
    queryFn:  () => selected ? authFetch(api(`/api/employees/${selected.id}/contacts`)).then(r => r.json()) : Promise.resolve([]),
    enabled:  !!selected && detailTab === "contacts",
  });
  const contacts: Array<{ id: number; name: string; relationship?: string; phone?: string; email?: string; }> = safeArray(contactsRaw);

  /* ── Mutations ───────────────────────────────────────────── */
  const createEmp = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      authFetch(api("/api/employees"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees"] }); setShowForm(false); toast({ title: "تمت إضافة الموظف بنجاح" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const updateEmp = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      authFetch(api(`/api/employees/${editId}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees"] }); setShowForm(false); toast({ title: "تم تحديث بيانات الموظف" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const deleteEmp = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employees/${id}`), { method: "DELETE" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees"] }); setDeleteId(null); setSelected(null); toast({ title: "تم حذف الموظف" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, new_status, reason }: { id: number; new_status: string; reason: string }) =>
      authFetch(api(`/api/employees/${id}/status`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_status, reason }) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees"] }); setStatusDialog(null); toast({ title: "تم تغيير حالة الموظف" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const addDoc = useMutation({
    mutationFn: (data: typeof docForm) =>
      authFetch(api(`/api/employees/${selected?.id}/documents`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees", selected?.id, "documents"] }); setShowDocForm(false); setDocForm({ document_type: "", file_name: "", expiry_date: "", notes: "" }); toast({ title: "تمت إضافة المستند" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const deleteDoc = useMutation({
    mutationFn: (docId: number) =>
      authFetch(api(`/api/employees/${selected?.id}/documents/${docId}`), { method: "DELETE" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees", selected?.id, "documents"] }); toast({ title: "تم حذف المستند" }); },
  });
  const addContact = useMutation({
    mutationFn: (data: typeof contactForm) =>
      authFetch(api(`/api/employees/${selected?.id}/contacts`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, contact_type: "emergency" }) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees", selected?.id, "contacts"] }); setShowContactForm(false); setContactForm({ name: "", relationship: "", phone: "", email: "" }); toast({ title: "تمت إضافة جهة الاتصال" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const deleteContact = useMutation({
    mutationFn: (cid: number) =>
      authFetch(api(`/api/employees/${selected?.id}/contacts/${cid}`), { method: "DELETE" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees", selected?.id, "contacts"] }); toast({ title: "تم حذف جهة الاتصال" }); },
  });

  /* ── Department mutations ────────────────────────────────── */
  const [deptForm, setDeptForm] = useState({ name_ar: "", name_en: "", description_ar: "" });
  const [deptEditId, setDeptEditId] = useState<number | null>(null);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const createDept = useMutation({
    mutationFn: (data: typeof deptForm) =>
      authFetch(api(deptEditId ? `/api/departments/${deptEditId}` : "/api/departments"), { method: deptEditId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/departments"] }); setShowDeptForm(false); setDeptEditId(null); setDeptForm({ name_ar: "", name_en: "", description_ar: "" }); toast({ title: deptEditId ? "تم تحديث القسم" : "تمت إضافة القسم" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const deleteDept = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/departments/${id}`), { method: "DELETE" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/departments"] }); toast({ title: "تم حذف القسم" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  /* ── Job Title mutations ──────────────────────────────────── */
  const [jtForm, setJtForm] = useState({ name_ar: "", name_en: "" });
  const [jtEditId, setJtEditId] = useState<number | null>(null);
  const [showJtForm, setShowJtForm] = useState(false);
  const createJt = useMutation({
    mutationFn: (data: typeof jtForm) =>
      authFetch(api(jtEditId ? `/api/job-titles/${jtEditId}` : "/api/job-titles"), { method: jtEditId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/job-titles"] }); setShowJtForm(false); setJtEditId(null); setJtForm({ name_ar: "", name_en: "" }); toast({ title: jtEditId ? "تم تحديث المسمى" : "تمت إضافة المسمى الوظيفي" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const deleteJt = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/job-titles/${id}`), { method: "DELETE" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/job-titles"] }); toast({ title: "تم حذف المسمى الوظيفي" }); },
    onError:   (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  /* ── Filtered employees ───────────────────────────────────── */
  const filtered = useMemo(() => employees.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.first_name_ar.includes(search) || e.last_name_ar.includes(search) ||
      e.first_name_en.toLowerCase().includes(q) || e.last_name_en.toLowerCase().includes(q) ||
      e.employee_code.toLowerCase().includes(q) || (e.national_id ?? "").includes(search) ||
      (e.email ?? "").toLowerCase().includes(q)
    );
  }), [employees, search]);

  /* ── Helpers ─────────────────────────────────────────────── */
  const set = (k: keyof Employee, v: unknown) => setEditEmp(prev => ({ ...prev, [k]: v }));

  function openCreate() {
    setEditId(null);
    setEditEmp(blankEmp());
    setShowForm(true);
  }
  function openEdit(emp: Employee) {
    setEditId(emp.id);
    setEditEmp({ ...emp });
    setShowForm(true);
  }
  function saveEmployee() {
    const payload = { ...editEmp, salary: Number(editEmp.salary ?? 0) };
    if (editId) updateEmp.mutate(payload);
    else        createEmp.mutate(payload);
  }

  const totalActive = employees.filter(e => e.employment_status === "active").length;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">إدارة الموظفين</h1>
          <span className="erp-badge erp-badge-info">{totalActive} نشط</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-2">
        {([
          { key: "employees",  label: "الموظفون",           icon: Users },
          { key: "departments", label: "الأقسام",            icon: Building2 },
          { key: "job-titles",  label: "المسميات الوظيفية",  icon: Briefcase },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-all ${
              tab === t.key ? "bg-amber-500/20 text-amber-300 border-b-2 border-amber-400" : "text-white/50 hover:text-white/80"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── EMPLOYEES TAB ─────────────────────────────────────── */}
      {tab === "employees" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* List Panel */}
          <div className="xl:col-span-2 space-y-3">
            {/* Search & Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-white/40" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الكود أو الرقم القومي..."
                  className="erp-input w-full pr-8 text-sm"
                />
              </div>
              <select
                value={deptFilter} onChange={e => setDeptFilter(e.target.value === "" ? "" : Number(e.target.value))}
                className="erp-input text-sm"
              >
                <option value="">كل الأقسام</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
              </select>
              <select
                value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="erp-input text-sm"
              >
                <option value="">كل الحالات</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {canManage && (
                <button onClick={openCreate} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
                  <Plus size={14} /> موظف جديد
                </button>
              )}
            </div>

            {/* Table */}
            <div className="erp-card overflow-x-auto">
              {empsLoading ? <TableSkeleton /> : (
                <table className="erp-table w-full">
                  <thead>
                    <tr className="erp-table-header">
                      <th className="p-3 text-right text-xs">الكود</th>
                      <th className="p-3 text-right text-xs">الاسم</th>
                      <th className="p-3 text-right text-xs">القسم</th>
                      <th className="p-3 text-right text-xs">المسمى الوظيفي</th>
                      <th className="p-3 text-right text-xs">الحالة</th>
                      <th className="p-3 text-right text-xs">تاريخ التعيين</th>
                      {canViewSalary && <th className="p-3 text-right text-xs">الراتب</th>}
                      <th className="p-3 text-right text-xs"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-12 text-white/40">
                        <div className="erp-empty-state"><UserCheck size={36} className="mb-2 opacity-30" /><p>لا توجد بيانات موظفين</p></div>
                      </td></tr>
                    )}
                    {filtered.map(emp => (
                      <tr
                        key={emp.id}
                        className={`erp-table-row cursor-pointer ${selected?.id === emp.id ? "bg-amber-500/10" : ""}`}
                        onClick={() => { setSelected(emp); setDetailTab("info"); }}
                      >
                        <td className="p-3 text-xs font-mono text-amber-300">{emp.employee_code}</td>
                        <td className="p-3">
                          <div className="font-semibold text-sm">{emp.first_name_ar} {emp.last_name_ar}</div>
                          <div className="text-xs text-white/40">{emp.email}</div>
                        </td>
                        <td className="p-3 text-sm text-white/70">{emp.department_name ?? "—"}</td>
                        <td className="p-3 text-sm text-white/70">{emp.job_title_name ?? "—"}</td>
                        <td className="p-3"><StatusBadge status={emp.employment_status} /></td>
                        <td className="p-3 text-sm text-white/60 font-mono">{emp.hire_date}</td>
                        {canViewSalary && (
                          <td className="p-3 text-sm text-emerald-300 font-mono">
                            {emp.salary != null ? `${emp.salary.toLocaleString("ar-EG")} ${emp.currency}` : "—"}
                          </td>
                        )}
                        <td className="p-3">
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {canManage && (
                              <>
                                <button onClick={() => openEdit(emp)} className="erp-btn erp-btn-ghost p-1" title="تعديل">
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => { setStatusDialog({ emp, open: true }); setNewStatus(emp.employment_status); setStatusReason(""); }} className="erp-btn erp-btn-ghost p-1" title="تغيير الحالة">
                                  <RefreshCw size={13} />
                                </button>
                                <button onClick={() => setDeleteId(emp.id)} className="erp-btn erp-btn-ghost p-1 text-red-400" title="حذف">
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                            <button onClick={() => { setSelected(emp); setDetailTab("info"); }} className="erp-btn erp-btn-ghost p-1 text-amber-400" title="التفاصيل">
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="erp-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold text-white">{selected.first_name_ar} {selected.last_name_ar}</div>
                  <div className="text-xs text-amber-300 font-mono">{selected.employee_code}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>
              <StatusBadge status={selected.employment_status} />

              {/* Detail Tabs */}
              <div className="flex gap-1 flex-wrap">
                {([
                  { key: "info",     label: "البيانات",   icon: IdCard },
                  { key: "docs",     label: "المستندات",  icon: FileText },
                  { key: "contacts", label: "اتصال طوارئ", icon: Phone },
                  { key: "history",  label: "السجل",      icon: History },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setDetailTab(t.key)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-all ${
                      detailTab === t.key ? "bg-amber-500/20 text-amber-300" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    <t.icon size={11} /> {t.label}
                  </button>
                ))}
              </div>

              {/* Info Tab */}
              {detailTab === "info" && (
                <div className="space-y-2 text-sm">
                  <InfoRow icon={Mail}          label="البريد الإلكتروني"  value={selected.email} />
                  <InfoRow icon={Phone}          label="الهاتف"             value={selected.phone} />
                  <InfoRow icon={Phone}          label="الهاتف الشخصي"      value={selected.personal_phone} />
                  <InfoRow icon={IdCard}         label="الرقم القومي"       value={selected.national_id} />
                  <InfoRow icon={Building2}      label="القسم"              value={selected.department_name} />
                  <InfoRow icon={Briefcase}      label="المسمى الوظيفي"    value={selected.job_title_name} />
                  <InfoRow icon={CalendarDays}   label="تاريخ التعيين"      value={selected.hire_date} />
                  {canViewSalary && selected.salary != null && (
                    <InfoRow icon={Wallet} label="الراتب" value={`${selected.salary.toLocaleString("ar-EG")} ${selected.currency}`} />
                  )}
                  {canViewSalary && selected.bank_account && (
                    <InfoRow icon={Wallet} label="الحساب البنكي" value={selected.bank_account} />
                  )}
                  {selected.address_ar && <InfoRow icon={Building2} label="العنوان" value={`${selected.address_ar}${selected.city ? ` — ${selected.city}` : ""}${selected.country ? ` — ${selected.country}` : ""}`} />}
                  {selected.notes && <div className="bg-white/5 rounded p-2 text-white/60 text-xs">{selected.notes}</div>}
                  {canManage && (
                    <button onClick={() => openEdit(selected)} className="erp-btn erp-btn-ghost w-full flex items-center justify-center gap-1 text-xs mt-2">
                      <Pencil size={12} /> تعديل البيانات
                    </button>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {detailTab === "docs" && (
                <div className="space-y-2">
                  {canManage && (
                    <button onClick={() => setShowDocForm(true)} className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1">
                      <Plus size={12} /> إضافة مستند
                    </button>
                  )}
                  {documents.length === 0 && <p className="text-white/40 text-xs text-center py-4">لا توجد مستندات</p>}
                  {documents.map(doc => (
                    <div key={doc.id} className="bg-white/5 rounded-lg p-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-white">{doc.file_name}</div>
                        <div className="text-xs text-white/50">{doc.document_type}</div>
                        {doc.expiry_date && <div className="text-xs text-amber-300">ينتهي: {doc.expiry_date}</div>}
                        {doc.verified_at ? (
                          <div className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={10} /> تم التحقق</div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-white/30"><AlertCircle size={10} /> لم يُتحقق منه</div>
                        )}
                      </div>
                      {canManage && (
                        <button onClick={() => deleteDoc.mutate(doc.id)} className="text-red-400/60 hover:text-red-400"><Trash2 size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Contacts Tab */}
              {detailTab === "contacts" && (
                <div className="space-y-2">
                  {canManage && (
                    <button onClick={() => setShowContactForm(true)} className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1">
                      <Plus size={12} /> إضافة جهة اتصال
                    </button>
                  )}
                  {contacts.length === 0 && <p className="text-white/40 text-xs text-center py-4">لا توجد جهات اتصال</p>}
                  {contacts.map(c => (
                    <div key={c.id} className="bg-white/5 rounded-lg p-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-white">{c.name}</div>
                        {c.relationship && <div className="text-xs text-white/50">{c.relationship}</div>}
                        {c.phone && <div className="text-xs text-amber-300 font-mono">{c.phone}</div>}
                      </div>
                      {canManage && (
                        <button onClick={() => deleteContact.mutate(c.id)} className="text-red-400/60 hover:text-red-400"><Trash2 size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* History Tab */}
              {detailTab === "history" && (
                <div className="space-y-2">
                  {history.length === 0 && <p className="text-white/40 text-xs text-center py-4">لا يوجد سجل</p>}
                  {history.map(h => (
                    <div key={h.id} className="flex gap-3 text-xs">
                      <div className="mt-0.5"><Clock size={12} className="text-amber-300/60" /></div>
                      <div>
                        <div className="flex items-center gap-1">
                          {h.old_status && <><StatusBadge status={h.old_status} /><span className="text-white/30">→</span></>}
                          <StatusBadge status={h.new_status} />
                        </div>
                        {h.reason && <div className="text-white/50 mt-0.5">{h.reason}</div>}
                        <div className="text-white/30">{h.changed_at ? new Date(h.changed_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── DEPARTMENTS TAB ────────────────────────────────────── */}
      {tab === "departments" && (
        <div className="erp-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2"><Building2 size={16} className="text-amber-400" /> الأقسام</h2>
            {canManage && (
              <button onClick={() => { setDeptEditId(null); setDeptForm({ name_ar: "", name_en: "", description_ar: "" }); setShowDeptForm(true); }} className="erp-btn erp-btn-primary text-xs flex items-center gap-1">
                <Plus size={12} /> قسم جديد
              </button>
            )}
          </div>
          {deptsLoading ? <TableSkeleton /> : (
            <table className="erp-table w-full">
              <thead>
                <tr className="erp-table-header">
                  <th className="p-3 text-right text-xs">الاسم (عربي)</th>
                  <th className="p-3 text-right text-xs">الاسم (إنجليزي)</th>
                  <th className="p-3 text-right text-xs">الوصف</th>
                  <th className="p-3 text-right text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-white/40">لا توجد أقسام</td></tr>
                )}
                {departments.map(d => (
                  <tr key={d.id} className="erp-table-row">
                    <td className="p-3 font-semibold text-sm">{d.name_ar}</td>
                    <td className="p-3 text-sm text-white/60">{d.name_en}</td>
                    <td className="p-3 text-xs text-white/50">{d.description_ar ?? "—"}</td>
                    <td className="p-3">
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={() => { setDeptEditId(d.id); setDeptForm({ name_ar: d.name_ar, name_en: d.name_en, description_ar: d.description_ar ?? "" }); setShowDeptForm(true); }} className="erp-btn erp-btn-ghost p-1"><Pencil size={13} /></button>
                          <button onClick={() => deleteDept.mutate(d.id)} className="erp-btn erp-btn-ghost p-1 text-red-400"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── JOB TITLES TAB ─────────────────────────────────────── */}
      {tab === "job-titles" && (
        <div className="erp-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2"><Briefcase size={16} className="text-amber-400" /> المسميات الوظيفية</h2>
            {canManage && (
              <button onClick={() => { setJtEditId(null); setJtForm({ name_ar: "", name_en: "" }); setShowJtForm(true); }} className="erp-btn erp-btn-primary text-xs flex items-center gap-1">
                <Plus size={12} /> مسمى جديد
              </button>
            )}
          </div>
          {jtsLoading ? <TableSkeleton /> : (
            <table className="erp-table w-full">
              <thead>
                <tr className="erp-table-header">
                  <th className="p-3 text-right text-xs">المسمى (عربي)</th>
                  <th className="p-3 text-right text-xs">المسمى (إنجليزي)</th>
                  <th className="p-3 text-right text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {jobTitles.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-8 text-white/40">لا توجد مسميات وظيفية</td></tr>
                )}
                {jobTitles.map(jt => (
                  <tr key={jt.id} className="erp-table-row">
                    <td className="p-3 font-semibold text-sm">{jt.name_ar}</td>
                    <td className="p-3 text-sm text-white/60">{jt.name_en}</td>
                    <td className="p-3">
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={() => { setJtEditId(jt.id); setJtForm({ name_ar: jt.name_ar, name_en: jt.name_en }); setShowJtForm(true); }} className="erp-btn erp-btn-ghost p-1"><Pencil size={13} /></button>
                          <button onClick={() => deleteJt.mutate(jt.id)} className="erp-btn erp-btn-ghost p-1 text-red-400"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════ */}

      {/* Employee Create/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">{editId ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="الاسم الأول (عربي) *">
                  <input value={editEmp.first_name_ar ?? ""} onChange={e => set("first_name_ar", e.target.value)} className="erp-input w-full" placeholder="محمد" />
                </Field>
                <Field label="الاسم الأخير (عربي) *">
                  <input value={editEmp.last_name_ar ?? ""} onChange={e => set("last_name_ar", e.target.value)} className="erp-input w-full" placeholder="أحمد" />
                </Field>
              </div>
              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="الهاتف">
                  <input value={editEmp.phone ?? ""} onChange={e => set("phone", e.target.value)} className="erp-input w-full" placeholder="+20..." />
                </Field>
              </div>
              {/* HR */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="القسم">
                  <select value={editEmp.department_id ?? ""} onChange={e => set("department_id", e.target.value ? Number(e.target.value) : null)} className="erp-input w-full">
                    <option value="">— اختر القسم —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
                  </select>
                </Field>
                <Field label="المسمى الوظيفي">
                  <select value={editEmp.job_title_id ?? ""} onChange={e => set("job_title_id", e.target.value ? Number(e.target.value) : null)} className="erp-input w-full">
                    <option value="">— اختر المسمى —</option>
                    {jobTitles.map(jt => <option key={jt.id} value={jt.id}>{jt.name_ar}</option>)}
                  </select>
                </Field>
                <Field label="تاريخ التعيين *">
                  <input type="date" value={editEmp.hire_date ?? ""} onChange={e => set("hire_date", e.target.value)} className="erp-input w-full" />
                </Field>
                <Field label="الراتب الأساسي *">
                  <div className="flex gap-2 w-full">
                    <input type="number" value={editEmp.salary ?? 0} onChange={e => set("salary", Number(e.target.value))} className="erp-input flex-1 min-w-0" min={0} />
                    <select value={editEmp.currency ?? "EGP"} onChange={e => set("currency", e.target.value)} className="erp-input w-20 shrink-0">
                      {["EGP", "SAR", "AED", "USD"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </Field>
              </div>
              <Field label="العنوان">
                <input value={editEmp.address_ar ?? ""} onChange={e => set("address_ar", e.target.value)} className="erp-input w-full" placeholder="العنوان الكامل" />
              </Field>
              <Field label="ملاحظات">
                <textarea value={editEmp.notes ?? ""} onChange={e => set("notes", e.target.value)} className="erp-input w-full" rows={2} />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={saveEmployee}
                disabled={createEmp.isPending || updateEmp.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {(createEmp.isPending || updateEmp.isPending) ? "جاري الحفظ..." : (editId ? "حفظ التعديلات" : "إضافة الموظف")}
              </button>
              <button onClick={() => setShowForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Dialog */}
      {statusDialog?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><RefreshCw size={16} className="text-amber-400" /> تغيير حالة الموظف</h2>
              <button onClick={() => setStatusDialog(null)} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-white/60">الموظف: <strong className="text-white">{statusDialog.emp.first_name_ar} {statusDialog.emp.last_name_ar}</strong></div>
              <Field label="الحالة الجديدة">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="erp-input w-full">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="السبب">
                <input value={statusReason} onChange={e => setStatusReason(e.target.value)} className="erp-input w-full" placeholder="سبب التغيير..." />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button
                onClick={() => changeStatus.mutate({ id: statusDialog.emp.id, new_status: newStatus, reason: statusReason })}
                disabled={changeStatus.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {changeStatus.isPending ? "جاري التغيير..." : "تأكيد"}
              </button>
              <button onClick={() => setStatusDialog(null)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm p-5 text-center" dir="rtl">
            <UserX size={36} className="text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">حذف الموظف</h2>
            <p className="text-white/50 text-sm mb-4">هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذه العملية.</p>
            <div className="flex gap-2">
              <button onClick={() => deleteEmp.mutate(deleteId)} disabled={deleteEmp.isPending} className="erp-btn flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30">
                {deleteEmp.isPending ? "جاري الحذف..." : "حذف"}
              </button>
              <button onClick={() => setDeleteId(null)} className="erp-btn erp-btn-ghost flex-1">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Form */}
      {showDocForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><FileText size={16} className="text-amber-400" /> إضافة مستند</h2>
              <button onClick={() => setShowDocForm(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="نوع المستند *">
                <select value={docForm.document_type} onChange={e => setDocForm(p => ({ ...p, document_type: e.target.value }))} className="erp-input w-full">
                  <option value="">— اختر —</option>
                  {["بطاقة هوية وطنية", "جواز سفر", "عقد عمل", "شهادة مؤهل", "شهادة خبرة", "أخرى"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="اسم الملف *">
                <input value={docForm.file_name} onChange={e => setDocForm(p => ({ ...p, file_name: e.target.value }))} className="erp-input w-full" placeholder="مثال: هوية_محمد_أحمد.pdf" />
              </Field>
              <Field label="تاريخ الانتهاء">
                <input type="date" value={docForm.expiry_date} onChange={e => setDocForm(p => ({ ...p, expiry_date: e.target.value }))} className="erp-input w-full" />
              </Field>
              <Field label="ملاحظات">
                <input value={docForm.notes} onChange={e => setDocForm(p => ({ ...p, notes: e.target.value }))} className="erp-input w-full" />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button onClick={() => addDoc.mutate(docForm)} disabled={addDoc.isPending} className="erp-btn erp-btn-primary flex-1">
                {addDoc.isPending ? "جاري الإضافة..." : "إضافة"}
              </button>
              <button onClick={() => setShowDocForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Form */}
      {showContactForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Phone size={16} className="text-amber-400" /> إضافة جهة اتصال طوارئ</h2>
              <button onClick={() => setShowContactForm(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="الاسم *">
                <input value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} className="erp-input w-full" />
              </Field>
              <Field label="صلة القرابة">
                <input value={contactForm.relationship} onChange={e => setContactForm(p => ({ ...p, relationship: e.target.value }))} className="erp-input w-full" placeholder="أب / أم / زوج..." />
              </Field>
              <Field label="رقم الهاتف">
                <input value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} className="erp-input w-full" />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button onClick={() => addContact.mutate(contactForm)} disabled={addContact.isPending} className="erp-btn erp-btn-primary flex-1">
                {addContact.isPending ? "جاري الإضافة..." : "إضافة"}
              </button>
              <button onClick={() => setShowContactForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Department Form */}
      {showDeptForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Building2 size={16} className="text-amber-400" /> {deptEditId ? "تعديل القسم" : "إضافة قسم جديد"}</h2>
              <button onClick={() => setShowDeptForm(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="الاسم (عربي) *">
                <input value={deptForm.name_ar} onChange={e => setDeptForm(p => ({ ...p, name_ar: e.target.value }))} className="erp-input w-full" placeholder="قسم المبيعات" />
              </Field>
              <Field label="الاسم (إنجليزي)">
                <input value={deptForm.name_en} onChange={e => setDeptForm(p => ({ ...p, name_en: e.target.value }))} className="erp-input w-full" placeholder="Sales Department" />
              </Field>
              <Field label="الوصف">
                <input value={deptForm.description_ar} onChange={e => setDeptForm(p => ({ ...p, description_ar: e.target.value }))} className="erp-input w-full" />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button onClick={() => createDept.mutate(deptForm)} disabled={createDept.isPending} className="erp-btn erp-btn-primary flex-1">
                {createDept.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button onClick={() => setShowDeptForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Job Title Form */}
      {showJtForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Briefcase size={16} className="text-amber-400" /> {jtEditId ? "تعديل المسمى" : "إضافة مسمى وظيفي"}</h2>
              <button onClick={() => setShowJtForm(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="المسمى (عربي) *">
                <input value={jtForm.name_ar} onChange={e => setJtForm(p => ({ ...p, name_ar: e.target.value }))} className="erp-input w-full" placeholder="مدير مبيعات" />
              </Field>
              <Field label="المسمى (إنجليزي)">
                <input value={jtForm.name_en} onChange={e => setJtForm(p => ({ ...p, name_en: e.target.value }))} className="erp-input w-full" placeholder="Sales Manager" />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button onClick={() => createJt.mutate(jtForm)} disabled={createJt.isPending} className="erp-btn erp-btn-primary flex-1">
                {createJt.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button onClick={() => setShowJtForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small helper components ──────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value?: string | null | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={12} className="text-amber-400/60 mt-0.5 shrink-0" />
      <div>
        <div className="text-white/40">{label}</div>
        <div className="text-white/80">{value}</div>
      </div>
    </div>
  );
}
