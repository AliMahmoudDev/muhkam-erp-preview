import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ClipboardList, RotateCcw } from "lucide-react";
import PurchaseFormModal from "./PurchaseFormModal";
import PurchaseList from "./PurchaseList";
import PurchaseReturnsPanel from "./PurchaseReturnsPanel";

export default function Purchases() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const urlTab = new URLSearchParams(searchStr).get('tab') as "new" | "history" | "returns" | null;
  const [tab, setTab] = useState<"new" | "history" | "returns">(urlTab ?? "new");

  const changeTab = (t: "new" | "history" | "returns") => {
    setTab(t);
    navigate(`?tab=${t}`, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="flex bg-surface rounded-2xl p-1 border border-line">
          <button onClick={() => changeTab("new")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${tab === "new" ? "bg-amber-500 text-black shadow" : "text-ink/50 hover:text-ink"}`}>
            فاتورة شراء
          </button>
          <button onClick={() => changeTab("history")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${tab === "history" ? "bg-amber-500 text-black shadow" : "text-ink/50 hover:text-ink"}`}>
            <ClipboardList className="w-3.5 h-3.5" /> سجل الفواتير
          </button>
          <button onClick={() => changeTab("returns")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${tab === "returns" ? "bg-amber-500 text-black shadow" : "text-ink/50 hover:text-ink"}`}>
            <RotateCcw className="w-3.5 h-3.5" /> المرتجعات
          </button>
        </div>
      </div>

      {tab === "new" ? <PurchaseFormModal onDone={() => {}} />
        : tab === "history" ? <PurchaseList />
        : <PurchaseReturnsPanel />}
    </div>
  );
}
