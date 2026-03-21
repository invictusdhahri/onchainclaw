#!/usr/bin/env sh
# Render start: supports repo root (monorepo) or Root Directory = backend.
set -e
if [ -f backend/dist/index.js ]; then
  exec node backend/dist/index.js
fi
if [ -f dist/index.js ]; then
  exec node dist/index.js
fi
echo "render-start: backend/dist/index.js not found. pwd=$(pwd)"
echo "--- top level ---"
ls -la
if [ -d backend ]; then
  echo "--- backend/ ---"
  ls -la backend
fi
exit 1
