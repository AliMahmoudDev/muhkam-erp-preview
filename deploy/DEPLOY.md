# دليل نشر MUHKAM ERP على Hetzner VPS
## (ULTIMATE + ADVANCED — نظامان في خادم واحد)

---

## المتطلبات

- Ubuntu 22.04 LTS
- Node.js 20+ (`nvm install 20 && nvm use 20`)
- pnpm (`npm install -g pnpm`)
- PostgreSQL 16
- Nginx
- PM2 (`npm install -g pm2`)
- Certbot (للـ SSL)

---

## البنية النهائية على الخادم

```
halaltec.com/             → MUHKAM ULTIMATE  (نظام كامل)
halaltec.com/muhkam-advanced/ → MUHKAM ADVANCED  (نظام مبسط)
halaltec.com/api/         → Express API      (مشترك بين النسختين)
```

كلا النسختين تعملان من نفس الـ Express backend على port 3000.
الـ Express يقدّم الملفات الثابتة للنسختين معاً.

---

## الخطوة 1 — استنساخ الكود

```bash
git clone https://github.com/m4elmelegy-hub/MUHKAM-ERP.git /var/www/muhkam-erp
cd /var/www/muhkam-erp
pnpm install
```

---

## الخطوة 2 — إعداد متغيرات البيئة

```bash
cp .env.example .env
nano .env
```

أدخل هذه القيم:

```env
DATABASE_URL=postgresql://erpuser:YOUR_STRONG_PASSWORD@localhost:5432/erp
JWT_SECRET=GENERATE_64_CHAR_HEX_HERE
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://halaltec.com
```

لتوليد `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## الخطوة 3 — إعداد قاعدة البيانات

```bash
# إنشاء مستخدم وقاعدة بيانات
sudo -u postgres psql -c "CREATE USER erpuser WITH PASSWORD 'YOUR_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE erp OWNER erpuser;"

# رفع الـ schema
source .env && pnpm --filter @workspace/db run db:push
```

---

## الخطوة 4 — بناء النظامين

```bash
# 1. بناء الـ Backend
pnpm --filter @workspace/api-server run build

# 2. بناء MUHKAM ULTIMATE (مسار /)
PORT=3000 BASE_PATH=/ NODE_ENV=production \
  pnpm --filter @workspace/erp-system run build

# 3. بناء MUHKAM ADVANCED (مسار /muhkam-advanced/)
PORT=3000 BASE_PATH=/muhkam-advanced/ NODE_ENV=production \
  pnpm --filter @workspace/muhkam-base run build
```

تحقق من الملفات:
```bash
ls artifacts/erp-system/dist/public/     # ULTIMATE
ls artifacts/muhkam-advanced/dist/public/    # ADVANCED
```

---

## الخطوة 5 — تشغيل Backend مع PM2

افتح `ecosystem.config.cjs` وتأكد من وجود المتغيرات:

```javascript
env_production: {
  NODE_ENV: "production",
  PORT: 3000,
  DATABASE_URL: "postgresql://erpuser:YOUR_PASS@localhost:5432/erp",
  JWT_SECRET: "YOUR_64_CHAR_SECRET",
  ALLOWED_ORIGINS: "https://halaltec.com",
  // مسارات اختيارية — تُضبط تلقائياً نسبةً لموقع dist/index.mjs
  // FRONTEND_DIST: "/var/www/muhkam-erp/artifacts/erp-system/dist/public",
  // ADVANCED_DIST:  "/var/www/muhkam-erp/artifacts/muhkam-advanced/dist/public",
}
```

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # اتبع التعليمات لتشغيل تلقائي عند إعادة التشغيل
```

تحقق:
```bash
pm2 status
pm2 logs halaltech-api --lines 20
```

يجب أن ترى في اللوجز:
```
Serving ADVANCED frontend at /muhkam-advanced/
Serving ULTIMATE frontend at /
Backend started on port 3000
```

---

## الخطوة 6 — إعداد Nginx

```bash
# انسخ الـ config
sudo cp /var/www/muhkam-erp/deploy/nginx.conf /etc/nginx/sites-available/muhkam

# عدّل اسم النطاق (استبدل halaltec.com بنطاقك الفعلي)
sudo nano /etc/nginx/sites-available/muhkam

# فعّل الموقع
sudo ln -s /etc/nginx/sites-available/muhkam /etc/nginx/sites-enabled/

# احذف الـ default إذا موجود
sudo rm -f /etc/nginx/sites-enabled/default

# اختبر واعد تشغيل
sudo nginx -t && sudo nginx -s reload
```

---

## الخطوة 7 — SSL مع Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d halaltec.com -d www.halaltec.com
```

---

## الخطوة 8 — اختبار التطبيق

```bash
# تحقق من ULTIMATE
curl -I https://halaltec.com/
# يجب أن يرجع: HTTP/2 200

# تحقق من ADVANCED
curl -I https://halaltec.com/muhkam-advanced/
# يجب أن يرجع: HTTP/2 200

# تحقق من API
curl https://halaltec.com/api/healthz
# يجب أن يرجع: {"status":"ok"}
```

---

## التحديث من GitHub (سحب تغييرات جديدة)

```bash
cd /var/www/muhkam-erp
git pull

# تثبيت حزم جديدة إن وجدت
pnpm install

# رفع تغييرات قاعدة البيانات
source .env && pnpm --filter @workspace/db run db:push

# بناء الكل من جديد
pnpm --filter @workspace/api-server run build
PORT=3000 BASE_PATH=/ NODE_ENV=production \
  pnpm --filter @workspace/erp-system run build
PORT=3000 BASE_PATH=/muhkam-advanced/ NODE_ENV=production \
  pnpm --filter @workspace/muhkam-base run build

# إعادة تشغيل الـ backend
pm2 restart halaltech-api

# إعادة تحميل Nginx (إذا تغير الـ config فقط)
sudo nginx -s reload
```

---

## متغيرات البيئة الكاملة

| المتغير | مطلوب | الوصف |
|---|---|---|
| `DATABASE_URL` | **نعم** | رابط PostgreSQL |
| `JWT_SECRET` | **نعم** | مفتاح JWT (64 حرف hex على الأقل) |
| `PORT` | نعم | port الـ backend (3000 في الإنتاج) |
| `NODE_ENV` | نعم | `production` |
| `ALLOWED_ORIGINS` | مستحسن | `https://halaltec.com` |
| `FRONTEND_DIST` | اختياري | مسار ULTIMATE (يُضبط تلقائياً) |
| `ADVANCED_DIST` | اختياري | مسار ADVANCED (يُضبط تلقائياً) |

---

## كيفية تحديد نسخة كل عميل

1. ادخل على `https://halaltec.com` بحساب **superadmin**
2. اذهب لـ **لوحة المدير العام** (Super Admin)
3. اضغط على اسم الشركة
4. في قسم التفاصيل ستجد **🏷️ النسخة** — اختر:
   - ⭐ ULTIMATE — النسخة الكاملة (محاسبة كاملة)
   - 🚀 ADVANCED — النسخة المبسطة (شركات متوسطة)
5. التغيير فوري — في المرة القادمة يدخل المستخدم على أي رابط، سيُحوَّل تلقائياً للنسخة المخصصة لشركته

**الرابط الموحّد للعملاء:** يمكنك إعطاء جميع العملاء رابطاً واحداً: `https://halaltec.com`  
النظام سيحول كل مستخدم للنسخة الصحيحة تلقائياً بعد الدخول.

---

## مواصفات السيرفر الموصى بها

| الحجم | المستخدمين | المواصفات |
|---|---|---|
| Starter | ≤25 | 2 vCPU, 2 GB RAM, 20 GB SSD |
| Standard | ≤100 | 4 vCPU, 4 GB RAM, 40 GB SSD |
| Growth | ≤500 | 8 vCPU, 8 GB RAM, 80 GB SSD |

**Hetzner المقترح:** CX21 (2 vCPU, 4 GB RAM) أو CX31 للنمو

---

## قائمة تحقق الأمان قبل الإطلاق

- [ ] `JWT_SECRET` 64 حرف hex عشوائي
- [ ] كلمة مرور PostgreSQL قوية وغير مكشوفة
- [ ] `ALLOWED_ORIGINS` يحتوي نطاقك فقط
- [ ] port 5432 محمي بجدار الحماية (لا يُعرض للإنترنت)
- [ ] SSL مثبّت ومجدَّد تلقائياً (Certbot)
- [ ] PM2 مضبوط للتشغيل التلقائي (`pm2 startup`)
- [ ] PIN المدير الافتراضي تم تغييره بعد أول دخول
