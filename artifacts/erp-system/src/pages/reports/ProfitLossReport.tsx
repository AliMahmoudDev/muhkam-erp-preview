/**
 * ProfitLossReport — قائمة الأرباح والخسائر
 * الحالة: ✔ STABLE — النظام المالي جاهز للإنتاج، عربي بالكامل، ومجمَّع.
 * Financial system is production-ready, fully Arabic, and frozen.
 */
import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import {
  api, authFetch,
  DateMode, getDateRange, getPrevRange,
  ProfitsData, EMPTY_PL, thisMonthStart, todayStr,
} from "./shared";
import FilterPanel from "./profit-loss/FilterPanel";
import SummaryCards from "./profit-loss/SummaryCards";
import ReportTable from "./profit-loss/ReportTable";

/* ── Types ────────────────────────────────────────────────────────────────── */
interface Warehouse { id: number; name: string; }

/* ── Main Component ─────────────────────────────────────────────────────── */
export default function ProfitLossReport() {
  const [mode,setMode]             = useState<DateMode>("month");
  const [customFrom,setCustomFrom] = useState(thisMonthStart());
  const [customTo,setCustomTo]     = useState(todayStr());
  const [branches,setBranches]     = useState<number[]>([]);

  const [dateFrom,dateTo] = getDateRange(mode, customFrom, customTo);
  const [prevFrom,prevTo] = getPrevRange(dateFrom, dateTo);

  const { data:warehouses=[] } = useQuery<Warehouse[]>({
    queryKey: ["/api/settings/warehouses"],
    queryFn: ()=>authFetch(api("/api/settings/warehouses")).then(async r=>{ if(!r.ok) throw new Error(`API Error: ${r.status}`); return r.json(); }),
    staleTime:300_000,
  });


  const buildQS = useCallback((from:string,to:string,ids:number[]) => {
    let qs = `/api/profits?date_from=${from}&date_to=${to}`;
    if (ids.length>0) qs+=`&warehouse_ids=${ids.join(",")}`;
    return qs;
  },[]);

  const {data:plData,isLoading} = useQuery<ProfitsData>({
    queryKey: ["/api/profits",dateFrom,dateTo,branches.join(",")],
    queryFn: ()=>authFetch(api(buildQS(dateFrom,dateTo,branches))).then(async r=>{ if(!r.ok) throw new Error(`API Error: ${r.status}`); return r.json(); }),
    staleTime:60_000,
  });
  const {data:prevData} = useQuery<ProfitsData>({
    queryKey: ["/api/profits",prevFrom,prevTo,branches.join(",")],
    queryFn: ()=>authFetch(api(buildQS(prevFrom,prevTo,branches))).then(async r=>{ if(!r.ok) throw new Error(`API Error: ${r.status}`); return r.json(); }),
    staleTime:60_000, enabled:!!prevFrom,
  });

  const pl   = plData   ? {...EMPTY_PL,...plData}   : EMPTY_PL;
  const prev = prevData ? {...EMPTY_PL,...prevData}  : EMPTY_PL;

  const branchLabel = branches.length===0 ? "جميع الفروع"
    : branches.length===1 ? (warehouses.find(w=>w.id===branches[0])?.name??String(branches[0]))
    : `${branches.length} فروع محددة`;
  const currLabel = `${dateFrom} → ${dateTo}`;
  const prevLabel = `${prevFrom} → ${prevTo}`;
  const hasData = pl.invoice_count > 0 || pl.total_expenses > 0;

  return (
    <div className="space-y-4" dir="rtl" style={{fontFamily:"'Tajawal','Cairo',sans-serif"}}>

      {/* ── Top bar ── */}
      <FilterPanel
        mode={mode} setMode={setMode}
        customFrom={customFrom} setCustomFrom={setCustomFrom}
        customTo={customTo} setCustomTo={setCustomTo}
        warehouses={warehouses} branches={branches} setBranches={setBranches}
        pl={pl} dateFrom={dateFrom} dateTo={dateTo} branchLabel={branchLabel}
      />

      {/* ── KPI Strip — compact ── */}
      <SummaryCards pl={pl} prev={prev}/>

      {/* ── Main content ── */}
      {hasData ? (
        <ReportTable pl={pl} prev={prev} currLabel={currLabel} prevLabel={prevLabel}/>
      ) : (
        !isLoading && (
          <div className="rpt-section rounded-2xl p-16 flex flex-col items-center gap-3">
            <BarChart3 className="w-10 h-10 text-ink/15"/>
            <p className="rpt-strong font-semibold">لا توجد بيانات للفترة المحددة</p>
            <p className="rpt-muted text-xs">جرّب تغيير النطاق الزمني أو الفرع المحدد</p>
          </div>
        )
      )}
    </div>
  );
}
