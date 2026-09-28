# Build context is this directory (backend/), not the repository root: the app is imported as the
# `app` package from /app, and only this directory has a pip requirements.txt.

# --- builder -------------------------------------------------------------------------------------
# Produces the finished environment. The compiler toolchain is installed here and never shipped, so
# it cannot end up in a running server. Nothing in requirements.txt currently compiles (binary wheels
# throughout), but the toolchain is the fallback for a platform that has no wheel, and it is cheap
# here precisely because this layer is thrown away.
FROM python:slim AS builder

# Empty by default: the build then uses the base image's own Debian sources and cannot be broken by a
# mirror that is slow, moved down or blocked elsewhere. Opt in only where that is a real problem:
#   docker build --build-arg DEBIAN_MIRROR=http://deb.debian.org/debian/ .
ARG DEBIAN_MIRROR=
ENV DEBIAN_FRONTEND=noninteractive
# The stock trixie images keep their repositories in a deb822 file, so replacing only sources.list
# would leave the mirror as an extra source next to the originals rather than a replacement.
RUN if [ -n "$DEBIAN_MIRROR" ]; then \
        rm -f /etc/apt/sources.list.d/*.sources /etc/apt/sources.list.d/*.list; \
        echo "deb ${DEBIAN_MIRROR} trixie main contrib non-free" > /etc/apt/sources.list; \
        echo "deb ${DEBIAN_MIRROR} trixie-updates main contrib non-free" >> /etc/apt/sources.list; \
    fi \
 && apt-get update \
 && apt-get install -y -o APT::Install-Recommends=false gcc g++ libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# The same absolute path in both stages: a venv stores absolute paths and does not survive being moved.
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN python3 -m venv $VIRTUAL_ENV

WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -U pip uv
# Plain, pinned-by-requirements install. No --pre/--prerelease: prereleases of every dependency
# belong on a developer's machine, not in an image a server runs.
RUN uv pip install --no-cache-dir -r requirements.txt

# --- runtime -------------------------------------------------------------------------------------
FROM python:slim AS runtime

ARG TZ=Europe/Moscow
ENV TZ=$TZ
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Only the finished environment crosses over; the toolchain and the apt lists stay in the builder.
COPY --from=builder /opt/venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Unprivileged: nothing here needs to write outside /app, and a container escape should not start
# from root.
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin app \
 && install -d -o app -g app /app
WORKDIR /app
COPY --chown=app:app . .
USER app

EXPOSE 8000

# Liveness only, deliberately: /health touches no database, LLM or telephony (app/health.py), so a
# dependency outage does not get the container restarted. urllib rather than curl - there is no curl
# in this image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT', '8000'), timeout=4)"

# uvicorn, not `python app/main.py`: main.py exposes an ASGI object and is not a script.
# sh -c is what expands ${PORT} (a PaaS injects it at run time, not at build time), and exec replaces
# that shell with uvicorn so uvicorn itself is PID 1 and receives the SIGTERM it needs to drain
# calls and shut down inside the stop timeout.
ENTRYPOINT ["sh", "-c"]
CMD ["exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
