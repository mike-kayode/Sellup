#!/bin/bash
# What is eating the process/thread quota?
echo ==ULIMIT==
echo "nproc_per_user=$(ulimit -u)"
echo ==MY_PROCS_AND_THREADS==
ps -u toairjsv -o pid,nlwp,args --no-headers | head -60
echo ==SUM_NLWP==
ps -u toairjsv -o nlwp --no-headers | awk '{s+=$1} END {print "total_threads="s}'
echo ==PROC_COUNT==
ps -u toairjsv --no-headers | wc -l
echo ==CGROUP==
cat /proc/self/cgroup | grep -i pids || echo no-pids-cgroup
