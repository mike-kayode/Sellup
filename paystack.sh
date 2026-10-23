#!/bin/bash
# Set Paystack live keys in remote .env and restart the app to pick them up.
cd /home/toairjsv/sellup || exit 1
sed -i 's/^PAYSTACK_SECRET_KEY=.*/PAYSTACK_SECRET_KEY=sk_live_c8e5353bac9f000bf19818360f357846149c9393/' .env
sed -i 's/^PAYSTACK_PUBLIC_KEY=.*/PAYSTACK_PUBLIC_KEY=pk_live_70f139864cfe992e6a4f202c7d6c671aeb983122/' .env
echo ==ENV_AFTER==
grep '^PAYSTACK' .env
echo ==RESTART==
PID=$(ss -tlnp | grep ':8080 ' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
echo "old_app_pid=$PID"
[ -n "$PID" ] && kill "$PID" && echo killed
sleep 15
echo ==AFTER==
ss -tln | grep ':8080 ' || echo NOT_BACK_YET
curl -s http://127.0.0.1:8080/api/health; echo
tail -4 /home/toairjsv/portwatch.log
