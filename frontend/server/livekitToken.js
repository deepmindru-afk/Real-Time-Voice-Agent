// Minting a LiveKit access token with no backend, no database and no session: the
// credentials come from the environment, and everything the token grants is decided
// here, on the server, in one function.
//
// One grant is one room, and the room belongs to that grant alone. Neither the room
// name nor the agent name is taken from the request:
//
//   * the room is named after the grant, so a caller cannot name the room it joins
//     and therefore cannot land in somebody else's call;
//   * the agent is the one this deployment is configured with, because the agent's
//     name is what turns a room into a conversation, and letting a browser pick it
//     would hand out the API secret by another route.
//
// What the request may send is the part of the standard LiveKit token endpoint schema
// that describes the person on the call: a display name, and the app's own payload -
// which profile, which contact, which agent record - which is passed on to the agent
// as participant metadata. That is what an agent worker reads to know who it is
// talking to, and it is the only thing a browser should get to choose.
//
// Schema and rationale: https://docs.livekit.io/frontends/build/authentication/endpoint/

import { randomBytes } from "node:crypto";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { AccessToken } from "livekit-server-sdk";

// Long enough for a call, short enough that a token that leaks is not a key to the
// deployment. Both are overridable for a deployment that thinks otherwise.
const DEFAULT_TTL = "10m";
const DEFAULT_ROOM_PREFIX = "portal";

// The app's own payload, as it travels to the agent. These are the fields the console
// already knows how to set on a call, and none of them is a credential.
const CALL_FIELDS = ["profile_id", "agent_id", "customer_ref", "job_id", "call_id"];

// A grant is a room of its own, so the id only has to be unique, not memorable.
const grantId = () => randomBytes(12).toString("base64url");

// An HTTP failure that is not a bug: the caller is told what to fix.
export class TokenEndpointError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "TokenEndpointError";
    this.status = status;
  }
}

const text = (value) => (typeof value === "string" ? value.trim() : "");

// Reads the deployment's LiveKit credentials. Only the names of anything missing are
// ever reported - a half-configured deployment must not print half a secret.
export function readCredentials(env = {}) {
  const apiKey = text(env.LIVEKIT_API_KEY);
  const apiSecret = text(env.LIVEKIT_API_SECRET);
  const url = text(env.LIVEKIT_URL);

  const missing = [
    ["LIVEKIT_API_KEY", apiKey],
    ["LIVEKIT_API_SECRET", apiSecret],
    ["LIVEKIT_URL", url],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new TokenEndpointError(500, `LiveKit is not configured: ${missing.join(", ")} is not set`);
  }

  return {
    apiKey,
    apiSecret,
    url,
    // Without an agent name the token still opens a room; nothing answers in it. That
    // is a valid (if quiet) deployment, so it is not an error here.
    agentName: text(env.LIVEKIT_AGENT_NAME),
    agentMetadata: text(env.LIVEKIT_AGENT_METADATA),
    roomPrefix: text(env.LIVEKIT_ROOM_PREFIX) || DEFAULT_ROOM_PREFIX,
    ttl: text(env.LIVEKIT_TOKEN_TTL) || DEFAULT_TTL,
  };
}

// The call context the console put on this call, and nothing else: only string fields
// this endpoint already knows about, so a caller cannot smuggle anything in.
export function callContext(body = {}) {
  const context = {};

  for (const field of CALL_FIELDS) {
    const value = text(body[field]);

    if (value) context[field] = value;
  }

  return context;
}

// LiveKit reads both, and so can the agent: the metadata as one JSON document, the
// attributes as individual strings it can match on.
const attributesOf = (context) => ({ ...context });

const participantName = (body, context) =>
  text(body.participant_name) || text(body.participant_identity) || context.customer_ref || "Оператор";

// The whole endpoint, minus HTTP: environment in, a connectable grant out. `id` is
// injectable so a test can name the room it minted.
export async function mintParticipantToken({ body = {}, env = {}, id = grantId() } = {}) {
  const credentials = readCredentials(env);
  const context = callContext(body);
  const room = `${credentials.roomPrefix}-${id}`;

  const at = new AccessToken(credentials.apiKey, credentials.apiSecret, {
    // Unique per grant, because two callers in one room would be one of the two
    // disconnected by the server for sharing an identity.
    identity: `operator-${id}`,
    name: participantName(body, context),
    metadata: JSON.stringify(context),
    attributes: attributesOf(context),
    ttl: credentials.ttl,
  });

  // Join one room, speak and listen, and send the typed lines the console types.
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  // The dispatch rule rides along inside the token, so the agent is already on its
  // way by the time the browser connects and there is no second call to make. The
  // configuration is named after the room, which is what makes a fresh room dispatch
  // a fresh agent rather than reusing the last one's configuration.
  if (credentials.agentName) {
    at.roomConfig = new RoomConfiguration({
      name: room,
      agents: [
        new RoomAgentDispatch({
          agentName: credentials.agentName,
          metadata: credentials.agentMetadata,
        }),
      ],
    });
  }

  return {
    // The two fields the standard endpoint specifies, named exactly as it names them,
    // so the same endpoint serves every LiveKit client SDK.
    server_url: credentials.url,
    participant_token: await at.toJwt(),
    // Echoed back so the browser can say which call it is in. LiveKit ignores them.
    room,
    identity: `operator-${id}`,
  };
}
