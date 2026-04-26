#!/bin/bash
set -e

APP_DIR="/var/www/muhkam-erp"
cd "$APP_DIR"

# تحميل متغيرات البيئة
if [ -f "$APP_DIR/.env" ]; then
  set -a
  source "$APP_DIR/.env"
  set +a
fi

echo "=== [1/6] سحب آخر تحديثات من GitHub ==="
git fetch origin main
git reset --hard origin/main
git clean -fd

echo "=== [2/6] تثبيت الحزم ==="
pnpm install

echo "=== [3/6] رفع تغييرات قاعدة البيانات ==="
cd "$APP_DIR/lib/db"
pnpm run push-force

echo "=== [4/6] بناء الـ Backend ==="
cd "$APP_DIR"
pnpm --filter @workspace/api-server run build

echo "=== [5/6] بناء الـ Frontend (erp-system) ==="
cd "$APP_DIR"
NODE_ENV=production BASE_PATH=/ VITE_API_URL="" \
  pnpm --filter @workspace/erp-system run build

echo "=== [6/6] إعادة تشغيل الـ Backend ==="
pm2 restart halaltech-api --update-env

echo "--- انتظار تشغيل الـ API (حد أقصى 60 ثانية) ---"
MAX=24
i=0
until curl -sf http://localhost:3000/api/healthz > /dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge "$MAX" ]; then
    echo "فشل التشغيل — آخر لوجز:"
    pm2 logs halaltech-api --lines 30 --nostream || true
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
