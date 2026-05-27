import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Wallet, X } from 'lucide-react';
import { ADVANCE_TYPES } from './constants';

/* ══════════════════════════════════════════════════
   SALARY ADVANCE REQUEST MODAL
══════════════════════════════════════════════════ */

export function AdvanceRequestModal({ empId, currency, isDark, border, onClose }: {
  empId: number; currency: string; isDark: boolean; border: string; onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    requested_amount: '',
    advance_type: 'personal',
    reason: '',
    deduct_from: 'fixed' as 'fixed' | 'commission' | 'both',
  });
  const bg = isDark ? 'rgba(8,14,26,0.98)' : '#ffffff';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc';
  const inputStyle = {
    width:'100%', padding:'10px 14px', borderRadius:10,
    border:`1px solid ${border}`, background:inputBg, color:textMain,
    fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const,
  };
  const labelStyle = { fontSize:12, fontWeight:700 as const, color:textMain, display:'block' as const, marginBottom:6 };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/salary-advances', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: empId,
          requested_amount: parseFloat(form.requested_amount),
          advance_type: form.advance_type,
          reason: form.reason,
          deduct_from: form.deduct_from,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(String(j.message ?? j.error ?? 'فشل إرسال الطلب'));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم إرسال طلب السلفة ✓', description: 'سيتم مراجعته من قِبل المدير وإشعارك بالنتيجة' });
      qc.invalidateQueries({ queryKey: ['portal-advances'] });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'فشل إرسال الطلب', description: e.message, variant: 'destructive' });
    },
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }}>
      <div dir="rtl" style={{ width:'100%', maxWidth:460, borderRadius:20, background:bg, border:`1px solid ${border}`, padding:28, position:'relative', boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, left:16, background:'transparent', border:'none', cursor:'pointer', color:isDark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.4)' }}>
          <X size={18} />
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
          <span style={{ width:42, height:42, borderRadius:12, background:'rgba(245,158,11,0.18)', display:'flex', alignItems:'center', justifyContent:'center', color:'#f59e0b', flexShrink:0 }}>
            <Wallet size={21} />
          </span>
          <div>
            <p style={{ fontSize:16, fontWeight:900, color:textMain }}>طلب سلفة مالية</p>
            <p style={{ fontSize:12, color:textMuted }}>سيُرسَل للمدير للموافقة</p>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Amount */}
          <div>
            <label style={labelStyle}>المبلغ المطلوب ({currency}) *</label>
            <input
              type="number" min="1"
              value={form.requested_amount}
              onChange={e => setForm(p => ({ ...p, requested_amount: e.target.value }))}
              placeholder="أدخل المبلغ..."
              style={inputStyle}
            />
          </div>

          {/* Advance type */}
          <div>
            <label style={labelStyle}>نوع السلفة</label>
            <select
              value={form.advance_type}
              onChange={e => setForm(p => ({ ...p, advance_type: e.target.value }))}
              style={inputStyle}
            >
              {ADVANCE_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Deduct from */}
          <div>
            <label style={labelStyle}>خصم السلفة من</label>
            <select
              value={form.deduct_from}
              onChange={e => setForm(p => ({ ...p, deduct_from: e.target.value as 'fixed' | 'commission' | 'both' }))}
              style={inputStyle}
            >
              <option value="fixed">الراتب الثابت</option>
              <option value="commission">العمولة</option>
              <option value="both">من الراتب الثابت والعمولة معاً</option>
            </select>
          </div>

          {/* Reason */}
          <div>
            <label style={labelStyle}>سبب الطلب (اختياري)</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="اكتب سبب السلفة..."
              rows={3}
              style={{ ...inputStyle, resize:'vertical' }}
            />
          </div>

          {/* Info note */}
          <div style={{ fontSize:12, color:'#f59e0b', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.20)', borderRadius:9, padding:'10px 14px', lineHeight:1.6 }}>
            سيصلك إشعار بالنتيجة فور مراجعة الطلب من قِبل المدير
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:22 }}>
          <button
            onClick={() => mutate()}
            disabled={!form.requested_amount || parseFloat(form.requested_amount) <= 0 || isPending}
            style={{ flex:1, padding:'11px 0', borderRadius:11, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg, #b45309, #f59e0b)', color:'#fff',
              fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              opacity: (!form.requested_amount || parseFloat(form.requested_amount) <= 0 || isPending) ? 0.6 : 1 }}
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <PlusCircle size={15} />}
            {isPending ? 'جاري الإرسال...' : 'إرسال طلب السلفة'}
          </button>
          <button
            onClick={onClose}
            style={{ padding:'11px 18px', borderRadius:11, border:`1px solid ${border}`, cursor:'pointer',
              background:'transparent', color:isDark?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.5)', fontWeight:600, fontSize:13 }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
