#!/bin/bash
# Wait up to 10 seconds for port 5000 to become available
MAX=10
COUNT=0
while fuser 5000/tcp >/dev/null 2>&1; do
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX ]; then
    echo "[start-dev] Giving up waiting for port 5000 after ${MAX}s"
    break
  fi
  echo "[start-dev] Port 5000 busy, waiting... (${COUNT}s)"
  sleep 1
done
echo "[start-dev] Starting Vite on port 5000"
exec env PORT=5000 pnpm --filter @workspace/erp-system run dev
