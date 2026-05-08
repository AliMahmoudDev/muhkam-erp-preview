import { useState, useEffect, useRef, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { BACKUP_MODULES_LIST, RESTORE_MODULE_GROUPS } from '../../_constants';
import {
  LAST_BK_KEY,
  AUTO_BK_KEY,
  AutoSettings,
  BackupRecord,
  saveFile,
  loadAutoSettings,
} from '../backup-utils';

export function useBackupActions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [bkMode, setBkMode] = useState<'local' | 'server'>('local');
  const [bkModules, setBkModules] = useState<Set<string>>(
    new Set(BACKUP_MODULES_LIST.map((m) => m.key))
  );
  const [bkLoading, setBkLoading] = useState(false);
  const [bkProgress, setBkProgress] = useState(0);
  const [bkResult, setBkResult] = useState<{ name: string; size: string; count: number } | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(() =>
    localStorage.getItem(LAST_BK_KEY)
  );

  const [schedule, setSchedule] = useState('none');
  const [destination, setDestination] = useState('local');
  const [lastScheduled, setLastScheduled] = useState<string | null>(null);
  const [onLogin, setOnLogin] = useState(false);
  const [onLogout, setOnLogout] = useState(false);
  const [schedSaving, setSchedSaving] = useState(false);
  const [serverBkBusy, setServerBkBusy] = useState(false);

  const [backupList, setBackupList] = useState<BackupRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    counts: Record<string, number>;
    meta: { file_version: string; file_date: string | null; is_legacy: boolean };
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const pendingEncFileRef = useRef<File | null>(null);

  const [modal, setModal] = useState(false);
  const [modalText, setModalText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState<{
    fileName: string;
    parsed: unknown;
    version: string | null;
    date: string | null;
    tableCount: number;
  } | null>(null);

  const [showModSelect, setShowModSelect] = useState(false);
  const [availMods, setAvailMods] = useState<string[]>([]);
  const [selectedRestoreMods, setSelectedRestoreMods] = useState<Set<string>>(new Set());
  const [isStructuredBackup, setIsStructuredBackup] = useState(false);

  const [compBusy, setCompBusy] = useState(false);
  const [compResult, setCompResult] = useState<string | null>(null);

  const [autoSettings, setAutoSettings] = useState<AutoSettings>(loadAutoSettings);

  const saveAutoSettings = useCallback((patch: Partial<AutoSettings>) => {
    const next = { ...autoSettings, ...patch };
    localStorage.setItem(AUTO_BK_KEY, JSON.stringify(next));
    setAutoSettings(next);
  }, [autoSettings]);

  const handleComprehensiveBackup = useCallback(async (silent = false) => {
    setCompBusy(true);
    setCompResult(null);
    try {
      const r = await authFetch(api('/api/system/backup'), { method: 'POST' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'فشل الطلب');
      const disp = r.headers.get('Content-Disposition') ?? '';
      const match = disp.match(/filename="([^"]+)"/);
      const fname = match?.[1] ?? `backup_comprehensive_${new Date().toISOString().slice(0, 10)}.json`;
      const blob = await r.blob();
      await saveFile(blob, fname, silent);
      const now = new Date().toISOString();
      localStorage.setItem(LAST_BK_KEY, now);
      setLastBackup(now);
      setCompResult(fname);
      toast({ title: `✅ نسخة شاملة محفوظة — ${fname}` });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'فشل إنشاء النسخة الشاملة', description: msg, variant: 'destructive' });
    } finally {
      setCompBusy(false);
    }
  }, [toast]);

  useEffect(() => {
    const auto = loadAutoSettings();
    const loginFlag  = localStorage.getItem('halal_erp_login_flag');
    const logoutFlag = localStorage.getItem('halal_erp_logout_flag');
    if (loginFlag) {
      localStorage.removeItem('halal_erp_login_flag');
      if (auto.on_login) setTimeout(() => void handleComprehensiveBackup(true), 1500);
    }
    if (logoutFlag) {
      localStorage.removeItem('halal_erp_logout_flag');
      if (auto.on_logout) setTimeout(() => void handleComprehensiveBackup(true), 500);
    }
    if (auto.daily) {
      const last = localStorage.getItem(LAST_BK_KEY);
      const stale = !last || Date.now() - new Date(last).getTime() > 86_400_000;
      if (stale) setTimeout(() => void handleComprehensiveBackup(true), 3000);
    }
  }, [handleComprehensiveBackup]);

  const loadSettings = useCallback(async () => {
    try {
      const r = await authFetch(api('/api/backups/settings'));
      if (r.ok) {
        const d = (await r.json()) as {
          schedule: string;
          destination: string;
          last_scheduled: string | null;
          on_login: boolean;
          on_logout: boolean;
        };
        setSchedule(d.schedule ?? 'none');
        setDestination(d.destination ?? 'local');
        setLastScheduled(d.last_scheduled ?? null);
        setOnLogin(!!d.on_login);
        setOnLogout(!!d.on_logout);
      }
    } catch {}
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const r = await authFetch(api('/api/backups'));
      if (r.ok) setBackupList((await r.json()) as BackupRecord[]);
    } catch {
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      void loadSettings();
      void loadList();
    }
  }, [loadSettings, loadList, isSuperAdmin]);

  const toggleModule = (key: string) =>
    setBkModules((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });

  const toggleAll = () =>
    setBkModules(
      bkModules.size === BACKUP_MODULES_LIST.length
        ? new Set()
        : new Set(BACKUP_MODULES_LIST.map((m) => m.key))
    );

  const lastBackupLabel = () => {
    if (!lastBackup) return 'لم يتم إنشاء نسخة بعد';
    const d = Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000);
    return d === 0
      ? 'اليوم'
      : d === 1
        ? 'منذ يوم'
        : d < 30
          ? `منذ ${d} أيام`
          : new Date(lastBackup).toLocaleDateString('ar-EG-u-nu-latn');
  };

  const handleLocalBackup = async () => {
    if (bkModules.size === 0) {
      toast({ title: 'اختر وحدة واحدة على الأقل', variant: 'destructive' });
      return;
    }
    setBkLoading(true);
    setBkProgress(5);
    setBkResult(null);
    try {
      const selected = BACKUP_MODULES_LIST.filter((m) => bkModules.has(m.key));
      const bundle: Record<string, unknown> = {
        version: '1.0',
        created_at: new Date().toISOString(),
        app: 'مُحكم - MUHKAM ERP',
        modules: selected.map((m) => m.label),
      };
      const step = Math.floor(75 / selected.length);
      for (const mod of selected) {
        setBkProgress((p) => Math.min(p + step, 85));
        if (mod.url) {
          try {
            const r = await authFetch(api(mod.url));
            bundle[mod.key] = r.ok ? await r.json() : [];
          } catch {
            bundle[mod.key] = [];
          }
        } else if (mod.key === 'settings') {
          bundle[mod.key] = JSON.parse(localStorage.getItem('halal_erp_settings') || '{}');
        }
      }
      setBkProgress(90);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const dt = new Date().toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);
      const fname = `backup_${dt}.json`;
      await saveFile(blob, fname);
      setBkResult({
        name: fname,
        size: `${(blob.size / 1024).toFixed(1)} KB`,
        count: selected.length,
      });
      setBkProgress(100);
      const now = new Date().toISOString();
      localStorage.setItem(LAST_BK_KEY, now);
      setLastBackup(now);
      toast({ title: `✅ تم إنشاء النسخة — ${fname}` });
    } catch {
      toast({ title: 'فشل إنشاء النسخة', variant: 'destructive' });
    } finally {
      setBkLoading(false);
      setTimeout(() => setBkProgress(0), 1500);
    }
  };

  const handleServerDownload = async () => {
    setServerBkBusy(true);
    try {
      const r = await authFetch(api('/api/system/backup'), { method: 'POST' });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const cd = r.headers.get('Content-Disposition') ?? '';
      const m = cd.match(/filename="([^"]+)"/);
      const fname = m?.[1] ?? `halal-tech-backup_${new Date().toISOString().slice(0, 10)}.json`;
      await saveFile(blob, fname);
      const now = new Date().toISOString();
      localStorage.setItem(LAST_BK_KEY, now);
      setLastBackup(now);
      toast({ title: `✅ تم تنزيل النسخة الكاملة — ${fname}` });
    } catch (e) {
      toast({ title: 'فشل إنشاء النسخة الكاملة', description: String(e), variant: 'destructive' });
    } finally {
      setServerBkBusy(false);
    }
  };

  const handleServerSave = async () => {
    setServerBkBusy(true);
    try {
      const r = await authFetch(api('/api/backups'), { method: 'POST' });
      if (r.ok) {
        toast({ title: '✅ تم حفظ النسخة على الخادم' });
        void loadList();
        void loadSettings();
      } else {
        const d = (await r.json().catch(() => ({ error: 'فشل' }))) as { error?: string };
        toast({ title: d.error ?? 'فشل', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ في الاتصال', variant: 'destructive' });
    } finally {
      setServerBkBusy(false);
    }
  };

  const handleSaveSettings = async (overrides: {
    schedule?: string;
    destination?: string;
    on_login?: boolean;
    on_logout?: boolean;
  }) => {
    setSchedSaving(true);
    try {
      const payload = {
        schedule: overrides.schedule ?? schedule,
        destination: overrides.destination ?? destination,
        on_login: overrides.on_login ?? onLogin,
        on_logout: overrides.on_logout ?? onLogout,
      };
      const r = await authFetch(api('/api/backups/settings'), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        if (overrides.schedule !== undefined) setSchedule(overrides.schedule);
        if (overrides.destination !== undefined) setDestination(overrides.destination);
        if (overrides.on_login !== undefined) setOnLogin(overrides.on_login);
        if (overrides.on_logout !== undefined) setOnLogout(overrides.on_logout);
        toast({ title: '✅ تم حفظ إعدادات النسخ الاحتياطي' });
      }
    } catch {
    } finally {
      setSchedSaving(false);
    }
  };

  const handleDeleteBackup = async (id: number) => {
    setDeletingId(id);
    try {
      const r = await authFetch(api(`/api/backups/${id}`), { method: 'DELETE' });
      if (r.ok) {
        setBackupList((p) => p.filter((b) => b.id !== id));
        toast({ title: 'تم حذف النسخة' });
      }
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadById = async (id: number, filename: string) => {
    try {
      const r = await authFetch(api(`/api/backups/${id}/download`));
      if (!r.ok) {
        toast({ title: 'فشل التنزيل', variant: 'destructive' });
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await r.blob());
      a.download = filename;
      a.click();
    } catch {
      toast({ title: 'خطأ في التنزيل', variant: 'destructive' });
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const isEnc  = file.name.endsWith('.json.enc');
    const isJson = file.name.endsWith('.json');
    if (!isJson && !isEnc) {
      toast({ title: 'يجب اختيار ملف .json أو .json.enc', variant: 'destructive' });
      return;
    }
    if (isEnc) {
      setPending({ fileName: file.name, parsed: null, version: 'مشفّر', date: null, tableCount: 0 });
      (pendingEncFileRef as React.MutableRefObject<File | null>).current = file;
      setModalText('');
      setUnderstood(false);
      setModal(true);
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const dataSection = (parsed.data ?? parsed.tables ?? parsed) as Record<string, unknown>;
      const tableCount  = Object.values(dataSection).filter(Array.isArray).length;
      const structured  = typeof parsed.data === 'object' && parsed.data !== null;
      setPending({
        fileName: file.name,
        parsed,
        version: typeof parsed.version === 'string' ? parsed.version : null,
        date: typeof parsed.created_at === 'string' ? parsed.created_at : null,
        tableCount,
      });
      setIsStructuredBackup(structured);
      setModalText('');
      setUnderstood(false);
      if (structured) {
        const data = parsed.data as Record<string, unknown[]>;
        const MODULE_TABLE_MAP: Record<string, string[]> = {
          products:       ['products', 'stock_movements'],
          customers:      ['customers'],
          sales:          ['sales', 'sale_items', 'sales_returns', 'sale_return_items'],
          purchases:      ['purchases', 'purchase_items', 'purchase_returns', 'purchase_return_items'],
          finance:        ['expenses', 'income', 'transactions', 'accounts', 'journal_entries', 'receipt_vouchers', 'payment_vouchers'],
          infrastructure: ['safes', 'warehouses'],
          alerts:         ['alerts'],
        };
        const found = RESTORE_MODULE_GROUPS
          .map(g => g.key)
          .filter(k => (MODULE_TABLE_MAP[k] ?? []).some(t => Array.isArray(data[t])));
        setAvailMods(found);
        setSelectedRestoreMods(new Set(found));
        setShowModSelect(true);
      } else {
        toast({
          title: '⚠️ هذا الملف للتصدير فقط',
          description: 'ملفات النسخ المحلية (v1.0) لا يمكن استعادتها. استخدم "النسخة الشاملة" التي تنزّلها بالزر الأخضر.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'ملف JSON غير صالح', variant: 'destructive' });
    }
  };

  const handleConfirmRestore = async () => {
    if (!pending) return;
    setModal(false);
    setRestoreLoading(true);
    setRestoreResult(null);
    setRestoreError(null);
    try {
      let body: BodyInit;
      let contentType: string;
      const encFile = (pendingEncFileRef as React.MutableRefObject<File | null>).current;
      if (pending.parsed === null && encFile) {
        body = await encFile.arrayBuffer();
        contentType = 'application/octet-stream';
        (pendingEncFileRef as React.MutableRefObject<File | null>).current = null;
      } else {
        const payload = isStructuredBackup && selectedRestoreMods.size > 0
          ? { ...(pending.parsed as object), restore_modules: Array.from(selectedRestoreMods) }
          : pending.parsed;
        body = JSON.stringify(payload);
        contentType = 'application/json';
      }
      const idemKey = `restore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const r = await authFetch(api('/api/system/restore'), {
        method: 'POST',
        headers: { 'Content-Type': contentType, 'Idempotency-Key': idemKey },
        body,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'فشل الاستعادة');
      setRestoreResult({
        counts: data.counts ?? {},
        meta: data.meta ?? { file_version: 'legacy', file_date: null, is_legacy: true },
      });
      toast({ title: '✅ تمت الاستعادة بنجاح' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setRestoreError(msg);
      toast({ title: 'فشل الاستعادة', description: msg, variant: 'destructive' });
    } finally {
      setRestoreLoading(false);
      setPending(null);
    }
  };

  const canConfirm = modalText === 'RESTORE' && understood;

  return {
    isSuperAdmin,
    bkMode, setBkMode,
    bkModules,
    bkLoading, bkProgress, bkResult,
    schedule, lastScheduled,
    onLogin, onLogout,
    schedSaving, serverBkBusy,
    backupList, listLoading, deletingId,
    restoreLoading, restoreResult, restoreError,
    restoreFileRef, pendingEncFileRef,
    modal, setModal, modalText, setModalText,
    understood, setUnderstood,
    pending, setPending,
    showModSelect, setShowModSelect,
    availMods, selectedRestoreMods, setSelectedRestoreMods,
    isStructuredBackup,
    compBusy, compResult,
    autoSettings,
    canConfirm,
    saveAutoSettings,
    toggleModule, toggleAll,
    lastBackupLabel,
    handleComprehensiveBackup,
    handleLocalBackup,
    handleServerDownload, handleServerSave,
    handleSaveSettings,
    handleDeleteBackup, handleDownloadById,
    handleRestoreFile, handleConfirmRestore,
    loadList,
  };
}
