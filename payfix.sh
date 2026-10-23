#!/bin/bash
# deploy settings-page fix: ship file, ensure app URL env, rebuild, restart, verify
export PATH=/opt/alt/alt-nodejs24/root/usr/bin:$PATH
cd /home/toairjsv/sellup || exit 1
echo "=== PAYFIX START $(date '+%F %T') ==="

echo "--- NEXT_PUBLIC_APP_URL check ---"
if grep -q '^NEXT_PUBLIC_APP_URL=' .env; then
  grep '^NEXT_PUBLIC_APP_URL=' .env | sed 's/=.*/=<set>/'
else
  echo 'NEXT_PUBLIC_APP_URL=https://sellup.ng' >> .env
  echo "appended NEXT_PUBLIC_APP_URL=https://sellup.ng"
fi

echo "--- rebuild (includes static copy + capped flags) ---"
bash /home/toairjsv/rebuild.sh 2>&1 | tail -22

echo "--- restart with fresh build (kill by real title) ---"
pkill -9 -f 'next-server' || true
sleep 4
for i in 1 2 3 4 5 6 7 8; do
  ss -tln 2>/dev/null | grep -q ':8080 ' && break
  sleep 2
done
sleep 2

echo "--- verify ---"
curl -s -o /dev/null -w 'health=%{http_code}\n' --max-time 10 http://127.0.0.1:8080/api/health
CSS=$(curl -s --max-time 10 http://127.0.0.1:8080/ | grep -oE '/_next/static/chunks/[A-Za-z0-9._~-]+\.css' | head -1)
curl -s -o /dev/null -w "css=%{http_code}\n" --max-time 10 "http://127.0.0.1:8080$CSS"
echo "--- new provider mapping in bundle? ---"
grep -rl 'provider:"paystack"' /home/toairjsv/sellup/.next/static/chunks/ 2>/dev/null | head -2
grep -rl 'paymentMethod=="paystack"?"paystack":"flutterwave"' /home/toairjsv/sellup/.next/static/chunks/ 2>/dev/null | head -2 || echo OLD_MAPPING_GONE
echo "=== PAYFIX DONE $(date '+%F %T') ==="
