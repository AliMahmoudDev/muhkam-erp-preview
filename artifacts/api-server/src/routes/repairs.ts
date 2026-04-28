import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairJobPartsTable,
  repairStatusesTable,
  repairChecklistItemsTable,
  repairStatusHistoryTable,
  scrapItemsTable,
  erpUsersTable,
  productsTable,
  stockMovementsTable,
  expensesTable,
  expenseCategoriesTable,
  safesTable,
  transactionsTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { notifyUser } from "../lib/notify";
import { requireFeature } from "../middleware/feature-guard";
import { validateTransition } from "../services/repair-pipeline.service";
import { writeAuditLog } from "../lib/audit-log";
import { alertManager } from "../lib/telegram-alert-manager";
import { normalizeName, getNextCustomerCode } from "./customers";
import { getOrCreateCustomerAccount, getOrCreateSafeAccount, getOrCreateGeneralExpenseAccount, createAutoJournalEntry } from "../lib/auto-account";

const router: IRouter = Router();
router.use(["/repair-jobs", "/repair-statuses", "/repair-customers", "/repair-checklist-items", "/scrap-items"], requireFeature("maintenance"));

/* ── helpers ───────────────────────────────────────────────── */
function ctx(req: Express.Request) {
  const u = (req as unknown as { user: { company_id: number; id: number; name: string } }).user;
  return { company_id: u.company_id, user_id: u.id, user_name: u.name };
}

async function nextJobNo(companyId: number): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, companyId));
  const n = (Number(result[0]?.count ?? 0) + 1).toString().padStart(4, "0");
  const year = new Date().getFullYear();
  return `REP-${year}-${n}`;
}

const SYSTEM_STATUSES = [
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
type SeedItem = { label_ar: string; category: string };

/* List of supported device types — must match frontend DEVICE_TYPES */
const VALID_DEVICE_TYPES = [
  "iphone", "ipad", "watch", "airpods", "mac",
  "samsung_phone", "samsung_tablet",
  "android_phone", "android_tablet",
  "other", "general",
] as const;
type DeviceType = typeof VALID_DEVICE_TYPES[number];

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

const SEED_TEMPLATES: Record<string, SeedItem[]> = {
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

async function ensureCompanyDefaults(companyId: number) {
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

/* ══════════════════════════════════════════════════════════════
   STATUSES (custom per company)
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-statuses", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);
  const rows = await db.select().from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, company_id))
    .orderBy(repairStatusesTable.sort_order);
  return res.json(rows);
}));

router.post("/repair-statuses", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const label = String(b.label_ar ?? "").trim();
  if (!label) return res.status(400).json({ error: "الاسم مطلوب" });
  const key = String(b.key ?? `custom_${Date.now()}`).trim();
  const [row] = await db.insert(repairStatusesTable).values({
    company_id,
    key,
    label_ar: label,
    color: String(b.color ?? "#64748b"),
    sort_order: Number(b.sort_order ?? 99),
    is_system: false,
  }).returning();
  return res.status(201).json(row);
}));

router.patch("/repair-statuses/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if ("label_ar" in b)   updates.label_ar = String(b.label_ar);
  if ("color" in b)      updates.color = String(b.color);
  if ("sort_order" in b) updates.sort_order = Number(b.sort_order);
  const [row] = await db.update(repairStatusesTable).set(updates)
    .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "غير موجود" });
  return res.json(row);
}));

router.delete("/repair-statuses/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [s] = await db.select().from(repairStatusesTable)
    .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)));
  if (!s) return res.status(404).json({ error: "غير موجود" });
  if (s.is_system) return res.status(400).json({ error: "لا يمكن حذف حالة النظام" });
  await db.delete(repairStatusesTable)
    .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   CHECKLIST ITEMS (custom per company)
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-checklist-items", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);
  const deviceType = req.query.device_type as string | undefined;
  const where = deviceType
    ? and(eq(repairChecklistItemsTable.company_id, company_id), eq(repairChecklistItemsTable.device_type, deviceType))
    : eq(repairChecklistItemsTable.company_id, company_id);
  const rows = await db.select().from(repairChecklistItemsTable)
    .where(where)
    .orderBy(repairChecklistItemsTable.sort_order);
  return res.json(rows);
}));

router.post("/repair-checklist-items", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const label = String(b.label_ar ?? "").trim();
  if (!label) return res.status(400).json({ error: "الاسم مطلوب" });
  const category = String(b.category ?? "عام").trim() || "عام";
  const device_type = String(b.device_type ?? "general").trim() || "general";
  const existing = await db.select({ s: repairChecklistItemsTable.sort_order })
    .from(repairChecklistItemsTable)
    .where(and(
      eq(repairChecklistItemsTable.company_id, company_id),
      eq(repairChecklistItemsTable.category, category),
      eq(repairChecklistItemsTable.device_type, device_type),
    ))
    .orderBy(desc(repairChecklistItemsTable.sort_order))
    .limit(1);
  const nextOrder = (existing[0]?.s ?? 0) + 1;
  const [row] = await db.insert(repairChecklistItemsTable).values({
    company_id,
    label_ar: label,
    category,
    device_type,
    sort_order: nextOrder,
    is_system: false,
  }).returning();
  return res.status(201).json(row);
}));

/* Seed all items for a specific device type (iphone | ipad | watch | airpods | mac | samsung_phone | etc.) */
router.post("/repair-checklist-items/seed-device-type", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const { device_type } = req.body as { device_type: string };
  const template = SEED_TEMPLATES[device_type];
  if (!template) return res.status(400).json({ error: "device_type غير معروف" });

  /* Check if already seeded */
  const existing = await db.select({ id: repairChecklistItemsTable.id })
    .from(repairChecklistItemsTable)
    .where(and(
      eq(repairChecklistItemsTable.company_id, company_id),
      eq(repairChecklistItemsTable.device_type, device_type),
    ))
    .limit(1);
  if (existing.length > 0) return res.status(409).json({ error: "already_seeded" });

  /* Insert all at once with sort_order by category group */
  const catOrder: Record<string, number> = {};
  const rows = template.map((item) => {
    catOrder[item.category] = (catOrder[item.category] ?? 0) + 1;
    return {
      company_id,
      label_ar: item.label_ar,
      category: item.category,
      device_type,
      sort_order: catOrder[item.category],
      is_system: true,
    };
  });
  await db.insert(repairChecklistItemsTable).values(rows);
  return res.json({ ok: true, count: rows.length });
}));

/* Copy checklist items from one device type to another (e.g. derive AirPods from iPhone) */
router.post("/repair-checklist-items/copy", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const { from, to } = req.body as { from: string; to: string };
  if (!from || !to || from === to) return res.status(400).json({ error: "from/to invalid" });
  if (!VALID_DEVICE_TYPES.includes(to as DeviceType)) return res.status(400).json({ error: "to غير معروف" });

  const sourceItems = await db.select().from(repairChecklistItemsTable)
    .where(and(eq(repairChecklistItemsTable.company_id, company_id), eq(repairChecklistItemsTable.device_type, from)));
  if (sourceItems.length === 0) return res.status(404).json({ error: "لا توجد بنود في النوع المصدر" });

  const existingTarget = await db.select({ id: repairChecklistItemsTable.id })
    .from(repairChecklistItemsTable)
    .where(and(eq(repairChecklistItemsTable.company_id, company_id), eq(repairChecklistItemsTable.device_type, to)))
    .limit(1);
  if (existingTarget.length > 0) return res.status(409).json({ error: "already_has_items" });

  const rows = sourceItems.map((s) => ({
    company_id,
    label_ar: s.label_ar,
    category: s.category ?? "عام",
    device_type: to,
    sort_order: s.sort_order ?? 0,
    is_system: false,
  }));
  await db.insert(repairChecklistItemsTable).values(rows);
  return res.json({ ok: true, count: rows.length });
}));

router.patch("/repair-checklist-items/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if ("label_ar" in b)    updates.label_ar    = String(b.label_ar);
  if ("sort_order" in b)  updates.sort_order   = Number(b.sort_order);
  if ("category" in b)    updates.category     = String(b.category).trim() || "عام";
  if ("device_type" in b) updates.device_type  = String(b.device_type).trim() || "general";
  const [row] = await db.update(repairChecklistItemsTable).set(updates)
    .where(and(eq(repairChecklistItemsTable.id, id), eq(repairChecklistItemsTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "غير موجود" });
  return res.json(row);
}));

/* Bulk reorder: [{ id, sort_order }] */
router.post("/repair-checklist-items/reorder", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const items = req.body as { id: number; sort_order: number }[];
  if (!Array.isArray(items)) return res.status(400).json({ error: "invalid" });
  await Promise.all(items.map(({ id, sort_order }) =>
    db.update(repairChecklistItemsTable)
      .set({ sort_order })
      .where(and(eq(repairChecklistItemsTable.id, id), eq(repairChecklistItemsTable.company_id, company_id)))
  ));
  return res.json({ ok: true });
}));

router.delete("/repair-checklist-items/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(repairChecklistItemsTable)
    .where(and(eq(repairChecklistItemsTable.id, id), eq(repairChecklistItemsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   REPAIR JOBS
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-jobs", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const { status, technician_id, search } = req.query as Record<string, string>;

  const conds = [eq(repairJobsTable.company_id, company_id)];
  if (status && status !== "all") {
    /* Support comma-separated for dashboard cards that group multiple statuses */
    const list = status.split(",").map(s => s.trim()).filter(Boolean);
    if (list.length === 1)      conds.push(eq(repairJobsTable.status, list[0]));
    else if (list.length > 1)   conds.push(inArray(repairJobsTable.status, list));
  }
  if (technician_id && technician_id !== "all") {
    const tid = Number(technician_id);
    conds.push(sql`(${repairJobsTable.technician_id} = ${tid} OR ${repairJobsTable.technician_2_id} = ${tid})`);
  }

  const jobs = await db.select().from(repairJobsTable)
    .where(and(...conds))
    .orderBy(desc(repairJobsTable.created_at));

  let filtered = jobs;
  if (search?.trim()) {
    const s = search.trim();
    const sl = s.toLowerCase();

    if (/^\d+$/.test(s)) {
      // Numeric-only → exact match on job number suffix
      filtered = jobs.filter(j =>
        j.job_no.endsWith(`-${s}`) ||
        j.job_no.endsWith(`-${s.padStart(4, "0")}`)
      );
    } else {
      // General: name, model, brand, IMEI, serial, phone, technician
      filtered = jobs.filter(j =>
        j.customer_name.toLowerCase().includes(sl) ||
        j.device_model.toLowerCase().includes(sl) ||
        j.device_brand.toLowerCase().includes(sl) ||
        j.job_no.toLowerCase().includes(sl) ||
        (j.imei && j.imei.toLowerCase().includes(sl)) ||
        (j.serial_no && j.serial_no.toLowerCase().includes(sl)) ||
        (j.customer_phone && j.customer_phone.includes(s)) ||
        (j.technician_name && j.technician_name.toLowerCase().includes(sl)) ||
        (j.technician_2_name && j.technician_2_name.toLowerCase().includes(sl))
      );
    }
  }
  return res.json(filtered);
}));

/* Stats by status (with colors) for dashboard cards */
router.get("/repair-jobs/stats", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);

  const rows = await db.select({
    status: repairJobsTable.status,
    count: sql<number>`count(*)`,
  }).from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, company_id))
    .groupBy(repairJobsTable.status);

  const statusDefs = await db.select().from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, company_id))
    .orderBy(repairStatusesTable.sort_order);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = Number(r.count);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayJobs = await db.select({ count: sql<number>`count(*)` })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.created_at} >= ${today.toISOString()}`
    ));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return res.json({
    total,
    today_count: Number(todayJobs[0]?.count ?? 0),
    pending:     counts["pending"] ?? 0,
    in_progress: counts["in_progress"] ?? 0,
    done:        counts["done"] ?? 0,
    delivered:   counts["delivered"] ?? 0,
    cancelled:   counts["cancelled"] ?? 0,
    by_status: statusDefs.map(s => ({
      key: s.key,
      label: s.label_ar,
      color: s.color,
      count: counts[s.key] ?? 0,
    })),
  });
}));

/* Long-stay alerts: jobs in repair center > N days, not delivered/cancelled */
router.get("/repair-jobs/alerts", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const days = Number(req.query.days ?? 7);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const rows = await db.select().from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.status} NOT IN ('delivered','cancelled')`,
      sql`${repairJobsTable.received_at} <= ${cutoff.toISOString().slice(0,10)}`
    ))
    .orderBy(repairJobsTable.received_at);
  return res.json(rows);
}));

/* Technicians list — kept for backward compat */
router.get("/repair-jobs/technicians", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const users = await db.select({ id: erpUsersTable.id, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, company_id));
  return res.json(users);
}));

/**
 * GET /repair-jobs/technician-stats
 *
 * إحصاء أداء الفنيين للشركة الحالية:
 *   - total_jobs:      إجمالي البطاقات المُسنَدة (كفنّي أساسي أو ثاني)
 *   - delivered:       بطاقات تم تسليمها
 *   - avg_duration_days: متوسط مدة الإصلاح بالأيام (received_at → delivered_at)
 *   - active_jobs:     بطاقات لا تزال جارية
 *
 * ⚠ هذا الـ route لازم يكون قبل /repair-jobs/:id (وإلّا Express يَعتبر "technician-stats" قيمة لـ :id).
 */
router.get("/repair-jobs/technician-stats", wrap(async (req, res) => {
  const { company_id } = ctx(req);

  /* استعلام واحد لكل فنّي — يحسب البطاقات حيث الفني الأساسي يتطابق
     (مع الإشارة إلى أنّنا لا نُكرّر الحساب عبر technician_2_id لتفادي الازدواج). */
  const rows = await db.execute(sql`
    SELECT
      u.id          AS technician_id,
      u.name        AS technician_name,
      COUNT(j.id)::int                                              AS total_jobs,
      COUNT(j.id) FILTER (WHERE j.status = 'delivered')::int         AS delivered,
      COUNT(j.id) FILTER (WHERE j.status NOT IN ('delivered','cancelled','rejected'))::int AS active_jobs,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (j.delivered_at::timestamp - j.received_at::timestamp)) / 86400.0
      ) FILTER (WHERE j.delivered_at IS NOT NULL), 2)::float        AS avg_duration_days
    FROM erp_users u
    LEFT JOIN repair_jobs j
      ON j.company_id = u.company_id
     AND (j.technician_id = u.id OR j.technician_2_id = u.id)
    WHERE u.company_id = ${company_id}
    GROUP BY u.id, u.name
    HAVING COUNT(j.id) > 0
    ORDER BY total_jobs DESC, u.name ASC
  `);

  /* drizzle's execute() result has .rows for pg driver */
  const list = (rows as unknown as { rows: Array<Record<string, unknown>> }).rows ?? [];
  return res.json(list);
}));

router.get("/repair-jobs/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const parts = await db.select().from(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.job_id, id), eq(repairJobPartsTable.company_id, company_id)));

  const history = await db.select().from(repairStatusHistoryTable)
    .where(and(eq(repairStatusHistoryTable.job_id, id), eq(repairStatusHistoryTable.company_id, company_id)))
    .orderBy(desc(repairStatusHistoryTable.created_at));

  return res.json({ ...job, parts, history });
}));

router.post("/repair-jobs", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const job_no = await nextJobNo(company_id);

  const [job] = await db.insert(repairJobsTable).values({
    company_id,
    job_no,
    customer_name:        String(b.customer_name ?? ""),
    customer_phone:       b.customer_phone ? String(b.customer_phone) : null,
    customer_id:          b.customer_id ? Number(b.customer_id) : null,
    device_brand:         String(b.device_brand ?? ""),
    device_model:         String(b.device_model ?? ""),
    device_type:          (() => {
      const dt = String(b.device_type ?? "general").trim();
      return VALID_DEVICE_TYPES.includes(dt as DeviceType) ? dt : "general";
    })(),
    imei:                 b.imei ? String(b.imei) : null,
    serial_no:            b.serial_no ? String(b.serial_no) : null,
    color:                b.color ? String(b.color) : null,
    storage:              b.storage ? String(b.storage) : null,
    problem_description:  b.problem_description ? String(b.problem_description) : null,
    technician_id:        b.technician_id ? Number(b.technician_id) : null,
    technician_name:      b.technician_name ? String(b.technician_name) : null,
    technician_2_id:      b.technician_2_id ? Number(b.technician_2_id) : null,
    technician_2_name:    b.technician_2_name ? String(b.technician_2_name) : null,
    technician_2_section: b.technician_2_section ? String(b.technician_2_section) : null,
    status:               "received",
    estimated_cost:       b.estimated_cost ? String(b.estimated_cost) : "0",
    deposit_paid:         b.deposit_paid ? String(b.deposit_paid) : "0",
    received_at:          String(b.received_at ?? new Date().toISOString().split("T")[0]),
    estimated_delivery:   b.estimated_delivery ? String(b.estimated_delivery) : null,
    notes:                b.notes ? String(b.notes) : null,
    checklist:            b.checklist ? JSON.stringify(b.checklist) : null,
    alert_days_threshold: b.alert_days_threshold ? Number(b.alert_days_threshold) : null,
    external_workshop:        Boolean(b.external_workshop),
    external_workshop_name:   b.external_workshop_name ? String(b.external_workshop_name) : null,
    external_workshop_cost:   b.external_workshop_cost ? String(b.external_workshop_cost) : "0",
    broker_name:              b.broker_name ? String(b.broker_name) : null,
    broker_commission:        b.broker_commission ? String(b.broker_commission) : "0",
    device_pin:               b.device_pin ? String(b.device_pin) : null,
    accessories:              b.accessories ? String(b.accessories) : null,
    branch_id:                b.branch_id ? Number(b.branch_id) : null,
  }).returning();

  /* History entry */
  await db.insert(repairStatusHistoryTable).values({
    job_id: job.id,
    company_id,
    status_to: "received",
    user_id,
    user_name,
    event_type: "created",
    note: "تم إنشاء بطاقة الصيانة",
  });

  /* Notify assigned technicians */
  for (const tid of [job.technician_id, job.technician_2_id]) {
    if (tid) {
      await notifyUser(company_id, tid, {
        type: "repair_assigned",
        title: "تم تعيينك على بطاقة صيانة",
        message: `بطاقة ${job.job_no} — ${job.device_brand} ${job.device_model}`,
        link: `/repairs?job=${job.id}`,
        reference_id: job.id,
      });
    }
  }

  return res.status(201).json(job);
}));

router.patch("/repair-jobs/:id", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const [existing] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "غير موجود" });
  if (existing.locked && !("locked" in b)) {
    return res.status(400).json({ error: "البطاقة مغلقة بعد التسليم — لا يمكن التعديل" });
  }

  if ("status" in b && String(b.status) !== existing.status) {
    /* SEC-GATE-001:
       لا نسمح للعميل بحقن حقول البوّابة (qa_completed_at / pre_delivery_reviewed_at /
       shipping_settled_at / delivery_receipt_sent_at) عبر body لتمرير validateTransition.
       هذه الحقول تُضبط حصراً من خلال الـ endpoints المخصّصة:
         POST /qa-checklist     → qa_completed_at
         POST /pre-delivery     → pre_delivery_reviewed_at
         POST /shipping         → shipping_settled_at
         POST /delivery-receipt → delivery_receipt_sent_at
       لذلك نقيّم الانتقال بناءً على بيانات الـ DB الموثوقة فقط. */
    const { allowed, errors } = validateTransition(
      existing.status,
      String(b.status),
      existing as Record<string, unknown>,
    );
    if (!allowed) {
      return res.status(422).json({ error: errors.join(', ') });
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  const FIELDS = [
    "status","technician_id","technician_name","technician_2_id","technician_2_name","technician_2_section",
    "problem_description","notes","imei","serial_no","color","storage",
    "estimated_delivery","external_workshop","external_workshop_name",
    "broker_name","alert_days_threshold","qa_notes",
    /* SEC-001: تم حذف "locked" من هنا — يُضبط تلقائياً فقط عند التسليم
       ولا يجب السماح لأي مستخدم بفتح بطاقة مسلّمة يدوياً عبر الـ API */
    "accessories","branch_id","device_pin",
    "device_brand","device_model",
  ];
  // eslint-disable-next-line security/detect-object-injection
  for (const f of FIELDS) if (f in b) updates[f] = (b as Record<string, unknown>)[f];

  if ("device_type" in b) {
    const dt = String(b.device_type ?? "general").trim();
    updates.device_type = VALID_DEVICE_TYPES.includes(dt as DeviceType) ? dt : "general";
  }

  const NUM = ["estimated_cost","final_cost","deposit_paid","external_workshop_cost","broker_commission"];
  // eslint-disable-next-line security/detect-object-injection
  for (const f of NUM) {
    if (!(f in b)) continue;
    // eslint-disable-next-line security/detect-object-injection
    const raw = (b as Record<string, unknown>)[f];
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      // eslint-disable-next-line security/detect-object-injection
      updates[f] = "0";
    } else {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        return res.status(400).json({ error: `قيمة غير صحيحة للحقل ${f}` });
      }
      // eslint-disable-next-line security/detect-object-injection
      updates[f] = String(num);
    }
  }

  if ("device_score" in b) updates.device_score = b.device_score ? Number(b.device_score) : null;
  if ("checklist" in b)    updates.checklist = JSON.stringify(b.checklist);
  if ("qa_checklist" in b) {
    /* SEC-GATE-002: نسمح بحفظ qa_checklist عبر PATCH العام (للتعديل اليدوي)
       لكن لا نضبط qa_completed_at — هذا الـ timestamp بوّابة، ويُضبط حصراً
       من POST /repair-jobs/:id/qa-checklist لمنع تجاوز فحص QC الإلزامي. */
    updates.qa_checklist = JSON.stringify(b.qa_checklist);
  }
  if (b.status === "delivered") {
    updates.delivered_at = new Date().toISOString().split("T")[0];
    updates.locked = true;
  }

  const [updated] = await db.update(repairJobsTable).set(updates)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .returning();

  /* History on status change */
  if (b.status && b.status !== existing.status) {
    await db.insert(repairStatusHistoryTable).values({
      job_id: id,
      company_id,
      status_from: existing.status,
      status_to: String(b.status),
      user_id,
      user_name,
      event_type: "pipeline_transition",
      note: "انتقال تلقائي عبر Pipeline",
    });
    void writeAuditLog({
      action: "repair_status_change",
      record_type: "repair_job",
      record_id: id,
      old_value: { status: existing.status },
      new_value: { status: String(b.status) },
      user: { id: user_id, username: user_name },
      company_id,
    });
  }

  /* History on technician change + notify */
  for (const slot of [
    { idKey: "technician_id",   nameKey: "technician_name",   prevId: existing.technician_id,   prevName: existing.technician_name,   label: "فني أساسي" },
    { idKey: "technician_2_id", nameKey: "technician_2_name", prevId: existing.technician_2_id, prevName: existing.technician_2_name, label: "فني ثاني" },
  ] as const) {
    if (slot.idKey in b) {
      const newId = (b as Record<string, unknown>)[slot.idKey] ? Number((b as Record<string, unknown>)[slot.idKey]) : null;
      if (newId !== slot.prevId) {
        await db.insert(repairStatusHistoryTable).values({
          job_id: id,
          company_id,
          technician_id: newId,
          technician_name: (b as Record<string, unknown>)[slot.nameKey] as string ?? null,
          user_id,
          user_name,
          event_type: "technician_change",
          note: `تغيير ${slot.label}: ${slot.prevName ?? "—"} → ${(b as Record<string, unknown>)[slot.nameKey] ?? "—"}`,
        });
        if (newId) {
          await notifyUser(company_id, newId, {
            type: "repair_assigned",
            title: "تم تعيينك على بطاقة صيانة",
            message: `بطاقة ${existing.job_no} — ${existing.device_brand} ${existing.device_model}`,
            link: `/repairs?job=${id}`,
            reference_id: id,
          });
        }
      }
    }
  }

  /* History on report/notes */
  if (b.report_note) {
    await db.insert(repairStatusHistoryTable).values({
      job_id: id,
      company_id,
      user_id,
      user_name,
      event_type: "report",
      note: String(b.report_note),
    });
  }

  /* أي تحديث للبطاقة يحلّ تنبيه التأخير المُسجَّل (لو موجود) — يمنع spam التنبيهات */
  void alertManager.markResolved(
    `repair_overdue:${id}`,
    `✅ بطاقة ${existing.job_no} تم تحديثها — تنبيه التأخير لُغي تلقائياً.`,
  );

  return res.json(updated);
}));

router.delete("/repair-jobs/:id", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const [job] = await db.select({ id: repairJobsTable.id, job_no: repairJobsTable.job_no })
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .limit(1);
  if (!job) return res.status(404).json({ error: "غير موجود" });
  await db.transaction(async (tx) => {
    await tx.delete(repairJobPartsTable).where(eq(repairJobPartsTable.job_id, job.id));
    await tx.delete(repairStatusHistoryTable).where(eq(repairStatusHistoryTable.job_id, job.id));
    await tx.delete(repairJobsTable)
      .where(and(eq(repairJobsTable.id, job.id), eq(repairJobsTable.company_id, company_id)));
  });
  /* SEC-002: سجّل حذف بطاقة الصيانة في audit_log لضمان الأثر الجنائي */
  void writeAuditLog({
    action: "delete",
    record_type: "repair_job",
    record_id: id,
    old_value: { job_no: job.job_no },
    user: { id: user_id, username: user_name },
    company_id,
  });
  return res.json({ ok: true });
}));

/* ══ ENGINEER REPORTS ═══════════════════════════════════════
   Stored in repair_status_history with event_type="engineer_report"
   - GET     /repair-jobs/:id/engineer-reports
   - POST    /repair-jobs/:id/engineer-reports         body: { note }
   - DELETE  /repair-jobs/:id/engineer-reports/:rid
═══════════════════════════════════════════════════════════ */
router.get("/repair-jobs/:id/engineer-reports", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const job_id = Number(req.params.id);
  const rows = await db.select().from(repairStatusHistoryTable)
    .where(and(
      eq(repairStatusHistoryTable.job_id, job_id),
      eq(repairStatusHistoryTable.company_id, company_id),
      eq(repairStatusHistoryTable.event_type, "engineer_report"),
    ))
    .orderBy(desc(repairStatusHistoryTable.created_at));
  return res.json(rows);
}));

/* الحد الأقصى لنص تقرير المهندس = 5000 حرف — SEC-004 */
const MAX_ENGINEER_REPORT_LEN = 5000;

router.post("/repair-jobs/:id/engineer-reports", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const job_id = Number(req.params.id);
  const note = String((req.body as Record<string, unknown>).note ?? "").trim();
  if (!note) return res.status(400).json({ error: "نص التقرير مطلوب" });
  /* SEC-004: رفض النصوص التي تتجاوز الحد الأقصى لمنع إرهاق الخادم */
  if (note.length > MAX_ENGINEER_REPORT_LEN)
    return res.status(400).json({ error: `نص التقرير لا يجب أن يتجاوز ${MAX_ENGINEER_REPORT_LEN} حرف` });

  const [job] = await db.select({
    id: repairJobsTable.id,
    technician_id: repairJobsTable.technician_id,
    technician_name: repairJobsTable.technician_name,
  }).from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, job_id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const [row] = await db.insert(repairStatusHistoryTable).values({
    job_id,
    company_id,
    event_type:      "engineer_report",
    note,
    user_id,
    user_name,
    technician_id:   job.technician_id ?? null,
    technician_name: job.technician_name ?? null,
  }).returning();
  /* SEC-006: سجّل إضافة التقرير في audit_log للأثر الجنائي */
  void writeAuditLog({
    action: "create",
    record_type: "repair_job",
    record_id: job_id,
    new_value: { event_type: "engineer_report", note_length: note.length },
    user: { id: user_id, username: user_name },
    company_id,
  });
  return res.status(201).json(row);
}));

router.delete("/repair-jobs/:id/engineer-reports/:rid", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const job_id = Number(req.params.id);
  const rid = Number(req.params.rid);
  /* SEC-003: تحقق من وجود التقرير قبل الحذف لضمان company_id isolation */
  const [existing] = await db.select({ id: repairStatusHistoryTable.id })
    .from(repairStatusHistoryTable)
    .where(and(
      eq(repairStatusHistoryTable.id, rid),
      eq(repairStatusHistoryTable.company_id, company_id),
      eq(repairStatusHistoryTable.event_type, "engineer_report"),
    ))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "التقرير غير موجود" });

  await db.delete(repairStatusHistoryTable)
    .where(and(
      eq(repairStatusHistoryTable.id, rid),
      eq(repairStatusHistoryTable.company_id, company_id),
      eq(repairStatusHistoryTable.event_type, "engineer_report"),
    ));
  /* SEC-003: سجّل حذف التقرير في audit_log لضمان الأثر الجنائي */
  void writeAuditLog({
    action: "delete",
    record_type: "repair_job",
    record_id: job_id,
    old_value: { engineer_report_id: rid },
    user: { id: user_id, username: user_name },
    company_id,
  });
  return res.json({ ok: true });
}));

/* ── PARTS ─────────────────────────────────────────────────── */
router.post("/repair-jobs/:id/parts", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const job_id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const [part] = await db.insert(repairJobPartsTable).values({
    job_id,
    company_id,
    product_id:    b.product_id ? Number(b.product_id) : null,
    product_name:  String(b.product_name ?? ""),
    quantity:      String(b.quantity ?? "1"),
    unit_price:    String(b.unit_price ?? "0"),
    source:        String(b.source ?? "internal"),
    warehouse_id:  b.warehouse_id ? Number(b.warehouse_id) : null,
  }).returning();
  return res.status(201).json(part);
}));

router.delete("/repair-jobs/:id/parts/:partId", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const partId = Number(req.params.partId);
  await db.delete(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.id, partId), eq(repairJobPartsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/**
 * إرجاع قطعة غيار من بطاقة صيانة إلى المخزن أو إلى سجل الهالك (Scrap).
 *
 * - destination = "stock"  → يزيد كمية المنتج في productsTable + يسجل stock_movement (نوع: repair_return)
 * - destination = "scrap"  → يضيف القطعة إلى scrap_items (لا يعود للمخزون)
 *
 * تطبيق ذرّي عبر transaction لمنع تعارض ما بين تحديث الجدول والمخزن.
 */
router.post("/repair-jobs/:id/parts/:partId/return", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const partId = Number(req.params.partId);
  const b = req.body as Record<string, unknown>;
  const dest = String(b.destination ?? "stock"); // 'stock' | 'scrap'
  if (dest !== "stock" && dest !== "scrap") {
    return res.status(400).json({ error: "وجهة الإرجاع يجب أن تكون stock أو scrap" });
  }

  /* خطأ HTTP محمول داخل المعاملة — نُرميه لإلغاء المعاملة ثم نمسكه ليعطي status معبّر */
  class HttpAbort extends Error {
    constructor(public httpStatus: number, public reason: string) { super(reason); }
  }

  try {
    await db.transaction(async (tx) => {
      /* RACE-FIX: claim atomically — نحدّث القطعة فقط لو لم تُرجَع بعد، ونعيدها كـ returning. */
      const [claimed] = await tx.update(repairJobPartsTable)
        .set({
          is_returned: true,
          return_destination: dest,
          returned_at: new Date(),
        })
        .where(and(
          eq(repairJobPartsTable.id, partId),
          eq(repairJobPartsTable.company_id, company_id),
          eq(repairJobPartsTable.is_returned, false),
        ))
        .returning();

      if (!claimed) {
        /* إمّا غير موجودة أو سُبقت بإرجاع آخر — تحقّق سبب الفشل */
        const [check] = await tx.select({ id: repairJobPartsTable.id })
          .from(repairJobPartsTable)
          .where(and(eq(repairJobPartsTable.id, partId), eq(repairJobPartsTable.company_id, company_id)));
        if (!check) throw new HttpAbort(404, "القطعة غير موجودة");
        throw new HttpAbort(400, "تم إرجاعها بالفعل");
      }

      const part = claimed;

      if (dest === "stock" && part.product_id && part.warehouse_id) {
        /* زيادة كمية المنتج في المخزن المحدد */
        const [prod] = await tx.select({ id: productsTable.id, quantity: productsTable.quantity, name: productsTable.name })
          .from(productsTable)
          .where(and(eq(productsTable.id, part.product_id), eq(productsTable.company_id, company_id)));
        if (!prod) throw new HttpAbort(404, "المنتج المرتبط لم يعد موجوداً");

        const oldQty = Number(prod.quantity);
        const addQty = Number(part.quantity);
        const newQty = oldQty + addQty;

        await tx.update(productsTable)
          .set({ quantity: String(newQty) })
          .where(and(eq(productsTable.id, part.product_id), eq(productsTable.company_id, company_id)));

        await tx.insert(stockMovementsTable).values({
          product_id:      part.product_id,
          product_name:    part.product_name,
          movement_type:   "repair_return",
          quantity:        String(addQty),         // موجب = وارد
          quantity_before: String(oldQty),
          quantity_after:  String(newQty),
          unit_cost:       part.unit_price,
          reference_type:  "repair_job",
          reference_id:    part.job_id,
          notes:           `إرجاع قطعة غير مستخدمة من بطاقة صيانة #${part.job_id}`,
          date:            new Date().toISOString().split("T")[0],
          warehouse_id:    part.warehouse_id,
          company_id,
        });
      }

      if (dest === "scrap") {
        await tx.insert(scrapItemsTable).values({
          company_id,
          product_id: part.product_id,
          product_name: part.product_name,
          quantity: part.quantity,
          unit_cost: part.unit_price,
          warehouse_id: part.warehouse_id,
          reason: String(b.reason ?? "إرجاع من صيانة - تالفة"),
          source_type: "repair_return",
          source_id: part.job_id,
          created_by: user_id,
          created_by_name: user_name,
        });
      }
    });
  } catch (err) {
    if (err instanceof HttpAbort) return res.status(err.httpStatus).json({ error: err.reason });
    throw err;
  }

  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   STAGE-GATE ENDPOINTS — Modals مخصّصة لكل بوّابة في Pipeline
   هذه الـ endpoints تَملأ الحقول المطلوبة (timestamps) التي
   تتحقق منها validateTransition في الانتقال التالي.
══════════════════════════════════════════════════════════════ */

/**
 * (1) إكمال فحص مراقبة الجودة (QC) قبل "جاهز للتسليم".
 *
 * يستقبل: { items: [...], notes?, device_score? }
 * يُسجّل: qa_checklist (JSON) + qa_completed_at + qa_notes + device_score
 * يحفظ سطر في status_history (event_type='qa_completed') لتتبع الفنّي الذي أنجز الفحص.
 */
router.post("/repair-jobs/:id/qa-checklist", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: "يجب إدخال بنود فحص QC" });
  }
  /* كل بند يجب أن يحوي status (pass/fail/n/a) */
  const allDecided = items.every((i: unknown) => {
    const it = i as { status?: unknown };
    return it.status === "pass" || it.status === "fail" || it.status === "n/a";
  });
  if (!allDecided) {
    return res.status(400).json({ error: "يجب اتخاذ قرار (نجح/فشل/لا ينطبق) لكل بند فحص" });
  }

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });

  const updates: Record<string, unknown> = {
    qa_checklist: JSON.stringify(items),
    qa_completed_at: new Date(),
    qa_notes: b.notes != null ? String(b.notes) : job.qa_notes,
    updated_at: new Date(),
  };
  if (b.device_score != null && String(b.device_score).trim() !== "") {
    const score = Number(b.device_score);
    if (Number.isFinite(score) && score >= 0 && score <= 100) {
      updates.device_score = score;
    }
  }

  const [updated] = await db.update(repairJobsTable).set(updates)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .returning();

  await db.insert(repairStatusHistoryTable).values({
    job_id: id,
    company_id,
    user_id,
    user_name,
    event_type: "qa_completed",
    note: `إكمال فحص مراقبة الجودة — ${items.filter((i: { status?: string }) => i.status === "fail").length} بند فشل`,
  });

  return res.json(updated);
}));

/**
 * (2) مراجعة ما قبل التسليم — يضع pre_delivery_reviewed_at = now().
 *
 * يستقبل (اختياري): {
 *   external_workshop, external_workshop_name, external_workshop_cost,
 *   broker_name, broker_commission
 * }
 * إرجاع القطع غير المستخدمة يتم عبر POST /parts/:partId/return بشكل منفصل
 * (المستخدم يقرر لكل قطعة على حدة قبل الضغط على "تأكيد المراجعة").
 */
router.post("/repair-jobs/:id/pre-delivery", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });

  const updates: Record<string, unknown> = {
    pre_delivery_reviewed_at: new Date(),
    updated_at: new Date(),
  };

  /* ورشة خارجية */
  if ("external_workshop" in b) {
    updates.external_workshop = Boolean(b.external_workshop);
    if (b.external_workshop) {
      updates.external_workshop_name = String(b.external_workshop_name ?? "").trim() || null;
      const cost = Number(b.external_workshop_cost ?? 0);
      updates.external_workshop_cost = String(Number.isFinite(cost) && cost >= 0 ? cost : 0);
    } else {
      updates.external_workshop_name = null;
      updates.external_workshop_cost = "0";
    }
  }

  /* وسيط/سمسار */
  if ("broker_name" in b || "broker_commission" in b) {
    const bName = String(b.broker_name ?? "").trim();
    updates.broker_name = bName || null;
    const bComm = Number(b.broker_commission ?? 0);
    updates.broker_commission = String(Number.isFinite(bComm) && bComm >= 0 ? bComm : 0);
  }

  const [updated] = await db.update(repairJobsTable).set(updates)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .returning();

  /* عدد القطع التي ما زالت بدون قرار إرجاع */
  const pendingParts = await db.select({ count: sql<number>`count(*)::int` })
    .from(repairJobPartsTable)
    .where(and(
      eq(repairJobPartsTable.job_id, id),
      eq(repairJobPartsTable.company_id, company_id),
      eq(repairJobPartsTable.is_returned, false),
      eq(repairJobPartsTable.source, "internal"),
    ));

  await db.insert(repairStatusHistoryTable).values({
    job_id: id,
    company_id,
    user_id,
    user_name,
    event_type: "pre_delivery_reviewed",
    note: `مراجعة ما قبل التسليم — قطع داخلية لم تُرجَع: ${Number(pendingParts[0]?.count ?? 0)}`,
  });

  return res.json(updated);
}));

/**
 * (3) تسجيل تكلفة الشحن — تنشئ مصروفاً تلقائياً وتخصمه من الخزنة المختارة.
 *
 * يستقبل: { shipping_cost: number, safe_id: number, notes? }
 * - يُنشئ سطر مصروف في expenses (الفئة: "مصاريف شحن صيانة" — تُستحدَث تلقائياً إن لم تكن موجودة)
 * - يُخصَم المبلغ من رصيد الخزنة (safe) بشكل ذرّي
 * - يُسجَّل سطر في transactions + journal entry + يُربط expense.id بالبطاقة (shipping_expense_id)
 * - في النهاية يضع shipping_settled_at = now() لفتح بوابة الانتقال إلى "تم التسليم".
 *
 * إن كانت تكلفة الشحن = 0 يمكن للمستخدم تأكيد ذلك (يضع shipping_settled_at بدون مصروف).
 */
router.post("/repair-jobs/:id/shipping", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const cost = Number(b.shipping_cost ?? 0);
  if (!Number.isFinite(cost) || cost < 0) {
    return res.status(400).json({ error: "تكلفة الشحن غير صحيحة" });
  }

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });
  if (job.shipping_settled_at) {
    return res.status(400).json({ error: "تكلفة الشحن مسجّلة مسبقاً لهذه البطاقة" });
  }

  /* حالة 1: المستخدم أكّد عدم وجود تكلفة شحن
     IDEMPOTENCY: الـ WHERE يضمن أنه لو طلبان متزامنان أرسلا shipping=0
     فسطر واحد فقط هو الذي سيُحدّث، والثاني سيرجع بدون updated rows. */
  if (cost === 0) {
    const [updated] = await db.update(repairJobsTable).set({
      shipping_cost: "0",
      shipping_settled_at: new Date(),
      updated_at: new Date(),
    }).where(and(
      eq(repairJobsTable.id, id),
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.shipping_settled_at} IS NULL`,
    )).returning();

    if (!updated) return res.status(409).json({ error: "تكلفة الشحن مسجّلة مسبقاً (تنفيذ متزامن)" });

    await db.insert(repairStatusHistoryTable).values({
      job_id: id,
      company_id,
      user_id,
      user_name,
      event_type: "shipping_settled",
      note: "تم تأكيد عدم وجود تكلفة شحن",
    });

    return res.json({ job: updated, expense: null });
  }

  /* حالة 2: تكلفة شحن > 0 — ننشئ مصروف فعلي */
  const safeId = Number(b.safe_id);
  if (!Number.isFinite(safeId) || safeId <= 0) {
    return res.status(400).json({ error: "يجب اختيار خزنة لخصم تكلفة الشحن منها" });
  }

  /* خطأ HTTP محمول داخل المعاملة لإلغائها بأمان */
  class HttpAbort extends Error {
    constructor(public httpStatus: number, public reason: string) { super(reason); }
  }

  let txResult: { job: typeof job; expense: { id: number }; safeName: string; note: string } | null = null;

  try {
    txResult = await db.transaction(async (tx) => {
      /* IDEMPOTENCY-FIX: claim الـ shipping_settled_at ذرّياً قبل أي تعديل آخر —
         إن سبقنا طلب آخر فالـ UPDATE لن يُرجع أي صف، ونوقف العملية. */
      const [claimedJob] = await tx.update(repairJobsTable).set({
        shipping_settled_at: new Date(),
        updated_at: new Date(),
      }).where(and(
        eq(repairJobsTable.id, id),
        eq(repairJobsTable.company_id, company_id),
        sql`${repairJobsTable.shipping_settled_at} IS NULL`,
      )).returning();

      if (!claimedJob) throw new HttpAbort(409, "تكلفة الشحن مسجّلة مسبقاً (تنفيذ متزامن)");

      /* جلب الخزنة وخصم المبلغ ذرّياً */
      const [safe] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, safeId), eq(safesTable.company_id, company_id)));
      if (!safe) throw new HttpAbort(404, "الخزنة غير موجودة");

      const debited = await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} - ${String(cost)}` })
        .where(and(
          eq(safesTable.id, safeId),
          eq(safesTable.company_id, company_id),
          sql`${safesTable.balance} >= ${String(cost)}`,
        ))
        .returning({ id: safesTable.id });
      if (debited.length === 0) {
        throw new HttpAbort(400, `رصيد الخزنة غير كافٍ (المتاح: ${Number(safe.balance).toFixed(2)})`);
      }

      /* فئة المصروف — استحداث "مصاريف شحن صيانة" إن لم تكن موجودة */
      const SHIPPING_CAT_NAME = "مصاريف شحن صيانة";
      let [shipCat] = await tx.select().from(expenseCategoriesTable)
        .where(and(eq(expenseCategoriesTable.name, SHIPPING_CAT_NAME), eq(expenseCategoriesTable.company_id, company_id)));
      if (!shipCat) {
        const [created] = await tx.insert(expenseCategoriesTable).values({
          name: SHIPPING_CAT_NAME,
          company_id,
        }).returning();
        shipCat = created;
      }

      /* إدراج المصروف */
      const note = String(b.notes ?? `شحن بطاقة صيانة ${job.job_no}`);
      const [exp] = await tx.insert(expensesTable).values({
        description:    note,
        amount:         String(cost),
        category:       SHIPPING_CAT_NAME,
        safe_id:        safeId,
        safe_name:      safe.name,
        reference_type: "repair_job",
        reference_id:   id,
        company_id,
      }).returning();

      /* سطر في transactions */
      await tx.insert(transactionsTable).values({
        type: "expense",
        amount: String(cost),
        description: note,
        reference_type: "repair_shipping",
        reference_id: id,
        safe_id: safeId,
        company_id,
      });

      /* تحديث البطاقة بـ shipping_cost + رابط المصروف (settled_at تم claim'ه أعلاه) */
      const [updated] = await tx.update(repairJobsTable).set({
        shipping_cost:        String(cost),
        shipping_expense_id:  exp.id,
      }).where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id))).returning();

      await tx.insert(repairStatusHistoryTable).values({
        job_id: id,
        company_id,
        user_id,
        user_name,
        event_type: "shipping_settled",
        note: `تكلفة شحن ${cost.toFixed(2)} — مصروف #${exp.id}`,
      });

      return { job: updated, expense: exp, safeName: safe.name, note };
    });
  } catch (err) {
    if (err instanceof HttpAbort) return res.status(err.httpStatus).json({ error: err.reason });
    throw err;
  }

  /* القيد المحاسبي خارج المعاملة (دوال auto-account لا تقبل tx).
     ملاحظة: نُنفّذه بعد commit ضماناً للاتساق المحاسبي —
     لو فشل هنا تظل بيانات الشحن صحيحة ويتم تسجيل الخطأ ليُعالَج لاحقاً. */
  if (txResult) {
    try {
      const expenseAcct = await getOrCreateGeneralExpenseAccount(company_id);
      const safeAcct    = await getOrCreateSafeAccount(safeId, txResult.safeName, company_id);
      await createAutoJournalEntry({
        date:        new Date().toISOString().split("T")[0],
        description: txResult.note,
        reference:   `repair_shipping:${id}`,
        debit:       expenseAcct,
        credit:      safeAcct,
        amount:      cost,
        companyId:   company_id,
      });
    } catch (jErr) {
      console.error("[repair-shipping] auto-journal failed for job", id, jErr);
    }
  }

  return res.json({ job: txResult?.job, expense: txResult?.expense });
}));

/**
 * (4) بيانات إيصال التسليم — للطباعة و WhatsApp.
 *
 * يُرجع البيانات المنسّقة (بدون HTML) ليبنيها العميل (frontend) كما يشاء —
 * هذا أوضح فصلاً للمسؤوليات وأسهل اختباراً من إرجاع HTML من الخادم.
 */
router.get("/repair-jobs/:id/receipt-data", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });

  const parts = await db.select().from(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.job_id, id), eq(repairJobPartsTable.company_id, company_id)));

  const partsTotal = parts.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.unit_price)), 0);

  return res.json({
    job_no:           job.job_no,
    customer_name:    job.customer_name,
    customer_phone:   job.customer_phone,
    device_brand:     job.device_brand,
    device_model:     job.device_model,
    imei:             job.imei,
    serial_no:        job.serial_no,
    color:            job.color,
    storage:          job.storage,
    received_at:      job.received_at,
    delivered_at:     job.delivered_at,
    problem_description: job.problem_description,
    notes:            job.notes,
    technician_name:  job.technician_name,
    estimated_cost:   Number(job.estimated_cost ?? 0),
    final_cost:       Number(job.final_cost ?? 0),
    deposit_paid:     Number(job.deposit_paid ?? 0),
    shipping_cost:    Number(job.shipping_cost ?? 0),
    parts_total:      partsTotal,
    parts:            parts.map((p) => ({
      product_name: p.product_name,
      quantity:     Number(p.quantity),
      unit_price:   Number(p.unit_price),
      total:        Number(p.quantity) * Number(p.unit_price),
    })),
    qa_completed_at:  job.qa_completed_at,
    delivery_receipt_sent_at: job.delivery_receipt_sent_at,
  });
}));

/**
 * (5) تسجيل أن إيصال التسليم قد أُرسل / طُبع.
 * يستقبل: { method: 'whatsapp' | 'print' | 'both' }
 */
router.post("/repair-jobs/:id/delivery-receipt", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const method = String(b.method ?? "both");
  if (!["whatsapp", "print", "both"].includes(method)) {
    return res.status(400).json({ error: "طريقة الإرسال غير صحيحة" });
  }

  const [updated] = await db.update(repairJobsTable).set({
    delivery_receipt_sent_at: new Date(),
    delivery_receipt_method:  method,
    updated_at:               new Date(),
  })
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "البطاقة غير موجودة" });

  await db.insert(repairStatusHistoryTable).values({
    job_id: id,
    company_id,
    user_id,
    user_name,
    event_type: "delivery_receipt_sent",
    note: `تم إرسال/طباعة إيصال التسليم — ${method === "whatsapp" ? "واتساب" : method === "print" ? "طباعة" : "واتساب + طباعة"}`,
  });

  return res.json(updated);
}));

/* ══════════════════════════════════════════════════════════════
   QUICK CUSTOMER CREATION (from repair form)
   Creates a customer tagged source='repair'. No can_manage_customers
   permission required — anyone who can create repair jobs can add
   a walk-in repair customer.
══════════════════════════════════════════════════════════════ */
router.get("/repair-customers/lookup", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const phone = String(req.query.phone ?? "").trim();
  if (!phone) return res.json(null);
  const rows = await db.execute(sql`
    SELECT id, name, phone FROM customers
    WHERE company_id = ${company_id} AND phone = ${phone}
    LIMIT 1
  `);
  const row = (rows.rows as Record<string, unknown>[])[0];
  return res.json(row ?? null);
}));

router.post("/repair-customers", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const name  = String(b.name  ?? "").trim();
  const phone = String(b.phone ?? "").trim();
  if (!name)  return res.status(400).json({ error: "اسم العميل مطلوب" });
  if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

  const normalized = normalizeName(name);

  /* Duplicate name check (within company) */
  const dupName = await db.execute(sql`
    SELECT id, name FROM customers
    WHERE company_id = ${company_id} AND normalized_name = ${normalized}
    LIMIT 1
  `);
  if ((dupName.rows as unknown[]).length > 0) {
    const d = (dupName.rows as Record<string, unknown>[])[0];
    return res.status(400).json({ error: `يوجد عميل بنفس الاسم بالفعل: "${d.name}"`, existing: d });
  }

  /* Duplicate phone check (within company) */
  const dupPhone = await db.execute(sql`
    SELECT id, name FROM customers WHERE company_id = ${company_id} AND phone = ${phone} LIMIT 1
  `);
  if ((dupPhone.rows as unknown[]).length > 0) {
    const d = (dupPhone.rows as Record<string, unknown>[])[0];
    return res.status(400).json({ error: `رقم الهاتف مستخدم بالفعل للعميل: "${d.name}"`, existing: d });
  }

  /* Globally-unique next customer_code (UNIQUE constraint is global across companies) */
  let attempts = 0;
  let inserted: Record<string, unknown> | null = null;
  let lastError: unknown = null;

  while (attempts < 5 && !inserted) {
    attempts++;
    const nextCode = await getNextCustomerCode();
    try {
      const result = await db.execute(sql`
        INSERT INTO customers (name, customer_code, normalized_name, phone, balance,
                               is_customer, is_supplier, source, company_id)
        VALUES (${name}, ${nextCode}, ${normalized}, ${phone}, 0,
                true, false, 'repair', ${company_id})
        RETURNING id, name, phone, customer_code
      `);
      inserted = (result.rows as Record<string, unknown>[])[0] ?? null;
    } catch (e: unknown) {
      lastError = e;
      const msg = String((e as { message?: string })?.message ?? "");
      /* retry only on customer_code unique-collision */
      if (!/customers_customer_code_unique|duplicate key/.test(msg)) throw e;
    }
  }

  if (!inserted) {
    return res.status(500).json({
      error: "تعذر توليد رقم عميل فريد، حاول مرة أخرى",
      details: String((lastError as { message?: string })?.message ?? ""),
    });
  }

  /* Auto-create chart-of-accounts entry & link */
  try {
    const acct = await getOrCreateCustomerAccount(
      Number(inserted.customer_code),
      name,
      company_id,
    );
    await db.execute(sql`
      UPDATE customers SET account_id = ${acct.id} WHERE id = ${Number(inserted.id)}
    `);
  } catch {
    /* non-fatal: customer is created, accounting link can be repaired later */
  }

  return res.status(201).json(inserted);
}));

export default router;
