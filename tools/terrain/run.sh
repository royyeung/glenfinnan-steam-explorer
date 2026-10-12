#!/bin/sh
# Build public/terrain/ from OS OpenData in data/os (Docker: python with numpy, pyshp, pillow).
DIR=$(cd "$(dirname "$0")/../.." && pwd)
exec docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$DIR":/w -w /w python:3.12-slim \
  sh -c "pip -q install --disable-pip-version-check --target /tmp/pp numpy==2.2.6 pyshp==2.3.1 pillow==11.2.1 >/dev/null 2>&1 && PYTHONPATH=/tmp/pp python tools/terrain/build.py $*"
