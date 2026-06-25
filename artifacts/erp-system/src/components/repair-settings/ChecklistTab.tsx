import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Plus,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  AlertCircle,
  Zap,
  ArrowLeft,
  Copy,
  Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import type { ChecklistRow, DeviceType, DeviceCategory, Manufacturer } from './shared';
import { DEVICE_TYPE_LABEL, loadManufacturers, saveManufacturers } from './shared';
import { Combobox } from '@/components/ui/combobox';

export default function ChecklistTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  /* ── manufacturer/category state ── */
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>(loadManufacturers);
  const [activeMfr, setActiveMfr] = useState<string>('apple');
  const [showAddMfr, setShowAddMfr] = useState(false);
  const [addMfrLabel, setAddMfrLabel] = useState('');
  const [addMfrEmoji, setAddMfrEmoji] = useState('📱');
  const [showAddCat, setShowAddCat] = useState(false);
  const [addCatLabel, setAddCatLabel] = useState('');
  const [addCatEmoji, setAddCatEmoji] = useState('📱');

  /* ── item state ── */
  const [activeType, setActiveType] = useState<string>('iphone');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [addingToCat, setAddingToCat] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [localCats, setLocalCats] = useState<string[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  /* ── derived manufacturer / category helpers ── */
  const activeMfrData = manufacturers.find((m) => m.key === activeMfr) ?? manufacturers[0];
  const activeCatData = activeMfrData?.categories.find((c) => c.key === activeType);
  const allDeviceTypes = manufacturers.flatMap((m) => m.categories);

  const doSelectMfr = (mfrKey: string) => {
    setActiveMfr(mfrKey);
    const mfr = manufacturers.find((m) => m.key === mfrKey);
    if (mfr && mfr.categories.length > 0) setActiveType(mfr.categories[0].key);
    setShowAddMfr(false);
    setShowAddCat(false);
  };

  const doAddManufacturer = () => {
    const label = addMfrLabel.trim();
    if (!label) return;
    const key = `mfr_${label
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '_')
      .slice(0, 24)}_${Date.now()}`;
    const newMfr: Manufacturer = { key, label, emoji: addMfrEmoji, categories: [] };
    const updated = [...manufacturers, newMfr];
    setManufacturers(updated);
    saveManufacturers(updated);
    setActiveMfr(key);
    setAddMfrLabel('');
    setAddMfrEmoji('📱');
    setShowAddMfr(false);
  };

  const doAddCategory = () => {
    const label = addCatLabel.trim();
    if (!label) return;
    const key = `${activeMfr}_${label
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\u0600-\u06ff]/g, '')
      .slice(0, 24)}_${Date.now()}`;
    const newCat: DeviceCategory = { key, label, emoji: addCatEmoji };
    const updated = manufacturers.map((m) =>
      m.key === activeMfr ? { ...m, categories: [...m.categories, newCat] } : m
    );
    setManufacturers(updated);
    saveManufacturers(updated);
    setActiveType(key);
    setAddCatLabel('');
    setAddCatEmoji('📱');
    setShowAddCat(false);
  };

  const deviceType = activeType;
  const qKey = ['/api/repair-checklist-items', deviceType];

  const {
    data: rawItems,
    isLoading,
    isError,
  } = useQuery<ChecklistRow[]>({
    queryKey: qKey,
    queryFn: async () => {
      const r = await authFetch(api(`/api/repair-checklist-items?device_type=${deviceType}`));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 0,
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const items = useMemo(
    () =>
      (rawItems ?? []).map((i) => ({
        ...i,
        category: i.category ?? 'عام',
        device_type: i.device_type ?? deviceType,
      })),
    [rawItems, deviceType]
  );

  const dbCategories = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const item of items) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        order.push(item.category);
      }
    }
    return order;
  }, [items]);

  const allCategories = useMemo(() => {
    const result = [...dbCategories];
    for (const lc of localCats) {
      if (!result.includes(lc)) result.push(lc);
    }
    return result;
  }, [dbCategories, localCats]);

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: qKey }),
    [qc, qKey.join(',')]
  );

  useEffect(() => {
    if (!dbCategories.length) return;
    setExpandedCats((prev) => {
      const n = new Set(prev);
      dbCategories.forEach((c) => n.add(c));
      return n;
    });
  }, [dbCategories.join(',')]);

  useEffect(() => {
    setEditingId(null);
    setAddingToCat(null);
    setNewItemLabel('');
    setLocalCats([]);
    setExpandedCats(new Set());
    setShowCopyMenu(false);
  }, [activeType]);

  const toggleCat = (cat: string) =>
    setExpandedCats((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) {
        n.delete(cat);
      } else {
        n.add(cat);
      }
      return n;
    });

  const seedDeviceType = async () => {
    setSeeding(true);
    const r = await authFetch(api('/api/repair-checklist-items/seed-device-type'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_type: deviceType }),
    });
    setSeeding(false);
    if (r.status === 409) {
      toast({ title: 'البنود محملة مسبقاً' });
      return;
    }
    if (!r.ok) {
      toast({ title: 'خطأ في تحميل البنود', variant: 'destructive' });
      return;
    }
    const { count } = await r.json();
    toast({ title: `✓ تم تحميل ${count} بند` });
    invalidate();
  };

  const copyFrom = async (fromType: string) => {
    setCopying(true);
    setShowCopyMenu(false);
    const r = await authFetch(api('/api/repair-checklist-items/copy'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromType, to: deviceType }),
    });
    setCopying(false);
    if (!r.ok) {
      toast({ title: 'تعذر النسخ', variant: 'destructive' });
      return;
    }
    const { count } = await r.json();
    const fromLabel =
      allDeviceTypes.find((t) => t.key === fromType)?.label ??
      DEVICE_TYPE_LABEL[fromType as DeviceType] ??
      fromType;
    toast({ title: `✓ تم نسخ ${count} بند من ${fromLabel}` });
    invalidate();
  };

  const addItemToCat = async (cat: string) => {
    const label = newItemLabel.trim();
    if (!label) return;
    const r = await authFetch(api('/api/repair-checklist-items'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_ar: label, category: cat, device_type: deviceType }),
    });
    if (!r.ok) {
      toast({ title: 'خطأ في الإضافة', variant: 'destructive' });
      return;
    }
    setNewItemLabel('');
    setAddingToCat(null);
    setLocalCats((prev) => prev.filter((c) => c !== cat));
    invalidate();
  };

  const saveEdit = async (id: number) => {
    if (!editLabel.trim()) return;
    const r = await authFetch(api(`/api/repair-checklist-items/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_ar: editLabel.trim() }),
    });
    if (!r.ok) {
      toast({ title: 'خطأ في التعديل', variant: 'destructive' });
      return;
    }
    setEditingId(null);
    invalidate();
  };

  const deleteItem = async (id: number) => {
    await authFetch(api(`/api/repair-checklist-items/${id}`), { method: 'DELETE' });
    invalidate();
  };

  const openAddToCat = (cat: string) => {
    if (!dbCategories.includes(cat))
      setLocalCats((prev) => (prev.includes(cat) ? prev : [...prev, cat]));
    setExpandedCats((prev) => {
      const n = new Set(prev);
      n.add(cat);
      return n;
    });
    setAddingToCat(cat);
    setNewItemLabel('');
    setEditingId(null);
    setShowNewCat(false);
  };

  const confirmAddCat = () => {
    const name = newCatInput.trim();
    if (!name || allCategories.includes(name)) return;
    openAddToCat(name);
    setNewCatInput('');
  };

  const isEmpty = !isLoading && !isError && items.length === 0 && localCats.length === 0;

  /* activeMeta — safe for built-in and custom types */
  const activeMeta = {
    key: activeType,
    label: activeCatData?.label ?? DEVICE_TYPE_LABEL[activeType as DeviceType] ?? activeType,
    emoji: activeCatData?.emoji ?? '📱',
  };

  /* unified accent classes — token-based, auto-switch with theme */
  const accent = 'text-amber-400';
  const accentDim = 'text-amber-300/75';
  const accentBg = 'bg-amber-500/10';
  const accentBdr = 'border-amber-500/30';
  const badgeCls = 'bg-amber-500/15 text-amber-200/85 border border-amber-500/25';

  /* بحث محلّي داخل البنود */
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  /* ⌘K / Ctrl+K → focus search */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (i) => i.label_ar.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  /* pill styles — token-based, no isLight needed */
  const mfrActiveStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.28) 0%, rgba(217,119,6,0.12) 100%)',
    border: '1px solid rgba(245,158,11,0.55)',
    color: '#fef3c7',
    boxShadow:
      '0 6px 16px -4px rgba(245,158,11,0.40), inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 3px rgba(245,158,11,0.08)',
  };
  const mfrInactiveStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--edge)',
    color: 'var(--text-2)',
  };
  const catActiveStyle: React.CSSProperties = {
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.40)',
    color: 'var(--erp-brand)',
  };
  const catInactiveStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--edge)',
    color: 'var(--text-hint)',
  };

  return (
    <div className="flex flex-col h-full">
      {/* ═════ HERO — manufacturer + category 2-level selector ═════ */}
      <div
        className="px-5 pt-4 pb-0 shrink-0 relative"
        style={{
          background:
            'linear-gradient(180deg, rgba(245,158,11,0.05) 0%, rgba(245,158,11,0.01) 60%, transparent 100%)',
          borderBottom: '1px solid var(--edge)',
        }}
      >
        {/* ── صف 1: عنوان + بيانات ── */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-300 to-amber-500" />
            <h3 className="text-[11px] font-black tracking-[0.22em] uppercase text-ink/55">
              الشركة المصنعة
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-ink/35">
            <span className="font-bold text-amber-500 tabular-nums">{items.length}</span>
            <span>بند في «{activeMeta.label}»</span>
          </div>
        </div>

        {/* ── صف 2: الشركات المصنعة + زر إضافة شركة ── */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {manufacturers.map((mfr) => {
            const isMfrActive = activeMfr === mfr.key;
            return (
              <button
                key={mfr.key}
                onClick={() => doSelectMfr(mfr.key)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all"
                style={isMfrActive ? mfrActiveStyle : mfrInactiveStyle}
              >
                <span className="text-base leading-none">{mfr.emoji}</span>
                <span>{mfr.label}</span>
                {isMfrActive && mfr.categories.length > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-black tabular-nums"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      color: 'var(--erp-brand)',
                      border: '1px solid rgba(252,211,77,0.25)',
                    }}
                  >
                    {mfr.categories.length}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => {
              setShowAddMfr((v) => !v);
              setShowAddCat(false);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-bold whitespace-nowrap transition-all"
            style={mfrInactiveStyle}
          >
            <Plus className="w-3.5 h-3.5" /> شركة جديدة
          </button>
        </div>

        {/* ── صف 3: فئات الشركة المختارة + زر إضافة فئة ── */}
        <div
          className="flex flex-wrap gap-1 pb-2.5 pt-2"
          style={{ borderTop: '1px solid var(--edge)' }}
        >
          {activeMfrData?.categories.map((cat) => {
            const isCatActive = activeType === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveType(cat.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all"
                style={isCatActive ? catActiveStyle : catInactiveStyle}
              >
                <span className="text-sm leading-none">{cat.emoji}</span>
                <span>{cat.label}</span>
                {isCatActive && items.length > 0 && (
                  <span
                    className="text-[10px] px-1 rounded font-black tabular-nums"
                    style={{ background: 'rgba(0,0,0,0.25)', color: 'var(--erp-brand)' }}
                  >
                    {items.length}
                  </span>
                )}
              </button>
            );
          })}
          {activeMfrData && (
            <button
              onClick={() => {
                setShowAddCat((v) => !v);
                setShowAddMfr(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all"
              style={catInactiveStyle}
            >
              <Plus className="w-3 h-3" /> فئة جديدة
            </button>
          )}
          {activeMfrData?.categories.length === 0 && (
            <p className="text-[11px] py-0.5 text-ink/25">
              لا توجد فئات — اضغط «فئة جديدة» لإضافة الأولى
            </p>
          )}
        </div>
      </div>

      {/* ── Add Manufacturer inline form ── */}
      {showAddMfr && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid var(--edge)', background: 'var(--surface)' }}
        >
          <Combobox
            options={['📱', '💻', '⌚', '🎧', '🖥️', '🤖', '🔧', '🎮', '📷', '🖨️'].map((e) => ({ value: e, label: e }))}
            value={addMfrEmoji}
            onChange={(v) => setAddMfrEmoji(v)}
            className="text-lg w-20"
          />
          <input
            autoFocus
            value={addMfrLabel}
            onChange={(e) => setAddMfrLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doAddManufacturer();
              if (e.key === 'Escape') {
                setShowAddMfr(false);
                setAddMfrLabel('');
              }
            }}
            placeholder="اسم الشركة المصنعة (مثال: Huawei)..."
            className="erp-input flex-1 text-sm py-1"
          />
          <button
            onClick={doAddManufacturer}
            disabled={!addMfrLabel.trim()}
            className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowAddMfr(false);
              setAddMfrLabel('');
            }}
            className="text-ink/30 hover:text-ink/60"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Add Category inline form ── */}
      {showAddCat && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid var(--edge)', background: 'var(--surface)' }}
        >
          <Combobox
            options={['📱', '💻', '⌚', '🎧', '🔧', '🤖', '📷', '🖥️', '🎮', '🖨️'].map((e) => ({ value: e, label: e }))}
            value={addCatEmoji}
            onChange={(v) => setAddCatEmoji(v)}
            className="text-lg w-20"
          />
          <input
            autoFocus
            value={addCatLabel}
            onChange={(e) => setAddCatLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doAddCategory();
              if (e.key === 'Escape') {
                setShowAddCat(false);
                setAddCatLabel('');
              }
            }}
            placeholder={`اسم الفئة تحت ${activeMfrData?.label ?? ''}... (مثال: سمارت واتش)`}
            className="erp-input flex-1 text-sm py-1"
          />
          <button
            onClick={doAddCategory}
            disabled={!addCatLabel.trim()}
            className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowAddCat(false);
              setAddCatLabel('');
            }}
            className="text-ink/30 hover:text-ink/60"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═════ شريط البحث + الإجراءات — أسلوب Linear toolbar ═════ */}
      <div
        className="flex items-center flex-wrap gap-2 px-5 py-2.5 shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--edge)' }}
      >
        {/* مربع البحث */}
        <div
          className="flex items-center gap-2 px-3 h-9 rounded-xl flex-1 min-w-[200px] max-w-[360px]"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--edge-md)' }}
        >
          <Search className="w-3.5 h-3.5 shrink-0 text-ink/40" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`ابحث في بنود ${activeMeta.label}...`}
            className="flex-1 bg-transparent text-[12px] outline-none font-medium text-ink placeholder:text-ink/45"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="shrink-0 text-ink/30 hover:text-ink/70"
              title="مسح البحث"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {!searchQuery && <kbd className="rs-kbd shrink-0 hidden sm:inline-flex">⌘ K</kbd>}
        </div>

        <div className="flex-1" />

        {/* الإجراءات */}
        <button
          onClick={() => setShowNewCat((v) => !v)}
          className="flex items-center gap-1.5 text-[11.5px] h-9 px-3 rounded-xl font-bold text-ink/70 hover:text-ink"
          style={{ background: 'var(--surface)', border: '1px solid var(--edge-md)' }}
        >
          <Plus className="w-3.5 h-3.5" /> تصنيف جديد
        </button>
        <div className="relative">
          <button
            onClick={() => setShowCopyMenu((v) => !v)}
            disabled={copying}
            className="flex items-center gap-1.5 text-[11.5px] h-9 px-3 rounded-xl disabled:opacity-40 font-bold text-ink/70 hover:text-ink"
            style={{ background: 'var(--surface)', border: '1px solid var(--edge-md)' }}
          >
            <Copy className="w-3.5 h-3.5" /> {copying ? 'جاري النسخ...' : 'نسخ من'}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showCopyMenu && (
            <div
              className="rs-popup-dark absolute left-0 top-full mt-1.5 z-20 w-56 rounded-xl py-1.5 max-h-80 overflow-y-auto rs-scroll"
              style={{
                background: 'var(--bg-panel)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--edge-md)',
                boxShadow: 'var(--shadow-modal)',
              }}
            >
              <p className="text-[10px] text-ink/40 font-black tracking-wider uppercase px-3 pt-1 pb-1.5">
                انسخ بنود من:
              </p>
              {allDeviceTypes
                .filter((d) => d.key !== activeType)
                .map((d) => (
                  <button
                    key={d.key}
                    onClick={() => copyFrom(d.key)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-ink/80 hover:bg-amber-500/10 hover:text-amber-200 text-right rounded-md mx-1 transition-colors"
                  >
                    <span className="text-base">{d.emoji}</span>
                    <span className="flex-1 font-semibold">{d.label}</span>
                    <ArrowLeft className="w-3 h-3 opacity-40" />
                  </button>
                ))}
            </div>
          )}
        </div>
        <button
          onClick={seedDeviceType}
          disabled={seeding}
          className="flex items-center gap-1.5 text-[11.5px] h-9 px-3.5 rounded-xl font-black disabled:opacity-40 text-amber-50"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.85), rgba(217,119,6,0.65))',
            border: '1px solid rgba(245,158,11,0.55)',
            boxShadow:
              '0 4px 14px -3px rgba(245,158,11,0.45),' + 'inset 0 1px 0 rgba(255,255,255,0.20)',
          }}
        >
          <Zap className="w-3.5 h-3.5" />
          {seeding ? 'جاري التحميل...' : 'تحميل بنود افتراضية'}
        </button>
      </div>

      {/* Add cat input */}
      {showNewCat && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface shrink-0">
          <input
            autoFocus
            value={newCatInput}
            onChange={(e) => setNewCatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmAddCat();
              if (e.key === 'Escape') {
                setShowNewCat(false);
                setNewCatInput('');
              }
            }}
            placeholder="اسم التصنيف..."
            className="erp-input flex-1 text-sm py-1"
          />
          <button
            onClick={confirmAddCat}
            disabled={!newCatInput.trim()}
            className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowNewCat(false);
              setNewCatInput('');
            }}
            className="text-ink/30 hover:text-ink/60"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-line border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center h-32 gap-2 text-red-400/70 text-sm">
            <AlertCircle className="w-4 h-4" /> خطأ في تحميل البيانات
          </div>
        )}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 px-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/12 border border-amber-500/25 flex items-center justify-center text-2xl">
              {activeMeta.emoji}
            </div>
            <p className="text-ink/40 text-sm text-center">
              لا توجد بنود فحص لـ {activeMeta.label} بعد — تُستخدم نفس البنود في الفحص الأولي و QC
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={seedDeviceType}
                disabled={seeding}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${accentBg} ${accentBdr} ${accent} hover:bg-amber-500/20`}
              >
                <Zap className="w-4 h-4" />
                {seeding ? 'جاري التحميل...' : `تحميل بنود ${activeMeta.label}`}
              </button>
              <button
                onClick={() => setShowCopyMenu((v) => !v)}
                disabled={copying}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold border border-line bg-surface text-ink/65 hover:bg-surface disabled:opacity-50"
              >
                <Copy className="w-4 h-4" /> نسخ من نوع آخر
              </button>
            </div>
            <button
              onClick={() => setShowNewCat(true)}
              className="text-xs text-ink/25 hover:text-ink/50 transition-colors"
            >
              أو أضف تصنيفاً يدوياً
            </button>
          </div>
        )}
        {!isLoading && !isError && !isEmpty && (
          <div className="pb-4">
            {allCategories.map((cat) => {
              const catItems = filteredItems
                .filter((i) => i.category === cat)
                .sort((a, b) => a.sort_order - b.sort_order);
              if (searchQuery && catItems.length === 0) return null;
              const isExpanded = searchQuery ? true : expandedCats.has(cat);
              const isLocal = !dbCategories.includes(cat);
              return (
                <div key={cat} className="border-b border-line last:border-b-0">
                  <button
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-raised transition-colors text-right"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 ${accentDim} transition-transform duration-200 shrink-0 ${isExpanded ? '' : '-rotate-90'}`}
                    />
                    <span className={`text-[13px] font-semibold flex-1 text-right ${accentDim}`}>
                      {cat}
                      {isLocal && (
                        <span className="text-[10px] font-normal mr-2 text-ink/25">جديد</span>
                      )}
                    </span>
                    {!isLocal && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${badgeCls}`}>
                        {catItems.length}
                      </span>
                    )}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddToCat(cat);
                      }}
                      className="flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-lg border border-transparent text-ink/25 hover:bg-surface hover:border-line hover:text-ink/60 transition-all shrink-0"
                    >
                      <Plus className="w-3 h-3" /> بند
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-2 pt-0.5 pb-2 space-y-0.5">
                      {catItems.length === 0 && addingToCat !== cat && (
                        <p className="text-center text-ink/20 text-xs py-4">
                          لا توجد بنود — اضغط «بند» لإضافة الأول
                        </p>
                      )}
                      {catItems.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 py-2 px-3 rounded-xl border border-transparent hover:border-line hover:bg-surface transition-all group"
                        >
                          <span className="text-[10px] text-ink/15 w-5 text-left shrink-0 tabular-nums group-hover:text-ink/35">
                            {idx + 1}
                          </span>
                          {editingId === item.id ? (
                            <>
                              <input
                                autoFocus
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(item.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="erp-input flex-1 text-sm py-0.5"
                              />
                              <button
                                onClick={() => saveEdit(item.id)}
                                className="text-emerald-400 hover:text-emerald-300 p-1 shrink-0"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-ink/30 p-1 shrink-0"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-ink/75">{item.label_ar}</span>
                              <button
                                onClick={() => {
                                  setEditingId(item.id);
                                  setEditLabel(item.label_ar);
                                  setAddingToCat(null);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-ink/25 hover:text-amber-400 p-1 transition-all shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 text-ink/20 hover:text-red-400 p-1 transition-all shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      {addingToCat === cat && (
                        <div className="flex items-center gap-2 py-1.5 px-3 mt-0.5 rounded-xl border border-line bg-surface">
                          <input
                            autoFocus
                            value={newItemLabel}
                            onChange={(e) => setNewItemLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addItemToCat(cat);
                              if (e.key === 'Escape') {
                                setAddingToCat(null);
                                setNewItemLabel('');
                              }
                            }}
                            placeholder={`بند جديد في «${cat}»...`}
                            className="erp-input flex-1 text-sm py-0.5"
                          />
                          <button
                            onClick={() => addItemToCat(cat)}
                            disabled={!newItemLabel.trim()}
                            className="text-emerald-400 hover:text-emerald-300 p-1 disabled:opacity-30 shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setAddingToCat(null);
                              setNewItemLabel('');
                            }}
                            className="text-ink/25 hover:text-ink/60 p-1 shrink-0"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
