#!/bin/bash
# rebuild.sh - build Sell Up in this folder. Passenger serves the app; this script never starts a server.
#
# Usage (run from the app folder):
#   ./rebuild.sh                 stop the running app, build, restart through Passenger, health check.
#                                If the build fails, the previous build is put back automatically.
#   ./rebuild.sh --install       the same, after running npm install first
#   ./rebuild.sh --build-only    build in THIS folder without touching the live app, for a trial build
#                                in a side folder (does not stop, restart, or health-check anything)
# Environment:
#   HEAP_MB   Node heap limit for the build in MB (default 1536). The old fixed 512 caused
#             "JavaScript heap out of memory" once the app grew.
# Log: ~/rebuild.log
LOG="${REBUILD_LOG:-$HOME/rebuild.log}"
START_LINES=$(wc -l < "$LOG" 2>/dev/null || echo 0)
START_LINES=${START_LINES//[[:space:]]/}
exec >> "$LOG" 2>&1

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR" || exit 1

BUILD_ONLY=0; INSTALL=0
for a in "$@"; do
  case "$a" in
    --build-only) BUILD_ONLY=1 ;;
    --install) INSTALL=1 ;;
  esac
done

HEAP_MB="${HEAP_MB:-1536}"
export PATH=/opt/alt/alt-nodejs24/root/usr/bin:$PATH
export UV_THREADPOOL_SIZE=1
export NODE_OPTIONS="--max-old-space-size=${HEAP_MB} --v8-pool-size=1"
export NEXT_TELEMETRY_DISABLED=1

echo "== rebuild start $(date '+%F %T') in $APP_DIR (heap ${HEAP_MB} MB, build-only=${BUILD_ONLY}) =="

# NEXT_PUBLIC_* values are inlined at build time, so they must be in .env now.
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_APP_URL NEXT_PUBLIC_BASE_DOMAIN NEXT_PUBLIC_STORE_SUBDOMAINS; do
  grep -qE "^$k=.+" .env 2>/dev/null || { echo "[rebuild] ABORT: $k missing or empty in .env"; exit 1; }
done

if [ "$INSTALL" = "1" ]; then
  echo "[rebuild] npm install (with dev deps)..."
  npm install --include=dev --no-audit --no-fund || echo "[rebuild] npm install FAILED (continuing)"
fi

if [ "$BUILD_ONLY" = "0" ]; then
  # Keep the working build so a failed build can be undone.
  if [ -d .next ]; then rm -rf .next.prev; cp -a .next .next.prev; fi
  echo "[rebuild] stopping the running app for the build (site is down until it finishes)"
  pkill -9 -f 'next-server' 2>/dev/null || true
  sleep 2
else
  echo "[rebuild] build-only: the live app is left running"
fi

npm run build
RC=$?
if [ "$RC" -ne 0 ] || [ ! -f .next/BUILD_ID ]; then
  echo "[rebuild] BUILD FAILED (rc=$RC)"
  # Only look at lines written by THIS run (older runs in the log must not trigger a hint).
  RUN_LOG="$(sed -n "$((START_LINES + 1)),\$p" "$LOG")"
  if printf '%s\n' "$RUN_LOG" | grep -qi "heap out of memory"; then
    echo "[rebuild] HINT: the build ran out of memory. Re-run with a higher limit, e.g.  HEAP_MB=2048 ./rebuild.sh"
  else
    echo "[rebuild] first error lines from THIS run:"
    printf '%s\n' "$RUN_LOG" | grep -aE "Error|error:|Module not found|Failed|Unexpected|Expected|rope|Can't resolve|doesn't exist" | head -8 | cut -c1-200
  fi
  if [ "$BUILD_ONLY" = "0" ]; then
    if [ -d .next.prev ]; then
      rm -rf .next && mv .next.prev .next
      echo "[rebuild] previous build restored"
    fi
    mkdir -p tmp && touch tmp/restart.txt
  fi
  exit 1
fi

# Standalone assets must sit next to the standalone server.
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -R .next/static .next/standalone/.next/static || echo "[rebuild] static copy FAILED"
if [ -d .next/server ] && [ -d .next/standalone/.next ]; then
  mkdir -p .next/standalone/.next/server
  cp -R .next/server/. .next/standalone/.next/server/ || echo "[rebuild] server copy FAILED"
  cp -f .env .next/standalone/.env 2>/dev/null || true
fi
if [ -d public ] && [ -d .next/standalone ]; then
  rm -rf .next/standalone/public
  cp -R public .next/standalone/public || echo "[rebuild] public copy FAILED"
fi

# Confirm the public Supabase settings made it into the browser bundle (values are not printed).
U=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env | cut -d= -f2-)
K=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env | cut -d= -f2-)
grep -rlF "$U" .next/static >/dev/null 2>&1 && echo "[rebuild] Supabase URL in browser bundle: YES" || echo "[rebuild] Supabase URL in browser bundle: NO"
grep -rlF "$K" .next/static >/dev/null 2>&1 && echo "[rebuild] anon key in browser bundle: YES" || echo "[rebuild] anon key in browser bundle: NO"

if [ "$BUILD_ONLY" = "1" ]; then
  echo "[rebuild] BUILD OK (trial build; nothing was deployed)"
  echo "== rebuild done $(date '+%F %T') =="
  exit 0
fi

# Let Passenger start a fresh process, then check it through the public URL.
mkdir -p tmp && touch tmp/restart.txt
for i in 1 2 3 4 5 6; do
  H=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://sellup.ng/api/health)
  echo "[rebuild] health=$H"
  [ "$H" = "200" ] && break
  sleep 5
done
echo "== rebuild done $(date '+%F %T') =="
