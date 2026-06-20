import { Plus, Trash2, X, Vault, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Classification {
  id: number;
  name: string;
}

interface PriceList {
  id: number;
  name: string;
  is_active: boolean;
}

interface Safe {
  id: number;
  name: string;
  balance: number;
}

interface AddFormData {
  name: string;
  phone: string;
  balance: number;
  is_customer: boolean;
  is_supplier: boolean;
  classification_id: number | null;
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

interface ShowEdit {
  id: number;
  name: string;
  phone: string;
  is_customer: boolean;
  is_supplier: boolean;
  classification_id?: number | null;
}

/* ─── إضافة عميل ─── */
export function AddCustomerModal({
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
}: {
  showAdd: boolean;
  formData: AddFormData;
  setFormData: React.Dispatch<React.SetStateAction<AddFormData>>;
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
}) {
  if (!showAdd) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
      <form
        onSubmit={handleAdd}
        className="glass-panel rounded-3xl p-8 w-full max-w-md border border-line"
      >
        <h3 className="text-2xl font-bold text-ink mb-6">عميل جديد</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-ink/70 text-sm mb-1">اسم العميل *</label>
            <input
              required
              type="text"
              className="glass-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-ink/70 text-sm mb-1">
              رقم الهاتف * <span className="text-ink/30 text-xs">(11 رقم)</span>
            </label>
            <input
              required
              type="text"
              inputMode="numeric"
              className="glass-input"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })
              }
              maxLength={11}
              placeholder="01xxxxxxxxx"
            />
          </div>
          <div>
            <label className="block text-ink/70 text-sm mb-1">رصيد ابتدائي (عليه)</label>
            <input
              type="number"
              step="0.01"
              className="glass-input"
              value={formData.balance || ''}
              onChange={(e) =>
                setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <div>
            <label className="block text-ink/70 text-sm mb-1">تصنيف العميل</label>
            <div className="flex items-center gap-2">
              <select
                className="glass-input flex-1 appearance-none"
                value={formData.classification_id ?? ''}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    classification_id: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
              >
                <option value="" className="bg-gray-900">
                  -- بدون تصنيف --
                </option>
                {classifications.map((c) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">
                    {c.name}
                  </option>
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
            {canManageCustomers &&
              (showNewClassification ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="text"
                    autoFocus
                    className="glass-input flex-1 text-sm py-1.5"
                    placeholder="اسم التصنيف الجديد"
                    value={newClassificationName}
                    onChange={(e) => setNewClassificationName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddClassification();
                      }
                      if (e.key === 'Escape') {
                        setShowNewClassification(false);
                        setNewClassificationName('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddClassification}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors shrink-0"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClassification(false);
                      setNewClassificationName('');
                    }}
                    className="px-2 py-1.5 rounded-lg bg-surface text-ink/60 text-xs hover:bg-raised transition-colors shrink-0"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewClassification(true)}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 mt-1.5 transition-colors"
                >
                  <Plus className="w-3 h-3" /> إضافة تصنيف جديد
                </button>
              ))}
          </div>

          <div className="border border-line rounded-2xl p-4 bg-surface space-y-3">
            <p className="text-ink/50 text-xs font-semibold mb-1">الدور في العمليات</p>
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, is_customer: !f.is_customer }))}
              className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${formData.is_customer ? 'text-green-400' : 'text-ink/50 hover:text-ink/70'}`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${formData.is_customer ? 'bg-green-500 border-green-500' : 'border-line'}`}
              >
                {formData.is_customer && <span className="text-ink text-xs font-black">✓</span>}
              </div>
              🛒 عميل — يمكن البيع له
            </button>
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, is_supplier: !f.is_supplier }))}
              className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${formData.is_supplier ? 'text-blue-400' : 'text-ink/50 hover:text-ink/70'}`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${formData.is_supplier ? 'bg-blue-500 border-blue-500' : 'border-line'}`}
              >
                {formData.is_supplier && <span className="text-ink text-xs font-black">✓</span>}
              </div>
              🔄 مورد — يمكن الشراء منه
            </button>
          </div>
        </div>
        <div className="flex gap-4 mt-8">
          <button
            type="submit"
            disabled={createMutationIsPending}
            className="flex-1 btn-primary py-3"
          >
            حفظ
          </button>
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── تعديل عميل ─── */
export function EditCustomerModal({
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
}: {
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
}) {
  if (!showEdit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
      <form
        onSubmit={handleEdit}
        className="glass-panel rounded-3xl p-8 w-full max-w-md border border-line"
      >
        <h3 className="text-2xl font-bold text-ink mb-6">تعديل بيانات العميل</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-ink/70 text-sm mb-1">اسم العميل *</label>
            <input
              required
              type="text"
              className="glass-input"
              value={editFormData.name}
              onChange={(e) => setEditFormData((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-ink/70 text-sm mb-1">
              رقم الهاتف * <span className="text-ink/30 text-xs">(11 رقم)</span>
            </label>
            <input
              required
              type="text"
              inputMode="numeric"
              className="glass-input"
              value={editFormData.phone}
              onChange={(e) =>
                setEditFormData((f) => ({
                  ...f,
                  phone: e.target.value.replace(/\D/g, '').slice(0, 11),
                }))
              }
              maxLength={11}
              placeholder="01xxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-ink/70 text-sm mb-1">تصنيف العميل</label>
            <div className="flex items-center gap-2">
              <select
                className="glass-input flex-1 appearance-none"
                value={editFormData.classification_id ?? ''}
                onChange={(e) =>
                  setEditFormData((f) => ({
                    ...f,
                    classification_id: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
              >
                <option value="" className="bg-gray-900">
                  -- بدون تصنيف --
                </option>
                {classifications.map((c) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">
                    {c.name}
                  </option>
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
            {canManageCustomers &&
              (showNewClassification ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="text"
                    autoFocus
                    className="glass-input flex-1 text-sm py-1.5"
                    placeholder="اسم التصنيف الجديد"
                    value={newClassificationName}
                    onChange={(e) => setNewClassificationName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddClassification();
                      }
                      if (e.key === 'Escape') {
                        setShowNewClassification(false);
                        setNewClassificationName('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddClassification}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors shrink-0"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClassification(false);
                      setNewClassificationName('');
                    }}
                    className="px-2 py-1.5 rounded-lg bg-surface text-ink/60 text-xs hover:bg-raised transition-colors shrink-0"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewClassification(true)}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 mt-1.5 transition-colors"
                >
                  <Plus className="w-3 h-3" /> إضافة تصنيف جديد
                </button>
              ))}
          </div>

          <div>
            <label className="block text-ink/70 text-sm mb-1">قائمة الأسعار</label>
            <select
              className="glass-input w-full appearance-none"
              value={editFormData.price_list_id ?? ''}
              onChange={(e) =>
                setEditFormData((f) => ({
                  ...f,
                  price_list_id: e.target.value ? parseInt(e.target.value) : null,
                  price_list_markup: e.target.value ? f.price_list_markup : '',
                }))
              }
            >
              <option value="" className="bg-gray-900">
                -- بدون قائمة أسعار --
              </option>
              {priceLists.map((pl) => (
                <option key={pl.id} value={pl.id} className="bg-gray-900">
                  {pl.name}
                </option>
              ))}
            </select>
            {editFormData.price_list_id && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-ink/50 text-xs shrink-0">هامش الربح الخاص %</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editFormData.price_list_markup}
                  onChange={(e) =>
                    setEditFormData((f) => ({ ...f, price_list_markup: e.target.value }))
                  }
                  placeholder="مثال: 15"
                  className="glass-input flex-1 text-sm py-1.5"
                />
                <span className="text-ink/40 text-xs shrink-0">%</span>
              </div>
            )}
          </div>

          <div className="border border-line rounded-2xl p-4 bg-surface space-y-3">
            <p className="text-ink/50 text-xs font-semibold mb-1">الدور في العمليات</p>
            <button
              type="button"
              onClick={() => setEditFormData((f) => ({ ...f, is_customer: !f.is_customer }))}
              className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${editFormData.is_customer ? 'text-green-400' : 'text-ink/50 hover:text-ink/70'}`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${editFormData.is_customer ? 'bg-green-500 border-green-500' : 'border-line'}`}
              >
                {editFormData.is_customer && <span className="text-ink text-xs font-black">✓</span>}
              </div>
              🛒 عميل — يمكن البيع له
            </button>
            <button
              type="button"
              onClick={() => setEditFormData((f) => ({ ...f, is_supplier: !f.is_supplier }))}
              className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${editFormData.is_supplier ? 'text-blue-400' : 'text-ink/50 hover:text-ink/70'}`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${editFormData.is_supplier ? 'bg-blue-500 border-blue-500' : 'border-line'}`}
              >
                {editFormData.is_supplier && <span className="text-ink text-xs font-black">✓</span>}
              </div>
              🔄 مورد — يمكن الشراء منه
            </button>
          </div>
        </div>
        <div className="flex gap-4 mt-8">
          <button
            type="submit"
            disabled={updateMutationIsPending}
            className="flex-1 btn-primary py-3"
          >
            {updateMutationIsPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── سند قبض ─── */
export function ReceiptModal({
  showReceipt,
  receiptData,
  setReceiptData,
  safes,
  isPending,
  handleReceipt,
  onClose,
}: {
  showReceipt: { id: number; name: string; balance: number } | null;
  receiptData: { amount: string; notes: string; safe_id: string };
  setReceiptData: React.Dispatch<
    React.SetStateAction<{ amount: string; notes: string; safe_id: string }>
  >;
  safes: Safe[];
  isPending: boolean;
  handleReceipt: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  if (showReceipt === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
      <form
        onSubmit={handleReceipt}
        className="glass-panel rounded-3xl p-8 w-full max-w-md border border-line space-y-5"
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-ink">سند قبض</h3>
            <p className="text-ink/50 text-sm mt-1">
              استلام مبلغ من <span className="text-amber-400 font-bold">{showReceipt.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-surface hover:bg-raised"
          >
            <X className="w-4 h-4 text-ink/60" />
          </button>
        </div>

        <div
          className={`rounded-xl px-4 py-2.5 border text-sm font-bold flex items-center justify-between ${showReceipt.balance > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : showReceipt.balance < 0 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-surface border-line text-ink/40'}`}
        >
          <span>الرصيد الحالي:</span>
          <span>
            {showReceipt.balance > 0
              ? `${formatCurrency(showReceipt.balance)} عليه`
              : showReceipt.balance < 0
                ? `${formatCurrency(Math.abs(showReceipt.balance))} دائن له`
                : 'متسوّى'}
          </span>
        </div>

        {showReceipt.balance <= 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-xs text-blue-300">
            ℹ️ رصيد العميل صفر أو دائن — القبض سيجعل رصيده دائناً (سنكون مدينين له بهذا المبلغ)
          </div>
        )}

        <div>
          <label className="block text-ink/70 text-sm mb-1">الخزينة المستلِمة *</label>
          <select
            required
            className="glass-input w-full appearance-none"
            value={receiptData.safe_id}
            onChange={(e) => setReceiptData((d) => ({ ...d, safe_id: e.target.value }))}
          >
            <option value="" className="bg-gray-900">
              -- اختر خزينة --
            </option>
            {safes.map((s) => (
              <option key={s.id} value={s.id} className="bg-gray-900">
                {s.name} ({formatCurrency(Number(s.balance))})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-ink/70 text-sm mb-1">المبلغ المستلم *</label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            className="glass-input text-xl font-bold"
            value={receiptData.amount}
            onChange={(e) => setReceiptData((d) => ({ ...d, amount: e.target.value }))}
            placeholder="0.00"
          />
          {receiptData.amount && (
            <p className="text-xs text-ink/40 mt-1">
              الرصيد بعد القبض:{' '}
              <span
                className={
                  showReceipt.balance - parseFloat(receiptData.amount) < 0
                    ? 'text-blue-400 font-bold'
                    : 'text-amber-400 font-bold'
                }
              >
                {formatCurrency(Math.abs(showReceipt.balance - parseFloat(receiptData.amount)))}
                {showReceipt.balance - parseFloat(receiptData.amount) > 0
                  ? ' عليه'
                  : showReceipt.balance - parseFloat(receiptData.amount) < 0
                    ? ' دائن له'
                    : ' متسوّى'}
              </span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-ink/70 text-sm mb-1">بيان (اختياري)</label>
          <input
            type="text"
            className="glass-input"
            placeholder="دفعة على الحساب..."
            value={receiptData.notes}
            onChange={(e) => setReceiptData((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-emerald-500 text-ink py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <Vault className="w-4 h-4" />
            {isPending ? 'جاري الحفظ...' : 'تأكيد القبض'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── تسديد دفعة ─── */
export function SupplierPaymentModal({
  showSupplierPayment,
  supplierPaymentData,
  setSupplierPaymentData,
  safes,
  isPending,
  handleSupplierPayment,
  onClose,
}: {
  showSupplierPayment: { id: number; name: string; balance: number } | null;
  supplierPaymentData: { amount: string; notes: string; safe_id: string };
  setSupplierPaymentData: React.Dispatch<
    React.SetStateAction<{ amount: string; notes: string; safe_id: string }>
  >;
  safes: Safe[];
  isPending: boolean;
  handleSupplierPayment: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  if (showSupplierPayment === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
      <form
        onSubmit={handleSupplierPayment}
        className="glass-panel rounded-3xl p-8 w-full max-w-md border border-line space-y-5"
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-ink">تسديد دفعة</h3>
            <p className="text-ink/50 text-sm mt-1">
              سداد مستحقات{' '}
              <span className="text-amber-400 font-bold">{showSupplierPayment.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-surface hover:bg-raised"
          >
            <X className="w-4 h-4 text-ink/60" />
          </button>
        </div>

        <div
          className={`rounded-xl px-4 py-2.5 border text-sm font-bold flex items-center justify-between ${showSupplierPayment.balance < 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : showSupplierPayment.balance > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-surface border-line text-ink/40'}`}
        >
          <span>الرصيد الحالي:</span>
          <span>
            {showSupplierPayment.balance < 0
              ? `له علينا ${formatCurrency(Math.abs(showSupplierPayment.balance))}`
              : showSupplierPayment.balance > 0
                ? `عليه لنا ${formatCurrency(showSupplierPayment.balance)}`
                : 'متسوّى'}
          </span>
        </div>

        <div>
          <label className="block text-ink/70 text-sm mb-1">الخزينة المدفوعة منها *</label>
          <select
            required
            className="glass-input w-full appearance-none"
            value={supplierPaymentData.safe_id}
            onChange={(e) => setSupplierPaymentData((d) => ({ ...d, safe_id: e.target.value }))}
          >
            <option value="" className="bg-gray-900">
              -- اختر خزينة --
            </option>
            {safes.map((s) => (
              <option key={s.id} value={s.id} className="bg-gray-900">
                {s.name} ({formatCurrency(Number(s.balance))})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-ink/70 text-sm mb-1">المبلغ المسدَّد *</label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            className="glass-input text-xl font-bold"
            value={supplierPaymentData.amount}
            onChange={(e) => setSupplierPaymentData((d) => ({ ...d, amount: e.target.value }))}
            placeholder="0.00"
          />
          {supplierPaymentData.amount && (
            <p className="text-xs text-ink/40 mt-1">
              الرصيد بعد التسديد:{' '}
              {(() => {
                const newBal = showSupplierPayment.balance + parseFloat(supplierPaymentData.amount);
                return (
                  <span
                    className={
                      newBal < 0
                        ? 'text-red-400 font-bold'
                        : newBal > 0
                          ? 'text-green-400 font-bold'
                          : 'text-ink/40 font-bold'
                    }
                  >
                    {newBal < 0
                      ? `له علينا ${formatCurrency(Math.abs(newBal))}`
                      : newBal > 0
                        ? `عليه لنا ${formatCurrency(newBal)}`
                        : 'متسوّى'}
                  </span>
                );
              })()}
            </p>
          )}
        </div>

        <div>
          <label className="block text-ink/70 text-sm mb-1">ملاحظات (اختياري)</label>
          <input
            type="text"
            className="glass-input"
            placeholder="دفعة مقابل مشتريات..."
            value={supplierPaymentData.notes}
            onChange={(e) => setSupplierPaymentData((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 erp-btn erp-btn-primary py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            {isPending ? 'جاري الحفظ...' : 'تأكيد التسديد'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── تأكيد الحذف ─── */
export function DeleteCustomerConfirm({
  deleteConfirmId,
  customers,
  isPending,
  handleDelete,
  onClose,
}: {
  deleteConfirmId: number | null;
  customers: Array<{ id: number; name: string; balance: number | string }>;
  isPending: boolean;
  handleDelete: () => void;
  onClose: () => void;
}) {
  if (deleteConfirmId === null) return null;
  const customer = customers.find((c) => c.id === deleteConfirmId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
      <div className="glass-panel rounded-3xl p-8 w-full max-w-sm border border-line text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <Trash2 className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-ink">حذف العميل</h3>
          <p className="text-ink/50 text-sm mt-2">
            هل تريد حذف العميل <span className="text-ink font-bold">{customer?.name}</span>؟
          </p>
          {Number(customer?.balance) !== 0 && (
            <p className="text-red-400 text-xs mt-2 font-bold">
              ⚠ لا يمكن الحذف، يوجد رصيد غير مسوّى
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={isPending || Number(customer?.balance) !== 0}
            className="flex-1 bg-red-500/80 hover:bg-red-500 text-ink py-2.5 rounded-xl font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isPending ? 'جاري الحذف...' : 'حذف'}
          </button>
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
