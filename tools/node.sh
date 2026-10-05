#!/bin/sh
# Run a node script inside node:22-alpine. Usage: tools/node.sh tools/assets/build.mjs
DIR=$(cd "$(dirname "$0")/.." && pwd)
exec docker run --rm --init -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$DIR":/w -w /w node:22-alpine node "$@"
