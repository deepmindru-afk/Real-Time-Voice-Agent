// The same token endpoint in development.
//
// Vercel serves /api as functions, so in production nothing here runs: api/livekit/
// token.js is the endpoint. In `vite dev` there is no such thing, and without this
// the token request would follow the /api proxy to a backend that has no route for
// it. This mounts the identical handler on the identical path, ahead of the proxy.
//
// It is a plugin rather than a copy in vite.config.js because it needs the project's
// environment, and only the plugin can ask Vite to load it.

import { loadEnv } from "vite";
import { createTokenEndpoint } from "./tokenEndpoint.js";

// The same default the browser asks for: src/runtime/livekit/token.js.
const TOKEN_PATH = "/api/livekit/token";

export function liveKitTokenEndpoint() {
  return {
    name: "livekit-token-endpoint",

    // Returning nothing from this hook puts the middleware ahead of Vite's own
    // middlewares, which is what keeps it ahead of the /api proxy.
    configureServer(server) {
      // Vite only exposes VITE_-prefixed variables to the client, so the whole .env is
      // read here instead - on the server, where the API secret belongs and where it
      // stays: nothing read this way is ever written into the bundle.
      const env = { ...loadEnv(server.config.mode, server.config.root, ""), ...process.env };

      server.middlewares.use(TOKEN_PATH, createTokenEndpoint(env));
    },
  };
}
