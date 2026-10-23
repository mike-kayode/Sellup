#!/bin/bash
# chain-deploy.sh - part 1: cron/postgres/supervisor; part 2: extract+rebuild.
# Part 2 only runs if the tarball is present (part 1 is always safe).
OUT=/home/toairjsv/deploy.log
exec >> "$OUT" 2>&1
echo "=================================================="
echo "== chain-deploy $(date '+%F %T') =="

# --- part 1: self-healing infra -------------------------------------------
PGCTL=/usr/bin/pg_ctl
[ -x "$PGCTL" ] || PGCTL=$(command -v pg_ctl || true)
if ! "$PGCTL" -D /home/toairjsv/pgdata status >/dev/null 2>&1; then
  echo "[1] postgres DOWN - starting"
  "$PGCTL" -D /home/toairjsv/pgdata -l /home/toairjsv/pgdata/server.log start || echo "[1] pg start FAILED"
else
  echo "[1] postgres up"
fi

crontab - <<'EOF'
@reboot export PATH="/home/toairjsv/postgres/install/bin:$PATH"; pg_ctl -D /home/toairjsv/pgdata status >/dev/null 2>&1 || pg_ctl -D /home/toairjsv/pgdata -l /home/toairjsv/pgdata/server.log start >/dev/null 2>&1
@reboot nohup bash /home/toairjsv/supervise.sh >/dev/null 2>&1 &
* * * * * export PATH="/home/toairjsv/postgres/install/bin:$PATH"; pg_ctl -D /home/toairjsv/pgdata status >/dev/null 2>&1 || pg_ctl -D /home/toairjsv/pgdata -l /home/toairjsv/pgdata/server.log start >/dev/null 2>&1
* * * * * pgrep -f supervise.sh >/dev/null 2>&1 || nohup bash /home/toairjsv/supervise.sh >/dev/null 2>&1 &
* * * * * date > /home/toairjsv/cron.alive
EOF
echo "[1] crontab lines: $(crontab -l 2>/dev/null | wc -l)"

if ! pgrep -f supervise.sh >/dev/null 2>&1; then
  echo "[1] starting supervise.sh"
  nohup bash /home/toairjsv/supervise.sh >/dev/null 2>&1 &
fi

HC1=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/api/health || echo fail)
echo "[1] health=$HC1"

# --- part 2: extract + rebuild (only when the tarball has arrived) --------
TAR=/home/toairjsv/sellup-deploy-2026-10-10.tar.gz
if [ ! -f "$TAR" ]; then
  echo "[2] tarball not uploaded yet - infra only"
  echo "== chain-deploy done (infra only) $(date '+%F %T') =="
  exit 0
fi

cd /home/toairjsv/sellup || { echo "[2] no app dir"; exit 2; }
echo "[2] extracting $(du -h "$TAR" | cut -f1) tarball..."
tar -xzf "$TAR" -C /home/toairjsv/sellup/ || { echo "[2] EXTRACT FAILED"; exit 1; }
chmod +x /home/toairjsv/sellup/rebuild.sh /home/toairjsv/sellup/supervise.sh 2>/dev/null
echo "[2] rebuild..."
bash /home/toairjsv/sellup/rebuild.sh
RC=$?
echo "[2] rebuild rc=$RC"
echo "== chain-deploy done rc=$RC $(date '+%F %T') =="
exit $RC