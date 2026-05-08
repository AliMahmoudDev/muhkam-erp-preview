import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

type AnyRec = Record<string, unknown>;

export function useAttendanceData({
  from, to, statusFilter,
}: { from: string; to: string; statusFilter: string; }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(api(url), opts);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(((d as AnyRec).error as string) || 'خطأ');
    }
    return r.json();
  }, []);

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
      toast({ title: msg });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const params = new URLSearchParams({ from, to });
  if (statusFilter) params.set('status', statusFilter);

  const records = useQuery({
    queryKey: ['attendance', from, to, statusFilter],
    queryFn: () => f(`/api/attendance/records?${params}`),
  });
  const employees = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => f('/api/employees?limit=500'),
  });
  const dedSettings = useQuery({
    queryKey: ['att-ded-settings'],
    queryFn: () => f('/api/attendance-deductions/settings'),
  });
  const dedTiers = useQuery({
    queryKey: ['att-ded-tiers'],
    queryFn: () => f('/api/attendance-deductions/tiers'),
  });
  const shiftsQuery = useQuery({
    queryKey: ['shifts'],
    queryFn: () => f('/api/shifts'),
  });

  const doCheckIn = useMutation({
    mutationFn: (d: AnyRec) => f('/api/attendance/check-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    ...mutOpts(['attendance', from, to, statusFilter], 'تم تسجيل الحضور'),
  });
  const doCheckOut = useMutation({
    mutationFn: (d: AnyRec) => f('/api/attendance/check-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    ...mutOpts(['attendance', from, to, statusFilter], 'تم تسجيل الانصراف'),
  });
  const doEditRecord = useMutation({
    mutationFn: (d: AnyRec) => f(`/api/attendance/records/${(d as AnyRec).id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    ...mutOpts(['attendance', from, to, statusFilter], 'تم تعديل السجل'),
  });
  const saveDedSettings = useMutation({
    mutationFn: (d: AnyRec) => f('/api/attendance-deductions/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    ...mutOpts('att-ded-settings', 'تم حفظ إعدادات الخصومات'),
  });
  const saveTiers = useMutation({
    mutationFn: (tiers: AnyRec[]) => f('/api/attendance-deductions/tiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tiers }) }),
    ...mutOpts('att-ded-tiers', 'تم حفظ شرائح الخصم'),
  });
  const previewDed = useMutation({
    mutationFn: (d: AnyRec) => f('/api/attendance-deductions/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const applyDed = useMutation({
    mutationFn: (items: AnyRec[]) => f('/api/attendance-deductions/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) }),
    onSuccess: (r: AnyRec) => {
      qc.invalidateQueries({ queryKey: ['employee-deductions'] });
      toast({ title: `تم حفظ ${r['inserted']} خصم${Number(r['skipped']) > 0 ? ` (تم تجاهل ${r['skipped']} مكرر)` : ''}` });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const doAddShift = useMutation({
    mutationFn: (d: AnyRec) => f('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    ...mutOpts('shifts', 'تم إضافة المناوبة'),
  });
  const doEditShift = useMutation({
    mutationFn: ({ id, ...d }: AnyRec) => f(`/api/shifts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    ...mutOpts('shifts', 'تم تعديل المناوبة'),
  });
  const doDeleteShift = useMutation({
    mutationFn: (id: number) => f(`/api/shifts/${id}`, { method: 'DELETE' }),
    ...mutOpts('shifts', 'تم حذف المناوبة'),
  });
  const doAssignShift = useMutation({
    mutationFn: (d: AnyRec) => f('/api/employee-shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const allRecords = safeArray(records.data);
  const empList = safeArray(employees.data);

  return {
    f, records, employees, dedSettings, dedTiers, shiftsQuery,
    doCheckIn, doCheckOut, doEditRecord,
    saveDedSettings, saveTiers, previewDed, applyDed,
    doAddShift, doEditShift, doDeleteShift, doAssignShift,
    allRecords, empList,
  };
}
