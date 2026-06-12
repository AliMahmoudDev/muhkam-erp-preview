import { Store, Vault, Zap, RotateCcw, Settings } from 'lucide-react';

interface PosHeaderProps {
  warehouseName: string;
  safeName: string;
  userName: string | null | undefined;
  canReturnSale: boolean;
  returnMode: boolean;
  onToggleReturnMode: () => void;
  cashierMode: boolean;
  onToggleCashierMode: () => void;
  isAdmin: boolean;
  onResetSetup: () => void;
}

export function PosHeader({
  warehouseName,
  safeName,
  userName,
  canReturnSale,
  returnMode,
  onToggleReturnMode,
  cashierMode,
  onToggleCashierMode,
  isAdmin,
  onResetSetup,
}: PosHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        background: 'var(--erp-bg-soft)',
        borderBottom: '1px solid var(--erp-border)',
      }}
    >
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="erp-label text-[10px]">الفرع</p>
            <p className="erp-text font-bold text-sm leading-tight">{warehouseName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Vault className="w-4 h-4 text-violet-400 shrink-0" />
          <div>
            <p className="erp-label text-[10px]">الخزينة</p>
            <p className="erp-text font-bold text-sm leading-tight">{safeName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 text-black"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
          >
            {(userName ?? '?').slice(0, 2)}
          </div>
          <p className="erp-text-muted text-sm font-medium">{userName}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-2">
          {[
            ['F2', 'بحث'],
            ['Enter', 'إضافة'],
            ['F9', 'دفع'],
            ['ESC', 'خروج'],
            ['⌃⌫', 'مسح'],
          ].map(([k, l]) => (
            <div key={k} className="flex items-center gap-1">
              <kbd
                className="px-1.5 py-0.5 rounded text-[10px] font-bold erp-label"
                style={{
                  background: 'var(--erp-bg-elevated)',
                  border: '1px solid var(--erp-border-strong)',
                }}
              >
                {k}
              </kbd>
              <span className="erp-label text-[10px]">{l}</span>
            </div>
          ))}
        </div>

        {canReturnSale && (
          <button
            onClick={onToggleReturnMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              returnMode ? 'bg-red-500 text-ink' : 'erp-btn-secondary'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {returnMode ? 'إلغاء المرتجع' : 'مرتجع'}
          </button>
        )}

        <button
          onClick={onToggleCashierMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            cashierMode ? 'bg-amber-500 text-black' : 'erp-btn-secondary'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          {cashierMode ? 'عادي' : 'وضع الكاشير'}
        </button>

        {isAdmin && (
          <button
            onClick={onResetSetup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold erp-btn-ghost transition-all"
            title="تغيير الفرع والخزينة"
          >
            <Settings className="w-3.5 h-3.5" />
            تغيير
          </button>
        )}
      </div>
    </header>
  );
}
