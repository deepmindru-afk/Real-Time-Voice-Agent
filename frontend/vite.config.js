import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { liveKitTokenEndpoint } from "./server/viteLiveKitToken.js";

// There is no backend. The only server in this project is the LiveKit token endpoint, and
// it ships with the app: api/livekit/token.js as a Vercel function in production, the
// identical handler mounted by the plugin below in `vite dev`. Either way the browser
// asks one path and there is nothing to proxy to.
export default defineConfig({
  plugins: [react(), liveKitTokenEndpoint()],
});
