import React from 'react';
import {
  Loader2,
  Download,
  CheckCircle2,
  Shield,
  Clock,
  LogIn,
  LogOut,
  Upload,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import { PrimaryBtn } from '../_shared';
import { BACKUP_MODULES_LIST } from '../_constants';
import { AutoSettings, MODULE_ICONS } from './backup-utils';

interface BackupLocalTabProps {
  bkModules: Set<string>;
  bkLoading: boolean;
  bkProgress: number;
  bkResult: { name: string; size: string; count: number } | null;
  compBusy: boolean;
  compResult: string | null;
  autoSettings: AutoSettings;
  restoreFileRef: React.RefObject<HTMLInputElement | null>;
  restoreLoading: boolean;
  restoreResult: {
    counts: Record<string, number>;
    meta: { file_version: string; file_date: string | null; is_legacy: boolean };
  } | null;
  restoreError: string | null;
  onLocalBackup: () => void;
  onToggleModule: (key: string) => void;
  onToggleAll: () => void;
  onComprehensiveBackup: () => void;
  onSaveAutoSettings: (patch: Partial<AutoSettings>) => void;
  onRestoreFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function BackupLocalTab({
  bkModules,
  bkLoading,
  bkProgress,
  bkResult,
  compBusy,
  compResult,
  autoSettings,
  restoreFileRef,
  restoreLoading,
  restoreResult,
  restoreError,
  onLocalBackup,
  onToggleModule,
  onToggleAll,
  onComprehensiveBackup,
  onSaveAutoSettings,
  onRestoreFile,
}: BackupLocalTabProps) {
  return (
    <div className="p-5 space-y-5">
      {/* اختيار الوحدات */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-ink/50 text-xs">اختر الوحدات المطلوبة في النسخة</p>
          <button
            onClick={onToggleAll}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-semibold"
          >
            {bkModules.size === BACKUP_MODULES_LIST.length ? 'إلغاء الكل' : 'تحديد الكل'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BACKUP_MODULES_LIST.map((m) => {
            const on = bkModules.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => onToggleModule(m.key)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-right transition-all ${on ? 'bg-amber-500/10 border-amber-500/25' : 'bg-surface border-white/10 hover:border-amber-500/15'}`}
              >
                <span className="text-lg shrink-0">{MODULE_ICONS[m.key] ?? '📁'}</span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-bold truncate ${on ? 'text-amber-300' : 'text-ink/60'}`}
                  >
                    {m.label}
                  </p>
                  <p className="text-ink/20 text-[10px] truncate">{m.sub}</p>
                </div>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${on ? 'bg-amber-500 border-amber-500' : 'border-line'}`}
                >
                  {on && <Check className="w-2.5 h-2.5 text-ink" />}
                </div>
              </button>
            );
          })}
        </div>

        {bkLoading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-ink/40">
              <span>جاري إنشاء النسخة...</span>
              <span>{bkProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${bkProgress}%` }}
              />
            </div>
          </div>
        )}

        {bkResult && !bkLoading && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-bold flex-1 truncate">{bkResult.name}</span>
            <span className="text-ink/40">{bkResult.size}</span>
            <span className="text-ink/40">{bkResult.count} وحدات</span>
          </div>
        )}

        <PrimaryBtn
          onClick={onLocalBackup}
          disabled={bkLoading || bkModules.size === 0}
          className="w-full"
        >
          {bkLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {bkLoading ? `جاري الإنشاء... ${bkProgress}%` : `تنزيل نسخة (${bkModules.size} وحدات)`}
        </PrimaryBtn>
      </div>

      {/* النسخة الشاملة */}
      <div className="h-px bg-surface" />
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="font-bold text-ink text-sm">نسخة شاملة (كل البيانات)</p>
            <p className="text-ink/30 text-xs">تُصدِّر جميع بيانات شركتك في ملف JSON واحد</p>
          </div>
        </div>
        {compResult && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-bold flex-1 truncate">{compResult}</span>
          </div>
        )}
        <button
          onClick={() => onComprehensiveBackup()}
          disabled={compBusy}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-ink font-bold text-sm transition-all"
        >
          {compBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {compBusy ? 'جاري التصدير...' : 'تنزيل النسخة الشاملة'}
        </button>
      </div>

      {/* الإعدادات التلقائية */}
      <div className="h-px bg-surface" />
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <p className="font-bold text-ink text-sm">تشغيل تلقائي للنسخة الشاملة</p>
            <p className="text-ink/30 text-xs">يبدأ التنزيل التلقائي عند تحقق الشروط</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-blue-300/70">
          <span className="shrink-0 mt-0.5">📂</span>
          <span>
            النسخ التلقائية تُحفَظ دائماً في مجلد{' '}
            <strong className="text-blue-300">التنزيلات</strong> بجهازك. أما النسخ اليدوية (بالزر
            الأخضر) فيظهر حوار <strong className="text-blue-300">اختيار المسار</strong> على
            Chrome/Edge.
          </span>
        </div>
        <div className="space-y-2">
          {[
            { key: 'on_login' as const, Icon: LogIn, label: 'عند تسجيل الدخول', color: 'emerald' },
            { key: 'on_logout' as const, Icon: LogOut, label: 'عند تسجيل الخروج', color: 'amber' },
            {
              key: 'daily' as const,
              Icon: Clock,
              label: 'مرة يومياً (إذا مرّ 24 ساعة)',
              color: 'blue',
            },
          ].map(({ key, Icon, label, color }) => {
            const on = !!autoSettings[key];
            return (
              <button
                key={key}
                onClick={() => onSaveAutoSettings({ [key]: !on })}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${on ? `bg-${color}-500/8 border-${color}-500/20` : 'bg-surface border-line hover:border-line'}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${on ? `text-${color}-400` : 'text-ink/30'}`} />
                <p
                  className={`flex-1 text-right text-sm font-semibold ${on ? `text-${color}-300` : 'text-ink/50'}`}
                >
                  {label}
                </p>
                <div
                  className={`w-9 h-5 rounded-full relative transition-all ${on ? `bg-${color}-500` : 'bg-surface'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'right-0.5' : 'left-0.5'}`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* الاستعادة */}
      <div className="h-px bg-surface" />
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface border border-line flex items-center justify-center">
            <Upload className="w-3.5 h-3.5 text-ink/50" />
          </div>
          <div>
            <p className="font-bold text-ink text-sm">استعادة نسخة احتياطية</p>
            <p className="text-ink/30 text-xs">
              ارفع ملف <strong className="text-emerald-400">النسخة الشاملة</strong> فقط (الزر الأخضر
              أعلاه)
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-300/70 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span>ستُحذف البيانات الحالية وتُستبدل بمحتوى الملف. المستخدمون والإعدادات تبقى.</span>
        </div>

        <input
          ref={restoreFileRef}
          type="file"
          accept=".json,.json.enc"
          className="hidden"
          onChange={onRestoreFile}
        />

        {restoreLoading && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-line">
            <Loader2 className="w-4 h-4 text-ink/40 animate-spin" />
            <p className="text-ink/60 text-sm">جاري الاستعادة...</p>
          </div>
        )}

        {restoreResult && !restoreLoading && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-bold text-sm">تمت الاستعادة بنجاح</span>
              <span className="mr-auto px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                v{restoreResult.meta.file_version}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {Object.entries(restoreResult.counts)
                .filter(([, v]) => (v as number) > 0)
                .slice(0, 9)
                .map(([k, v]) => (
                  <div key={k} className="bg-surface rounded-lg p-2">
                    <p className="text-ink/35 text-[10px]">{k}</p>
                    <p className="text-ink font-bold">{String(v)}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {restoreError && !restoreLoading && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <X className="w-4 h-4 shrink-0" /> {restoreError}
          </div>
        )}

        <button
          onClick={() => (restoreFileRef as React.RefObject<HTMLInputElement>).current?.click()}
          disabled={restoreLoading}
          className="w-full py-3.5 rounded-xl border-2 border-dashed border-line hover:border-amber-500/30 text-ink/50 hover:text-amber-400 transition-all flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-40"
        >
          <Upload className="w-4 h-4" /> اختر ملف النسخة الاحتياطية (.json)
        </button>
      </div>
    </div>
  );
}
