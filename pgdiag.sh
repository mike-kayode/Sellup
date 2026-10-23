#!/bin/bash
# Why won't local PG start?
echo ==SERVER_LOG==
tail -25 /home/toairjsv/pgdata/server.log 2>/dev/null || echo no-server-log
echo ==PIDFILE==
ls -la /home/toairjsv/pgdata/postmaster.pid 2>/dev/null || echo no-pidfile
echo ==DF==
df -h /home/toairjsv | tail -1
echo ==PIDS_CGROUP==
cat /sys/fs/cgroup/pids/pids.current 2>/dev/null; cat /sys/fs/cgroup/pids/pids.max 2>/dev/null
cat /sys/fs/cgroup/pids.current 2>/dev/null; cat /sys/fs/cgroup/pids.max 2>/dev/null
echo ==MEM==
free -m | head -2
echo ==RETRY_START==
/usr/bin/pg_ctl -D /home/toairjsv/pgdata -l /home/toairjsv/pgdata/server.log start 2>&1
sleep 3
ss -tln | grep ':5433 ' || echo STILL_DOWN
echo ==SERVER_LOG_TAIL==
tail -8 /home/toairjsv/pgdata/server.log 2>/dev/null
