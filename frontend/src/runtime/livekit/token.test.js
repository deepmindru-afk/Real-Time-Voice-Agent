import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { TOKEN_PATH } from "./connection.js";
import { requestToken, TokenError } from "./token.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const answer = (status, body) => {
  globalThis.fetch = async (url, options) => {
    answer.last = { url, options };
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
};

const connection = (over = {}) => ({
  tokenEndpoint: TOKEN_PATH,
  url: "",
  token: "",
  participantName: "Оператор",
  ...over,
});

test("the grant is asked of the endpoint that ships with the app", async () => {
  answer(201, { server_url: "wss://example.livekit.cloud", participant_token: "jwt", room: "portal-one", identity: "operator-1" });

  const grant = await requestToken({ connection: connection(), participantName: "Анна" });

  assert.equal(answer.last.url, TOKEN_PATH);
  assert.equal(answer.last.options.method, "POST");
  // The endpoint names the room and the identity; the browser only says who it is.
  assert.deepEqual(JSON.parse(answer.last.options.body), { participant_name: "Анна" });
  assert.equal(grant.token, "jwt");
  assert.equal(grant.url, "wss://example.livekit.cloud");
  assert.equal(grant.room, "portal-one");
  assert.equal(grant.identity, "operator-1");
});

test("an endpoint of the older shape is understood too", async () => {
  answer(200, { url: "wss://example.livekit.cloud", token: "jwt", room: "portal-one" });

  const grant = await requestToken({ connection: connection() });

  assert.equal(grant.token, "jwt");
  assert.equal(grant.url, "wss://example.livekit.cloud");
  assert.equal(grant.room, "portal-one");
});

test("a pasted grant needs no network call at all", async () => {
  let called = false;

  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };

  const grant = await requestToken({
    connection: connection({ tokenEndpoint: "", token: "pasted", url: "wss://example.livekit.cloud" }),
  });

  assert.equal(called, false);
  assert.equal(grant.token, "pasted");
  assert.equal(grant.url, "wss://example.livekit.cloud");
});

test("a response without a token is refused rather than half used", async () => {
  answer(201, { server_url: "wss://example.livekit.cloud" });

  await assert.rejects(requestToken({ connection: connection() }), TokenError);
});

test("a token with nowhere to connect to is refused rather than half used", async () => {
  answer(201, { participant_token: "jwt" });

  await assert.rejects(requestToken({ connection: connection() }), TokenError);
});

test("a deployment whose LiveKit is not configured says so, and mints nothing", async () => {
  answer(500, { error: "LiveKit is not configured: LIVEKIT_API_KEY is not set" });

  await assert.rejects(requestToken({ connection: connection() }), (error) => {
    assert.ok(error instanceof TokenError);
    // The endpoint's own words are passed through, so the missing variable is named.
    assert.match(error.message, /LIVEKIT_API_KEY/);
    return true;
  });
});

test("an endpoint that cannot be reached is reported as such", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  await assert.rejects(requestToken({ connection: connection() }), (error) => {
    assert.ok(error instanceof TokenError);
    assert.match(error.message, /CORS/);
    return true;
  });
});
