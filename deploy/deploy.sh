#!/bin/bash
set -e

APP_DIR="/var/www/muhkam-erp"
cd "$APP_DIR"

# ── المرحلة الأولى: git pull ثم إعادة تشغيل السكريبت من الملف الجديد ──────
# هذه الحيلة تضمن أن باقي الخطوات تقرأ من النسخة المحدَّثة وليس من الذاكرة
if [ "${1}" != "--deployed" ]; then
  echo "=== [0] سحب آخر تحديثات من GitHub ==="
  git fetch origin main
  git reset --hard origin/main
  git clean -fd
  echo "=== إعادة تشغيل السكريبت من النسخة الجديدة ==="
  exec bash "$APP_DIR/deploy/deploy.sh" --deployed
fi

# ── من هنا يعمل السكريبت الجديد بعد التحديث ───────────────────────────────

# تحميل متغيرات البيئة
if [ -f "$APP_DIR/.env" ]; then
  set -a
  source "$APP_DIR/.env"
  set +a
fi

echo "=== [1/5] تثبيت الحزم ==="
pnpm install

echo "=== [2/5] رفع تغييرات قاعدة البيانات ==="
cd "$APP_DIR/lib/db"
pnpm run push-force

echo "=== [3/5] بناء الـ Backend ==="
cd "$APP_DIR"
pnpm --filter @workspace/api-server run build

echo "=== [4/5] بناء الـ Frontend ==="
cd "$APP_DIR"
NODE_ENV=production BASE_PATH=/ VITE_API_URL="" VITE_SENTRY_DSN="${SENTRY_DSN:-}" \
  pnpm --filter @workspace/erp-system run build

echo "=== [5/5] إعادة تشغيل الـ Backend ==="
pm2 restart muhkam-api --update-env

echo "--- انتظار تشغيل الـ API (حد أقصى 60 ثانية) ---"
MAX=24
i=0
until curl -sf http://localhost:8080/api/healthz > /dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge "$MAX" ]; then
    echo "فشل التشغيل — آخر لوجز:"
    pm2 logs muhkam-api --lines 30 --nostream || true
    exit 1
  fi
  sleep 2.5
done

echo ""
echo "✅ النشر اكتمل بنجاح!"
DOMAIN=$(grep -oP 'ALLOWED_ORIGINS=https?://\K[^,\s]+' .env 2>/dev/null | head -1 || echo "localhost")
echo "   الموقع: https://${DOMAIN}/"
echo ""
pm2 status
