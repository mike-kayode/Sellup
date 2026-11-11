# Database backup restore procedure

Backups created by the admin backup job use PostgreSQL custom format. Restore is
an operator-controlled procedure; the dashboard intentionally has no one-click
restore action.

## Before restoring

1. Confirm the backup is marked `completed` in the admin dashboard and download
   it using the signed link. The download link expires after five minutes.
2. Keep the downloaded file outside the web root and restrict access to it.
3. Use a separate, empty recovery database first. Do not point the initial
   restore at the live database.
4. Confirm the PostgreSQL client tools are compatible with the database server.

## Validate and restore to recovery

```sh
pg_restore --list /secure/path/backup.dump
pg_restore --no-owner --no-privileges --single-transaction \
  --dbname="$RECOVERY_DATABASE_URL" /secure/path/backup.dump
```

`RECOVERY_DATABASE_URL` must be supplied in the operator's protected shell
environment and must refer to the recovery database, not production. Do not put
database credentials in shell history or this repository.

Verify the restored schema and representative records using the normal
application checks against the recovery database. Confirm extensions, roles,
storage objects, and any external services that are not included in a database
dump.

## Production recovery

Production recovery requires an approved maintenance window and a separate,
verified copy of the current production database. Coordinate the final cutover
with the database host. Do not use `drizzle-kit push` or run destructive
`pg_restore --clean` operations against production as part of this procedure.
If the hosting provider does not permit direct PostgreSQL restore, use its
supported restore workflow.
