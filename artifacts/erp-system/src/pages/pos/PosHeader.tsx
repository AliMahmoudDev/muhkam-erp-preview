import { Store, Vault, Zap, RotateCcw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <header className="flex items-center justify-between px-4 py-2 bg-[var(--surface)] border-b border-[var(--line)] shrink-0">
      {/* Left: info */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-[var(--brand)] shrink-0" />
          <div>
            <p className="text-[10px] opacity-50">الفرع</p>
            <p className="font-bold text-sm leading-tight">{warehouseName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Vault className="w-4 h-4 opacity-50 shrink-0" />
          <div>
            <p className="text-[10px] opacity-50">الخزينة</p>
            <p className="font-bold text-sm leading-tight">{safeName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 text-black bg-[var(--brand)]">
            {(userName ?? '?').slice(0, 2)}
          </div>
          <p className="opacity-60 text-sm font-medium">{userName}</p>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-4">
        {/* Keyboard shortcuts */}
        <div className="hidden lg:flex items-center gap-2">
          {[
            ['F2', 'بحث'],
            ['Enter', 'إضافة'],
            ['F9', 'دفع'],
            ['ESC', 'خروج'],
            ['⌃⌫', 'مسح'],
          ].map(([k, l]) => (
            <div key={k} className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-bold opacity-50 bg-[var(--raised)] border border-[var(--line)]">
                {k}
              </kbd>
              <span className="text-[10px] opacity-40">{l}</span>
            </div>
          ))}
        </div>

        {canReturnSale && (
          <Button
            size="sm"
            variant={returnMode ? 'default' : 'ghost'}
            className={returnMode ? 'bg-red-500 hover:bg-red-600 text-ink' : ''}
            onClick={onToggleReturnMode}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {returnMode ? 'إلغاء المرتجع' : 'مرتجع'}
          </Button>
        )}

        <Button
          size="sm"
          variant={cashierMode ? 'default' : 'ghost'}
          className={cashierMode ? 'bg-amber-500 hover:bg-amber-600 text-black' : ''}
          onClick={onToggleCashierMode}
        >
          <Zap className="w-3.5 h-3.5" />
          {cashierMode ? 'عادي' : 'وضع الكاشير'}
        </Button>

        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            title="تغيير الفرع والخزينة"
            onClick={onResetSetup}
          >
            <Settings className="w-3.5 h-3.5" />
            تغيير
          </Button>
        )}
      </div>
    </header>
  );
}
