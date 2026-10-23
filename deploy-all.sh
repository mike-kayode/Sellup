#!/bin/bash
# deploy-all.sh - extract the uploaded tarball, rebuild, restart, verify.
LOG=/home/toairjsv/deploy.log
exec >> "$LOG" 2>&1
echo "=================================================="
echo "== deploy start $(date '+%F %T') =="
TAR=/home/toairjsv/sellup-deploy-2026-10-10.tar.gz
if [ ! -f "$TAR" ]; then
  echo "[deploy] tarball missing: $TAR"
  exit 2
fi
cd /home/toairjsv/sellup || { echo "[deploy] no app dir"; exit 2; }
echo "[deploy] extracting $(du -h "$TAR" | cut -f1) tarball..."
tar -xzf "$TAR" -C /home/toairjsv/sellup/ || { echo "[deploy] EXTRACT FAILED"; exit 1; }
chmod +x /home/toairjsv/sellup/rebuild.sh /home/toairjsv/sellup/supervise.sh 2>/dev/null
echo "[deploy] running rebuild.sh..."
bash /home/toairjsv/sellup/rebuild.sh
RC=$?
echo "[deploy] rebuild rc=$RC"
echo "== deploy done $(date '+%F %T') =="
exit $RC