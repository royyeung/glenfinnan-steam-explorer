#!/bin/sh
# Run a harness script inside the Playwright container (nothing installed on the host).
# Usage: tools/run.sh shoot.mjs <stage> [options]   (first time: tools/run.sh --install)
DIR=$(cd "$(dirname "$0")/.." && pwd)
IMG=mcr.microsoft.com/playwright:v1.49.1-noble
if [ "$1" = "--install" ]; then
  exec docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$DIR/tools/harness":/w -w /w $IMG npm install --no-audit --no-fund
fi
SCRIPT=$1; shift
exec docker run --rm --init -u "$(id -u):$(id -g)" -e HOME=/tmp --ipc=host \
  -v "$DIR":/w -w /w $IMG node "tools/harness/$SCRIPT" "$@"
