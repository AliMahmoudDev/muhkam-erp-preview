import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { type Manager, authHeaders } from './types';
import { queryKeys } from '@/lib/queryKeys';

export function useManagerState(showToast: (msg: string, type?: 'success' | 'error') => void) {
  const qc = useQueryClient();

  const fetcher = useCallback(
    (url: string) =>
      authFetch(api(url)).then(async (r) => {
        if (!r.ok) {
          let detail = '';
          try { const b = await r.json(); detail = b?.error || b?.message || ''; } catch { /* ignore */ }
          throw new Error(detail ? `فشل جلب البيانات: ${detail}` : `فشل جلب البيانات (${r.status})`);
        }
        return r.json();
      }),
    []
  );

  /* ── State ── */
  const [showAddMgr, setShowAddMgr]   = useState(false);
  const [editMgr, setEditMgr]         = useState<Manager | null>(null);
  const [deleteMgr, setDeleteMgr]     = useState<Manager | null>(null);
  const [deleteMgrErr, setDeleteMgrErr] = useState('');

  /* Add form */
  const [mgName, setMgName] = useState('');
  const [mgUser, setMgUser] = useState('');
  const [mgPin, setMgPin]   = useState('');
  const [mgPin2, setMgPin2] = useState('');
  const [mgErr, setMgErr]   = useState('');

  /* Edit form */
  const [eName, setEName] = useState('');
  const [eUser, setEUser] = useState('');
  const [ePin, setEPin]   = useState('');
  const [ePin2, setEPin2] = useState('');
  const [eErr, setEErr]   = useState('');

  /* ── Query ── */
  const {
    data: managers = [],
    isLoading: mgLoading,
    isError: mgError,
    refetch: mgRefetch,
  } = useQuery<Manager[]>({
    queryKey: queryKeys.super.managers.all,
    queryFn: () => fetcher('/api/super/managers'),
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  /* ── Mutations ── */
  const mgCreate = useMutation({
    mutationFn: (body: object) =>
      authFetch(api('/api/super/managers'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.super.managers.all });
      setShowAddMgr(false);
      resetAddForm();
      showToast('تم إضافة المدير بنجاح');
    },
    onError: (e: Error) => setMgErr(e.message),
  });

  const mgUpdate = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      authFetch(api(`/api/super/managers/${id}`), {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.super.managers.all });
      setEditMgr(null);
      resetEditForm();
      showToast('تم تحديث بيانات المدير');
    },
    onError: (e: Error) => setEErr(e.message),
  });

  const mgToggle = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/super/managers/${id}/toggle`), {
        method: 'PATCH', headers: authHeaders(),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.super.managers.all }); showToast('تم تحديث حالة المدير'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const mgDelete = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/super/managers/${id}`), {
        method: 'DELETE', headers: authHeaders(),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.super.managers.all });
      setDeleteMgr(null); setDeleteMgrErr('');
      showToast('تم حذف المدير بنجاح');
    },
    onError: (e: Error) => setDeleteMgrErr(e.message),
  });

  /* ── Helpers ── */
  const resetAddForm = () => { setMgName(''); setMgUser(''); setMgPin(''); setMgPin2(''); setMgErr(''); };
  const resetEditForm = () => { setEName(''); setEUser(''); setEPin(''); setEPin2(''); setEErr(''); };

  const openEdit = (m: Manager) => {
    setEName(m.name); setEUser(m.username); setEPin(''); setEPin2(''); setEErr('');
    setEditMgr(m);
  };

  const handleAddMgr = () => {
    if (!mgName.trim())               { setMgErr('الاسم الكامل مطلوب'); return; }
    if (!mgUser.trim())               { setMgErr('اسم المستخدم مطلوب'); return; }
    if (/\s/.test(mgUser))            { setMgErr('اسم المستخدم لا يجب أن يحتوي على مسافات'); return; }
    if (mgPin.length < 4)             { setMgErr('الرقم السري يجب أن يكون 4 أحرف على الأقل'); return; }
    if (mgPin !== mgPin2)             { setMgErr('الرقم السري وتأكيده غير متطابقين'); return; }
    setMgErr('');
    mgCreate.mutate({ name: mgName.trim(), username: mgUser.trim(), pin: mgPin });
  };

  const handleEditMgr = () => {
    if (!editMgr) return;
    if (!eName.trim())                { setEErr('الاسم الكامل مطلوب'); return; }
    if (!eUser.trim())                { setEErr('اسم المستخدم مطلوب'); return; }
    if (/\s/.test(eUser))             { setEErr('اسم المستخدم لا يجب أن يحتوي على مسافات'); return; }
    if (ePin && ePin.length < 4)      { setEErr('الرقم السري يجب أن يكون 4 أحرف على الأقل'); return; }
    if (ePin && ePin !== ePin2)       { setEErr('الرقم السري وتأكيده غير متطابقين'); return; }
    setEErr('');
    const body: Record<string, string> = { name: eName.trim(), username: eUser.trim() };
    if (ePin) body.pin = ePin;
    mgUpdate.mutate({ id: editMgr.id, body });
  };

  return {
    /* state */
    showAddMgr, setShowAddMgr,
    editMgr, setEditMgr,
    deleteMgr, setDeleteMgr,
    deleteMgrErr, setDeleteMgrErr,
    mgName, setMgName, mgUser, setMgUser, mgPin, setMgPin, mgPin2, setMgPin2, mgErr,
    eName, setEName, eUser, setEUser, ePin, setEPin, ePin2, setEPin2, eErr,
    /* query */
    managers, mgLoading, mgError, mgRefetch,
    /* mutations */
    mgCreate, mgUpdate, mgToggle, mgDelete,
    /* helpers */
    resetAddForm, resetEditForm, openEdit, handleAddMgr, handleEditMgr,
  };
}
