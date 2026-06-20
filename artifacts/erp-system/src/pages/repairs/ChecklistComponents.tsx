import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertCircle,
  ClipboardList,
  ChevronRight,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import type { ChecklistItem } from './repairConstants';

/* ══════════════════════════════════════════════════════════════
   CHECKLIST WIZARD — one item at a time
══════════════════════════════════════════════════════════════ */
export function ChecklistWizard({
  checklist,
  onSaveItem,
}: {
  checklist: ChecklistItem[];
  onSaveItem: (id: string, status: ChecklistItem['status'], notes: string) => void;
}) {
  const [wizardIdx, setWizardIdx] = useState(0);
  const [awaitingNotes, setAwaitingNotes] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ChecklistItem['status']>(null);
  const [pendingNotes, setPendingNotes] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);

  const total = checklist.length;
  const doneCount = checklist.filter((c) => c.status !== null).length;
  const allDone = doneCount === total && total > 0;

  const nextPending = checklist.findIndex((c, i) => i >= wizardIdx && c.status === null);
  const currentItem = nextPending >= 0 ? checklist[nextPending] : null;

  const handleStatus = (s: ChecklistItem['status']) => {
    if (!currentItem) return;
    if (s === 'partial' || s === 'untestable') {
      setPendingStatus(s);
      setPendingNotes('');
      setAwaitingNotes(true);
    } else {
      onSaveItem(currentItem.id, s, '');
      setWizardIdx(nextPending + 1);
      setAwaitingNotes(false);
    }
  };

  const handleSaveWithNotes = () => {
    if (!currentItem) return;
    onSaveItem(currentItem.id, pendingStatus, pendingNotes);
    setWizardIdx(nextPending + 1);
    setAwaitingNotes(false);
    setPendingNotes('');
  };

  const statusBadge = (s: ChecklistItem['status']) => {
    if (s === 'pass')
      return { label: 'يعمل', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' };
    if (s === 'fail')
      return { label: 'لا يعمل', cls: 'border-red-500/30 bg-red-500/10 text-red-400' };
    if (s === 'partial')
      return { label: 'جزئي', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-400' };
    if (s === 'untestable') return { label: '—', cls: 'border-line bg-surface text-ink/30' };
    return { label: '؟', cls: 'border-line text-ink/30' };
  };

  const isPoweredOff = checklist.length === 1 && checklist[0].id === '__power_off__';
  if (isPoweredOff) {
    return (
      <div className="glass-panel rounded-2xl p-4 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
        <XCircle className="w-7 h-7 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-300">الجهاز لا يفتح</p>
          <p className="text-[11px] text-red-400/60 mt-0.5">
            تم تسجيل الطلب بدون فحص — الجهاز لا يشتغل
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-3 border border-line">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-ink/40 font-bold flex items-center gap-1">
          <ClipboardList className="w-3 h-3" /> فحص الجهاز
        </p>
        <span className="text-[10px] text-ink/30">
          {doneCount} / {total}
        </span>
      </div>
      <div className="w-full bg-surface rounded-full h-1 mb-4">
        <div
          className="h-1 rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }}
        />
      </div>

      {allDone ? (
        <div className="text-center py-3 space-y-2">
          <div className="text-3xl">✅</div>
          <p className="text-sm font-bold text-emerald-400">اكتمل الفحص</p>
          <p className="text-[11px] text-ink/40">جميع بنود التشخيص مسجلة</p>
          <button
            onClick={() => {
              setWizardIdx(0);
              setAwaitingNotes(false);
            }}
            className="flex items-center gap-1 mx-auto text-[11px] text-ink/40 hover:text-ink/60 border border-line rounded-lg px-3 py-1.5 transition-all"
          >
            <RotateCcw className="w-3 h-3" /> إعادة المراجعة
          </button>
        </div>
      ) : currentItem ? (
        <div className="space-y-3">
          <div className="bg-surface border border-line rounded-xl p-4 text-center">
            <p className="text-ink font-bold text-base">{currentItem.label}</p>
            <p className="text-[10px] text-ink/30 mt-1">
              البند {wizardIdx + 1} من {total}
            </p>
          </div>

          {awaitingNotes ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs text-amber-400/80">
                  {pendingStatus === 'partial'
                    ? 'يعمل جزئياً — أضف ملاحظة (اختياري):'
                    : 'لا يمكن تجربته — أضف سبباً (اختياري):'}
                </p>
              </div>
              <textarea
                value={pendingNotes}
                onChange={(e) => setPendingNotes(e.target.value)}
                rows={2}
                placeholder="ملاحظة اختيارية..."
                className="erp-input w-full text-xs resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveWithNotes}
                  className="flex-1 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all flex items-center justify-center gap-1"
                >
                  حفظ والتالي <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setAwaitingNotes(false)}
                  className="px-3 py-2 rounded-xl border border-line text-ink/40 text-xs hover:text-ink/60 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleStatus('pass')}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span className="text-xs font-bold">يعمل</span>
              </button>
              <button
                onClick={() => handleStatus('fail')}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <XCircle className="w-6 h-6" />
                <span className="text-xs font-bold">لا يعمل</span>
              </button>
              <button
                onClick={() => handleStatus('partial')}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all"
              >
                <AlertCircle className="w-6 h-6" />
                <span className="text-xs font-bold">لا يعمل بشكل جيد</span>
              </button>
              <button
                onClick={() => handleStatus('untestable')}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-surface border border-line text-ink/40 hover:bg-surface hover:text-ink/60 active:scale-95 transition-all"
              >
                <MinusCircle className="w-6 h-6" />
                <span className="text-xs font-bold">لا يمكن تجربته</span>
              </button>
            </div>
          )}
        </div>
      ) : null}

      {doneCount > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <button
            onClick={() => setSummaryOpen((v) => !v)}
            className="w-full flex items-center justify-between px-1 py-1 rounded-lg hover:bg-surface transition-all"
          >
            <div className="flex items-center gap-2">
              <ChevronRight
                className={`w-3 h-3 text-ink/25 transition-transform duration-200 ${summaryOpen ? 'rotate-90' : ''}`}
              />
              <span className="text-[10px] text-ink/30 font-semibold">
                النتائج المسجلة — اضغط لتعديل
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px]">
              {checklist.filter((c) => c.status === 'pass').length > 0 && (
                <span className="text-emerald-400 font-bold">
                  {checklist.filter((c) => c.status === 'pass').length}✓
                </span>
              )}
              {checklist.filter((c) => c.status === 'fail').length > 0 && (
                <span className="text-red-400 font-bold">
                  {checklist.filter((c) => c.status === 'fail').length}✗
                </span>
              )}
              {checklist.filter((c) => c.status === 'partial').length > 0 && (
                <span className="text-amber-400 font-bold">
                  {checklist.filter((c) => c.status === 'partial').length}~
                </span>
              )}
            </div>
          </button>
          {summaryOpen && (
            <div className="mt-1 space-y-0.5">
              {checklist
                .filter((c) => c.status)
                .map((item) => {
                  const { label, cls } = statusBadge(item.status);
                  const realIdx = checklist.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setWizardIdx(realIdx);
                        setAwaitingNotes(false);
                        setSummaryOpen(false);
                      }}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface transition-all text-right"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-ink/25 w-4 shrink-0 text-center">
                          {realIdx + 1}
                        </span>
                        <span className="text-xs text-ink/60 truncate">{item.label}</span>
                        {item.notes && (
                          <span className="text-[10px] text-ink/30 truncate max-w-[80px]">
                            ({item.notes})
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 mr-2 ${cls}`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   JOB CHECKLIST — inline editable (used in JobDetail)
══════════════════════════════════════════════════════════════ */
export function JobChecklist({
  checklist,
  onSaveItem,
  readOnly = false,
}: {
  checklist: ChecklistItem[];
  onSaveItem: (id: string, status: ChecklistItem['status'], notes: string) => void;
  readOnly?: boolean;
}) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ChecklistItem['status']>(null);
  const [notesText, setNotesText] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const categoryMap = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of checklist) {
      const cat = item.category ?? 'عام';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [checklist]);

  if (checklist.length === 1 && checklist[0].id === '__power_off__') {
    return (
      <div className="glass-panel rounded-2xl p-4 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
        <XCircle className="w-7 h-7 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-300">الجهاز لا يفتح</p>
          <p className="text-[11px] text-red-400/60 mt-0.5">
            تم تسجيل الطلب بدون فحص — الجهاز لا يشتغل
          </p>
        </div>
      </div>
    );
  }

  const toggleCat = (cat: string) =>
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const pass = checklist.filter((c) => c.status === 'pass').length;
  const fail = checklist.filter((c) => c.status === 'fail').length;
  const partial = checklist.filter((c) => c.status === 'partial').length;
  const unanswered = checklist.filter((c) => !c.status).length;
  const total = checklist.length;
  const doneCount = total - unanswered;

  const STATUS_OPTS: {
    key: ChecklistItem['status'];
    label: string;
    cls: string;
    activeCls: string;
  }[] = [
    {
      key: 'pass',
      label: '✓',
      cls: 'border-line text-ink/30 hover:border-emerald-500/40 hover:text-emerald-400',
      activeCls: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
    },
    {
      key: 'fail',
      label: '✗',
      cls: 'border-line text-ink/30 hover:border-red-500/40 hover:text-red-400',
      activeCls: 'border-red-500/50 bg-red-500/15 text-red-300',
    },
    {
      key: 'partial',
      label: '~',
      cls: 'border-line text-ink/30 hover:border-amber-500/40 hover:text-amber-400',
      activeCls: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
    },
    {
      key: 'untestable',
      label: '—',
      cls: 'border-line text-ink/20 hover:border-line hover:text-ink/50',
      activeCls: 'border-line bg-surface text-ink/50',
    },
  ];

  const handleClick = (item: ChecklistItem, key: ChecklistItem['status']) => {
    if (readOnly) return;
    if (key === 'partial' || key === 'untestable') {
      setEditingNotes(item.id);
      setPendingStatus(key);
      setNotesText(item.notes ?? '');
    } else {
      onSaveItem(item.id, key, '');
      if (editingNotes === item.id) setEditingNotes(null);
    }
  };

  const confirmNotes = (itemId: string) => {
    onSaveItem(itemId, pendingStatus, notesText);
    setEditingNotes(null);
    setPendingStatus(null);
    setNotesText('');
  };

  const statusLabel = (s: ChecklistItem['status']) =>
    s === 'pass' ? 'يعمل' : s === 'fail' ? 'لا يعمل' : s === 'partial' ? 'جزئي' : '—';

  const statusBadgeCls = (s: ChecklistItem['status']) =>
    s === 'pass'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : s === 'fail'
        ? 'text-red-400 bg-red-500/10 border-red-500/20'
        : s === 'partial'
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          : s === 'untestable'
            ? 'text-ink/30 bg-surface border-line'
            : '';

  return (
    <div className="glass-panel rounded-2xl p-3 border border-line">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-ink/40 font-bold flex items-center gap-1.5">
          <ClipboardList className="w-3 h-3" /> فحص الجهاز
          {readOnly && (
            <span className="text-[9px] text-ink/25 border border-line rounded px-1 py-0.5">
              مقفل
            </span>
          )}
        </p>
        <div className="flex items-center gap-2 text-[10px]">
          {pass > 0 && <span className="text-emerald-400">{pass} يعمل</span>}
          {fail > 0 && <span className="text-red-400">{fail} لا يعمل</span>}
          {partial > 0 && <span className="text-amber-400">{partial} جزئي</span>}
          {unanswered > 0 && <span className="text-ink/30">{unanswered} لم يُفحص</span>}
        </div>
      </div>
      <div className="w-full bg-surface rounded-full h-1 mb-3">
        <div
          className="h-1 rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }}
        />
      </div>
      <div className="space-y-1">
        {Array.from(categoryMap.entries()).map(([cat, items]) => {
          const isOpen = expandedCats.has(cat);
          const catPass = items.filter((i) => i.status === 'pass').length;
          const catFail = items.filter((i) => i.status === 'fail').length;
          const catPartial = items.filter((i) => i.status === 'partial').length;
          const catPending = items.filter((i) => !i.status).length;

          return (
            <div key={cat} className="rounded-xl border border-line overflow-hidden">
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface transition-all text-right"
              >
                <div className="flex items-center gap-2">
                  <ChevronRight
                    className={`w-3 h-3 text-ink/35 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                  />
                  <span className="text-[11px] text-ink/65 font-bold">{cat}</span>
                  <span className="text-[9px] text-ink/25">({items.length})</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px]">
                  {catPass > 0 && <span className="text-emerald-400 font-bold">{catPass}✓</span>}
                  {catFail > 0 && <span className="text-red-400 font-bold">{catFail}✗</span>}
                  {catPartial > 0 && (
                    <span className="text-amber-400 font-bold">{catPartial}~</span>
                  )}
                  {catPending > 0 && <span className="text-ink/25">{catPending}؟</span>}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-line divide-y divide-white/4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`px-3 ${!readOnly ? 'hover:bg-surface' : ''} transition-all group`}
                    >
                      <div className="flex items-center gap-2 py-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.status === 'pass'
                              ? 'bg-emerald-400'
                              : item.status === 'fail'
                                ? 'bg-red-400'
                                : item.status === 'partial'
                                  ? 'bg-amber-400'
                                  : item.status === 'untestable'
                                    ? 'bg-raised'
                                    : 'bg-surface'
                          }`}
                        />
                        <span
                          className={`flex-1 text-xs ${item.status ? 'text-ink/70' : 'text-ink/45'}`}
                        >
                          {item.label}
                        </span>
                        {item.status && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${statusBadgeCls(item.status)}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        )}
                        {!readOnly && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {STATUS_OPTS.map(({ key, label, cls, activeCls }) => (
                              <button
                                key={key}
                                onClick={() => handleClick(item, key)}
                                className={`w-6 h-6 rounded-md border text-[11px] font-bold transition-all ${
                                  item.status === key ? activeCls : cls
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {!readOnly && editingNotes === item.id && (
                        <div className="flex gap-2 mb-2 px-4">
                          <input
                            autoFocus
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmNotes(item.id);
                              if (e.key === 'Escape') {
                                setEditingNotes(null);
                                setPendingStatus(null);
                              }
                            }}
                            placeholder="ملاحظة (اختياري)..."
                            className="erp-input flex-1 text-xs py-0.5"
                          />
                          <button
                            onClick={() => confirmNotes(item.id)}
                            className="text-emerald-400 p-1 hover:text-emerald-300"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {item.notes && (!editingNotes || editingNotes !== item.id) && (
                        <p className="text-[10px] text-ink/30 px-5 pb-1.5 italic">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {unanswered === 0 && (
        <p className="text-center text-[10px] text-emerald-400/60 mt-3">✓ اكتمل الفحص</p>
      )}
    </div>
  );
}
