import { useRef } from 'react';
import { Trash2, X, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { ExpenseCategory } from '../types';
import { Combobox } from '@/components/ui/combobox';

interface Safe {
  id: number;
  name: string;
  balance: number;
}

interface AddExpenseModalProps {
  show: boolean;
  formData: { category: string; amount: string; description: string; safe_id: string };
  setFormData: React.Dispatch<
    React.SetStateAction<{ category: string; amount: string; description: string; safe_id: string }>
  >;
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
      <form
        onSubmit={handleAdd}
        className="glass-panel rounded-3xl p-8 w-full max-w-md animate-in zoom-in-95 space-y-4"
      >
        <div className="erp-modal-header">
          <div className="erp-modal-title-group">
            <h2 className="erp-modal-title">مصروف جديد</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="erp-action-btn"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category */}
        <div>
          <label className="erp-label flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-ink/40" /> تصنيف المصروف *
          </label>
          <div className="flex gap-2">
            <Combobox
              options={categories.map((c) => ({ value: c.name, label: c.name }))}
              value={formData.category}
              onChange={(v) => setFormData({ ...formData, category: v })}
              placeholder="-- اختر التصنيف --"
              className="flex-1"
            />
            {formData.category && categories.find((c) => c.name === formData.category) && (
              <button
                type="button"
                onClick={() => {
                  const cat = categories.find((c) => c.name === formData.category);
                  if (cat) onDeleteCategory(cat.id);
                }}
                className="p-2.5 rounded-xl bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-red-500/20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              ref={catInputRef}
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              className="erp-input flex-1 text-sm py-1.5"
              placeholder="＋ إضافة تصنيف جديد..."
            />
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={catLoading || !newCatName.trim()}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors border border-amber-500/25 text-sm font-bold disabled:opacity-40"
            >
              {catLoading ? '...' : 'إضافة'}
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="erp-label">المبلغ (ج.م) *</label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            className="erp-input w-full"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
        </div>

        {/* Safe */}
        {isCashier ? (
          <div>
            <label className="erp-label">الخزينة</label>
            <div className="erp-input w-full flex items-center gap-2 opacity-70 cursor-not-allowed">
              <span className="text-amber-300 font-bold text-sm">{userSafeName}</span>
            </div>
          </div>
        ) : (
          <div>
            <label className="erp-label">الخزينة المدفوع منها</label>
            <Combobox
              options={safes.map((s) => ({
                value: String(s.id),
                label: `${s.name} (${formatCurrency(Number(s.balance))})`,
              }))}
              value={formData.safe_id}
              onChange={(v) => setFormData({ ...formData, safe_id: v })}
              placeholder="-- بدون خزينة --"
              clearable
              className="w-full"
            />
          </div>
        )}

        {/* Description */}
        <div>
          <label className="erp-label">التفاصيل (اختياري)</label>
          <input
            type="text"
            className="erp-input w-full"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="erp-modal-footer">
          <button
            type="submit"
            disabled={createIsPending}
            className="flex-1 btn-primary"
          >
            {createIsPending ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
