/* Lightweight constants shared by repair screens without importing the full settings modal. */

export const REPAIR_SETTING_KEYS = {
  qrBaseUrl: 'repair.qr_base_url',
  warrantyDays: 'repair.default_warranty_days',
  waReady: 'repair.wa_template_ready',
  waProgress: 'repair.wa_template_progress',
} as const;

export const REPAIR_WA_DEFAULTS = {
  ready:
    '✅ عزيزنا {{اسم_العميل}}،\nجهازك {{الماركة}} {{الموديل}} جاهز للاستلام.\nبطاقة الصيانة: {{رقم_البطاقة}}\nالتكلفة الإجمالية: {{التكلفة}}\n\nشكراً لثقتكم 🙏',
  progress:
    '🔧 تحديث صيانة جهازك\nالموديل: {{الماركة}} {{الموديل}}\nالرقم: {{رقم_البطاقة}}\nالحالة: {{الحالة}}\n\nللاستفسار تواصل معنا 📱',
} as const;
