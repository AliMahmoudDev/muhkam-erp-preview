import { C, FONT } from './types';

interface AnnounceItem {
  id: number;
  title: string;
  body: string;
  type: string;
  target: string;
  company_id: number | null;
  is_active: boolean;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}

interface Props {
  annData?: { announcements: AnnounceItem[]; total: number };
  annType: string;
  setAnnType: (v: string) => void;
  annTarget: string;
  setAnnTarget: (v: string) => void;
  annCompanyId: string;
  setAnnCompanyId: (v: string) => void;
  annTitle: string;
  setAnnTitle: (v: string) => void;
  annBody: string;
  setAnnBody: (v: string) => void;
  annExpires: string;
  setAnnExpires: (v: string) => void;
  annSaving: boolean;
  onSave: () => void;
  onToggle: (id: number, is_active: boolean) => void;
  onDelete: (id: number) => void;
}

export function TabAnnouncements({
  annData,
  annType,
  setAnnType,
  annTarget,
  setAnnTarget,
  annCompanyId,
  setAnnCompanyId,
  annTitle,
  setAnnTitle,
  annBody,
  setAnnBody,
  annExpires,
  setAnnExpires,
  annSaving,
  onSave,
  onToggle,
  onDelete,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>
          📢 إعلانات وإشعارات النظام
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
          أرسل إشعارات لشركة محددة أو لجميع العملاء
        </p>
      </div>

      {/* Create form */}
      <div
        style={{
          background: C.card,
          borderRadius: '18px',
          border: `1px solid ${C.border}`,
          padding: '24px',
        }}
      >
        <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: '15px', color: C.text }}>
          ➕ إشعار جديد
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label
                style={{
                  fontSize: '12px',
                  color: C.muted,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                نوع الإشعار
              </label>
              <select
                value={annType}
                onChange={(e) => setAnnType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.text,
                  fontSize: '13px',
                  fontFamily: FONT,
                }}
              >
                <option value="info">ℹ️ معلوماتي</option>
                <option value="success">✅ إيجابي</option>
                <option value="warning">⚠️ تحذير</option>
                <option value="danger">🚨 عاجل</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: '12px',
                  color: C.muted,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                الجمهور المستهدف
              </label>
              <select
                value={annTarget}
                onChange={(e) => setAnnTarget(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.text,
                  fontSize: '13px',
                  fontFamily: FONT,
                }}
              >
                <option value="all">🌐 جميع الشركات</option>
                <option value="specific">🏢 شركة محددة</option>
              </select>
            </div>
            {annTarget === 'specific' && (
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    color: C.muted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  رقم الشركة (ID)
                </label>
                <input
                  type="number"
                  value={annCompanyId}
                  onChange={(e) => setAnnCompanyId(e.target.value)}
                  placeholder="مثال: 5"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    fontSize: '13px',
                    fontFamily: FONT,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>
          <div>
            <label
              style={{
                fontSize: '12px',
                color: C.muted,
                fontWeight: 700,
                display: 'block',
                marginBottom: '6px',
              }}
            >
              عنوان الإشعار *
            </label>
            <input
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="مثال: صيانة مجدولة يوم الجمعة"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${C.border}`,
                background: C.bg,
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
                fontSize: '12px',
                color: C.muted,
                fontWeight: 700,
                display: 'block',
                marginBottom: '6px',
              }}
            >
              نص الرسالة *
            </label>
            <textarea
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="اكتب تفاصيل الإشعار هنا..."
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${C.border}`,
                background: C.bg,
                color: C.text,
                fontSize: '13px',
                fontFamily: FONT,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <label
                style={{
                  fontSize: '12px',
                  color: C.muted,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                تاريخ انتهاء الإشعار (اختياري)
              </label>
              <input
                type="datetime-local"
                value={annExpires}
                onChange={(e) => setAnnExpires(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.text,
                  fontSize: '13px',
                  fontFamily: FONT,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={() => void onSave()}
              disabled={annSaving}
              style={{
                padding: '11px 28px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                border: 'none',
                color: 'var(--text-1)',
                fontSize: '14px',
                fontWeight: 800,
                cursor: annSaving ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                whiteSpace: 'nowrap',
              }}
            >
              {annSaving ? '...' : '📢 نشر الإشعار'}
            </button>
          </div>
        </div>
      </div>

      {/* Announcements list */}
      <div
        style={{
          background: C.card,
          borderRadius: '18px',
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            fontWeight: 800,
            fontSize: '14px',
            color: C.text,
          }}
        >
          📋 الإشعارات المنشورة ({annData?.total ?? 0})
        </div>
        {!annData?.announcements.length ? (
          <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
            لا توجد إشعارات بعد
          </div>
        ) : (
          <div>
            {annData.announcements.map((ann) => {
              const typeColors: Record<string, { color: string; icon: string }> = {
                info: { color: 'var(--status-info)', icon: 'ℹ️' },
                success: { color: 'var(--status-success)', icon: '✅' },
                warning: { color: 'var(--status-warning)', icon: '⚠️' },
                danger: { color: 'var(--status-danger)', icon: '🚨' },
              };
              const tc = typeColors[ann.type] ?? typeColors.info;
              return (
                <div
                  key={ann.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${C.border}`,
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                    opacity: ann.is_active ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{tc.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: '14px', color: C.text }}>
                        {ann.title}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          background: `${tc.color}22`,
                          color: tc.color,
                          fontWeight: 700,
                        }}
                      >
                        {ann.type}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          background: ann.is_active
                            ? 'rgba(52,211,153,0.15)'
                            : 'rgba(148,163,184,0.15)',
                          color: ann.is_active ? 'var(--status-success)' : 'var(--text-2)',
                          fontWeight: 700,
                        }}
                      >
                        {ann.is_active ? 'نشط' : 'معطّل'}
                      </span>
                      <span style={{ fontSize: '11px', color: C.muted }}>
                        {ann.target === 'all' ? '🌐 للجميع' : `🏢 شركة #${ann.company_id}`}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '0 0 6px',
                        fontSize: '13px',
                        color: C.muted,
                        lineHeight: 1.5,
                      }}
                    >
                      {ann.body}
                    </p>
                    <div style={{ fontSize: '11px', color: C.muted }}>
                      {new Date(ann.created_at).toLocaleString('ar-EG', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {ann.expires_at &&
                        ` • ينتهي: ${new Date(ann.expires_at).toLocaleDateString('ar-EG')}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => void onToggle(ann.id, ann.is_active)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${C.border}`,
                        background: 'transparent',
                        color: ann.is_active ? 'var(--status-warning)' : 'var(--status-success)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      {ann.is_active ? '⏸ إيقاف' : '▶️ تفعيل'}
                    </button>
                    <button
                      onClick={() => void onDelete(ann.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'transparent',
                        color: 'var(--status-danger)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      🗑 حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
