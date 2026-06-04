/**
 * quality-check-helpers — أنواع وثوابت ودوال تحليل لبوّابة مراقبة الجودة (QC).
 *
 * مستخرجة من QualityCheckModal.tsx للحفاظ على حجم الملف وقابلية الصيانة.
 * منطق خالص بدون JSX — لا تغيير في السلوك.
 */
import { Check, Minus, XCircle } from "lucide-react";

export type QcStatus = "pass" | "fail" | "n/a";

/** بند الفحص الأولي كما يحفظه نظام الاستلام */
export interface IntakeItem {
  id: string;
  label: string;
  category?: string;
  status?: string | null;        // pass | fail | partial | untestable | null
  notes?: string | null;
}

/** بند فحص الجودة — مطابق لبنود الاستلام مع قرار الفني */
export interface QcItem {
  id: string;
  label: string;
  category?: string;
  intake_status?: string | null; // الحالة الأصلية عند الاستلام (مرجع)
  intake_notes?: string | null;
  status: QcStatus | null;       // قرار الفني الحالي
  notes: string;                 // ملاحظات الفني
}

/* ─── ألوان أزرار القرار ─── */
export const QC_BTN: Record<QcStatus, { label: string; bg: string; ring: string; icon: typeof Check }> = {
  pass:   { label: "قبول",     bg: "bg-emerald-500/85", ring: "ring-emerald-300/60", icon: Check   },
  fail:   { label: "رفض",      bg: "bg-red-500/85",     ring: "ring-red-300/60",     icon: XCircle },
  "n/a":  { label: "لا ينطبق", bg: "bg-zinc-500/80",    ring: "ring-zinc-300/50",    icon: Minus   },
};

/* ─── شارة حالة الاستلام للعرض في العمود الأيمن ─── */
export const INTAKE_BADGE: Record<string, { txt: string; cls: string; bg: string }> = {
  pass:       { txt: "يعمل",     cls: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/25" },
  fail:       { txt: "لا يعمل",  cls: "text-red-300",     bg: "bg-red-500/10 border-red-500/25"         },
  partial:    { txt: "جزئي",     cls: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/25"     },
  untestable: { txt: "غير قابل", cls: "text-zinc-300",    bg: "bg-zinc-500/10 border-zinc-500/25"       },
  na:         { txt: "غير قابل", cls: "text-zinc-300",    bg: "bg-zinc-500/10 border-zinc-500/25"       },
};

/* ─── بنود QC الافتراضية حسب نوع الجهاز (تُستخدم عندما لا يوجد قالب في قاعدة البيانات) ─── */
const PHONE_ITEMS = [
  { id: "d_screen",       label: "الشاشة (الصورة والتاتش)",       category: "الشاشة"     },
  { id: "d_front_cam",    label: "الكاميرا الأمامية",               category: "الكاميرات"  },
  { id: "d_back_cam",     label: "الكاميرا الخلفية",                category: "الكاميرات"  },
  { id: "d_speaker",      label: "السماعة الخارجية",                category: "الصوت"      },
  { id: "d_earpiece",     label: "سماعة الأذن",                     category: "الصوت"      },
  { id: "d_mic",          label: "الميكروفون",                      category: "الصوت"      },
  { id: "d_battery",      label: "البطارية (الشحن والاستهلاك)",     category: "البطارية"   },
  { id: "d_charging",     label: "منفذ الشحن",                      category: "البطارية"   },
  { id: "d_wifi",         label: "الواي فاي",                       category: "الاتصالات"  },
  { id: "d_sim",          label: "قارئ الشريحة",                    category: "الاتصالات"  },
  { id: "d_btooth",       label: "البلوتوث",                        category: "الاتصالات"  },
  { id: "d_buttons",      label: "الأزرار الجانبية والصوت",         category: "الأزرار"    },
  { id: "d_fingerprint",  label: "بصمة الإصبع / Face ID",           category: "الأمان"     },
  { id: "d_vibration",    label: "الاهتزاز",                        category: "أخرى"       },
  { id: "d_body",         label: "الهيكل الخارجي (كسر / خدش)",     category: "الهيكل"     },
];

const LAPTOP_ITEMS = [
  { id: "d_screen",    label: "الشاشة (الصورة والألوان)",           category: "الشاشة"     },
  { id: "d_keyboard",  label: "لوحة المفاتيح",                      category: "الإدخال"    },
  { id: "d_touchpad",  label: "لوحة اللمس (التاتشباد)",             category: "الإدخال"    },
  { id: "d_battery",   label: "البطارية (الشحن والاستهلاك)",        category: "البطارية"   },
  { id: "d_charging",  label: "مدخل الشحن / المحوّل",               category: "البطارية"   },
  { id: "d_wifi",      label: "الواي فاي",                          category: "الاتصالات"  },
  { id: "d_btooth",    label: "البلوتوث",                           category: "الاتصالات"  },
  { id: "d_usb",       label: "منافذ USB",                          category: "المنافذ"    },
  { id: "d_cam",       label: "الكاميرا",                           category: "الكاميرا"   },
  { id: "d_speaker",   label: "السماعات",                           category: "الصوت"      },
  { id: "d_mic",       label: "الميكروفون",                         category: "الصوت"      },
  { id: "d_fan",       label: "المروحة / التهوية",                  category: "الحرارة"    },
  { id: "d_body",      label: "الهيكل الخارجي",                     category: "الهيكل"     },
];

const TABLET_ITEMS = [
  { id: "d_screen",       label: "الشاشة (الصورة والتاتش)",         category: "الشاشة"    },
  { id: "d_front_cam",    label: "الكاميرا الأمامية",               category: "الكاميرات" },
  { id: "d_back_cam",     label: "الكاميرا الخلفية",                category: "الكاميرات" },
  { id: "d_speaker",      label: "السماعات",                        category: "الصوت"     },
  { id: "d_battery",      label: "البطارية",                        category: "البطارية"  },
  { id: "d_charging",     label: "منفذ الشحن",                      category: "البطارية"  },
  { id: "d_wifi",         label: "الواي فاي",                       category: "الاتصالات" },
  { id: "d_buttons",      label: "الأزرار الجانبية",                category: "الأزرار"   },
  { id: "d_body",         label: "الهيكل الخارجي",                  category: "الهيكل"    },
];

const GENERAL_ITEMS = [
  { id: "d_power",     label: "التشغيل والإيقاف",   category: "أساسيات" },
  { id: "d_screen",    label: "الشاشة",              category: "أساسيات" },
  { id: "d_battery",   label: "البطارية / الطاقة",  category: "أساسيات" },
  { id: "d_sound",     label: "الصوت",               category: "أساسيات" },
  { id: "d_body",      label: "الهيكل الخارجي",      category: "أساسيات" },
];

export function getDefaultItems(deviceType: string) {
  const dt = deviceType.toLowerCase();
  if (dt.includes("iphone") || dt.includes("samsung_phone") || dt.includes("android_phone") || dt.includes("phone"))
    return PHONE_ITEMS;
  if (dt.includes("ipad") || dt.includes("tablet") || dt.includes("samsung_tablet"))
    return TABLET_ITEMS;
  if (dt.includes("laptop") || dt.includes("macbook") || dt.includes("notebook"))
    return LAPTOP_ITEMS;
  return GENERAL_ITEMS;
}

/* ─── parsing helpers ─── */
export function parseChecklist(raw: unknown): IntakeItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); if (Array.isArray(v)) arr = v; } catch { /* ignore */ }
  }
  return arr
    .map((c, i) => {
      const o = c as Record<string, unknown>;
      const id = String(o.id ?? o.item_id ?? `item-${i}`);
      const label = String(o.label ?? o.label_ar ?? `بند ${i + 1}`);
      // تجاهل بند "الجهاز لا يفتح" — لا يصلح للفحص
      if (id === "__power_off__") return null;
      return {
        id,
        label,
        category: typeof o.category === "string" ? o.category : undefined,
        status:   typeof o.status === "string" ? o.status : null,
        notes:    typeof o.notes === "string" ? o.notes : null,
      } as IntakeItem;
    })
    .filter((x): x is IntakeItem => x !== null);
}

export function parseSavedQc(raw: unknown): Array<{ id?: string; label?: string; status?: string; notes?: string }> {
  if (Array.isArray(raw)) return raw as Array<{ id?: string; label?: string; status?: string; notes?: string }>;
  if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}
