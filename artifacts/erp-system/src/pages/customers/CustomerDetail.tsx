import { Plus, Trash2 } from 'lucide-react';

interface Classification {
  id: number;
  name: string;
}

interface PriceList {
  id: number;
  name: string;
  is_active: boolean;
}

interface ShowEdit {
  id: number;
  name: string;
  phone: string;
  is_customer: boolean;
  is_supplier: boolean;
  classification_id?: number | null;
}

interface EditFormData {
  name: string;
  phone: string;
  is_customer: boolean;
  is_supplier: boolean;
  classification_id: number | null;
  price_list_id: number | null;
  price_list_markup: string;
}

interface CustomerDetailProps {
  showEdit: ShowEdit | null;
  editFormData: EditFormData;
  setEditFormData: React.Dispatch<React.SetStateAction<EditFormData>>;
  classifications: Classification[];
  priceLists: PriceList[];
  canManageCustomers: boolean;
  showNewClassification: boolean;
  setShowNewClassification: (v: boolean) => void;
  newClassificationName: string;
  setNewClassificationName: (v: string) => void;
  handleEdit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleAddClassification: () => void;
  setConfirmDeleteClassificationId: (id: number | null) => void;
  updateMutationIsPending: boolean;
  onClose: () => void;
}

export function CustomerDetail({
  showEdit,
  editFormData,
  setEditFormData,
  classifications,
  priceLists,
  canManageCustomers,
  showNewClassification,
  setShowNewClassification,
  newClassificationName,
  setNewClassificationName,
  handleEdit,
  handleAddClassification,
  setConfirmDeleteClassificationId,
  updateMutationIsPending,
  onClose,
}: CustomerDetailProps) {
  if (!showEdit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
      <form
        onSubmit={handleEdit}
        className="glass-panel rounded-3xl p-8 w-full max-w-md border border-white/10"
      >
        <h3 className="text-2xl font-bold text-white mb-6">تعديل بيانات العميل</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm mb-1">اسم العميل *</label>
            <input
              required
              type="text"
              className="glass-input"
              value={editFormData.name}
              onChange={(e) => setEditFormData((f) => ({ ...f, name: e.target.value }))}
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
              value={editFormData.phone}
              onChange={(e) => setEditFormData((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              maxLength={11}
              placeholder="01xxxxxxxxx"
            />
          </div>

          {/* تصنيف العميل */}
          <div>
            <label className="block text-white/70 text-sm mb-1">تصنيف العميل</label>
            <div className="flex items-center gap-2">
              <select
                className="glass-input flex-1 appearance-none"
                value={editFormData.classification_id ?? ''}
                onChange={(e) => setEditFormData((f) => ({ ...f, classification_id: e.target.value ? parseInt(e.target.value) : null }))}
              >
                <option value="" className="bg-gray-900">-- بدون تصنيف --</option>
                {classifications.map((c) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>
                ))}
              </select>
              {editFormData.classification_id && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteClassificationId(editFormData.classification_id!)}
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

          {/* قائمة الأسعار */}
          <div>
            <label className="block text-white/70 text-sm mb-1">قائمة الأسعار</label>
            <select
              className="glass-input w-full appearance-none"
              value={editFormData.price_list_id ?? ''}
              onChange={(e) => setEditFormData((f) => ({ ...f, price_list_id: e.target.value ? parseInt(e.target.value) : null, price_list_markup: e.target.value ? f.price_list_markup : '' }))}
            >
              <option value="" className="bg-gray-900">-- بدون قائمة أسعار --</option>
              {priceLists.map((pl) => (
                <option key={pl.id} value={pl.id} className="bg-gray-900">{pl.name}</option>
              ))}
            </select>
            {editFormData.price_list_id && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-white/50 text-xs shrink-0">هامش الربح الخاص %</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editFormData.price_list_markup}
                  onChange={(e) => setEditFormData((f) => ({ ...f, price_list_markup: e.target.value }))}
                  placeholder="مثال: 15"
                  className="glass-input flex-1 text-sm py-1.5"
                />
                <span className="text-white/40 text-xs shrink-0">%</span>
              </div>
            )}
          </div>

          {/* الدور في العمليات */}
          <div className="border border-white/10 rounded-2xl p-4 bg-white/3 space-y-3">
            <p className="text-white/50 text-xs font-semibold mb-1">الدور في العمليات</p>
            <button
              type="button"
              onClick={() => setEditFormData((f) => ({ ...f, is_customer: !f.is_customer }))}
              className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${editFormData.is_customer ? 'text-green-400' : 'text-white/50 hover:text-white/70'}`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${editFormData.is_customer ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                {editFormData.is_customer && <span className="text-white text-xs font-black">✓</span>}
              </div>
              🛒 عميل — يمكن البيع له
            </button>
            <button
              type="button"
              onClick={() => setEditFormData((f) => ({ ...f, is_supplier: !f.is_supplier }))}
              className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${editFormData.is_supplier ? 'text-blue-400' : 'text-white/50 hover:text-white/70'}`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${editFormData.is_supplier ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`}>
                {editFormData.is_supplier && <span className="text-white text-xs font-black">✓</span>}
              </div>
              🔄 مورد — يمكن الشراء منه
            </button>
          </div>
        </div>
        <div className="flex gap-4 mt-8">
          <button type="submit" disabled={updateMutationIsPending} className="flex-1 btn-primary py-3">
            {updateMutationIsPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
