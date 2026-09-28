// The container's HTTP server: the built site, and the LiveKit token endpoint on the
// same origin.
//
// The app has two halves and they have to answer on one origin. The bundle is static
// and is happy anywhere; POST /api/livekit/token has to run where the LiveKit secret
// is and must never end up inside that bundle. Vercel serves them as a CDN plus a
// function, `vite dev` as a dev server plus middleware - a container has to serve
// both itself, and this is that: the same handler from tokenEndpoint.js, on the same
// path, with the same decision about what a request is worth.
//
// Deliberately no framework and no dependencies. It is a static file server and one
// endpoint, both of which node has; the only packages this process loads are the two
// the endpoint mints tokens with.

import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { createTokenEndpoint } from "./tokenEndpoint.js";

// The build output, addressed from this file rather than from the working directory,
// so `node /app/server/serve.js` and `npm run serve` are the same server.
const ROOT = resolve(fileURLToPath(new URL("../dist", import.meta.url)));

// The two paths this server answers by name. TOKEN_PATH is the one the browser asks
// for (src/runtime/livekit/connection.js); HEALTH_PATH exists so a container can be
// asked whether it is alive.
const TOKEN_PATH = "/api/livekit/token";
const HEALTH_PATH = "/health";

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";

const TEXT = "text/plain; charset=utf-8";

// Vite emits these, and nothing else: there is no build step that could introduce a
// type this table has never heard of.
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Only the text types are worth compressing; the woff2 fonts and the pngs are already
// compressed, and gzipping them again costs CPU and buys nothing.
const COMPRESSIBLE = new Set([".css", ".html", ".js", ".json", ".mjs", ".svg", ".txt", ".webmanifest"]);

// Read once per file and kept, because this process answers the same immutable bytes
// over and over and the whole dist is under 2 MB. Keyed by path, and re-read when the
// file changes underneath, so a dist bind-mounted into a running container can still be
// rebuilt without a restart.
const files = new Map();

async function fileAt(path) {
  const info = await stat(path).catch(() => null);

  if (!info || !info.isFile()) return null;

  const cached = files.get(path);

  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached;

  const type = CONTENT_TYPES[extname(path).toLowerCase()] || "application/octet-stream";
  const body = await readFile(path);
  const entry = {
    mtimeMs: info.mtimeMs,
    size: info.size,
    type,
    // Not a hash, and it does not have to be: it changes when the bytes do, and the
    // bytes are what this answer is.
    etag: `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`,
    body,
    gzipped: COMPRESSIBLE.has(extname(path).toLowerCase()) ? gzipSync(body) : null,
  };

  files.set(path, entry);

  return entry;
}

// A path that climbs out of dist is not a miss to be answered with index.html: it is a
// request this server refuses. resolve collapses the ".." first, so the check below is
// the whole containment test.
function inRoot(pathname) {
  const target = resolve(join(ROOT, pathname));

  return target === ROOT || target.startsWith(ROOT + sep) ? target : null;
}

// /assets/ names are content hashes, so a browser that has one will never be told
// otherwise and a year is honest. Everything else - index.html above all, since it is
// how a deploy is noticed - is stored but revalidated, and the etag makes that
// revalidation a 304 instead of a resend.
function cacheControlFor(pathname) {
  return pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
}

function sendFile(request, response, file, cacheControl) {
  if (request.headers["if-none-match"] === file.etag) {
    response.writeHead(304, { "cache-control": cacheControl, etag: file.etag });
    response.end();
    return;
  }

  const headers = {
    "content-type": file.type,
    "cache-control": cacheControl,
    etag: file.etag,
    // One etag for both encodings, kept honest by this header rather than by two tags.
    vary: "Accept-Encoding",
  };

  if (file.gzipped && /\bgzip\b/.test(request.headers["accept-encoding"] || "")) {
    headers["content-encoding"] = "gzip";
  }

  const body = headers["content-encoding"] ? file.gzipped : file.body;

  headers["content-length"] = body.length;
  response.writeHead(200, headers);
  // A HEAD gets the length of what a GET would return and none of the bytes.
  response.end(request.method === "HEAD" ? undefined : body);
}

function sendText(request, response, status, text) {
  response.writeHead(status, { "content-type": TEXT, "content-length": Buffer.byteLength(text) });
  response.end(request.method === "HEAD" ? undefined : text);
}

// The environment is passed in rather than defaulted per call, so this process is the
// only thing in the image that decides where credentials come from: the environment it
// was started with. No file in the image holds one.
const tokenEndpoint = createTokenEndpoint(process.env);

async function handle(request, response) {
  const { pathname } = new URL(request.url, "http://portal");

  if (pathname === HEALTH_PATH) {
    // Liveness only, deliberately: it reads no credential, opens no file and calls no
    // LiveKit, so a half-configured deployment is not restarted in a loop over a
    // mistake. A caller that actually asks for a token is told what is missing, by
    // name (server/livekitToken.js, readCredentials).
    return sendText(request, response, 200, "ok");
  }

  if (pathname === TOKEN_PATH) return tokenEndpoint(request, response);

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("allow", "GET, HEAD");
    return sendText(request, response, 405, "method not allowed");
  }

  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return sendText(request, response, 400, "bad request");
  }

  const target = inRoot(decoded);
  const file = target ? await fileAt(target) : null;

  if (file) return sendFile(request, response, file, cacheControlFor(decoded));

  // A route (/app/dashboard) is the same document as "/", because the router is what
  // reads the path - so anything without a file extension is the app. A missing asset
  // is still a 404: answering it with HTML turns a broken script tag into a confusing
  // syntax error far from the cause.
  if (!extname(decoded)) {
    const index = await fileAt(join(ROOT, "index.html"));

    if (index) return sendFile(request, response, index, cacheControlFor("/index.html"));

    // The image was started without a build. Said plainly, because "ok" on every route
    // with an empty body would be the alternative.
    return sendText(request, response, 500, "dist/index.html is missing: build the app");
  }

  return sendText(request, response, 404, "not found");
}

const server = createServer((request, response) => {
  // An unhandled throw here would take the process down and every caller's page with
  // it. A 500 is enough, and the log says what happened.
  // nosniff because nothing here is user content, and a browser guessing a type is
  // never the answer this server intended. A CSP is deliberately not set: what the
  // bundle may reach - a LiveKit host, a token service on another origin - is a
  // per-deployment decision, and a wrong policy breaks calls silently.
  response.setHeader("x-content-type-options", "nosniff");

  handle(request, response).catch((error) => {
    console.error("portal request failed", error);

    if (response.headersSent) {
      response.end();
      return;
    }

    sendText(request, response, 500, "internal error");
  });
});

server.on("error", (error) => {
  console.error("portal cannot listen", error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`portal on http://${HOST}:${PORT} (dist: ${ROOT})`);
});

// SIGTERM is what an orchestrator sends, and the handler is this process rather than a
// shell that would swallow it: stop accepting, finish what is in flight, exit. The
// timer is the backstop for a client that does not hang up, so a stop cannot overrun
// the grace period the platform allows.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
