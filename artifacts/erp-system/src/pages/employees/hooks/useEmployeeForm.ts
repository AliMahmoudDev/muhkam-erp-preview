/**
 * hooks/useEmployeeForm.ts
 * Employee create/edit form state, inline dept/job-title creation, and
 * the employee CRUD mutations (create, update).
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { Employee, Department, JobTitle } from '../types';

export function blankEmp(): Partial<Employee> {
  return {
    first_name_ar: '',
    last_name_ar: '',
    first_name_en: '',
    last_name_en: '',
    phone: '',
    national_id: '',
    national_id_image: null,
    email: '',
    job_title_id: null,
    department_id: null,
    branch_id: null,
    hire_date: new Date().toISOString().split('T')[0],
    salary: 0,
    currency: 'EGP',
    salary_type: 'fixed',
    commission_rate: null,
    commission_basis: null,
    commission_scope_dept_id: null,
    bank_account: '',
    address_ar: '',
    country: 'مصر',
    notes: '',
  };
}

export function useEmployeeForm() {
  const qc = useQueryClient();
  const { toast } = useToast();

  /* ── Form state ───────────────────────────────────────────── */
  const [showForm, setShowForm] = useState(false);
  const [editEmp, setEditEmp] = useState<Partial<Employee>>(blankEmp());
  const [editId, setEditId] = useState<number | null>(null);

  /* ── Inline dept add ──────────────────────────────────────── */
  const [showInlineDept, setShowInlineDept] = useState(false);
  const [inlineDept, setInlineDept] = useState({ name_ar: '' });

  /* ── Inline job title add ─────────────────────────────────── */
  const [showInlineJt, setShowInlineJt] = useState(false);
  const [inlineJt, setInlineJt] = useState({ name_ar: '' });

  const set = (k: keyof Employee, v: unknown) =>
    setEditEmp((prev) => ({ ...prev, [k]: v }));

  function openCreate() {
    setEditId(null);
    setEditEmp(blankEmp());
    setShowForm(true);
  }

  function openEdit(emp: Employee) {
    const inferredType: 'fixed' | 'commission' | 'fixed_plus_commission' =
      emp.salary_type ??
      ((emp.commission_rate ?? 0) > 0 && (emp.salary ?? 0) > 0
        ? 'fixed_plus_commission'
        : (emp.commission_rate ?? 0) > 0
          ? 'commission'
          : 'fixed');
    setEditId(emp.id);
    setEditEmp({ ...emp, salary_type: inferredType });
    setShowForm(true);
  }

  /* ── Employee mutations ───────────────────────────────────── */
  const createEmp = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      authFetch(api('/api/employees'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employees'] });
      setShowForm(false);
      toast({ title: 'تمت إضافة الموظف بنجاح' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const updateEmp = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      authFetch(api(`/api/employees/${editId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employees'] });
      setShowForm(false);
      toast({ title: 'تم تحديث بيانات الموظف' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Inline dept/jt creation ──────────────────────────────── */
  const createInlineDept = useMutation({
    mutationFn: (data: { name_ar: string }) =>
      authFetch(api('/api/departments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, description_ar: '' }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: (d: Department) => {
      qc.invalidateQueries({ queryKey: ['/api/departments'] });
      setEditEmp((p) => ({ ...p, department_id: d.id }));
      setShowInlineDept(false);
      setInlineDept({ name_ar: '' });
      toast({ title: 'تمت إضافة القسم' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const createInlineJt = useMutation({
    mutationFn: (data: { name_ar: string }) =>
      authFetch(api('/api/job-titles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: (d: JobTitle) => {
      qc.invalidateQueries({ queryKey: ['/api/job-titles'] });
      setEditEmp((p) => ({ ...p, job_title_id: d.id }));
      setShowInlineJt(false);
      setInlineJt({ name_ar: '' });
      toast({ title: 'تمت إضافة المسمى الوظيفي' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Save helper (validates + dispatches to create/update) ── */
  function saveEmployee() {
    const st = editEmp.salary_type ?? 'fixed';
    const phone = (editEmp.phone ?? '').toString().trim();
    const nid = (editEmp.national_id ?? '').toString().trim();
    if (phone && !/^\d{11}$/.test(phone)) {
      toast({ title: 'رقم الهاتف يجب أن يكون 11 رقم بالضبط', variant: 'destructive' });
      return;
    }
    if (nid && !/^\d{14}$/.test(nid)) {
      toast({ title: 'الرقم القومي يجب أن يكون 14 رقم بالضبط', variant: 'destructive' });
      return;
    }
    const payload: Partial<Employee> = {
      ...editEmp,
      phone: phone || null,
      national_id: nid || null,
      salary_type: st,
      salary: st === 'commission' ? 0 : Number(editEmp.salary ?? 0),
      commission_rate: st === 'fixed' ? null : Number(editEmp.commission_rate ?? 0),
      commission_basis: st === 'fixed' ? null : (editEmp.commission_basis ?? 'gross'),
      commission_scope_dept_id: st === 'fixed' ? null : (editEmp.commission_scope_dept_id ?? null),
    };
    if (editId) updateEmp.mutate(payload);
    else createEmp.mutate(payload);
  }

  return {
    /* state */
    showForm, setShowForm,
    editEmp, setEditEmp,
    editId,
    showInlineDept, setShowInlineDept,
    inlineDept, setInlineDept,
    showInlineJt, setShowInlineJt,
    inlineJt, setInlineJt,
    /* helpers */
    set, openCreate, openEdit, saveEmployee,
    /* mutations (passed to EmployeeForm) */
    createEmp, updateEmp,
    createInlineDept, createInlineJt,
  };
}
