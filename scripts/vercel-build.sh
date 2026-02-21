#!/usr/bin/env bash
set -euo pipefail

npx prisma generate

# Strip accidental "VAR_NAME=" prefixes that can creep in from
# copy-paste errors when setting env vars in dashboards.
sanitize_url() {
  local raw="$1"
  # Remove any leading KEY= prefix (e.g. "DIRECT_URL=postgresql://...")
  local cleaned="${raw#*=postgresql://}"
  if [[ "$cleaned" != "$raw" ]]; then
    cleaned="postgresql://${cleaned}"
  fi
  # Validate it looks like a postgres URL
  if [[ "$cleaned" =~ ^postgres(ql)?:// ]]; then
    echo "$cleaned"
  else
    echo ""
  fi
}

# Prefer non-pooling URL for schema push (DDL needs direct connection)
RAW_URL="${POSTGRES_URL_NON_POOLING:-${DIRECT_URL:-${POSTGRES_PRISMA_URL:-${DATABASE_URL:-}}}}"
DB_PUSH_URL="$(sanitize_url "$RAW_URL")"

if [[ -z "$DB_PUSH_URL" ]]; then
  echo "WARNING: No valid database URL found for prisma db push" >&2
  echo "  RAW_URL value (first 40 chars): ${RAW_URL:0:40}..." >&2
  echo "  Checked: POSTGRES_URL_NON_POOLING, DIRECT_URL, POSTGRES_PRISMA_URL, DATABASE_URL" >&2
  echo "  Skipping schema push — tables must exist already" >&2
else
  echo "Running prisma db push (source: ${DB_PUSH_URL%%@*}@...)" >&2
  if PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 \
     DATABASE_URL="$DB_PUSH_URL" \
     DIRECT_URL="$DB_PUSH_URL" \
     npx prisma db push --skip-generate; then
    echo "Schema push succeeded" >&2
  else
    echo "WARNING: prisma db push failed (tables may already exist) — continuing build" >&2
  fi
fi

next build
