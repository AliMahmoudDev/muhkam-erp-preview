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

echo "=== [1/7] سحب آخر تحديثات من GitHub ==="
git fetch origin main
git reset --hard origin/main
git clean -fd

echo "=== [2/7] تثبيت الحزم ==="
pnpm install

echo "=== [3/7] رفع تغييرات قاعدة البيانات ==="
cd "$APP_DIR/lib/db"
pnpm run push

echo "=== [4/7] بناء الـ Backend ==="
cd "$APP_DIR"
pnpm --filter @workspace/api-server run build

echo "=== [5/7] بناء MUHKAM ULTIMATE (النسخة الكاملة) ==="
cd "$APP_DIR"
PORT=3000 BASE_PATH=/ NODE_ENV=production \
  pnpm --filter @workspace/erp-system run build

echo "=== [6/7] بناء MUHKAM ADVANCED (النسخة المبسطة) ==="
cd "$APP_DIR"
PORT=3000 BASE_PATH=/muhkam-base/ NODE_ENV=production \
  pnpm --filter @workspace/muhkam-base run build

echo "=== [7/7] إعادة تشغيل الـ Backend ==="
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
echo "   ULTIMATE : https://$(grep ALLOWED_ORIGINS .env | cut -d= -f2 | sed 's|https://||')/"
echo "   ADVANCED : https://$(grep ALLOWED_ORIGINS .env | cut -d= -f2 | sed 's|https://||')/muhkam-base/"
echo ""
pm2 status
