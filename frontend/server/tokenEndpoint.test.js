import assert from "node:assert/strict";
import { test } from "node:test";

import { createTokenEndpoint } from "./tokenEndpoint.js";

const ENV = {
  LIVEKIT_API_KEY: "APIkey_test",
  LIVEKIT_API_SECRET: "verysecretvalue_that_is_long_enough",
  LIVEKIT_URL: "wss://example.livekit.cloud",
};

// A request as Node delivers one: a readable stream, which is what Vercel and the Vite
// dev server both hand over for a body they have not already parsed.
const requestOf = (method, body) => {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];

  return {
    method,
    headers: { "content-type": "application/json" },
    async *[Symbol.asyncIterator]() {
      yield* chunks;
    },
  };
};

const respond = async (endpoint, request) => {
  const answered = { status: null, headers: {}, body: null };

  await endpoint(request, {
    setHeader: (name, value) => {
      answered.headers[name] = value;
    },
    writeHead: (status, headers) => {
      answered.status = status;
      Object.assign(answered.headers, headers);
    },
    end: (payload) => {
      answered.body = JSON.parse(payload);
    },
  });

  return answered;
};

test("a token request is answered with a connectable grant", async () => {
  const answer = await respond(createTokenEndpoint(ENV), requestOf("POST", { profile_id: "telecom" }));

  assert.equal(answer.status, 201);
  assert.equal(answer.body.server_url, "wss://example.livekit.cloud");
  assert.equal(answer.body.participant_token.split(".").length, 3);
  // A grant is single use and belongs to one call; nothing here may be cached.
  assert.equal(answer.headers["cache-control"], "no-store");
});

test("a body already parsed by the runtime is used as it is", async () => {
  const request = requestOf("POST", { customer_ref: "+7 900 000-00-00" });

  request.body = { customer_ref: "+7 900 000-00-00" };

  const answer = await respond(createTokenEndpoint(ENV), request);

  assert.equal(answer.status, 201);
});

test("an empty body is a call like any other, not a bad request", async () => {
  const answer = await respond(createTokenEndpoint(ENV), requestOf("POST"));

  assert.equal(answer.status, 201);
});

test("a token is only ever minted with POST", async () => {
  const answer = await respond(createTokenEndpoint(ENV), requestOf("GET"));

  assert.equal(answer.status, 405);
  assert.equal(answer.headers.allow, "POST");
  assert.equal(answer.body.participant_token, undefined);
});

test("a body that is not JSON is refused, not guessed at", async () => {
  const request = requestOf("POST");

  request[Symbol.asyncIterator] = async function* () {
    yield Buffer.from("not json");
  };

  const answer = await respond(createTokenEndpoint(ENV), request);

  assert.equal(answer.status, 400);
});

test("a deployment with no credentials says which ones, and mints nothing", async () => {
  const answer = await respond(createTokenEndpoint({}), requestOf("POST"));

  assert.equal(answer.status, 500);
  assert.match(answer.body.error, /LIVEKIT_API_KEY/);
  assert.equal(answer.body.participant_token, undefined);
});
