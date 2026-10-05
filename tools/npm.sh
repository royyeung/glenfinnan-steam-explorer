#!/bin/sh
# Run npm/node inside a throwaway node:22-alpine container (nothing installed on the host).
# Usage: tools/npm.sh ci | tools/npm.sh run build | tools/npm.sh exec -- vitest run
DIR=$(cd "$(dirname "$0")/.." && pwd)
exec docker run --rm --init -u "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_update_notifier=false \
  -v "$DIR":/w -w /w node:22-alpine npm "$@"
