# MUHKAM ERP — Production Deployment Runbook

> دليل تشغيل الإنتاج على VPS + Domain. لا يحتوي أي أسرار حقيقية — فقط أوامر
> توليد وأسماء متغيرات. للمزيد من تفاصيل الـ CI/Deploy راجع `docs/DEPLOYMENT.md`
> وملف `.github/workflows/deploy.yml`. إعداد Nginx الفعلي في `deploy/nginx.conf`.

---

## 0. نظرة عامة على المعمارية

- **API + SPA على نفس الـ origin:** Express يخدم الـ React build من
  `artifacts/erp-system/dist/public`، لذا الواجهة والـ API على نفس الدومين.
- **Nginx** = reverse proxy + SSL termination → يمرر إلى `localhost:8080`.
- **PM2** يدير عملية الـ API باسم `muhkam-api`.
- **Deploy تلقائي:** push إلى `main` → CI → (عند النجاح) Deploy عبر SSH.

---

## 1. مسار المشروع على VPS

```
/var/www/muhkam-erp           # جذر المشروع (git clone)
/var/www/muhkam-erp/.env      # ملف الأسرار (غير مرفوع لـ git)
/root/db-backups              # نسخ احتياطية (BACKUP_DIR موصى به)
```

---

## 2. ملف البيئة `.env`

الموقع: `/var/www/muhkam-erp/.env`

أول مرة فقط:

```bash
cd /var/www/muhkam-erp
cp .env.production.example .env
nano .env
```

> `deploy.yml` يصدر `git clean -fd --exclude=.env`، أي أن `.env` **لا يُمسح**
> أثناء الـ deploy. عدّله مرة واحدة وسيبقى.

---

## 3. توليد الأسرار (نفّذ على VPS)

> لا تشارك القيم الناتجة في أي محادثة أو لقطة شاشة.

```bash
# مفاتيح JWT (يجب أن يختلفا تمامًا)
openssl rand -hex 32   # ← ضعه في JWT_SECRET
openssl rand -hex 32   # ← ضعه في JWT_REFRESH_SECRET

# مفاتيح التشفير (deploy.yml يولّدها تلقائيًا إن غابت، لكن يمكن توليدها يدويًا)
openssl rand -hex 32   # ← TOTP_ENCRYPTION_KEY
openssl rand -hex 32   # ← BACKUP_ENCRYPTION_KEY   ⚠️ احفظه للأبد (انظر §16)

# سر تتبّع الصيانة (QR)
openssl rand -hex 24   # ← REPAIR_TRACKING_SECRET
```

---

## 4. ضبط SUPER_ADMIN_IPS

```ini
# في .env — IP(s) ثابتة مسموح لها بالوصول لـ super-admin
SUPER_ADMIN_IPS=203.0.113.10,203.0.113.11
```

- **فارغ في الإنتاج = حجب كامل لـ super-admin** (fail-closed بالتصميم).
- استخدم IP ثابت (أو VPN ثابت). لمعرفة IP الحالي: `curl ifconfig.me`.

---

## 5. ضبط ALLOWED_ORIGINS للدومين

```ini
ALLOWED_ORIGINS=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN
```

- لازم إن وُجد تطبيق موبايل أو واجهة على origin منفصل.
- الـ SPA المخدوم من Express يعمل same-origin بدونه، لكن اضبطه للإغلاق الأمني.

---

## 6. Redis (اختياري / موصى به)

```bash
sudo apt-get install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping   # يجب أن يرد PONG
```

```ini
REDIS_URL=redis://localhost:6379
```

- بدونه: fallback ذاكرة داخلية (كافٍ لـ instance واحد).
- مطلوب عند تشغيل أكثر من instance (rate-limit/cache مشترك).

---

## 7. Nginx Reverse Proxy

الإعداد الجاهز في `deploy/nginx.conf` (الدومين الحالي `muhkampro.com` — بدّله
لدومينك). الـ deploy ينسخه تلقائيًا إلى `/etc/nginx/sites-available/muhkampro`.

تفعيل يدوي أول مرة:

```bash
sudo ln -s /etc/nginx/sites-available/muhkampro /etc/nginx/sites-enabled/
sudo nginx -t          # اختبار الصياغة
sudo systemctl reload nginx
```

ملخص ما يفعله الإعداد:
- HTTP (80) → redirect 301 إلى HTTPS.
- HTTPS (443) → proxy إلى `localhost:8080`.
- `client_max_body_size 10M` (متوافق مع حدود الـ API).
- Gzip مفعّل.

### Domain checklist

- [ ] **DNS A record**: `YOUR_DOMAIN` → IP الـ VPS.
- [ ] **DNS A record**: `www.YOUR_DOMAIN` → IP الـ VPS.
- [ ] انتشار DNS: `dig +short YOUR_DOMAIN` يرجع IP الصحيح.
- [ ] `server_name` في `deploy/nginx.conf` مطابق لدومينك.

---

## 8. SSL / HTTPS (certbot)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
sudo certbot renew --dry-run    # تأكيد التجديد التلقائي
```

> مسارات الشهادات في `nginx.conf` تشير إلى `/etc/letsencrypt/live/<domain>/`.
> حدّثها لتطابق دومينك إن لزم.

### Security headers
مطبّقة على طبقتين:
- **التطبيق:** Helmet (HSTS سنة، CSP، nosniff) في `app.ts`.
- **Nginx:** HSTS preload، X-Frame-Options SAMEORIGIN، X-Content-Type-Options.

---

## 9. PM2

```bash
pm2 status                       # حالة العمليات
pm2 logs muhkam-api           # متابعة اللوجز الحية
pm2 logs muhkam-api --lines 100 --nostream
pm2 restart muhkam-api
pm2 save                         # حفظ قائمة العمليات
pm2 startup                      # تفعيل التشغيل عند إقلاع السيرفر
```

---

## 10. Health Check

```bash
curl -fsS https://YOUR_DOMAIN/api/healthz        # سريع (DB ping)
curl -fsS https://YOUR_DOMAIN/api/healthz/deep   # عميق (قراءة/كتابة DB)
```

- `200` = سليم، `503` = غير سليم.
- الـ deploy ينتظر `/api/healthz` حتى 60 ثانية ويفشل مع طباعة اللوجز إن لم يصح.

---

## 11. Preflight قبل الاعتماد

على VPS بعد ضبط `.env`:

```bash
cd /var/www/muhkam-erp
set -a && source .env && set +a
pnpm --filter @workspace/scripts run production:preflight
```

- يفحص وجود/قوة الأسرار دون طباعة قيمها.
- exit code 1 إن كان هناك نقص حرج.

---

## 12. التحقق من النسخ الاحتياطي

- جدولان يعملان تلقائيًا عند الإقلاع:
  - `backup-scheduler` → نسخ JSON مشفّرة (`BACKUP_ENCRYPTION_KEY`) في `BACKUP_DIR`.
  - `db-backup` → نسخ SQL مضغوطة دورية.
- تحقق:

```bash
ls -lh /root/db-backups
pm2 logs muhkam-api | grep -i backup
```

---

## 13. تحذير الاستعادة (Restore)

- الاستعادة عملية **مدمّرة** تكتب فوق بيانات المستأجر.
- نفّذها فقط على نفس المستأجر، وبعد أخذ نسخة احتياطية حديثة.
- استعادة backup مشفّر تتطلب **نفس** `BACKUP_ENCRYPTION_KEY` الذي شُفّر به.

---

## 14. Rollback

```bash
cd /var/www/muhkam-erp

# خيار A — رجوع لآخر commit مستقر
git fetch origin main
git checkout <STABLE_COMMIT_SHA>

# خيار B — عكس آخر commit
git revert <BAD_COMMIT_SHA>

# ثم أعد البناء والتشغيل يدويًا
pnpm install --frozen-lockfile
cd artifacts/erp-system && NODE_ENV=production BASE_PATH=/ VITE_API_URL="" pnpm run build
cd ../api-server && pnpm run build
pm2 restart muhkam-api
```

> الأنظف: ادفع الإصلاح/الـ revert إلى `main` ودع الـ pipeline ينشر تلقائيًا.

---

## 15. إذا فشل CI

- افتح GitHub → Actions → الـ run الفاشل → اقرأ الخطوة الحمراء.
- الـ Deploy **لن يعمل** إلا بعد CI أخضر على `main` (gating عبر `workflow_run`).
- أصلح محليًا، شغّل: `pnpm lint` + الـ typechecks + الاختبارات المعنية، ثم ادفع.

---

## 16. إذا فشل Deploy

- الـ deploy يطبع آخر 50 سطر من `pm2 logs` عند الفشل، وأسماء متغيرات البيئة
  فقط (القيم مُخفّاة `<redacted>` عبر `sed` — لا تُسرَّب الأسرار في CI logs).
- أسباب شائعة: متغير مطلوب ناقص في `.env`، فشل migrate، أو فشل health check.
- على VPS: `pm2 logs muhkam-api --lines 100 --nostream`.
- يمكن إعادة التشغيل اليدوي: GitHub → Actions → Deploy → `Run workflow`
  (`workflow_dispatch` مفعّل).

---

## 17. إذا فُقد BACKUP_ENCRYPTION_KEY

- **كل النسخ الاحتياطية المشفّرة القديمة تصبح غير قابلة للاستعادة نهائيًا.**
- لا يوجد حل استرجاعي — التشفير AES بالمفتاح المفقود.
- الإجراء الوقائي الوحيد: **احفظ المفتاح الآن** في مدير كلمات مرور آمن، ولا
  تغيّره أبدًا بعد أول نسخة احتياطية.
- إن فُقد فعلًا: ولّد مفتاحًا جديدًا، تقبّل فقدان النسخ القديمة، وابدأ دورة نسخ جديدة.
