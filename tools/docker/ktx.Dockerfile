# KTX-Software (Khronos) CLI for KTX2/Basis texture encoding. Pinned release.
FROM ubuntu:24.04
ARG KTX_VERSION=4.4.2
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL -o /tmp/ktx.deb https://github.com/KhronosGroup/KTX-Software/releases/download/v${KTX_VERSION}/KTX-Software-${KTX_VERSION}-Linux-x86_64.deb \
 && apt-get install -y --no-install-recommends /tmp/ktx.deb \
 && rm -rf /var/lib/apt/lists/* /tmp/ktx.deb
WORKDIR /w
