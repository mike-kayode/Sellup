#!/bin/bash
# cronfix.sh - install self-healing cron, ensure Postgres + supervisor now.
LOG=/home/toairjsv/cronfix.log
exec >> "$LOG" 2>&1
echo "=================================================="
echo "== cronfix $(date '+%F %T') =="

PGCTL=/usr/bin/pg_ctl
[ -x "$PGCTL" ] || PGCTL=$(command -v pg_ctl || true)
[ -n "$PGCTL" ] || PGCTL=/home/toairjsv/postgres/install/bin/pg_ctl

# 1. Start Postgres right now if it is down
if ! "$PGCTL" -D /home/toairjsv/pgdata status >/dev/null 2>&1; then
  echo "[cronfix] postgres down - starting"
  "$PGCTL" -D /home/toairjsv/pgdata -l /home/toairjsv/pgdata/server.log start || echo "[cronfix] pg start FAILED"
else
  echo "[cronfix] postgres already up"
fi

# 2. Install the watchdog crontab (replaces previous content, idempotent)
crontab - <<'EOF'
@reboot export PATH="/home/toairjsv/postgres/install/bin:$PATH"; pg_ctl -D /home/toairjsv/pgdata status >/dev/null 2>&1 || pg_ctl -D /home/toairjsv/pgdata -l /home/toairjsv/pgdata/server.log start >/dev/null 2>&1
@reboot nohup bash /home/toairjsv/supervise.sh >/dev/null 2>&1 &
* * * * * export PATH="/home/toairjsv/postgres/install/bin:$PATH"; pg_ctl -D /home/toairjsv/pgdata status >/dev/null 2>&1 || pg_ctl -D /home/toairjsv/pgdata -l /home/toairjsv/pgdata/server.log start >/dev/null 2>&1
* * * * * pgrep -f supervise.sh >/dev/null 2>&1 || nohup bash /home/toairjsv/supervise.sh >/dev/null 2>&1 &
* * * * * date > /home/toairjsv/cron.alive
EOF
echo "[cronfix] crontab lines: $(crontab -l 2>/dev/null | wc -l)"

# 3. Start the supervisor (keeps PG + app alive every 10s) if not running
if ! pgrep -f supervise.sh >/dev/null 2>&1; then
  echo "[cronfix] starting supervise.sh"
  nohup bash /home/toairjsv/supervise.sh >/dev/null 2>&1 &
fi

sleep 3
HC=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/api/health || echo fail)
echo "[cronfix] health=$HC"
echo "== cronfix done $(date '+%F %T') =="