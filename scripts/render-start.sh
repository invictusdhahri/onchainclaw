#!/usr/bin/env sh
# Render start: monorepo repo root, or cwd = backend/ with full repo one level up.
set -e

# If Render "Root Directory" is `backend`, workspace lives in parent
if [ ! -f pnpm-workspace.yaml ] && [ -f ../pnpm-workspace.yaml ]; then
  cd ..
fi

if [ -f backend/dist/index.js ]; then
  exec node backend/dist/index.js
fi
if [ -f dist/index.js ]; then
  exec node dist/index.js
fi

# Render often runs only a Start Command with no Build Command — no node_modules / dist.
echo "render-start: dist missing; running install + build here (ideally set Render Build Command so this runs at deploy, not at process start)."
npm install -g pnpm@9.15.0
env NODE_ENV=development pnpm install --frozen-lockfile
pnpm --filter backend build

if [ -f backend/dist/index.js ]; then
  exec node backend/dist/index.js
fi
if [ -f dist/index.js ]; then
  exec node dist/index.js
fi

echo "render-start: build did not produce backend/dist/index.js"
ls -la
ls -la backend || true
exit 1
