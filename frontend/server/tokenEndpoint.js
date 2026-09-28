// The HTTP half of the token endpoint, kept apart from the function that Vercel
// deploys and from the Vite dev middleware that serves the same thing locally, so
// both answer identically and there is one place that decides what a request is worth.
//
//   POST /api/livekit/token
//   -> 201 { server_url, participant_token, room?, identity? }
//
// 201 Created is what the standard LiveKit token endpoint specifies, and the two fields
// in the body are named exactly as it names them, so the same endpoint also serves any
// other LiveKit client SDK pointed at it.

import { mintParticipantToken, TokenEndpointError } from "./livekitToken.js";

// Vercel parses a JSON body for us; everywhere else it arrives as an unread stream.
// Both are accepted, because refusing one of them would be a failure nobody could see.
async function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;

  const chunks = [];

  for await (const chunk of request) chunks.push(chunk);

  if (!chunks.length) return {};

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const send = (response, status, payload) => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    // A grant is single use and belongs to one call; nothing here is ever cached.
    "cache-control": "no-store",
  });

  response.end(JSON.stringify(payload));
}

// Returns a (request, response) handler, which is what both a Vercel function and a
// connect middleware expect. `env` is a parameter so a test can hand it its own.
export function createTokenEndpoint(env = process.env) {
  return async function tokenEndpoint(request, response) {
    if (request.method !== "POST") {
      response.setHeader("allow", "POST");
      send(response, 405, { error: "Токен Портала выдаётся только методом POST" });
      return;
    }

    let body;

    try {
      body = await readBody(request);
    } catch {
      send(response, 400, { error: "The request body is not JSON" });
      return;
    }

    try {
      send(response, 201, await mintParticipantToken({ body, env }));
    } catch (error) {
      // A missing credential is this deployment's problem and is reported by name; the
      // rest is a bug, and a bug must not answer with half a grant or a stack trace.
      if (error instanceof TokenEndpointError) {
        send(response, error.status, { error: error.message });
        return;
      }

      console.error("livekit token failed", error);
      send(response, 500, { error: "Не удалось выпустить токен Портала" });
    }
  };
}
