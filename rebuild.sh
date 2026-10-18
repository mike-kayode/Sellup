#!/bin/bash
# rebuild.sh - rebuild Sell Up in place on the server (LVE fork-safe).
# Run from /home/toairjsv/sellup. Logs to ~/rebuild.log.
LOG=/home/toairjsv/rebuild.log
exec >> "$LOG" 2>&1
echo "=================================================="
echo "== rebuild start $(date '+%F %T') =="

cd /home/toairjsv/sellup || { echo "[rebuild] cannot cd"; exit 1; }
export PATH=/opt/alt/alt-nodejs24/root/usr/bin:$PATH
export UV_THREADPOOL_SIZE=1
export NODE_OPTIONS="--max-old-space-size=512 --v8-pool-size=1"
export NEXT_TELEMETRY_DISABLED=1

# --- Subdomain flag: ON only when wildcard DNS AND TLS actually serve --------
# DNS alone is NOT enough: cPanel answers *.sellup.ng SNI with the default
# vhost's cert (*.abmosdatasub.com.ng) and returns 400 until TrueHost attaches
# the wildcard cert to a catch-all vhost. Strict curl (no -k) fails on that
# wrong cert (code 000) -> keeps path-style URLs, which always work.
PROBE="probe$RANDOM$RANDOM.sellup.ng"
PROBE_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://$PROBE/" 2>/dev/null || echo 000)
if getent hosts "$PROBE" >/dev/null 2>&1 && [ "$PROBE_CODE" != "000" ]; then
  if grep -q '^NEXT_PUBLIC_STORE_SUBDOMAINS=' .env; then
    sed -i 's/^NEXT_PUBLIC_STORE_SUBDOMAINS=.*/NEXT_PUBLIC_STORE_SUBDOMAINS=true/' .env
  else
    echo 'NEXT_PUBLIC_STORE_SUBDOMAINS=true' >> .env
  fi
  echo "[rebuild] wildcard DNS + TLS OK (probe=$PROBE code=$PROBE_CODE) -> store subdomains ON"
else
  if grep -q '^NEXT_PUBLIC_STORE_SUBDOMAINS=' .env; then
    sed -i 's/^NEXT_PUBLIC_STORE_SUBDOMAINS=.*/NEXT_PUBLIC_STORE_SUBDOMAINS=false/' .env
  else
    echo 'NEXT_PUBLIC_STORE_SUBDOMAINS=false' >> .env
  fi
  echo "[rebuild] wildcard DNS/TLS NOT serving (probe=$PROBE code=$PROBE_CODE) -> subdomains OFF (path-style URLs)"
fi

# --- Optional dependency install: ./rebuild.sh --install ------------------
if [ "$1" = "--install" ]; then
  # Full install (devDependencies included): `next build` needs typescript,
  # tailwind and @tailwindcss/postcss — `--omit=dev` prunes them and the
  # build fails with a PostCSS transform error on globals.css.
  echo "[rebuild] npm install..."
  npm install --include=dev --no-audit --no-fund || echo "[rebuild] npm install FAILED (continuing)"
fi

# --- Postgres stays up during the build (a park/restore cycle previously
#     left a stale lock; builds succeed with PG running at this cap) -------
restore_pg() { :; }

# --- Stop the app for the build. Builds SIGABRT (rc=134) when the running
#     next-server competes with webpack for the cgroup's memory/pid budget
#     — killing it first is the proven recipe on this host. ----------------
echo "[rebuild] stopping next-server for the build"
pkill -9 -f 'next-server' 2>/dev/null || true
sleep 2

# --- Build (no taskset - cgroup pinning caused SIGABRT on this host) ------
npm run build
BUILD_RC=$?
restore_pg
if [ "$BUILD_RC" -ne 0 ]; then
  echo "[rebuild] BUILD FAILED (rc=$BUILD_RC) - app left running the old build"
  exit 1
fi

# --- Standalone assets must be copied next to the standalone server -------
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -R .next/static .next/standalone/.next/static || echo "[rebuild] static copy FAILED"
# In-place rebuilds can leave the standalone tree without the fresh server
# output (prerendered pages + manifests) and with a stale .env copy — every
# static route then 404s while /api routes and proxy redirects still work.
if [ -d .next/server ] && [ -d .next/standalone/.next ]; then
  mkdir -p .next/standalone/.next/server
  cp -R .next/server/. .next/standalone/.next/server/ || echo "[rebuild] server copy FAILED"
  cp -f .env .next/standalone/.env 2>/dev/null || true
fi
if [ -d public ] && [ -d .next/standalone ]; then
  rm -rf .next/standalone/public
  cp -R public .next/standalone/public || echo "[rebuild] public copy FAILED"
fi

# --- Restart the app (fresh process picks up new build + env) -------------
echo "[rebuild] restarting next-server"
pkill -9 -f 'next-server' 2>/dev/null || true
sleep 2
nohup env PORT=8080 UV_THREADPOOL_SIZE=1 NODE_OPTIONS="--max-old-space-size=768 --v8-pool-size=1" \
  /opt/alt/alt-nodejs24/root/usr/bin/node server.js >> /home/toairjsv/app.log 2>&1 &
# Make sure the long-term keeper is alive too (PG + app watchdog).
if ! pgrep -f supervise.sh >/dev/null 2>&1; then
  nohup bash /home/toairjsv/supervise.sh >/dev/null 2>&1 &
fi

# --- Wait for the port, then verify ---------------------------------------
for i in $(seq 1 40); do
  if (exec 7<>/dev/tcp/127.0.0.1/8080) 2>/dev/null; then
    exec 7>&- 7<&-
    break
  fi
  sleep 3
done
sleep 3
HCODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/api/health || echo fail)
echo "[rebuild] health=$HCODE"
if [ "$HCODE" != "200" ]; then
  sleep 15
  HCODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/api/health || echo fail)
  echo "[rebuild] health retry=$HCODE"
fi
echo "== rebuild done $(date '+%F %T') =="