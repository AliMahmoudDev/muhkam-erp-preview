import { C, FONT } from './types';

export interface PlanSetting {
  id: number;
  key: string;
  name_ar: string;
  description: string | null;
  price: number;
  includes_mobile: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  planSettings?: PlanSetting[];
  planSettingsLoading: boolean;
  editingPlan: PlanSetting | null;
  setEditingPlan: (p: PlanSetting | null) => void;
  planSaving: boolean;
  onSavePlan: (p: PlanSetting) => void;
}

export function TabPlans({
  planSettings,
  planSettingsLoading,
  editingPlan,
  setEditingPlan,
  planSaving,
  onSavePlan,
}: Props) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: C.text, margin: 0 }}>
            💰 إدارة الخطط والأسعار
          </h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '4px 0 0' }}>
            تعديل أسعار اشتراكات خطط النظام — تُحسب الإيرادات بناءً على هذه الأسعار
          </p>
        </div>
      </div>

      {planSettingsLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>جارٍ التحميل…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {(planSettings ?? []).map((plan) => {
            const isEditing = editingPlan?.key === plan.key;
            const ep = isEditing ? editingPlan! : plan;
            return (
              <div
                key={plan.key}
                style={{
                  background: C.card,
                  borderRadius: '16px',
                  border: `1.5px solid ${isEditing ? C.orange : C.border}`,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: isEditing ? `0 4px 24px rgba(249,115,22,0.15)` : 'none',
                  transition: 'border-color 0.2s',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: ep.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: ep.is_active ? 'var(--status-success)' : 'var(--status-danger)',
                    }}
                  >
                    {ep.is_active ? 'فعّالة' : 'معطّلة'}
                  </span>
                  <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>
                    {plan.key}
                  </span>
                </div>

                {isEditing ? (
                  <>
                    <div>
                      <label
                        style={{
                          fontSize: '11px',
                          color: C.muted,
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        اسم الخطة (عربي)
                      </label>
                      <input
                        value={ep.name_ar}
                        onChange={(e) => setEditingPlan({ ...ep, name_ar: e.target.value })}
                        style={{
                          width: '100%',
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: C.text,
                          fontSize: '14px',
                          fontFamily: FONT,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: '11px',
                          color: C.muted,
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        الوصف
                      </label>
                      <input
                        value={ep.description ?? ''}
                        onChange={(e) => setEditingPlan({ ...ep, description: e.target.value })}
                        style={{
                          width: '100%',
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: C.text,
                          fontSize: '13px',
                          fontFamily: FONT,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: '11px',
                          color: C.muted,
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        السعر الشهري (ج.م.)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={ep.price}
                        onChange={(e) => setEditingPlan({ ...ep, price: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: C.orange,
                          fontSize: '18px',
                          fontWeight: 800,
                          fontFamily: FONT,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        id={`mobile-${plan.key}`}
                        checked={ep.includes_mobile}
                        onChange={(e) =>
                          setEditingPlan({ ...ep, includes_mobile: e.target.checked })
                        }
                      />
                      <label
                        htmlFor={`mobile-${plan.key}`}
                        style={{ fontSize: '13px', color: C.text, cursor: 'pointer' }}
                      >
                        تشمل تطبيق الموبايل
                      </label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        id={`active-${plan.key}`}
                        checked={ep.is_active}
                        onChange={(e) => setEditingPlan({ ...ep, is_active: e.target.checked })}
                      />
                      <label
                        htmlFor={`active-${plan.key}`}
                        style={{ fontSize: '13px', color: C.text, cursor: 'pointer' }}
                      >
                        الخطة فعّالة
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <button
                        onClick={() => onSavePlan(ep)}
                        disabled={planSaving}
                        style={{
                          flex: 1,
                          background: C.orange,
                          color: 'var(--text-1)',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '10px',
                          fontWeight: 800,
                          fontSize: '13px',
                          fontFamily: FONT,
                          cursor: 'pointer',
                        }}
                      >
                        {planSaving ? 'جارٍ الحفظ…' : '💾 حفظ'}
                      </button>
                      <button
                        onClick={() => setEditingPlan(null)}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          color: C.muted,
                          border: `1px solid ${C.border}`,
                          borderRadius: '10px',
                          padding: '10px',
                          fontWeight: 700,
                          fontSize: '13px',
                          fontFamily: FONT,
                          cursor: 'pointer',
                        }}
                      >
                        إلغاء
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: C.text }}>
                        {plan.name_ar}
                      </div>
                      {plan.description && (
                        <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>
                          {plan.description}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: C.orange }}>
                      {plan.price.toLocaleString('ar-EG')}
                      <span
                        style={{
                          fontSize: '14px',
                          color: C.muted,
                          fontWeight: 600,
                          marginRight: '4px',
                        }}
                      >
                        ج.م./شهر
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {plan.includes_mobile && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            background: 'rgba(99,102,241,0.12)',
                            color: 'var(--status-info)',
                          }}
                        >
                          📱 يشمل الموبايل
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingPlan({ ...plan })}
                      style={{
                        background: 'transparent',
                        border: `1.5px solid ${C.orange}`,
                        color: C.orange,
                        borderRadius: '10px',
                        padding: '8px',
                        fontWeight: 700,
                        fontSize: '13px',
                        fontFamily: FONT,
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      ✏️ تعديل السعر
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: '32px',
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(249,115,22,0.06)',
          border: `1px solid rgba(249,115,22,0.2)`,
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', color: C.muted, lineHeight: 1.6 }}>
          ⚠️ تغيير الأسعار يؤثر فقط على حسابات الإيرادات والتقارير. لا يتم تحديث الرسوم تلقائياً
          للعملاء الحاليين. تحقق دائماً من إعدادات بوابة الدفع عند تغيير أي سعر.
        </p>
      </div>
    </div>
  );
}
