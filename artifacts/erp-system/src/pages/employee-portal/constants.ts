/* ══════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════ */

export const ADVANCE_STATUS: Record<string, [string, string, string]> = {
  pending:  ['قيد المراجعة', '#fbbf24', 'rgba(251,191,36,0.13)'],
  approved: ['موافق عليه',   '#34d399', 'rgba(52,211,153,0.13)'],
  rejected: ['مرفوض',        '#f87171', 'rgba(248,113,113,0.13)'],
  paid:     ['مدفوع',        '#60a5fa', 'rgba(96,165,250,0.13)'],
  active:   ['نشط',          '#a78bfa', 'rgba(167,139,250,0.13)'],
  settled:  ['مسدد',         '#34d399', 'rgba(52,211,153,0.13)'],
  cancelled:['ملغى',         '#94a3b8', 'rgba(148,163,184,0.1)'],
};

export const LEAVE_STATUS: Record<string, [string, string, string]> = {
  pending:  ['قيد الانتظار', '#fbbf24', 'rgba(251,191,36,0.13)'],
  approved: ['موافق عليه',   '#34d399', 'rgba(52,211,153,0.13)'],
  rejected: ['مرفوض',        '#f87171', 'rgba(248,113,113,0.13)'],
  cancelled:['ملغى',         '#94a3b8', 'rgba(148,163,184,0.1)'],
};

export const ADVANCE_TYPES = [
  ['personal',    'شخصي'],
  ['emergency',   'طارئ'],
  ['medical',     'علاجي'],
  ['educational', 'تعليمي'],
  ['other',       'أخرى'],
] as const;
