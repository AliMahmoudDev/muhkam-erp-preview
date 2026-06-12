import { TrendingDown, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Expense } from '../types';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink/40 text-sm shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

export function ExpenseDetailModal({ item, onClose }: { item: Expense; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
      <div className="glass-panel rounded-3xl w-full max-w-md border border-line animate-in zoom-in-95">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-orange-400" />
            </div>
            <h3 className="font-bold text-ink text-lg">تفاصيل المصروف</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface text-ink/40 hover:text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <DetailRow label="التصنيف">
            <span className="px-3 py-1 rounded-lg bg-orange-500/15 text-orange-300 text-sm font-bold border border-orange-500/20">
              {item.category}
            </span>
          </DetailRow>
          <DetailRow label="المبلغ">
            <span className="text-red-400 font-black text-xl">{formatCurrency(item.amount)}</span>
          </DetailRow>
          <DetailRow label="الخزينة">
            {item.safe_name
              ? <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 text-sm font-bold border border-blue-500/20">{item.safe_name}</span>
              : <span className="text-ink/30 text-sm">—</span>}
          </DetailRow>
          <DetailRow label="التفاصيل">
            <span className={`text-sm ${item.description ? 'text-ink/80' : 'text-ink/30'}`}>
              {item.description || '—'}
            </span>
          </DetailRow>
          <DetailRow label="التاريخ والوقت">
            <span className="text-ink/60 text-sm">{formatDate(item.created_at)}</span>
          </DetailRow>
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-surface hover:bg-raised text-ink/70 font-bold transition-colors text-sm"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
