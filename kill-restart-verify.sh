#!/bin/bash
# kill by REAL process title (next-server), let watch2 restart, verify statics
cd /home/toairjsv/sellup || exit 1
echo "== before =="
ss -tlnp 2>/dev/null | grep ':8080 ' | head -1
pkill -9 -f 'next-server' && echo KILLED_NEXT_SERVER || echo NO_MATCH
sleep 4
for i in 1 2 3 4 5 6 7 8; do
  ss -tln 2>/dev/null | grep -q ':8080 ' && break
  sleep 2
done
sleep 2
echo "== after =="
tail -1 /home/toairjsv/sellup/launcher-debug.log
pgrep -af 'next-server' | head -2
echo "== verify =="
CSS=$(curl -s --max-time 10 http://127.0.0.1:8080/ | grep -oE '/_next/static/chunks/[A-Za-z0-9._~-]+\.css' | head -1)
curl -s -o /dev/null -w "css=$CSS -> %{http_code} %{content_type} %{size_download}\n" --max-time 10 "http://127.0.0.1:8080$CSS"
JS=$(curl -s --max-time 10 http://127.0.0.1:8080/ | grep -oE '/_next/static/chunks/[A-Za-z0-9._~-]+\.js' | head -1)
curl -s -o /dev/null -w "js=$JS -> %{http_code} %{size_download}\n" --max-time 10 "http://127.0.0.1:8080$JS"
H=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:8080/api/health)
echo "health=$H"
echo "== DONE =="
