#!/usr/bin/env bash
# Usage: ./run-tests.sh <psql connection args>   e.g.  ./run-tests.sh -h /path/to/socket -p 54329 -U me
# Creates a scratch database, applies a Supabase stand-in + schema.sql, runs the security tests.
set -euo pipefail
cd "$(dirname "$0")"
P="psql $* -q -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists cosmy_test" -c "create database cosmy_test"
$P -d cosmy_test -f tests/supabase_sim.sql
$P -d cosmy_test -f schema.sql
$P -d cosmy_test -f schema.sql   # idempotency check
$P -d cosmy_test -f tests/security_test.sql | grep -E "FAIL|passed|^ +[0-9]+ +\|" || true
