/**
 * useSalaryMutations — all employee salary/HR action mutations.
 * Extracted from EmployeeSalaryModal.tsx for maintainability.
 *
 * No business logic changed — only mechanical extraction into a hook.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { AnyRec } from '../types';

interface UseSalaryMutationsOpts {
  selectedId: number | undefined;
  onDeleteSuccess: () => void;
  onLoanCreated: () => void;
  onLoanApproved: () => void;
  onPaySuccess: () => void;
  onDeductCreated: () => void;
  onBonusCreated: () => void;
  onCustodyCreated: () => void;
  onSettleSuccess: () => void;
  onReimburseSuccess: () => void;
}

export function useSalaryMutations(opts: UseSalaryMutationsOpts) {
  const qc = useQueryClient();
  const { toast } = useToast();

  /* ── Employee delete ─────────────────────────────────────── */
  const deleteEmp = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employees/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employees'] });
      opts.onDeleteSuccess();
      toast({ title: 'تم حذف الموظف' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Loan mutations ──────────────────────────────────────── */
  const createLoan = useMutation({
    mutationFn: (data: AnyRec) =>
      authFetch(api('/api/salary-advances'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', opts.selectedId] });
      opts.onLoanCreated();
      toast({ title: 'تم تقديم طلب السلفة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const approveLoan = useMutation({
    mutationFn: ({ id, approved_amount, safe_id, notes }: { id: number; approved_amount?: number; safe_id?: number | null; notes?: string }) =>
      authFetch(api(`/api/salary-advances/${id}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_amount, safe_id: safe_id || undefined, notes }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', opts.selectedId] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      opts.onLoanApproved();
      toast({ title: 'تم اعتماد السلفة ✓' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const manualPay = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      authFetch(api(`/api/salary-advances/${id}/manual-payment`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', opts.selectedId] });
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', opts.selectedId, 'ledger'] });
      opts.onPaySuccess();
      toast({ title: 'تم تسجيل الدفعة / الخصم' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Deduction mutations ─────────────────────────────────── */
  const createDeduction = useMutation({
    mutationFn: (payload: { amount: number; reason: string; deduction_type: string; deduction_date: string }) =>
      authFetch(api('/api/employee-deductions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, employee_id: opts.selectedId }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'فشل تسجيل الخصم');
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-deductions', opts.selectedId] });
      opts.onDeductCreated();
      toast({ title: 'تم تسجيل الخصم' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const deleteDeduction = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employee-deductions/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'فشل الحذف');
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-deductions', opts.selectedId] });
      toast({ title: 'تم حذف الخصم' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Bonus mutations ─────────────────────────────────────── */
  const createBonus = useMutation({
    mutationFn: (data: AnyRec) =>
      authFetch(api('/api/employee-bonuses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-bonuses', opts.selectedId] });
      opts.onBonusCreated();
      toast({ title: 'تمت إضافة الحافز' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const deleteBonus = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employee-bonuses/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-bonuses', opts.selectedId] });
      toast({ title: 'تم حذف الحافز' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Custody mutations ───────────────────────────────────── */
  const createCustody = useMutation({
    mutationFn: (data: AnyRec) =>
      authFetch(api('/api/employee-custody'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-custody', opts.selectedId] });
      opts.onCustodyCreated();
      toast({ title: 'تمت إضافة العهدة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const settleCustody = useMutation({
    mutationFn: (payload: {
      id: number;
      lines: { amount: number; category: string; description: string | null; date: string }[];
      returned_amount: number;
      notes: string | null;
    }) =>
      authFetch(api(`/api/employee-custody/${payload.id}/settle`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: payload.lines, returned_amount: payload.returned_amount, notes: payload.notes }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-custody', opts.selectedId] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      opts.onSettleSuccess();
      toast({ title: 'تم تسوية العهدة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const reimburseCustody = useMutation({
    mutationFn: (vars: { id: number; safe_id: number; notes?: string }) =>
      authFetch(api(`/api/employee-custody/${vars.id}/reimburse`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safe_id: vars.safe_id, notes: vars.notes }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-custody', opts.selectedId] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      opts.onReimburseSuccess();
      toast({ title: 'تم صرف المستحقات' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const deleteCustody = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employee-custody/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-custody', opts.selectedId] });
      toast({ title: 'تم حذف العهدة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  return {
    deleteEmp,
    createLoan, approveLoan, manualPay,
    createDeduction, deleteDeduction,
    createBonus, deleteBonus,
    createCustody, settleCustody, reimburseCustody, deleteCustody,
  };
}
