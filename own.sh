#!/bin/bash
echo ==PORT_OWNERS==
ss -tlnp | grep -E ':(3000|8080) '
echo ==FOUR_PROCS==
ps -p 3460972,3771131,3771174,4194118 -o pid,lstart,etime,args --no-headers 2>/dev/null
echo ==CWD==
for p in 3460972 3771131 3771174 4194118; do echo -n "$p -> "; readlink /proc/$p/cwd 2>/dev/null || echo gone; done
echo ==LVE_PIDS==
cat /sys/fs/cgroup/pids/lvp1002/lve1140/pids.current 2>/dev/null || echo no-current
cat /sys/fs/cgroup/pids/lvp1002/lve1140/pids.max 2>/dev/null || echo no-max
