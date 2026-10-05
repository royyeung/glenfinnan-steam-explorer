#!/bin/sh
# Fetch CC0 textures and encode them to KTX2 (Basis ETC1S for colour/roughness, UASTC+zstd for normals).
set -e
DIR=$(cd "$(dirname "$0")/../.." && pwd); cd "$DIR"
U="-u $(id -u):$(id -g)"
docker run --rm $U -e HOME=/tmp -v "$DIR":/w -w /w python:3.12-slim sh -c "pip -q install --user pillow >/dev/null 2>&1; python tools/textures/fetch.py"
enc() { # id map out kind
  case $4 in
    color) A="--format R8G8B8_SRGB --assign-tf srgb --encode basis-lz --clevel 2 --qlevel 160";;
    normal) A="--format R8G8B8_UNORM --assign-tf linear --encode uastc --uastc-quality 2 --zstd 18 --normal-mode";;
    data) A="--format R8G8B8_UNORM --assign-tf linear --encode basis-lz --clevel 2 --qlevel 140";;
  esac
  docker run --rm $U -v "$DIR":/w -w /w glenfinnan-ktx:4.4.2 ktx create $A --generate-mipmap "data/cc0/$1/$2.png" "public/textures/$3.ktx2"
  echo "$3.ktx2 $(stat -c %s public/textures/$3.ktx2) bytes"
}
enc gravel_stones Diffuse ballast_color color; enc gravel_stones nor_gl ballast_normal normal; enc gravel_stones Rough ballast_rough data
enc aerial_grass_rock Diffuse ground_color color; enc aerial_grass_rock nor_gl ground_normal normal; enc aerial_grass_rock Rough ground_rough data
