import {
  Loader2, Clock, LogIn, LogOut, HardDrive, History,
  RefreshCcw, Download, Save, Database, Trash2,
} from 'lucide-react';
import { BackupRecord, formatBytes, formatTrigger, nextBackupTime } from './backup-utils';

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-all shrink-0 ${checked ? 'bg-amber-500' : 'bg-surface'} disabled:opacity-40`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'translate-x-[-0.125rem] left-5' : 'left-0.5'}`}
      />
    </button>
  );
}

function triggerBadge(trigger: string) {
  const cls =
    trigger === 'login'
      ? 'bg-blue-500/15 text-blue-400'
      : trigger === 'logout'
        ? 'bg-purple-500/15 text-purple-400'
        : trigger === 'sale_post' || trigger === 'purchase_post'
          ? 'bg-emerald-500/15 text-emerald-400'
          : trigger === 'scheduled'
            ? 'bg-sky-500/15 text-sky-400'
            : 'bg-surface text-ink/40';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${cls}`}>
      {formatTrigger(trigger)}
    </span>
  );
}

interface BackupServerTabProps {
  schedule: string;
  lastScheduled: string | null;
  onLogin: boolean;
  onLogout: boolean;
  schedSaving: boolean;
  serverBkBusy: boolean;
  backupList: BackupRecord[];
  listLoading: boolean;
  deletingId: number | null;
  onSaveSettings: (overrides: { schedule?: string; destination?: string; on_login?: boolean; on_logout?: boolean }) => void;
  onServerSave: () => void;
  onServerDownload: () => void;
  onDeleteBackup: (id: number) => void;
  onDownloadById: (id: number, filename: string) => void;
  onReloadList: () => void;
}

export default function BackupServerTab({
  schedule, lastScheduled, onLogin, onLogout,
  schedSaving, serverBkBusy,
  backupList, listLoading, deletingId,
  onSaveSettings, onServerSave, onServerDownload,
  onDeleteBackup, onDownloadById, onReloadList,
}: BackupServerTabProps) {
  return (
    <div className="p-5 space-y-4">
      {/* الجدولة التلقائية */}
      <div className="space-y-3">
        <p className="text-ink/40 text-xs font-black uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> الجدولة التلقائية
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { v: 'none',    l: 'بدون'    },
            { v: 'daily',   l: 'يومياً'  },
            { v: 'weekly',  l: 'أسبوعياً' },
            { v: 'monthly', l: 'شهرياً'  },
          ].map((s) => (
            <button
              key={s.v}
              onClick={() => onSaveSettings({ schedule: s.v })}
              disabled={schedSaving}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${schedule === s.v ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'border-line text-ink/40 hover:text-ink/70 hover:border-line'}`}
            >
              {schedSaving && schedule === s.v ? (
                <Loader2 className="w-3 h-3 animate-spin inline ml-1" />
              ) : null}
              {s.l}
            </button>
          ))}
        </div>
        {schedule !== 'none' && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-surface border border-line">
              <p className="text-ink/30 mb-0.5">آخر نسخة تلقائية</p>
              <p className="text-ink font-bold">
                {lastScheduled ? new Date(lastScheduled).toLocaleString('ar-EG-u-nu-latn') : '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-line">
              <p className="text-ink/30 mb-0.5">النسخة القادمة</p>
              <p className="text-sky-300 font-bold">
                {nextBackupTime(schedule, lastScheduled) ?? 'قريباً'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-surface" />

      {/* تريغر الدخول والخروج */}
      <div className="space-y-2.5">
        <p className="text-ink/40 text-xs font-black uppercase tracking-wider">نسخ تلقائي عند</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-line">
            <div className="flex items-center gap-2.5">
              <LogIn className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-ink text-xs font-bold">تسجيل الدخول</p>
                <p className="text-ink/30 text-[10px]">نسخة تلقائية لكل دخول ناجح</p>
              </div>
            </div>
            <Toggle
              checked={onLogin}
              disabled={schedSaving}
              onChange={(v) => onSaveSettings({ on_login: v })}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-line">
            <div className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-ink text-xs font-bold">تسجيل الخروج</p>
                <p className="text-ink/30 text-[10px]">نسخة تلقائية قبل كل خروج</p>
              </div>
            </div>
            <Toggle
              checked={onLogout}
              disabled={schedSaving}
              onChange={(v) => onSaveSettings({ on_logout: v })}
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-surface" />

      {/* أزرار الحفظ/التنزيل */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onServerSave}
          disabled={serverBkBusy}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/25 text-sky-300 font-bold text-xs transition-all disabled:opacity-40"
        >
          {serverBkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          حفظ على الخادم
        </button>
        <button
          onClick={onServerDownload}
          disabled={serverBkBusy}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 font-bold text-xs transition-all disabled:opacity-40"
        >
          {serverBkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
          تنزيل نسخة كاملة
        </button>
      </div>
      <p className="text-ink/25 text-xs text-center">
        "حفظ" تحفظ في السجل · "تنزيل" تُصدِّر مباشرةً من قاعدة البيانات
      </p>

      <div className="h-px bg-surface" />

      {/* سجل النسخ */}
      <div className="rounded-xl border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-ink/35" />
            <p className="text-ink/60 text-xs font-bold">سجل النسخ</p>
            <span className="text-ink/25 text-[10px]">
              {backupList.length > 0 ? `${backupList.length} نسخة` : 'لا توجد نسخ'}
            </span>
          </div>
          <button
            onClick={onReloadList}
            disabled={listLoading}
            className="p-1.5 rounded-lg text-ink/25 hover:text-ink hover:bg-surface transition-colors"
          >
            <RefreshCcw className={`w-3 h-3 ${listLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {listLoading && backupList.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-ink/25 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
          </div>
        ) : backupList.length === 0 ? (
          <div className="text-center py-8 text-ink/20 text-sm">
            <HardDrive className="w-6 h-6 mx-auto mb-1.5 opacity-25" />
            لا توجد نسخ محفوظة بعد
          </div>
        ) : (
          <div className="divide-y divide-white/4 max-h-56 overflow-y-auto">
            {backupList.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-xs font-mono truncate">{b.filename}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-ink/25 text-[10px]">
                      {new Date(b.created_at).toLocaleString('ar-EG-u-nu-latn')}
                    </span>
                    <span className="text-ink/15">·</span>
                    <span className="text-ink/25 text-[10px]">{formatBytes(b.size)}</span>
                    <span className="text-ink/15">·</span>
                    {triggerBadge(b.trigger)}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => onDownloadById(b.id, b.filename)}
                    className="p-1.5 rounded-lg text-emerald-400/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteBackup(b.id)}
                    disabled={deletingId === b.id}
                    className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {deletingId === b.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
