// Ask the token endpoint for a grant, and nothing else. This is the only network call
// this app makes.
//
// The endpoint ships alongside it (server/livekitToken.js, deployed as
// api/livekit/token.js) and mints a grant with the `livekit-server-sdk` AccessToken: one
// room, one identity, and a RoomAgentDispatch rule for the agent this deployment is
// configured with. The API key and secret never leave the server, which is why the
// request below carries nothing but a display name and whatever call context the console
// has - there is no room name and no agent name to send, because the server decides both.
//
// The response follows the standard LiveKit token endpoint schema, so the same endpoint
// serves any LiveKit client SDK:
//
//   POST /api/livekit/token
//     { participant_name, ...call context }
//   -> 201 { server_url, participant_token, room, identity }
//
// `room` and `identity` are echoed so the browser can say which call it is in; LiveKit
// itself ignores them. A hand-pasted grant bypasses the call entirely, which is what makes
// pointing the app at a project possible without the endpoint running.

import { normalizeConnection } from "./connection.js";

// How long to wait before deciding the endpoint is not there. A service that accepts the
// connection and then says nothing is worse than one that is plainly down: the operator
// would sit watching "подключение" forever.
const REQUEST_TIMEOUT_MS = 10000;

export class TokenError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "TokenError";
    this.cause = cause;
  }
}

const isJson = (response) => (response.headers.get("content-type") ?? "").includes("json");

async function readError(response) {
  if (!isJson(response)) return `код ${response.status}`;

  try {
    const body = await response.json();

    // Whatever the endpoint called the problem: `error`, FastAPI's `detail`, `message`,
    // or a validation array. Its own words beat ours.
    const detail = body?.error ?? body?.detail ?? body?.message;

    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);

    return `код ${response.status}`;
  } catch {
    return `код ${response.status}`;
  }
}

export async function requestToken({ connection, participantName } = {}) {
  const value = normalizeConnection(connection);

  // A pasted grant stands in for the endpoint entirely: the only path that makes no
  // network call at all.
  if (!value.tokenEndpoint) {
    if (!value.token) throw new TokenError("Не задан ни эндпоинт токенов, ни готовый токен.");
    if (!value.url) throw new TokenError("С готовым токеном нужен адрес LiveKit.");

    return { token: value.token, url: value.url, room: null, identity: null };
  }

  let response;

  try {
    response = await fetch(value.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_name: participantName || value.participantName || undefined }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // A CORS rejection reaches the browser as an opaque TypeError, and it is the most
    // common reason a token service "is not there". Saying so saves a long guessing game.
    throw new TokenError(
      error?.name === "TimeoutError"
        ? "Эндпоинт токенов не ответил вовремя."
        : "Не удалось обратиться к эндпоинту токенов. Проверьте адрес и что он разрешает CORS для этого сайта.",
      error
    );
  }

  if (!response.ok) throw new TokenError(`Эндпоинт токенов отклонил запрос: ${await readError(response)}.`);

  let body;

  try {
    body = await response.json();
  } catch (error) {
    throw new TokenError("Эндпоинт токенов вернул не JSON.", error);
  }

  // The standard names first, then the short ones other token services use.
  const token = body?.participant_token ?? body?.token;
  const url = body?.server_url ?? body?.url ?? value.url;

  if (!token) throw new TokenError("Эндпоинт токенов не вернул participant_token.");
  if (!url) throw new TokenError("Эндпоинт токенов не вернул server_url, и адрес LiveKit не задан.");

  return {
    token,
    url,
    room: body.room ?? null,
    identity: body.identity ?? null,
  };
}
