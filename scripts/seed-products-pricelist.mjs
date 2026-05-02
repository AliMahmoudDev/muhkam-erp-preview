import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Pool } = require("/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const COMPANY_ID = 1;

const products = [
  { name: "شاشة iPhone 14 Pro", category: "شاشات", cost_price: "850", sale_price: "1100" },
  { name: "شاشة iPhone 14", category: "شاشات", cost_price: "700", sale_price: "920" },
  { name: "شاشة iPhone 13 Pro Max", category: "شاشات", cost_price: "780", sale_price: "1000" },
  { name: "شاشة iPhone 13", category: "شاشات", cost_price: "620", sale_price: "820" },
  { name: "شاشة iPhone 12", category: "شاشات", cost_price: "500", sale_price: "680" },
  { name: "شاشة Samsung S23 Ultra", category: "شاشات", cost_price: "920", sale_price: "1200" },
  { name: "شاشة Samsung S22", category: "شاشات", cost_price: "650", sale_price: "850" },
  { name: "شاشة Samsung A54", category: "شاشات", cost_price: "380", sale_price: "520" },
  { name: "شاشة Samsung A34", category: "شاشات", cost_price: "320", sale_price: "440" },
  { name: "شاشة Xiaomi 13T", category: "شاشات", cost_price: "410", sale_price: "560" },
  { name: "بطارية iPhone 14 Pro", category: "بطاريات", cost_price: "180", sale_price: "280" },
  { name: "بطارية iPhone 14", category: "بطاريات", cost_price: "160", sale_price: "250" },
  { name: "بطارية iPhone 13", category: "بطاريات", cost_price: "150", sale_price: "240" },
  { name: "بطارية iPhone 12", category: "بطاريات", cost_price: "130", sale_price: "210" },
  { name: "بطارية iPhone 11", category: "بطاريات", cost_price: "110", sale_price: "180" },
  { name: "بطارية Samsung S23", category: "بطاريات", cost_price: "140", sale_price: "220" },
  { name: "بطارية Samsung A54", category: "بطاريات", cost_price: "90", sale_price: "150" },
  { name: "بطارية Xiaomi 13T", category: "بطاريات", cost_price: "100", sale_price: "165" },
  { name: "بطارية OPPO Reno10", category: "بطاريات", cost_price: "95", sale_price: "155" },
  { name: "بطارية Huawei P50", category: "بطاريات", cost_price: "105", sale_price: "170" },
  { name: "مايكروفون iPhone 14", category: "قطع غيار", cost_price: "45", sale_price: "80" },
  { name: "مايكروفون Samsung S23", category: "قطع غيار", cost_price: "40", sale_price: "72" },
  { name: "كاميرا خلفية iPhone 14 Pro", category: "قطع غيار", cost_price: "350", sale_price: "500" },
  { name: "كاميرا خلفية Samsung S22", category: "قطع غيار", cost_price: "280", sale_price: "400" },
  { name: "إطار iPhone 14 Pro", category: "قطع غيار", cost_price: "120", sale_price: "190" },
  { name: "إطار Samsung S23 Ultra", category: "قطع غيار", cost_price: "100", sale_price: "160" },
  { name: "زجاج خلفي iPhone 14", category: "قطع غيار", cost_price: "80", sale_price: "130" },
  { name: "زجاج خلفي Samsung S22", category: "قطع غيار", cost_price: "65", sale_price: "105" },
  { name: "مفتاح تشغيل iPhone 13", category: "قطع غيار", cost_price: "30", sale_price: "55" },
  { name: "مفتاح صوت iPhone 14", category: "قطع غيار", cost_price: "35", sale_price: "60" },
  { name: "كابل شحن iPhone Lightning", category: "إكسسوارات", cost_price: "25", sale_price: "55" },
  { name: "كابل شحن Type-C 65W", category: "إكسسوارات", cost_price: "30", sale_price: "65" },
  { name: "شاحن سريع 65W", category: "إكسسوارات", cost_price: "95", sale_price: "160" },
  { name: "شاحن لاسلكي 15W", category: "إكسسوارات", cost_price: "75", sale_price: "130" },
  { name: "سماعة بلوتوث TWS", category: "إكسسوارات", cost_price: "120", sale_price: "210" },
  { name: "كفر سيليكون iPhone 14 Pro", category: "إكسسوارات", cost_price: "20", sale_price: "45" },
  { name: "كفر سيليكون Samsung S23", category: "إكسسوارات", cost_price: "18", sale_price: "40" },
  { name: "زجاج حماية iPhone 14 Pro", category: "إكسسوارات", cost_price: "15", sale_price: "35" },
  { name: "زجاج حماية Samsung S23 Ultra", category: "إكسسوارات", cost_price: "15", sale_price: "35" },
  { name: "حامل سيارة مغناطيسي", category: "إكسسوارات", cost_price: "40", sale_price: "80" },
  { name: "لحام بورد iPhone 14", category: "خدمات", cost_price: "200", sale_price: "350" },
  { name: "إصلاح بورد Samsung S23", category: "خدمات", cost_price: "180", sale_price: "320" },
  { name: "فحص شامل جهاز", category: "خدمات", cost_price: "30", sale_price: "60" },
  { name: "تنظيف جهاز بالأولتراسونيك", category: "خدمات", cost_price: "40", sale_price: "80" },
  { name: "استبدال شاشة iPhone X", category: "خدمات", cost_price: "150", sale_price: "280" },
  { name: "بورد iPhone 14 Pro 256GB", category: "بوردات", cost_price: "1800", sale_price: "2400" },
  { name: "بورد Samsung S23 Ultra 256GB", category: "بوردات", cost_price: "1600", sale_price: "2150" },
  { name: "شاشة OPPO Reno10 Pro", category: "شاشات", cost_price: "360", sale_price: "500" },
  { name: "شاشة Realme 11 Pro", category: "شاشات", cost_price: "290", sale_price: "400" },
  { name: "بطارية Realme 11 Pro", category: "بطاريات", cost_price: "85", sale_price: "140" },
];

async function seed() {
  const client = await pool.connect();
  try {
    // Insert products
    console.log("Inserting 50 products...");
    const insertedIds = [];
    for (const p of products) {
      const r = await client.query(
        `INSERT INTO products (name, category, cost_price, sale_price, quantity, tax_rate, company_id)
         VALUES ($1, $2, $3, $4, 100, 0, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [p.name, p.category, p.cost_price, p.sale_price, COMPANY_ID]
      );
      if (r.rows[0]) insertedIds.push(r.rows[0].id);
    }
    console.log(`Inserted ${insertedIds.length} products`);

    // Create price list
    console.log("Creating price list with 10% markup...");
    const plResult = await client.query(
      `INSERT INTO price_lists (name, description, is_active, company_id)
       VALUES ($1, $2, true, $3)
       RETURNING id`,
      ["قائمة الأسعار الافتراضية", "قائمة أسعار تجريبية بهامش 10% على جميع المنتجات", COMPANY_ID]
    );
    const priceListId = plResult.rows[0].id;

    // Add all products to price list with 10% markup
    if (insertedIds.length > 0) {
      const vals = insertedIds.map((id, i) => `($${i*3+1}, $${i*3+2}, $${i*3+3})`).join(",");
      const params = insertedIds.flatMap(id => [priceListId, id, "10"]);
      await client.query(
        `INSERT INTO price_list_items (price_list_id, product_id, markup_percent) VALUES ${vals}`,
        params
      );
    }
    console.log(`Price list ID ${priceListId} created with ${insertedIds.length} items at 10% markup`);
    console.log("Done!");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(e => { console.error(e); process.exit(1); });
