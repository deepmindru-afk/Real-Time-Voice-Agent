import assert from "node:assert/strict";
import { test } from "node:test";

import { callContext, mintParticipantToken, readCredentials, TokenEndpointError } from "./livekitToken.js";

const ENV = {
  LIVEKIT_API_KEY: "APIkey_test",
  LIVEKIT_API_SECRET: "verysecretvalue_that_is_long_enough",
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_AGENT_NAME: "portal-agent",
};

// The token is a JWT, so its claims can be read back without a secret. This is what the
// LiveKit server itself will see.
const claimsOf = async (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

test("the credentials come from the environment and a missing one is named, never printed", () => {
  const credentials = readCredentials(ENV);

  assert.equal(credentials.url, "wss://example.livekit.cloud");
  assert.equal(credentials.agentName, "portal-agent");

  assert.throws(
    () => readCredentials({ ...ENV, LIVEKIT_API_SECRET: "" }),
    (error) =>
      error instanceof TokenEndpointError &&
      error.status === 500 &&
      error.message.includes("LIVEKIT_API_SECRET") &&
      !error.message.includes("APIkey_test")
  );
});

test("a grant is one room, and the browser does not get to name it", async () => {
  const grant = await mintParticipantToken({ body: {}, env: ENV, id: "one" });

  assert.equal(grant.server_url, "wss://example.livekit.cloud");
  assert.equal(grant.room, "portal-one");

  const claims = await claimsOf(grant.participant_token);

  assert.equal(claims.video.room, "portal-one");
  assert.equal(claims.video.roomJoin, true);
  // The identity travels as the JWT's subject.
  assert.equal(claims.sub, "operator-one");

  // Two callers asking for the same room still get two rooms, so neither can land in
  // the other's call.
  const other = await mintParticipantToken({ body: { room_name: "portal-one" }, env: ENV, id: "two" });

  assert.notEqual(other.room, "portal-one");
});

test("the agent rides along in the token, so one call is enough to reach it", async () => {
  const claims = await claimsOf((await mintParticipantToken({ env: ENV, id: "one" })).participant_token);

  assert.equal(claims.roomConfig.agents[0].agentName, "portal-agent");
  // Named after the room, which is what makes a fresh room dispatch a fresh agent.
  assert.equal(claims.roomConfig.name, "portal-one");
});

test("without an agent the room still opens; nothing answers in it", async () => {
  const env = { ...ENV, LIVEKIT_AGENT_NAME: "" };
  const claims = await claimsOf((await mintParticipantToken({ env, id: "one" })).participant_token);

  assert.equal(claims.video.roomJoin, true);
  assert.equal(claims.roomConfig, undefined);
});

test("the call's context reaches the agent as metadata, and nothing else does", async () => {
  const body = {
    profile_id: "telecom",
    agent_id: "agent-7",
    customer_ref: "+7 900 000-00-00",
    // Not part of the call context, and not carried over.
    room_name: "somebody-elses-room",
    LIVEKIT_API_SECRET: "smuggled",
    nickname: "operator",
  };

  assert.deepEqual(callContext(body), {
    profile_id: "telecom",
    agent_id: "agent-7",
    customer_ref: "+7 900 000-00-00",
  });

  const claims = await claimsOf((await mintParticipantToken({ body, env: ENV, id: "one" })).participant_token);

  assert.deepEqual(JSON.parse(claims.metadata), {
    profile_id: "telecom",
    agent_id: "agent-7",
    customer_ref: "+7 900 000-00-00",
  });
  assert.deepEqual(claims.attributes, JSON.parse(claims.metadata));
  assert.equal(claims.name, "+7 900 000-00-00");
});

test("the grant is signed with the deployment's key and does not outlive its call", async () => {
  const { participant_token } = await mintParticipantToken({ env: ENV, id: "one" });
  const [header, , signature] = participant_token.split(".");

  const claims = await claimsOf(participant_token);

  assert.equal(JSON.parse(Buffer.from(header, "base64url")).alg, "HS256");
  // An AccessToken's `iss` is the API key, which is public, unlike the secret: a token
  // must never carry the secret, and the server has it anyway to check the signature.
  assert.equal(claims.iss, ENV.LIVEKIT_API_KEY);
  assert.ok(!JSON.stringify(claims).includes(ENV.LIVEKIT_API_SECRET));
  // Not before now, and expired within the default ten minutes.
  assert.ok(claims.nbf <= Math.floor(Date.now() / 1000));
  assert.ok(claims.exp - claims.nbf <= 10 * 60);
  assert.ok(signature.length > 0);
});
