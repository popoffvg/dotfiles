# Run Open Canvas in Docker

1. Download the Linux archive and checksum for the engine architecture. Use `linux-arm64` for ARM64 and `linux-x64` for amd64. Keep both release file names beside the Dockerfile. Match the glibc base to the release build environment. [Release assets](https://github.com/utpalsinghdev/open-canvas/releases) · [Release build workflow](https://github.com/utpalsinghdev/open-canvas/blob/main/.github/workflows/package-local.yml)
2. Build and start the container with the commands below. Replace `kiri` with the verified Docker context when necessary. On macOS, Kiri host networking shares the VM network. The TCP relay supports bridge port publishing and preserves the request host and WebSocket traffic. [Kiri networks and ports](https://docs.runkiri.com/docker/network/)
3. Open `http://127.0.0.1:5190` and confirm the workspace chooser loads. The editor requires that exact host and port. Publish the editor on host loopback. Keep the broker on container loopback at port `4790`. [Installed host check](https://github.com/utpalsinghdev/open-canvas/blob/main/scripts/installed-preview.mjs) · [Install instructions](https://github.com/utpalsinghdev/open-canvas/blob/main/docs/install.md)
4. Check the save destination in the workspace chooser. Keep the named volume when replacing the container. For a fresh installation, verify persistence with a disposable workspace across a restart. [Workspace storage](https://github.com/utpalsinghdev/open-canvas/blob/main/docs/local-workspaces.md)

```dockerfile
FROM ubuntu:24.04
RUN apt-get update \
    && apt-get install -y --no-install-recommends libfontconfig1 socat \
    && rm -rf /var/lib/apt/lists/*

ARG TARGETARCH
COPY open-canvas-linux-*.tar.gz* /tmp/open-canvas-release/
RUN set -eu; \
    case "$TARGETARCH" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) exit 1 ;; esac; \
    cd /tmp/open-canvas-release; \
    archive="open-canvas-linux-$arch.tar.gz"; \
    sha256sum -c "$archive.sha256"; \
    mkdir -p /opt/open-canvas; \
    tar -xzf "$archive" -C /opt/open-canvas; \
    /opt/open-canvas/bin/open-canvas --version

RUN useradd --create-home canvas \
    && install -d -m 0700 -o canvas -g canvas /home/canvas/.open-canvas/data
USER canvas
ENV HOME=/home/canvas
CMD ["sh", "-c", "socat TCP4-LISTEN:5191,bind=0.0.0.0,reuseaddr,fork TCP4:127.0.0.1:5190 & exec /opt/open-canvas/bin/open-canvas --no-open"]
```

```sh
docker --context kiri build -t open-canvas:local .
docker --context kiri run -d --init --name open-canvas \
  -p 127.0.0.1:5190:5191 \
  --mount type=volume,source=open-canvas-data,target=/home/canvas/.open-canvas/data \
  open-canvas:local
curl -fsS --retry 10 --retry-all-errors --retry-delay 1 http://127.0.0.1:5190/ -o /dev/null
```

If the host port is occupied, choose an unused app port. Set `CAVAS_APP_PORT` and use that same port in the relay target, host port mapping, and browser URL. Keep the relay listener on its own port. The installed runtime selects a separate workspace directory when either runtime port changes. [Runtime settings](https://github.com/utpalsinghdev/open-canvas/blob/main/scripts/runtime-settings.mjs)
