# Build context is this directory (frontend/), not the repository root: this is a
# standalone npm project, and only this directory has a package.json.
#
# One image carries two things, because they have to answer on one origin: the built
# site, which is static, and POST /api/livekit/token, which is server-side because it
# holds the LiveKit secret. server/serve.js is the single process that serves both.

# --- builder -------------------------------------------------------------------------------------
FROM node:24-slim AS builder

WORKDIR /app

# Manifest and lockfile alone, so an edit to a component does not reinstall the tree.
COPY package.json package-lock.json ./
RUN npm ci

# Exactly what the build reads. server/ is not optional: vite.config.js imports the
# token endpoint from it, so a build that succeeds has also proven the endpoint loads.
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
COPY server ./server

# There is no secret here and no way to put one in: every LIVEKIT_* variable is read
# from the environment at request time (server/livekitToken.js), and Vite only ever
# writes VITE_-prefixed values into a bundle. The single build-time knob is the
# documented cross-origin one, and an operator who leaves it empty - the default - gets
# the relative path this image's own token endpoint answers.
ARG VITE_LIVEKIT_TOKEN_ENDPOINT=
ENV VITE_LIVEKIT_TOKEN_ENDPOINT=$VITE_LIVEKIT_TOKEN_ENDPOINT

RUN npm run build

# --- runtime -------------------------------------------------------------------------------------
FROM node:24-slim AS runtime

ARG TZ=Europe/Moscow
ENV TZ=$TZ
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Production dependencies only, and only because the runtime loads them: serve.js ->
# tokenEndpoint.js -> livekitToken.js mints grants with livekit-server-sdk. Everything
# else in the tree is the browser's, and it is already built into dist below. Installing
# from the same lockfile the build used is what keeps the two installs from drifting.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Only the finished site crosses over; node_modules of the build, the sources and the
# toolchain stay in the builder.
COPY --chown=node:node --from=builder /app/dist ./dist

# The three server files the runtime loads, named one by one: the tests next to them
# exist for `npm test` and have no business in an image.
COPY --chown=node:node server/serve.js server/tokenEndpoint.js server/livekitToken.js ./server/

# Unprivileged. The server writes nothing, so there is no reason to start as root, and a
# container escape should not start from root either.
USER node

EXPOSE 8080

# Liveness only, deliberately - see HEALTH_PATH in server/serve.js. Nothing here may fail
# because LiveKit is unreachable or a credential is missing: a deployment mistake would
# otherwise become a restart loop that hides the mistake. Node's own fetch rather than
# curl, which this image does not have.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Exec form, so node is PID 1 and receives the SIGTERM its own shutdown handler acts on.
# No shell: $PORT is read by the server from the environment, which a platform injects at
# run time, not something a shell has to expand.
CMD ["node", "server/serve.js"]
