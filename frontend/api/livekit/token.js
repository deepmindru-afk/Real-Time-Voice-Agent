// POST /api/livekit/token - the standalone LiveKit token endpoint, as deployed.
//
// It ships with this frontend, reads the deployment's LiveKit credentials from the
// environment, and answers with a grant that is good for exactly one room and one
// agent. No backend is involved and nothing is stored.
//
// Vercel serves the /api directory as functions, and checks it before it applies the
// /api proxy rewrite in vercel.json, so this endpoint answers on its own path and
// every other /api call still goes to the backend.
//
// The minting rules - what a request may decide, and what it may not - are in
// server/livekitToken.js. The schema is at
// https://docs.livekit.io/frontends/build/authentication/endpoint/

import { createTokenEndpoint } from "../../server/tokenEndpoint.js";

export default createTokenEndpoint();
