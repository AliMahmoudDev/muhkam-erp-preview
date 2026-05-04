import { Plus, Trash2 } from 'lucide-react';

interface Classification {
  id: number;
  name: string;
}

interface FormData {
  name: string;
  phone: string;
  balance: number;
  is_customer: boolean;
  is_supplier: boolean;
  classification_id: number | null;
}

interface CustomerFormProps {
  showAdd: boolean;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  classifications: Classification[];
  canManageCustomers: boolean;
  showNewClassification: boolean;
  setShowNewClassification: (v: boolean) => void;
  newClassificationName: string;
  setNewClassificationName: (v: string) => void;
  handleAdd: (e: React.FormEvent<HTMLFormElement>) => void;
  handleAddClassification: () => void;
  setConfirmDeleteClassificationId: (id: number | null) => void;
  createMutationIsPending: boolean;
  onClose: () => void;
}

export function CustomerForm({
  showAdd,
  formData,
  setFormData,
  classifications,
  canManageCustomers,
  showNewClassification,
  setShowNewClassification,
  newClassificationName,
  setNewClassificationName,
  handleAdd,
  handleAddClassification,
  setConfirmDeleteClassificationId,
  createMutationIsPending,
  onClose,
}: CustomerFormProps) {
  if (!showAdd) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
      <form
        onSubmit={handleAdd}
        className="glass-panel rounded-3xl p-8 w-full max-w-md border border-white/10"
      >
        <h3 className="text-2xl font-bold text-white mb-6">عميل جديد</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm mb-1">اسم العميل *</label>
            <input
              required
              type="text"
              className="glass-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-1">
              رقم الهاتف * <span className="text-white/30 text-xs">(11 رقم)</span>
            </label>
            <input
              required
              type="text"
              inputMode="numeric"
              className="glass-input"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
              maxLength={11}
              placeholder="01xxxxxxxxx"
            />
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-1">رصيد ابتدائي (عليه)</label>
            <input
              type="number"
              step="0.01"
              className="glass-input"
              value={formData.balance || ''}
              onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* تصنيف العميل */}
          <div>
            <label className="block text-white/70 text-sm mb-1">تصنيف العميل</label>
            <div className="flex items-center gap-2">
              <select
                className="glass-input flex-1 appearance-none"
                value={formData.classification_id ?? ''}
                onChange={(e) => setFormData((f) => ({ ...f, classification_id: e.target.value ? parseInt(e.target.value) : null }))}
              >
                <option value="" className="bg-gray-900">-- بدون تصنيف --</option>
                {classifications.map((c) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>
                ))}
              </select>
              {formData.classification_id && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteClassificationId(formData.classification_id!)}
                  className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                  title="حذف التصنيف نهائياً"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {canManageCustomers && (
              showNewClassification ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="text"
                    autoFocus
                    className="glass-input flex-1 text-sm py-1.5"
                    placeholder="اسم التصنيف الجديد"
                    value={newClassificationName}
                    onChange={(e) => setNewClassificationName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddClassification(); }
                      if (e.key === 'Escape') { setShowNewClassification(false); setNewClassificationName(''); }
                    }}
                  />
                  <button type="button" onClick={handleAddClassification} className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors shrink-0">حفظ</button>
                  <button type="button" onClick={() => { setShowNewClassification(false); setNewClassificationName(''); }} className="px-2 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/15 transition-colors shrink-0">إلغاء</button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowNewClassification(true)} className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 mt-1.5 transition-colors">
                  <Plus className="w-3 h-3" /> إضافة تصنيف جديد
                </button>
              )
            )}
          </div>

          {/* أدوار الطرف */}
          <div className="border border-white/10 rounded-2xl p-4 bg-white/3 space-y-3">
            <p className="text-white/50 text-xs font-semibold mb-1">الدور في العمليات</p>
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, is_customer: !f.is_customer }))}
              className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${formData.is_customer ? 'text-green-400' : 'text-white/50 hover:text-white/70'}`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${formData.is_customer ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                {formData.is_customer && <span className="text-white text-xs font-black">✓</span>}
              </div>
              🛒 عميل — يمكن البيع له
            </button>
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, is_supplier: !f.is_supplier }))}
              className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${formData.is_supplier ? 'text-blue-400' : 'text-white/50 hover:text-white/70'}`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${formData.is_supplier ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`}>
                {formData.is_supplier && <span className="text-white text-xs font-black">✓</span>}
              </div>
              🔄 مورد — يمكن الشراء منه
            </button>
          </div>
        </div>
        <div className="flex gap-4 mt-8">
          <button type="submit" disabled={createMutationIsPending} className="flex-1 btn-primary py-3">حفظ</button>
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
