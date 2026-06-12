/**
 * system-tab.tsx — النظام (دمج النسخ الاحتياطي + إدارة البيانات)
 */
import { lazy, Suspense, useState } from "react";
import { HardDrive, Database, Loader2 } from "lucide-react";

const BackupTab = lazy(() => import("./backup-tab"));
const DataTab   = lazy(() => import("./data-tab"));

type SubTab = "backup" | "data";

const SUB_TABS: { id: SubTab; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
  { id: "backup", label: "النسخ الاحتياطي",  icon: HardDrive, desc: "تصدير واستعادة وجدولة النسخ" },
  { id: "data",   label: "إدارة البيانات",    icon: Database,  desc: "استيراد وتصدير ومنطقة الخطر" },
];

export default function SystemTab() {
  const [active, setActive] = useState<SubTab>("backup");

  return (
    <div className="space-y-5" dir="rtl">
      {/* Sub-tab switcher */}
      <div className="flex gap-3">
        {SUB_TABS.map(t => {
          const Icon   = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-right flex-1 ${
                isActive
                  ? "bg-amber-500/10 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.12)]"
                  : "border-line bg-[var(--erp-bg-card)] hover:border-line hover:bg-surface"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-amber-500/20" : "bg-surface"}`}>
                <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-ink/40"}`} />
              </div>
              <div>
                <p className={`font-bold text-sm ${isActive ? "text-amber-400" : "text-ink/60"}`}>{t.label}</p>
                <p className="text-ink/25 text-[11px] mt-0.5">{t.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <Suspense fallback={
        <div className="flex items-center justify-center gap-2 py-16 text-ink/25 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
        </div>
      }>
        {active === "backup" && <BackupTab />}
        {active === "data"   && <DataTab />}
      </Suspense>
    </div>
  );
}
