// One place that knows how to get a LiveKit access token, and the one place that
// must never be wrong about security: the token is minted by our own server, never
// in the browser. The API secret does not belong in this bundle.
//
// The server side is a thin wrapper around the `livekit-server-sdk` AccessToken. It
// mints a token scoped to ONE room, and - when the deployment uses explicit agent
// dispatch - attaches a RoomAgentDispatch rule so the agent joins as soon as the
// participant does. Because the grant and the dispatch rule are minted together, the
// browser never has to know a room name, an agent name, an API key or a secret.
//
// Endpoint contract (all fields optional but `profile_id`):
//
//   POST <VITE_LIVEKIT_TOKEN_PATH, default "/api/livekit/token">
//     { profile_id, agent_id, customer_ref, room_name, identity, agent_config }
//   -> 200 { token, url?, room?, identity? }
//
// `url` (wss://…) and `identity` are echoed back because the server knows them for
// certain; both are optional here so a deployment that hard-codes them in the browser
// build (VITE_LIVEKIT_URL) still works.

import { post } from "../api.js";

export const TOKEN_PATH = import.meta.env?.VITE_LIVEKIT_TOKEN_PATH ?? "/api/livekit/token";

export const FALLBACK_URL = import.meta.env?.VITE_LIVEKIT_URL ?? "";

// How long a connection may take before we give up and let the caller fall back.
const TOKEN_TIMEOUT_MS = 8000;

export class LiveKitUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "LiveKitUnavailableError";
  }
}

// Resolves { token, url, room, identity }. Throws LiveKitUnavailableError when there
// is no token, or no URL to connect it to - either of which means "this deployment is
// not wired for LiveKit", and the call must fall back rather than fail.
export async function fetchLiveKitToken(request = {}) {
  let body;

  try {
    const response = await post(TOKEN_PATH, request, { signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS) });

    body = await response.json();
  } catch (error) {
    throw new LiveKitUnavailableError(
      `Не удалось получить токен LiveKit: ${error instanceof Error ? error.message : "неизвестная ошибка"}`
    );
  }

  const url = body?.url || FALLBACK_URL;
  const token = body?.token;

  if (!token) throw new LiveKitUnavailableError("Сервер не вернул токен LiveKit.");
  if (!url) throw new LiveKitUnavailableError("Не настроен адрес сервера LiveKit.");

  return {
    token,
    url,
    room: body.room ?? request.room_name ?? null,
    identity: body.identity ?? request.identity ?? null,
    // The call id, when the deployment ties a room to a call record. Optional: with it
    // the console can fetch the server's own summary, without it the summary is built
    // from the transcript the browser already has.
    callId: body.call_id ?? null,
  };
}
