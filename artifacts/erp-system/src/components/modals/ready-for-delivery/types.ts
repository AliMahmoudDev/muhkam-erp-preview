export type QcStatus = "pass" | "fail" | "n/a";

export interface IntakeItem {
  id: string;
  label: string;
  category?: string;
  status?: string | null;
  notes?: string | null;
}

export interface QcItem {
  id: string;
  label: string;
  category?: string;
  intake_status?: string | null;
  intake_notes?: string | null;
  status: QcStatus | null;
  notes: string;
}

export interface Product {
  id: number;
  name: string;
  quantity: string | number;
  sell_price: string | number;
  warehouse_id?: number | null;
}

export interface Warehouse {
  id: number;
  name: string;
}

export type PayType = "cash" | "credit";

export interface PayRow {
  id: string;
  type: PayType;
  safe_id: number | null;
  amount: number;
}

export interface PartLine {
  id: string;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  warehouse_id: number | null;
}

export interface JobLite {
  id: number;
  job_no: string;
  device_brand?: string | null;
  device_model?: string | null;
  device_type?: string | null;
  customer_name?: string | null;
  final_cost?: string | number | null;
  checklist?: unknown;
  qa_checklist?: unknown;
  qa_notes?: string | null;
  device_score?: number | null;
  broker_name?: string | null;
  broker_commission?: string | number | null;
}

/* ─── بنود QC الافتراضية حسب نوع الجهاز ─── */
type DefaultItem = { id: string; label: string; category: string };

const PHONE_ITEMS: DefaultItem[] = [
  { id: "d_screen",      label: "الشاشة (الصورة والتاتش)",        category: "الشاشة"     },
  { id: "d_front_cam",   label: "الكاميرا الأمامية",               category: "الكاميرات"  },
  { id: "d_back_cam",    label: "الكاميرا الخلفية",                category: "الكاميرات"  },
  { id: "d_speaker",     label: "السماعة الخارجية",                category: "الصوت"      },
  { id: "d_earpiece",    label: "سماعة الأذن",                     category: "الصوت"      },
  { id: "d_mic",         label: "الميكروفون",                      category: "الصوت"      },
  { id: "d_battery",     label: "البطارية (الشحن والاستهلاك)",     category: "البطارية"   },
  { id: "d_charging",    label: "منفذ الشحن",                      category: "البطارية"   },
  { id: "d_wifi",        label: "الواي فاي",                       category: "الاتصالات"  },
  { id: "d_sim",         label: "قارئ الشريحة",                    category: "الاتصالات"  },
  { id: "d_btooth",      label: "البلوتوث",                        category: "الاتصالات"  },
  { id: "d_buttons",     label: "الأزرار الجانبية والصوت",         category: "الأزرار"    },
  { id: "d_fingerprint", label: "بصمة الإصبع / Face ID",           category: "الأمان"     },
  { id: "d_vibration",   label: "الاهتزاز",                        category: "أخرى"       },
  { id: "d_body",        label: "الهيكل الخارجي (كسر / خدش)",     category: "الهيكل"     },
];

const LAPTOP_ITEMS: DefaultItem[] = [
  { id: "d_screen",   label: "الشاشة (الصورة والألوان)",      category: "الشاشة"    },
  { id: "d_keyboard", label: "لوحة المفاتيح",                 category: "الإدخال"   },
  { id: "d_touchpad", label: "لوحة اللمس (التاتشباد)",        category: "الإدخال"   },
  { id: "d_battery",  label: "البطارية (الشحن والاستهلاك)",   category: "البطارية"  },
  { id: "d_charging", label: "مدخل الشحن / المحوّل",          category: "البطارية"  },
  { id: "d_wifi",     label: "الواي فاي",                     category: "الاتصالات" },
  { id: "d_btooth",   label: "البلوتوث",                      category: "الاتصالات" },
  { id: "d_usb",      label: "منافذ USB",                     category: "المنافذ"   },
  { id: "d_cam",      label: "الكاميرا",                      category: "الكاميرا"  },
  { id: "d_speaker",  label: "السماعات",                      category: "الصوت"     },
  { id: "d_mic",      label: "الميكروفون",                    category: "الصوت"     },
  { id: "d_fan",      label: "المروحة / التهوية",             category: "الحرارة"   },
  { id: "d_body",     label: "الهيكل الخارجي",                category: "الهيكل"    },
];

const TABLET_ITEMS: DefaultItem[] = [
  { id: "d_screen",      label: "الشاشة (الصورة والتاتش)",   category: "الشاشة"    },
  { id: "d_front_cam",   label: "الكاميرا الأمامية",          category: "الكاميرات" },
  { id: "d_back_cam",    label: "الكاميرا الخلفية",           category: "الكاميرات" },
  { id: "d_speaker",     label: "السماعات",                   category: "الصوت"     },
  { id: "d_battery",     label: "البطارية",                   category: "البطارية"  },
  { id: "d_charging",    label: "منفذ الشحن",                 category: "البطارية"  },
  { id: "d_wifi",        label: "الواي فاي",                  category: "الاتصالات" },
  { id: "d_buttons",     label: "الأزرار الجانبية",           category: "الأزرار"   },
  { id: "d_body",        label: "الهيكل الخارجي",             category: "الهيكل"    },
];

const GENERAL_ITEMS: DefaultItem[] = [
  { id: "d_power",   label: "التشغيل والإيقاف",  category: "أساسيات" },
  { id: "d_screen",  label: "الشاشة",             category: "أساسيات" },
  { id: "d_battery", label: "البطارية / الطاقة", category: "أساسيات" },
  { id: "d_sound",   label: "الصوت",              category: "أساسيات" },
  { id: "d_body",    label: "الهيكل الخارجي",     category: "أساسيات" },
];

export function getDefaultQcItems(deviceType?: string | null): DefaultItem[] {
  const dt = (deviceType ?? "").toLowerCase();
  if (dt.includes("iphone") || dt.includes("phone") || dt.includes("samsung_phone") || dt.includes("android_phone"))
    return PHONE_ITEMS;
  if (dt.includes("ipad") || dt.includes("tablet") || dt.includes("samsung_tablet"))
    return TABLET_ITEMS;
  if (dt.includes("laptop") || dt.includes("macbook") || dt.includes("notebook"))
    return LAPTOP_ITEMS;
  return GENERAL_ITEMS;
}

export function parseChecklist(raw: unknown): IntakeItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); if (Array.isArray(v)) arr = v; } catch { /**/ }
  }
  return arr
    .map((c, i) => {
      const o = c as Record<string, unknown>;
      const id = String(o.id ?? o.item_id ?? `item-${i}`);
      if (id === "__power_off__") return null;
      return {
        id,
        label:    String(o.label ?? o.label_ar ?? `بند ${i + 1}`),
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
