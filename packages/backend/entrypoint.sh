#!/bin/sh
set -e
# Ensure node_modules in the mounted volume has all deps from package.json (fixes missing deps after adding packages)
pnpm install
exec "$@"
