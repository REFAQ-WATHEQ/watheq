#!/usr/bin/env bash
set -euo pipefail
# Disposable loopback-only cluster. Never accepts a production database URL.
for tool in initdb pg_ctl psql createdb setpriv nix bun; do command -v "$tool" >/dev/null || { printf 'Missing test tool: %s\n' "$tool"; exit 1; }; done
if psql -h 127.0.0.1 -p 55439 -U postgres -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
 printf 'Port 55439 is already occupied; stop the disposable test cluster first.\n'; exit 1
fi
stage=$(mktemp -d /tmp/wathiq-bootstrap.XXXXXX)
owner=$(id -u)
group=$(id -g)
if [ "$owner" = 0 ]; then owner=1000; group=1000; chown "$owner:$group" "$stage"; fi
run_pg() { if [ "$(id -u)" = 0 ]; then setpriv --reuid="$owner" --regid="$group" --clear-groups "$@"; else "$@"; fi; }
cleanup() { run_pg pg_ctl -D "$stage/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$stage"; }
trap cleanup EXIT
run_pg initdb -D "$stage/data" -A trust -U postgres > "$stage/init.log"
run_pg pg_ctl -D "$stage/data" -l "$stage/server.log" -o "-p 55439 -k $stage -h 127.0.0.1" start
WATHIQ_LOCAL_DB_TESTS=1 bunx vitest run src/test/bootstrap-database.test.ts
