import { eq, and, desc, sql } from "drizzle-orm";
import { db, repairJobsTable, repairStatusesTable } from "@workspace/db";
import { z } from "zod";

/* ── Zod schemas ──────────────────────────────────────────── */
export const createRepairStatusSchema = z.object({
  label_ar: z.string({ required_error: "الاسم مطلوب" }).min(1, "الاسم مطلوب").max(100),
  key: z.string().max(80).optional(),
  color: z.string().max(20).optional(),
  sort_order: z.number().int().optional(),
});

export const updateRepairStatusSchema = z.object({
  label_ar: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional(),
  sort_order: z.number().int().optional(),
});

export const createChecklistItemSchema = z.object({
  label_ar: z.string({ required_error: "اسم العنصر مطلوب" }).min(1, "اسم العنصر مطلوب").max(200),
  device_type: z.string().max(50).optional(),
  sort_order: z.number().int().optional(),
});

export const createRepairJobSchema = z.object({
  customer_name: z.string().min(1, "اسم العميل مطلوب").max(200),
  customer_phone: z.string().max(20).optional().nullable(),
  customer_id: z.number().int().positive().optional().nullable(),
  device_brand: z.string({ required_error: "الشركة المصنعة مطلوبة" }).min(1).max(100),
  device_model: z.string({ required_error: "الموديل مطلوب" }).min(1).max(100),
  device_type: z.string().max(50).optional(),
  imei: z.string().max(50).optional().nullable(),
  serial_no: z.string().max(100).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  storage: z.string().max(50).optional().nullable(),
  problem_description: z.string().max(1000).optional().nullable(),
  technician_id: z.number().int().positive().optional().nullable(),
  technician_name: z.string().max(200).optional().nullable(),
  technician_2_id: z.number().int().positive().optional().nullable(),
  technician_2_name: z.string().max(200).optional().nullable(),
  technician_2_section: z.string().max(200).optional().nullable(),
  estimated_cost: z.number().min(0).optional(),
  deposit_paid: z.number().min(0).optional(),
  received_at: z.string().optional(),
  estimated_delivery: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  checklist: z.unknown().optional(),
  alert_days_threshold: z.number().int().positive().optional().nullable(),
  external_workshop: z.boolean().optional(),
  external_workshop_name: z.string().max(200).optional().nullable(),
  external_workshop_cost: z.number().min(0).optional(),
  broker_name: z.string().max(200).optional().nullable(),
  broker_commission: z.number().min(0).optional(),
  device_pin: z.string().max(100).optional().nullable(),
  accessories: z.string().max(500).optional().nullable(),
  branch_id: z.number().int().positive().optional().nullable(),
});

export const addRepairPartSchema = z.object({
  product_name: z.string({ required_error: "اسم القطعة مطلوب" }).min(1).max(200),
  product_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().positive("الكمية يجب أن تكون أكبر من صفر").optional().default(1),
  unit_price: z.number().min(0).optional().default(0),
  source: z.enum(["internal", "external"]).optional().default("internal"),
  warehouse_id: z.number().int().positive().optional().nullable(),
});

export const repairPaymentSchema = z.object({
  amount: z.number({ required_error: "المبلغ مطلوب", invalid_type_error: "المبلغ يجب أن يكون رقماً" }).positive("المبلغ يجب أن يكون أكبر من صفر"),
  payment_method: z.string().max(50).optional().default("cash"),
  notes: z.string().max(500).optional().nullable(),
  safe_id: z.number().int().positive().optional().nullable(),
});

/* ── helpers ───────────────────────────────────────────────── */
export function ctx(req: Express.Request) {
  const u = (req as unknown as { user: { company_id: number; id: number; name: string } }).user;
  return { company_id: u.company_id, user_id: u.id, user_name: u.name };
}

export async function nextJobNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REP-${year}-`;
  const [row] = await db
    .select({ no: repairJobsTable.job_no })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, companyId),
      sql`${repairJobsTable.job_no} LIKE ${prefix + "%"}`,
    ))
    .orderBy(desc(repairJobsTable.id))
    .limit(1);
  if (!row) return `${prefix}0001`;
  const seq = parseInt(row.no.split("-").pop() ?? "0", 10);
  return `${prefix}${String(isNaN(seq) ? 1 : seq + 1).padStart(4, "0")}`;
}

export const SYSTEM_STATUSES = [
  { key: "pending",       label_ar: "في الانتظار",     color: "#f59e0b", sort_order: 1 },
  { key: "diagnosing",    label_ar: "قيد الفحص",       color: "#3b82f6", sort_order: 2 },
  { key: "in_progress",   label_ar: "قيد الإصلاح",     color: "#8b5cf6", sort_order: 3 },
  { key: "waiting_parts", label_ar: "بانتظار قطعة",    color: "#ec4899", sort_order: 4 },
  { key: "qa",            label_ar: "اختبار الجودة",   color: "#06b6d4", sort_order: 5 },
  { key: "done",          label_ar: "تم الإصلاح",       color: "#10b981", sort_order: 6 },
  { key: "shipped",       label_ar: "قيد الشحن",        color: "#0ea5e9", sort_order: 7 },
  { key: "delivered",     label_ar: "تم التسليم",       color: "#14b8a6", sort_order: 8 },
  { key: "cancelled",     label_ar: "ملغي",             color: "#ef4444", sort_order: 9 },
];

/* ── Device-type seed templates ─────────────────────────────────── */
export type SeedItem = { label_ar: string; category: string };

/* List of supported device types — must match frontend DEVICE_TYPES */
export const VALID_DEVICE_TYPES = [
  "iphone", "ipad", "watch", "airpods", "mac",
  "samsung_phone", "samsung_tablet",
  "android_phone", "android_tablet",
  "other", "general",
] as const;
export type DeviceType = typeof VALID_DEVICE_TYPES[number];

const IPHONE_CHECKLIST: SeedItem[] = [
  { label_ar: "حالة الشاشة",                      category: "الشاشة واللمس" },
  { label_ar: "أصلية / تقليد",                    category: "الشاشة واللمس" },
  { label_ar: "اللمس",                             category: "الشاشة واللمس" },
  { label_ar: "سفرة الشاشة (بولش)",               category: "الشاشة واللمس" },
  { label_ar: "الإضاءة",                           category: "الشاشة واللمس" },
  { label_ar: "True Tone",                          category: "الشاشة واللمس" },
  { label_ar: "الكاميرا الأمامية",                 category: "الكاميرات و Face ID" },
  { label_ar: "بورتريه أمامي",                     category: "الكاميرات و Face ID" },
  { label_ar: "الكاميرا الخلفية العريضة",          category: "الكاميرات و Face ID" },
  { label_ar: "الكاميرا الخلفية الواسعة",          category: "الكاميرات و Face ID" },
  { label_ar: "كاميرا التقريب الخلفية",            category: "الكاميرات و Face ID" },
  { label_ar: "نقطة الكاميرا (Face ID)",           category: "الكاميرات و Face ID" },
  { label_ar: "بورتريه خلفي",                      category: "الكاميرات و Face ID" },
  { label_ar: "الفلاش / LED",                       category: "الكاميرات و Face ID" },
  { label_ar: "زر رفع الصوت",                      category: "الأزرار والبصمة" },
  { label_ar: "زر خفض الصوت",                      category: "الأزرار والبصمة" },
  { label_ar: "زر الصامت / Action Button",         category: "الأزرار والبصمة" },
  { label_ar: "زر الباور",                         category: "الأزرار والبصمة" },
  { label_ar: "البصمة (Touch ID)",                 category: "الأزرار والبصمة" },
  { label_ar: "زر التحكم بالكاميرا (iPhone 16+)", category: "الأزرار والبصمة" },
  { label_ar: "إثارة الشبكة / SIM",               category: "الاتصال" },
  { label_ar: "بيانات الموبايل (4G / 5G)",         category: "الاتصال" },
  { label_ar: "واي فاي",                           category: "الاتصال" },
  { label_ar: "بلوتوث",                            category: "الاتصال" },
  { label_ar: "GPS / الموقع",                      category: "الاتصال" },
  { label_ar: "NFC (Apple Pay)",                   category: "الاتصال" },
  { label_ar: "إير دروب",                          category: "الاتصال" },
  { label_ar: "eSIM",                              category: "الاتصال" },
  { label_ar: "مستشعر التسارع",                    category: "المستشعرات" },
  { label_ar: "الجايروسكوب",                       category: "المستشعرات" },
  { label_ar: "مستشعر القرب",                      category: "المستشعرات" },
  { label_ar: "مستشعر الإضاءة المحيطة",            category: "المستشعرات" },
  { label_ar: "البارومتر",                         category: "المستشعرات" },
  { label_ar: "البوصلة (مقياس المغناطيسية)",       category: "المستشعرات" },
  { label_ar: "ماسح LiDAR (Pro)",                  category: "المستشعرات" },
  { label_ar: "مستشعر الحرارة (Pro 15+)",          category: "المستشعرات" },
  { label_ar: "سماعة الأذن",                       category: "الصوت والمايكروفونات" },
  { label_ar: "مكبر الصوت",                        category: "الصوت والمايكروفونات" },
  { label_ar: "مايك الكاميرا الأمامية",            category: "الصوت والمايكروفونات" },
  { label_ar: "مايك الكاميرا الخلفية",             category: "الصوت والمايكروفونات" },
  { label_ar: "مايك المكالمات (سفلي)",             category: "الصوت والمايكروفونات" },
  { label_ar: "عزل الصوت",                         category: "الصوت والمايكروفونات" },
  { label_ar: "الاهتزاز (Taptic Engine)",           category: "الصوت والمايكروفونات" },
  { label_ar: "الشحن السلكي (USB-C / Lightning)",  category: "الشحن والبطارية" },
  { label_ar: "الشحن اللاسلكي / MagSafe",          category: "الشحن والبطارية" },
  { label_ar: "قراءة الأمبير (ستر)",               category: "الشحن والبطارية" },
  { label_ar: "صحة البطارية",                      category: "الشحن والبطارية" },
  { label_ar: "حالة الهيكل",                       category: "الفحص الخارجي" },
  { label_ar: "الزجاج الخلفي",                     category: "الفحص الخارجي" },
  { label_ar: "زجاج عدسة الكاميرا",               category: "الفحص الخارجي" },
  { label_ar: "مؤشر تلف المياه",                   category: "الفحص الخارجي" },
  { label_ar: "عازل المياه (أصلي)",                category: "الفحص الخارجي" },
  { label_ar: "مفتوح مسبقاً",                      category: "الفحص الخارجي" },
  { label_ar: "حالة المسامير",                     category: "الفحص الخارجي" },
  { label_ar: "درج الشريحة",                       category: "الفحص الخارجي" },
  { label_ar: "حالة منفذ الشحن",                   category: "الفحص الخارجي" },
];

const IPAD_CHECKLIST: SeedItem[] = [
  { label_ar: "حالة الشاشة",                       category: "الشاشة واللمس" },
  { label_ar: "أصلية / تقليد",                     category: "الشاشة واللمس" },
  { label_ar: "اللمس متعدد النقاط",                category: "الشاشة واللمس" },
  { label_ar: "Apple Pencil (الجيل 1 / 2 / Pro)", category: "الشاشة واللمس" },
  { label_ar: "الإضاءة / السطوع",                  category: "الشاشة واللمس" },
  { label_ar: "True Tone / ProMotion",             category: "الشاشة واللمس" },
  { label_ar: "الكاميرا الأمامية",                 category: "الكاميرات و Face ID" },
  { label_ar: "Center Stage",                       category: "الكاميرات و Face ID" },
  { label_ar: "الكاميرا الخلفية",                  category: "الكاميرات و Face ID" },
  { label_ar: "ماسح LiDAR (Pro)",                  category: "الكاميرات و Face ID" },
  { label_ar: "Face ID",                            category: "الكاميرات و Face ID" },
  { label_ar: "زر الباور / Touch ID",              category: "الأزرار" },
  { label_ar: "أزرار الصوت",                       category: "الأزرار" },
  { label_ar: "الواي فاي",                         category: "الاتصال" },
  { label_ar: "بلوتوث",                            category: "الاتصال" },
  { label_ar: "خلوي / SIM (للموديلات الخلوية)",   category: "الاتصال" },
  { label_ar: "eSIM",                              category: "الاتصال" },
  { label_ar: "GPS",                               category: "الاتصال" },
  { label_ar: "مستشعر التسارع والجايروسكوب",       category: "المستشعرات" },
  { label_ar: "مستشعر الإضاءة المحيطة",            category: "المستشعرات" },
  { label_ar: "البارومتر",                         category: "المستشعرات" },
  { label_ar: "البوصلة",                           category: "المستشعرات" },
  { label_ar: "السماعات (4 أو 2)",                category: "الصوت والمايكروفونات" },
  { label_ar: "المايكات",                          category: "الصوت والمايكروفونات" },
  { label_ar: "Smart Connector (للكيبورد)",        category: "الملحقات" },
  { label_ar: "موصل MagSafe / Smart Folio",        category: "الملحقات" },
  { label_ar: "USB-C / Lightning شحن وبيانات",    category: "الشحن والبطارية" },
  { label_ar: "صحة البطارية",                      category: "الشحن والبطارية" },
  { label_ar: "حالة الهيكل",                       category: "الفحص الخارجي" },
  { label_ar: "حالة الزجاج",                       category: "الفحص الخارجي" },
  { label_ar: "مؤشر تلف المياه",                   category: "الفحص الخارجي" },
  { label_ar: "حالة المسامير / مفتوح مسبقاً",      category: "الفحص الخارجي" },
  { label_ar: "درج الشريحة",                       category: "الفحص الخارجي" },
];

const WATCH_CHECKLIST: SeedItem[] = [
  { label_ar: "حالة الشاشة",                       category: "الشاشة" },
  { label_ar: "اللمس / Force Touch",                category: "الشاشة" },
  { label_ar: "Always-On Display",                  category: "الشاشة" },
  { label_ar: "الإضاءة / السطوع",                  category: "الشاشة" },
  { label_ar: "Digital Crown — تدوير",              category: "التحكم" },
  { label_ar: "Digital Crown — ضغط",                category: "التحكم" },
  { label_ar: "Side Button",                        category: "التحكم" },
  { label_ar: "Action Button (Ultra)",              category: "التحكم" },
  { label_ar: "مستشعر نبض القلب",                  category: "المستشعرات الصحية" },
  { label_ar: "ECG (تخطيط القلب)",                 category: "المستشعرات الصحية" },
  { label_ar: "SpO2 (الأكسجين)",                   category: "المستشعرات الصحية" },
  { label_ar: "مستشعر درجة الحرارة (Series 8+)",  category: "المستشعرات الصحية" },
  { label_ar: "مستشعر التسارع والجايروسكوب",       category: "المستشعرات" },
  { label_ar: "البارومتر / الارتفاع",              category: "المستشعرات" },
  { label_ar: "البوصلة",                           category: "المستشعرات" },
  { label_ar: "GPS",                               category: "الاتصال" },
  { label_ar: "الواي فاي",                         category: "الاتصال" },
  { label_ar: "بلوتوث",                            category: "الاتصال" },
  { label_ar: "الخلوي (Cellular موديل)",           category: "الاتصال" },
  { label_ar: "السماعة",                           category: "الصوت" },
  { label_ar: "المايك",                            category: "الصوت" },
  { label_ar: "Taptic Engine (الاهتزاز)",          category: "الصوت" },
  { label_ar: "موصل الشحن (المغناطيسي)",          category: "الشحن والبطارية" },
  { label_ar: "صحة البطارية",                      category: "الشحن والبطارية" },
  { label_ar: "آلية تركيب السوار (يمين)",          category: "الهيكل والسوار" },
  { label_ar: "آلية تركيب السوار (يسار)",          category: "الهيكل والسوار" },
  { label_ar: "حالة الهيكل / الإطار",              category: "الهيكل والسوار" },
  { label_ar: "زجاج خلفي (المستشعرات)",            category: "الهيكل والسوار" },
  { label_ar: "مقاومة الماء",                      category: "الهيكل والسوار" },
];

const AIRPODS_CHECKLIST: SeedItem[] = [
  { label_ar: "صوت السماعة اليمنى (R)",            category: "الصوت — يمين" },
  { label_ar: "مايك السماعة اليمنى (R)",           category: "الصوت — يمين" },
  { label_ar: "حساس اللمس / الضغط (R)",            category: "الصوت — يمين" },
  { label_ar: "حساس وضع الأذن (R)",                category: "الصوت — يمين" },
  { label_ar: "صوت السماعة اليسرى (L)",            category: "الصوت — يسار" },
  { label_ar: "مايك السماعة اليسرى (L)",           category: "الصوت — يسار" },
  { label_ar: "حساس اللمس / الضغط (L)",            category: "الصوت — يسار" },
  { label_ar: "حساس وضع الأذن (L)",                category: "الصوت — يسار" },
  { label_ar: "إلغاء الضوضاء (ANC)",               category: "ميزات الصوت" },
  { label_ar: "وضع الشفافية (Transparency)",       category: "ميزات الصوت" },
  { label_ar: "الصوت المكاني (Spatial Audio)",     category: "ميزات الصوت" },
  { label_ar: "بطارية السماعة اليمنى",             category: "البطارية" },
  { label_ar: "بطارية السماعة اليسرى",             category: "البطارية" },
  { label_ar: "بطارية العلبة (Case)",              category: "البطارية" },
  { label_ar: "منفذ شحن العلبة (USB-C / Lightning)", category: "العلبة (Case)" },
  { label_ar: "الشحن اللاسلكي للعلبة",             category: "العلبة (Case)" },
  { label_ar: "MagSafe (إن وجد)",                  category: "العلبة (Case)" },
  { label_ar: "زر العلبة الخلفي (Pairing)",        category: "العلبة (Case)" },
  { label_ar: "مؤشر LED الأمامي",                  category: "العلبة (Case)" },
  { label_ar: "مفصلة الغطاء (Hinge)",             category: "العلبة (Case)" },
  { label_ar: "إغلاق مغناطيسي محكم",               category: "العلبة (Case)" },
  { label_ar: "حالة الجسم الخارجي للسماعات",      category: "الفحص الخارجي" },
  { label_ar: "حالة الجسم الخارجي للعلبة",         category: "الفحص الخارجي" },
  { label_ar: "نقاط الشحن (الذهبية) للسماعات",    category: "الفحص الخارجي" },
  { label_ar: "Find My / المسلسل مسجّل",           category: "الفحص الخارجي" },
];

const MAC_CHECKLIST: SeedItem[] = [
  { label_ar: "حالة الشاشة / Retina",               category: "الشاشة" },
  { label_ar: "إضاءة الشاشة",                      category: "الشاشة" },
  { label_ar: "True Tone / ProMotion",             category: "الشاشة" },
  { label_ar: "Notch (للموديلات الجديدة)",         category: "الشاشة" },
  { label_ar: "كل أزرار الكيبورد",                category: "الكيبورد والترك باد" },
  { label_ar: "إضاءة الكيبورد (Backlit)",          category: "الكيبورد والترك باد" },
  { label_ar: "Touch Bar (إن وجد)",                category: "الكيبورد والترك باد" },
  { label_ar: "Touch ID",                           category: "الكيبورد والترك باد" },
  { label_ar: "Trackpad — اللمس",                   category: "الكيبورد والترك باد" },
  { label_ar: "Trackpad — Force Click",             category: "الكيبورد والترك باد" },
  { label_ar: "كاميرا FaceTime",                   category: "الكاميرا والصوت" },
  { label_ar: "السماعات",                          category: "الكاميرا والصوت" },
  { label_ar: "صفيف المايكات",                     category: "الكاميرا والصوت" },
  { label_ar: "Thunderbolt / USB-C — كل المنافذ",  category: "المنافذ" },
  { label_ar: "MagSafe (إن وجد)",                  category: "المنافذ" },
  { label_ar: "HDMI",                              category: "المنافذ" },
  { label_ar: "SD Card Reader",                    category: "المنافذ" },
  { label_ar: "منفذ السماعات (3.5mm)",             category: "المنافذ" },
  { label_ar: "الواي فاي",                         category: "الاتصال" },
  { label_ar: "بلوتوث",                            category: "الاتصال" },
  { label_ar: "AirDrop / Continuity",              category: "الاتصال" },
  { label_ar: "الشاحن الأصلي",                    category: "الشحن والبطارية" },
  { label_ar: "صحة البطارية / دورات الشحن",       category: "الشحن والبطارية" },
  { label_ar: "أداء المعالج (Benchmark)",          category: "الأداء والحرارة" },
  { label_ar: "المروحة وضوضاء التشغيل",            category: "الأداء والحرارة" },
  { label_ar: "حرارة التشغيل تحت الحمل",           category: "الأداء والحرارة" },
  { label_ar: "حالة الهيكل / الغطاء",              category: "الفحص الخارجي" },
  { label_ar: "المفصلة (Hinge)",                   category: "الفحص الخارجي" },
  { label_ar: "حالة المسامير / مفتوح مسبقاً",      category: "الفحص الخارجي" },
  { label_ar: "علامات سوائل / صدأ داخلي",          category: "الفحص الخارجي" },
];

const ANDROID_PHONE_CHECKLIST: SeedItem[] = [
  { label_ar: "حالة الشاشة",                      category: "الشاشة واللمس" },
  { label_ar: "أصلية / تقليد",                    category: "الشاشة واللمس" },
  { label_ar: "اللمس",                             category: "الشاشة واللمس" },
  { label_ar: "بصمة الشاشة (In-Display)",          category: "الشاشة واللمس" },
  { label_ar: "الإضاءة",                           category: "الشاشة واللمس" },
  { label_ar: "Always On Display",                 category: "الشاشة واللمس" },
  { label_ar: "الكاميرا الأمامية",                 category: "الكاميرات" },
  { label_ar: "الكاميرا الخلفية الرئيسية",         category: "الكاميرات" },
  { label_ar: "الكاميرا الواسعة",                  category: "الكاميرات" },
  { label_ar: "كاميرا الماكرو / التقريب",          category: "الكاميرات" },
  { label_ar: "الفلاش",                            category: "الكاميرات" },
  { label_ar: "زر رفع الصوت",                      category: "الأزرار والبصمة" },
  { label_ar: "زر خفض الصوت",                      category: "الأزرار والبصمة" },
  { label_ar: "زر الباور",                         category: "الأزرار والبصمة" },
  { label_ar: "بصمة الإصبع الجانبية",              category: "الأزرار والبصمة" },
  { label_ar: "فتح بالوجه (Face Unlock)",          category: "الأزرار والبصمة" },
  { label_ar: "إثارة الشبكة / SIM",               category: "الاتصال" },
  { label_ar: "بيانات الموبايل (4G / 5G)",         category: "الاتصال" },
  { label_ar: "واي فاي",                           category: "الاتصال" },
  { label_ar: "بلوتوث",                            category: "الاتصال" },
  { label_ar: "GPS / الموقع",                      category: "الاتصال" },
  { label_ar: "NFC",                               category: "الاتصال" },
  { label_ar: "مستشعر التسارع",                    category: "المستشعرات" },
  { label_ar: "الجايروسكوب",                       category: "المستشعرات" },
  { label_ar: "مستشعر القرب",                      category: "المستشعرات" },
  { label_ar: "مستشعر الإضاءة المحيطة",            category: "المستشعرات" },
  { label_ar: "البارومتر",                         category: "المستشعرات" },
  { label_ar: "البوصلة",                           category: "المستشعرات" },
  { label_ar: "سماعة الأذن",                       category: "الصوت والمايكروفونات" },
  { label_ar: "مكبر الصوت",                        category: "الصوت والمايكروفونات" },
  { label_ar: "مايك الأمامي",                      category: "الصوت والمايكروفونات" },
  { label_ar: "مايك الخلفي",                       category: "الصوت والمايكروفونات" },
  { label_ar: "عزل الصوت",                         category: "الصوت والمايكروفونات" },
  { label_ar: "الاهتزاز",                          category: "الصوت والمايكروفونات" },
  { label_ar: "الشحن السلكي (USB-C)",              category: "الشحن والبطارية" },
  { label_ar: "الشحن اللاسلكي",                    category: "الشحن والبطارية" },
  { label_ar: "الشحن العكسي اللاسلكي",            category: "الشحن والبطارية" },
  { label_ar: "صحة البطارية",                      category: "الشحن والبطارية" },
  { label_ar: "حالة الهيكل",                       category: "الفحص الخارجي" },
  { label_ar: "الزجاج الخلفي / الغطاء",           category: "الفحص الخارجي" },
  { label_ar: "زجاج عدسة الكاميرا",               category: "الفحص الخارجي" },
  { label_ar: "مؤشر تلف المياه",                   category: "الفحص الخارجي" },
  { label_ar: "مفتوح مسبقاً",                      category: "الفحص الخارجي" },
  { label_ar: "حالة المسامير",                     category: "الفحص الخارجي" },
  { label_ar: "درج الشريحة",                       category: "الفحص الخارجي" },
  { label_ar: "حالة منفذ الشحن",                   category: "الفحص الخارجي" },
];

const SAMSUNG_PHONE_CHECKLIST: SeedItem[] = ANDROID_PHONE_CHECKLIST.concat([
  { label_ar: "S Pen (للطرازات Note / S Ultra)",   category: "ملحقات سامسونج" },
  { label_ar: "Samsung DeX",                        category: "ملحقات سامسونج" },
]);

const ANDROID_TABLET_CHECKLIST: SeedItem[] = [
  { label_ar: "حالة الشاشة",                       category: "الشاشة واللمس" },
  { label_ar: "اللمس متعدد النقاط",                category: "الشاشة واللمس" },
  { label_ar: "الإضاءة / السطوع",                  category: "الشاشة واللمس" },
  { label_ar: "الكاميرا الأمامية",                 category: "الكاميرات" },
  { label_ar: "الكاميرا الخلفية",                  category: "الكاميرات" },
  { label_ar: "الفلاش",                            category: "الكاميرات" },
  { label_ar: "أزرار الصوت",                       category: "الأزرار" },
  { label_ar: "زر الباور / البصمة",                category: "الأزرار" },
  { label_ar: "فتح بالوجه (Face Unlock)",          category: "الأزرار" },
  { label_ar: "الواي فاي",                         category: "الاتصال" },
  { label_ar: "بلوتوث",                            category: "الاتصال" },
  { label_ar: "خلوي / SIM (للموديلات الخلوية)",   category: "الاتصال" },
  { label_ar: "GPS",                               category: "الاتصال" },
  { label_ar: "مستشعر التسارع والجايروسكوب",       category: "المستشعرات" },
  { label_ar: "مستشعر الإضاءة المحيطة",            category: "المستشعرات" },
  { label_ar: "البوصلة",                           category: "المستشعرات" },
  { label_ar: "السماعات",                          category: "الصوت والمايكروفونات" },
  { label_ar: "المايكات",                          category: "الصوت والمايكروفونات" },
  { label_ar: "USB-C شحن وبيانات",                category: "الشحن والبطارية" },
  { label_ar: "صحة البطارية",                      category: "الشحن والبطارية" },
  { label_ar: "حالة الهيكل",                       category: "الفحص الخارجي" },
  { label_ar: "حالة الزجاج",                       category: "الفحص الخارجي" },
  { label_ar: "مؤشر تلف المياه",                   category: "الفحص الخارجي" },
  { label_ar: "مفتوح مسبقاً",                      category: "الفحص الخارجي" },
  { label_ar: "درج الشريحة",                       category: "الفحص الخارجي" },
];

const SAMSUNG_TABLET_CHECKLIST: SeedItem[] = ANDROID_TABLET_CHECKLIST.concat([
  { label_ar: "S Pen (للطرازات المدعومة)",         category: "ملحقات سامسونج" },
  { label_ar: "Samsung DeX",                        category: "ملحقات سامسونج" },
]);

const OTHER_CHECKLIST: SeedItem[] = [
  { label_ar: "تشغيل الجهاز",                      category: "عام" },
  { label_ar: "الشاشة (إن وجدت)",                  category: "عام" },
  { label_ar: "الأزرار",                           category: "عام" },
  { label_ar: "منفذ الشحن",                        category: "عام" },
  { label_ar: "البطارية",                          category: "عام" },
  { label_ar: "الصوت / السماعة",                   category: "عام" },
  { label_ar: "الاتصال (واي فاي / بلوتوث)",       category: "عام" },
  { label_ar: "حالة الهيكل الخارجي",               category: "عام" },
  { label_ar: "مؤشر تلف المياه",                   category: "عام" },
];

export const SEED_TEMPLATES: Record<string, SeedItem[]> = {
  iphone:          IPHONE_CHECKLIST,
  ipad:            IPAD_CHECKLIST,
  watch:           WATCH_CHECKLIST,
  airpods:         AIRPODS_CHECKLIST,
  mac:             MAC_CHECKLIST,
  samsung_phone:   SAMSUNG_PHONE_CHECKLIST,
  samsung_tablet:  SAMSUNG_TABLET_CHECKLIST,
  android_phone:   ANDROID_PHONE_CHECKLIST,
  android_tablet:  ANDROID_TABLET_CHECKLIST,
  other:           OTHER_CHECKLIST,
};

export async function ensureCompanyDefaults(companyId: number) {
  /* جلب كل الحالات الموجودة (الـ keys) للشركة */
  const existing = await db.select({ key: repairStatusesTable.key })
    .from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, companyId));
  const existingKeys = new Set(existing.map(r => r.key));

  /* إضافة فقط الحالات النظامية الناقصة (مثلاً shipped لشركات قديمة) */
  const missing = SYSTEM_STATUSES.filter(s => !existingKeys.has(s.key));
  if (missing.length > 0) {
    await db.insert(repairStatusesTable).values(
      missing.map(s => ({ ...s, company_id: companyId, is_system: true }))
    );
  }
}

/* الحد الأقصى لنص تقرير المهندس = 5000 حرف — SEC-004 */
export const MAX_ENGINEER_REPORT_LEN = 5000;
