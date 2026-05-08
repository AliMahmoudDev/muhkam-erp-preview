/* TypeScript shim for File System Access API */
declare global {
  interface Window {
    showSaveFilePicker?: (opts?: {
      suggestedName?: string;
      types?: { description?: string; accept?: Record<string, string[]> }[];
    }) => Promise<{
      createWritable: () => Promise<{
        write: (d: unknown) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  }
}

export const LAST_BK_KEY = 'halal_erp_last_backup';
export const AUTO_BK_KEY = 'halal_erp_auto_backup';

export type AutoSettings = { on_login?: boolean; on_logout?: boolean; daily?: boolean };

export type BackupRecord = {
  id: number;
  filename: string;
  size: number;
  trigger: string;
  created_at: string;
};

export const MODULE_ICONS: Record<string, string> = {
  sales: '🛍️',
  purchases: '🛒',
  products: '📦',
  treasury: '💰',
  customers: '👥',
  settings: '⚙️',
  reports: '📊',
};

export async function saveFile(blob: Blob, fname: string, silent = false): Promise<void> {
  if (!silent && typeof window.showSaveFilePicker === 'function') {
    try {
      const ext  = fname.split('.').pop() ?? 'json';
      const mime = blob.type || 'application/json';
      const handle = await window.showSaveFilePicker({
        suggestedName: fname,
        types: [{ description: 'ملف النسخة الاحتياطية', accept: { [mime]: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadAutoSettings(): AutoSettings {
  try { return JSON.parse(localStorage.getItem(AUTO_BK_KEY) || '{}'); } catch { return {}; }
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

export function formatTrigger(t: string) {
  return (
    ({
      login: 'تسجيل دخول',
      logout: 'تسجيل خروج',
      sale_post: 'ترحيل مبيعات',
      purchase_post: 'ترحيل مشتريات',
      scheduled: 'جدولة تلقائية',
      manual: 'يدوي',
    } as Record<string, string>)[t] ?? t
  );
}

export function nextBackupTime(sched: string, last: string | null) {
  if (!last || sched === 'none') return null;
  const hours = sched === 'daily' ? 24 : sched === 'weekly' ? 168 : 720;
  return new Date(new Date(last).getTime() + hours * 3600000).toLocaleString('ar-EG-u-nu-latn');
}
