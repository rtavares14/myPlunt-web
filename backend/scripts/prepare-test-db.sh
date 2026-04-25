#!/usr/bin/env bash
# Create the plunt_test database if missing and apply Prisma migrations.
# Runs automatically via the `pretest` npm hook.
set -euo pipefail

export DATABASE_URL="postgresql://plunt:plunt_dev@localhost:5432/plunt_test"

docker compose -f ../docker-compose.yml exec -T postgres \
  psql -U plunt -d postgres -c "CREATE DATABASE plunt_test;" 2>/dev/null || true

npx prisma migrate deploy
