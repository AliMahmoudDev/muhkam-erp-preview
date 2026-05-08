import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { useResetDatabase } from '@workspace/api-client-react';
import { api } from '@/lib/api';
import { DATA_GROUPS } from '../../_constants';
import { pushActivity, useCountdown } from '../data-utils';

export function useDangerActions(
  warehousesList: { id: number; name: string }[],
  onRefreshLog: () => void
) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const resetDb = useResetDatabase();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [clearBusy, setClearBusy] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
  const [resetText, setResetText] = useState('');

  const readyToDelete = confirmText === 'تأكيد الحذف' && selected.size > 0;
  const { count: delCount, ready: canDelete } = useCountdown(readyToDelete, 5);

  const readyToReset = resetText === 'إعادة تعيين كاملة';
  const { count: resetCount, ready: canReset } = useCountdown(readyToReset, 10);

  const allKeys = DATA_GROUPS.map((g) => g.key);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
    setConfirmText('');
  };

  const toggleAll = () => {
    setSelected(selected.size === allKeys.length ? new Set<string>() : new Set<string>(allKeys));
    setConfirmText('');
  };

  const handleClear = async () => {
    if (!canDelete) return;
    if (selected.has('warehouse') && !selectedWarehouseId && warehousesList.length > 0) {
      toast({ title: 'اختر المخزن المراد تفريغه أولاً', variant: 'destructive' });
      return;
    }
    setClearBusy(true);
    const body: Record<string, unknown> = { tables: Array.from(selected) };
    if (selected.has('warehouse') && selectedWarehouseId) body.warehouse_id = selectedWarehouseId;
    const r = await authFetch(api('/api/admin/clear'), {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setClearBusy(false);
    const d = await r.json();
    if (!r.ok) {
      toast({ title: d.error ?? 'فشل المسح', variant: 'destructive' });
      return;
    }
    toast({ title: `✅ تم مسح ${selected.size} مجموعة` });
    pushActivity({
      date: new Date().toISOString(),
      type: 'delete',
      file: Array.from(selected).join(', '),
      status: `✅ ${selected.size} مجموعة`,
    });
    onRefreshLog();
    setSelected(new Set());
    setConfirmText('');
    setSelectedWarehouseId('');
    qc.invalidateQueries();
  };

  const handleResetFull = () => {
    if (!canReset) return;
    resetDb.mutate(
      { confirm: 'إعادة تعيين كاملة' },
      {
        onSuccess: () => {
          toast({ title: '✅ تمت إعادة تعيين قاعدة البيانات' });
          pushActivity({
            date: new Date().toISOString(),
            type: 'reset',
            file: '—',
            status: '✅ إعادة تعيين كاملة',
          });
          onRefreshLog();
          setResetText('');
          qc.invalidateQueries();
        },
        onError: (e: unknown) =>
          toast({ title: (e as Error)?.message ?? 'فشلت إعادة التعيين', variant: 'destructive' }),
      }
    );
  };

  return {
    selected, setSelected, confirmText, setConfirmText,
    clearBusy, canDelete, delCount, readyToDelete,
    resetText, setResetText, canReset, resetCount, readyToReset,
    resetDb, allKeys,
    selectedWarehouseId, setSelectedWarehouseId,
    toggle, toggleAll,
    handleClear, handleResetFull,
  };
}
