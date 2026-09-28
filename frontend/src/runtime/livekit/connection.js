// How this frontend reaches a LiveKit agent. This is the whole integration surface.
//
// There is no backend of ours in the loop. The token endpoint ships with this app
// (server/livekitToken.js, deployed as api/livekit/token.js) and mints one grant for one
// room from the deployment's environment variables. The browser's job is to ask for a
// grant and connect with it - and that is all it is allowed to decide, which is why this
// file has no field for a room or an agent name: the server names both, so a caller cannot
// land in someone else's call or pick the agent and thereby reach the API secret.
//
// What this file does hold is the address to ask, and who we are when we do.
//
// Stored in localStorage. Nothing here is secret: a room grant is scoped to one room, is
// short-lived, and could only be minted on the server in the first place.

const KEY = "livekit-connection";

// The endpoint the app ships and serves: api/livekit/token.js as a Vercel function in
// production, the same handler mounted by the Vite plugin in dev. A build can point it at
// a token service on another host with VITE_LIVEKIT_TOKEN_ENDPOINT - a full URL, which
// then has to allow this origin, because the browser calls it directly.
export const TOKEN_PATH = "/api/livekit/token";

const DEFAULT_TOKEN_ENDPOINT = import.meta.env?.VITE_LIVEKIT_TOKEN_ENDPOINT || TOKEN_PATH;

export const LIMITS = {
  url: 300,
  tokenEndpoint: 500,
  token: 4096,
  participantName: 120,
};

export function emptyConnection() {
  return {
    // Where to ask for a grant.
    tokenEndpoint: DEFAULT_TOKEN_ENDPOINT,
    // wss://… Only needed when a hand-pasted token is used and no endpoint is configured,
    // because a pasted token is not something an endpoint can tell us the server for.
    url: "",
    // A grant, pasted by hand. A fallback for pointing the app at a project while the
    // endpoint is not to hand, not a mode: a grant expires, and the app asks the endpoint
    // again as soon as one is configured.
    token: "",
    // The name this participant shows in the room. Sent as `participant_name`; the server
    // decides the room and the identity.
    participantName: "",
  };
}

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// A pasted grant is a developer convenience, so the newlines and stray wrapping that a
// copy out of a dashboard tends to add are removed rather than refused.
const compactToken = (value) => text(value, LIMITS.token).replace(/\s+/g, "");

export function normalizeConnection(raw) {
  const input = raw && typeof raw === "object" ? raw : {};

  return {
    // An explicitly empty endpoint is a choice, not a missing value: it is how the
    // operator says "use the token I pasted". So the default is applied once, in
    // emptyConnection(), and never re-applied here - otherwise a pasted token could never
    // take effect, because the endpoint would always come back.
    tokenEndpoint: text(input.tokenEndpoint, LIMITS.tokenEndpoint),
    url: text(input.url, LIMITS.url),
    token: compactToken(input.token),
    participantName: text(input.participantName, LIMITS.participantName),
  };
}

// {field: message} for what is missing before a call can even be attempted. Empty means
// the connection can be tried. Nothing here demands an endpoint, because a hand-pasted
// grant is enough on its own.
export function validateConnection(connection) {
  const value = normalizeConnection(connection);
  const errors = {};

  if (!value.tokenEndpoint && !value.token) {
    errors.tokenEndpoint = "Укажите эндпоинт токенов или вставьте готовый токен.";
  }

  if (value.tokenEndpoint && !/^(https?:\/\/|\/)/i.test(value.tokenEndpoint)) {
    errors.tokenEndpoint = "Адрес должен начинаться с http://, https:// или /.";
  }

  if (value.url && !/^wss?:\/\//i.test(value.url)) {
    errors.url = "Адрес LiveKit должен начинаться с wss:// или ws://.";
  }

  if (value.token && !value.url) {
    errors.url = "С готовым токеном нужен адрес LiveKit: эндпоинт его не возвращает.";
  }

  return errors;
}

export const isConfigured = (connection) => Object.keys(validateConnection(connection)).length === 0;

// Reads and writes are defensive about storage for the same reason the rest of the app
// is: private windows and full quotas must not stop a call.
export function loadConnection(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(KEY));

    // Nothing stored yet is the one case that means "use the defaults", including the
    // endpoint the app ships.
    return raw && typeof raw === "object" ? normalizeConnection(raw) : emptyConnection();
  } catch {
    return emptyConnection();
  }
}

export function saveConnection(connection, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(normalizeConnection(connection)));

    return true;
  } catch {
    return false;
  }
}
