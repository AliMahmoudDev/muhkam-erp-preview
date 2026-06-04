import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import {
  type BackupFile,
  type TgConfig,
  type TgBotStatus,
  type ActiveTab,
  authHeaders,
} from './types';
import { queryKeys } from '@/lib/queryKeys';

export function useSettingsState(
  showToast: (msg: string, type?: 'success' | 'error') => void,
  activeTab: ActiveTab
) {
  const qc = useQueryClient();

  const fetcher = useCallback(
    (url: string) =>
      authFetch(api(url)).then(async (r) => {
        if (!r.ok) {
          let detail = '';
          try {
            const b = await r.json();
            detail = b?.error || b?.message || '';
          } catch {
            /* ignore */
          }
          throw new Error(
            detail ? `فشل جلب البيانات: ${detail}` : `فشل جلب البيانات (${r.status})`
          );
        }
        return r.json();
      }),
    []
  );

  /* ── Support settings state ── */
  const [supportWa, setSupportWa] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingsActiveCard, setSettingsActiveCard] = useState<
    'support' | 'backup' | 'security' | 'audit_log' | 'managers' | 'plans' | 'telegram' | null
  >(null);

  /* ── Telegram state ── */
  const [tgConfig, setTgConfig] = useState<TgConfig | null>(null);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgBotStatus, setTgBotStatus] = useState<TgBotStatus | null>(null);
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgShowToken, setTgShowToken] = useState(false);
  const [tgCredSaving, setTgCredSaving] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  /* ── Backup state ── */
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreOk, setRestoreOk] = useState<string | null>(null);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);
  const [restoreModal, setRestoreModal] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  /* ── Encryption key state ── */
  const [encKey, setEncKey] = useState<string | null>(null);
  const [encEnabled, setEncEnabled] = useState(false);
  const [encKeyVisible, setEncKeyVisible] = useState(false);
  const [encKeyCopied, setEncKeyCopied] = useState(false);
  const [encKeyLoading, setEncKeyLoading] = useState(false);

  /* Auto-fetch encryption status (no key exposed) on settings tab */
  const { data: encStatusData } = useQuery<{ enabled: boolean }>({
    queryKey: queryKeys.super.encryptionStatus,
    queryFn: () => fetcher('/api/super/encryption-status') as Promise<{ enabled: boolean }>,
    enabled: activeTab === 'settings',
    staleTime: 300_000,
  });
  useEffect(() => {
    if (encStatusData !== undefined) setEncEnabled(encStatusData.enabled);
  }, [encStatusData]);

  /* ── Security / 2FA state ── */
  const [totpSetupData, setTotpSetupData] = useState<{ qr_code: string; secret: string } | null>(
    null
  );
  const [totpInput, setTotpInput] = useState('');
  const [disableTotpInput, setDisableTotpInput] = useState('');
  const [secLoading, setSecLoading] = useState(false);
  const [secMsg, setSecMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showDisable, setShowDisable] = useState(false);

  /* ── Queries ── */
  const { data: sysSettings, refetch: refetchSupportSettings } = useQuery<Record<string, string>>({
    queryKey: queryKeys.super.supportSettings,
    queryFn: () => fetcher('/api/super/support-settings') as Promise<Record<string, string>>,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (sysSettings) {
      setSupportWa(sysSettings['support_whatsapp'] ?? '');
      setSupportEmail(sysSettings['support_email'] ?? '');
    }
  }, [sysSettings]);

  const { data: backupData, refetch: refetchBackups } = useQuery<{
    backups: BackupFile[];
    total: number;
  }>({
    queryKey: queryKeys.super.backupList,
    queryFn: () =>
      fetcher('/api/super/backup/list') as Promise<{ backups: BackupFile[]; total: number }>,
    enabled: activeTab === 'settings',
    staleTime: 30_000,
  });

  const { data: totpStatus, refetch: refetchTotpStatus } = useQuery<{ totp_enabled: boolean }>({
    queryKey: queryKeys.auth.twoFaStatus,
    queryFn: () => fetcher('/api/auth/2fa/status') as Promise<{ totp_enabled: boolean }>,
    enabled: activeTab === 'settings',
    staleTime: 10_000,
  });

  const isTgOpen = activeTab === 'settings' && settingsActiveCard === 'telegram';

  const {
    data: tgConfigData,
    isLoading: tgLoading,
    isError: tgError,
    error: tgErrorObj,
    refetch: tgRefetch,
  } = useQuery<TgConfig, Error>({
    queryKey: queryKeys.super.telegramSettings,
    queryFn: () => fetcher('/api/super/telegram-settings') as Promise<TgConfig>,
    enabled: isTgOpen,
    staleTime: 30_000,
    retry: 1,
  });
  useEffect(() => {
    if (tgConfigData) setTgConfig(tgConfigData);
  }, [tgConfigData]);

  const {
    data: tgBotData,
    isLoading: tgBotLoading,
    refetch: tgBotRefetch,
  } = useQuery<TgBotStatus, Error>({
    queryKey: queryKeys.super.telegramConfig,
    queryFn: () => fetcher('/api/super/telegram-config') as Promise<TgBotStatus>,
    enabled: isTgOpen,
    staleTime: 20_000,
    retry: 1,
  });
  useEffect(() => {
    if (tgBotData) {
      setTgBotStatus(tgBotData);
      if (!tgBotData.connected) {
        setTgBotToken('');
        setTgChatId(tgBotData.chat_id ?? '');
      }
    }
  }, [tgBotData]);

  /* ── Handlers ── */
  async function saveSupportSettings() {
    setSettingSaving(true);
    try {
      const res = await authFetch(api('/api/super/support-settings'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          support_whatsapp: supportWa.trim(),
          support_email: supportEmail.trim(),
        }),
      });
      if (!res.ok) {
        showToast('فشل حفظ الإعدادات', 'error');
        return;
      }
      showToast('✅ تم حفظ إعدادات التواصل');
      void refetchSupportSettings();
    } catch {
      showToast('فشل حفظ الإعدادات', 'error');
    } finally {
      setSettingSaving(false);
    }
  }

  async function triggerBackup() {
    setCreatingBackup(true);
    try {
      const res = await authFetch(api('/api/super/backup/create'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        filename?: string;
        size_mb?: string;
        error?: string;
      };
      if (data.success) {
        showToast(`✅ ${data.message ?? 'تم إنشاء النسخة الاحتياطية'} (${data.size_mb} MB)`);
        void refetchBackups();
      } else showToast(data.error ?? 'فشل إنشاء النسخة الاحتياطية', 'error');
    } catch {
      showToast('فشل إنشاء النسخة الاحتياطية', 'error');
    } finally {
      setCreatingBackup(false);
    }
  }

  async function downloadBackup(filename: string) {
    setDownloadingFile(filename);
    try {
      const res = await authFetch(
        api(`/api/super/backup/download/${encodeURIComponent(filename)}`),
        { headers: authHeaders() }
      );
      if (!res.ok) {
        showToast('فشل التنزيل', 'error');
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      showToast('خطأ في التنزيل', 'error');
    } finally {
      setDownloadingFile(null);
    }
  }

  function openRestorePicker() {
    setRestoreOk(null);
    setRestoreErr(null);
    restoreInputRef.current?.click();
  }

  async function handleRestoreFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.json') && !file.name.endsWith('.json.enc')) {
      showToast('يجب اختيار ملف .json أو .json.enc', 'error');
      return;
    }
    setPendingRestoreFile(file);
    setRestoreCode('');
    setRestoreModal(true);
  }

  async function confirmRestore() {
    if (!pendingRestoreFile || restoreCode !== 'RESTORE') return;
    setRestoreModal(false);
    setRestoring(true);
    setRestoreOk(null);
    setRestoreErr(null);
    try {
      const isEnc = pendingRestoreFile.name.endsWith('.enc');
      let body: BodyInit;
      let headers: HeadersInit = authHeaders();
      if (isEnc) {
        body = await pendingRestoreFile.arrayBuffer();
        headers = { ...headers, 'Content-Type': 'application/octet-stream' };
      } else {
        body = await pendingRestoreFile.text();
        headers = { ...headers, 'Content-Type': 'application/json' };
      }
      const res = await authFetch(api('/api/system/restore'), { method: 'POST', headers, body });
      const data = (await res.json()) as { counts?: Record<string, number>; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'فشل الاستعادة');
      const total = Object.values(data.counts ?? {}).reduce((a, b) => a + b, 0);
      setRestoreOk(`تمت الاستعادة بنجاح — ${total} سجل`);
      showToast(`✅ تمت الاستعادة — ${total} سجل`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRestoreErr(msg);
      showToast('فشل الاستعادة: ' + msg, 'error');
    } finally {
      setRestoring(false);
      setPendingRestoreFile(null);
    }
  }

  async function loadEncKey() {
    if (encKey !== null) {
      setEncKeyVisible(true);
      return;
    }
    setEncKeyLoading(true);
    try {
      const res = await authFetch(api('/api/super/encryption-key'), { headers: authHeaders() });
      const data = (await res.json()) as { key: string | null; enabled: boolean };
      setEncEnabled(data.enabled);
      setEncKey(data.key ?? '');
      setEncKeyVisible(true);
    } catch {
      showToast('فشل جلب مفتاح التشفير', 'error');
    } finally {
      setEncKeyLoading(false);
    }
  }

  function copyEncKey() {
    if (!encKey) return;
    void navigator.clipboard.writeText(encKey).then(() => {
      setEncKeyCopied(true);
      setTimeout(() => setEncKeyCopied(false), 2500);
    });
  }

  function downloadEncKey() {
    if (!encKey) return;
    const now = new Date();
    const content = [
      '# مفتاح تشفير النسخ الاحتياطية — MUHKAM ERP',
      `# تاريخ التصدير: ${now.toLocaleString('ar-EG')}`,
      '# ⚠️ احتفظ بهذا الملف في مكان آمن — بدونه لا يمكن فك تشفير أي نسخة احتياطية',
      '',
      encKey,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muhkam-backup-key-${now.toISOString().slice(0, 10)}.key`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function emailEncKey() {
    if (!encKey) return;
    const subject = encodeURIComponent('مفتاح تشفير النسخ الاحتياطية — MUHKAM ERP');
    const body = encodeURIComponent(
      `مفتاح تشفير النسخ الاحتياطية لنظام مُحكم:\n\n${encKey}\n\nالتاريخ: ${new Date().toLocaleString('ar-EG')}\n\n⚠️ تحذير: احتفظ بهذا المفتاح في مكان آمن.`
    );
    window.open(`mailto:m.elmelegy@me.com?subject=${subject}&body=${body}`, '_blank');
  }

  async function startTotpSetup() {
    setSecLoading(true);
    setSecMsg(null);
    try {
      const res = await authFetch(api('/api/auth/2fa/setup'));
      const data = (await res.json()) as { qr_code?: string; secret?: string; error?: string };
      if (data.qr_code) setTotpSetupData({ qr_code: data.qr_code, secret: data.secret! });
      else setSecMsg({ text: data.error ?? 'فشل الإعداد', ok: false });
    } catch {
      setSecMsg({ text: 'فشل الاتصال', ok: false });
    } finally {
      setSecLoading(false);
    }
  }

  async function confirmTotpSetup() {
    if (totpInput.length !== 6) {
      setSecMsg({ text: 'أدخل 6 أرقام', ok: false });
      return;
    }
    setSecLoading(true);
    setSecMsg(null);
    try {
      const res = await authFetch(api('/api/auth/2fa/verify'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token: totpInput }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (data.success) {
        setSecMsg({ text: data.message ?? 'تم تفعيل 2FA ✅', ok: true });
        setTotpSetupData(null);
        setTotpInput('');
        void refetchTotpStatus();
      } else setSecMsg({ text: data.error ?? 'رمز خاطئ', ok: false });
    } catch {
      setSecMsg({ text: 'فشل الاتصال', ok: false });
    } finally {
      setSecLoading(false);
    }
  }

  async function confirmDisableTotp() {
    if (disableTotpInput.length !== 6) {
      setSecMsg({ text: 'أدخل 6 أرقام', ok: false });
      return;
    }
    setSecLoading(true);
    setSecMsg(null);
    try {
      const res = await authFetch(api('/api/auth/2fa/disable'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token: disableTotpInput }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (data.success) {
        setSecMsg({ text: data.message ?? 'تم إيقاف 2FA', ok: true });
        setShowDisable(false);
        setDisableTotpInput('');
        void refetchTotpStatus();
      } else setSecMsg({ text: data.error ?? 'رمز خاطئ', ok: false });
    } catch {
      setSecMsg({ text: 'فشل الاتصال', ok: false });
    } finally {
      setSecLoading(false);
    }
  }

  async function saveTelegramSettings() {
    if (!tgConfig) return;
    setTgSaving(true);
    try {
      await authFetch(api('/api/super/telegram-settings'), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(tgConfig),
      });
      showToast('تم حفظ إعدادات تليجرام ✅');
    } catch {
      showToast('فشل حفظ الإعدادات', 'error');
    } finally {
      setTgSaving(false);
    }
  }

  async function saveTgCredentials() {
    if (!tgBotToken.trim() || !tgChatId.trim()) {
      showToast('أدخل رمز البوت ومعرّف المحادثة', 'error');
      return;
    }
    setTgCredSaving(true);
    setTgTestResult(null);
    try {
      const res = await authFetch(api('/api/super/telegram-config'), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ bot_token: tgBotToken.trim(), chat_id: tgChatId.trim() }),
      });
      const json = (await res.json()) as TgBotStatus & { success?: boolean; error?: string };
      if (!res.ok) {
        showToast(json.error ?? 'فشل الحفظ', 'error');
        return;
      }
      setTgBotStatus(json);
      setTgBotToken('');
      void tgBotRefetch();
      showToast(
        json.connected
          ? `✅ تم الاتصال بـ @${json.bot_username ?? 'البوت'}`
          : '⚠️ تم الحفظ لكن البوت لم يتصل',
        json.connected ? 'success' : 'error'
      );
    } catch {
      showToast('فشل حفظ البيانات', 'error');
    } finally {
      setTgCredSaving(false);
    }
  }

  async function testTelegramConnection() {
    setTgTesting(true);
    setTgTestResult(null);
    try {
      const res = await authFetch(api('/api/super/telegram-test'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { success: boolean; message?: string; error?: string };
      setTgTestResult({
        ok: json.success,
        msg: json.success
          ? 'تم الإرسال بنجاح — تحقق من محادثة التيليجرام'
          : (json.error ?? 'فشل الإرسال'),
      });
    } catch {
      setTgTestResult({ ok: false, msg: 'تعذّر الاتصال بالخادم' });
    } finally {
      setTgTesting(false);
    }
  }

  void qc; // qc used implicitly via refetchBackups etc

  return {
    /* support */
    supportWa,
    setSupportWa,
    supportEmail,
    setSupportEmail,
    settingSaving,
    saveSupportSettings,
    settingsActiveCard,
    setSettingsActiveCard,
    /* backup */
    backupData,
    creatingBackup,
    downloadingFile,
    restoring,
    restoreOk,
    restoreErr,
    triggerBackup,
    downloadBackup,
    openRestorePicker,
    restoreInputRef,
    handleRestoreFileChange,
    restoreModal,
    setRestoreModal,
    pendingRestoreFile,
    setPendingRestoreFile,
    restoreCode,
    setRestoreCode,
    confirmRestore,
    /* encryption */
    encEnabled,
    encKey,
    encKeyLoading,
    encKeyVisible,
    encKeyCopied,
    loadEncKey,
    copyEncKey,
    downloadEncKey,
    emailEncKey,
    /* totp */
    totpStatus,
    totpSetupData,
    totpInput,
    setTotpInput,
    disableTotpInput,
    setDisableTotpInput,
    secLoading,
    secMsg,
    setSecMsg,
    showDisable,
    setShowDisable,
    startTotpSetup,
    confirmTotpSetup,
    confirmDisableTotp,
    /* telegram */
    tgConfig,
    setTgConfig,
    tgSaving,
    tgBotStatus,
    tgBotLoading,
    tgBotRefetch,
    tgLoading,
    tgError,
    tgErrorObj,
    tgRefetch,
    tgBotToken,
    setTgBotToken,
    tgChatId,
    setTgChatId,
    tgShowToken,
    setTgShowToken,
    tgCredSaving,
    saveTgCredentials,
    tgTesting,
    testTelegramConnection,
    tgTestResult,
    saveTelegramSettings,
  };
}
