import { useRef } from 'react';
import { Trash2, X, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { ExpenseCategory } from '../types';

interface Safe {
  id: number;
  name: string;
  balance: number;
}

interface AddExpenseModalProps {
  show: boolean;
  formData: { category: string; amount: string; description: string; safe_id: string };
  setFormData: React.Dispatch<React.SetStateAction<{ category: string; amount: string; description: string; safe_id: string }>>;
  categories: ExpenseCategory[];
  safes: Safe[];
  isCashier: boolean;
  userSafeName: string;
  newCatName: string;
  setNewCatName: (v: string) => void;
  catLoading: boolean;
  createIsPending: boolean;
  handleAdd: (e: React.FormEvent) => void;
  handleAddCategory: () => void;
  onDeleteCategory: (id: number) => void;
  onClose: () => void;
}

export function AddExpenseModal({
  show,
  formData,
  setFormData,
  categories,
  safes,
  isCashier,
  userSafeName,
  newCatName,
  setNewCatName,
  catLoading,
  createIsPending,
  handleAdd,
  handleAddCategory,
  onDeleteCategory,
  onClose,
}: AddExpenseModalProps) {
  const catInputRef = useRef<HTMLInputElement>(null);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
      <form onSubmit={handleAdd}
        className="glass-panel rounded-3xl p-8 w-full max-w-md animate-in zoom-in-95 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-2xl font-bold text-white">مصروف جديد</h3>
          <button type="button" onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category */}
        <div>
          <label className="block text-white/70 text-sm mb-1.5 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-violet-400" /> تصنيف المصروف *
          </label>
          <div className="flex gap-2">
            <select className="glass-input flex-1 appearance-none" value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })} required>
              <option value="" className="bg-gray-900">-- اختر التصنيف --</option>
              {categories.map((c) => <option key={c.id} value={c.name} className="bg-gray-900">{c.name}</option>)}
            </select>
            {formData.category && categories.find((c) => c.name === formData.category) && (
              <button type="button"
                onClick={() => { const cat = categories.find((c) => c.name === formData.category); if (cat) onDeleteCategory(cat.id); }}
                className="p-2.5 rounded-xl bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-red-500/20">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <input ref={catInputRef} type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
              className="glass-input flex-1 text-sm py-1.5" placeholder="＋ إضافة تصنيف جديد..." />
            <button type="button" onClick={handleAddCategory} disabled={catLoading || !newCatName.trim()}
              className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors border border-violet-500/30 text-sm font-bold disabled:opacity-40">
              {catLoading ? '...' : 'إضافة'}
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-white/70 text-sm mb-1">المبلغ (ج.م) *</label>
          <input required type="number" step="0.01" min="0.01" className="glass-input w-full"
            value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
        </div>

        {/* Safe */}
        {isCashier ? (
          <div>
            <label className="block text-white/70 text-sm mb-1">الخزينة</label>
            <div className="glass-input w-full flex items-center gap-2 opacity-70 cursor-not-allowed">
              <span className="text-amber-300 font-bold text-sm">
                {userSafeName}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-white/70 text-sm mb-1">الخزينة المدفوع منها</label>
            <select className="glass-input w-full" value={formData.safe_id}
              onChange={(e) => setFormData({ ...formData, safe_id: e.target.value })}>
              <option value="" className="bg-gray-900">-- بدون خزينة --</option>
              {safes.map((s) => <option key={s.id} value={s.id} className="bg-gray-900">{s.name} ({formatCurrency(Number(s.balance))})</option>)}
            </select>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-white/70 text-sm mb-1">التفاصيل (اختياري)</label>
          <input type="text" className="glass-input w-full" value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
        </div>

        <div className="flex gap-4 pt-2">
          <button type="submit" disabled={createIsPending} className="flex-1 btn-primary py-3 rounded-xl font-bold">
            {createIsPending ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/20">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
