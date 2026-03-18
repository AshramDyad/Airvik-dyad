#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Dumping production schema..."
npx supabase db dump -f supabase/migrations/00000000000000_baseline.sql --linked

if [[ "${1:-}" != "--schema-only" ]]; then
  echo "==> Dumping production data..."
  npx supabase db dump --data-only -f supabase/seed.sql --linked
fi

echo "==> Resetting local database..."
npx supabase db reset

echo "==> Done. Local database mirrors production."
