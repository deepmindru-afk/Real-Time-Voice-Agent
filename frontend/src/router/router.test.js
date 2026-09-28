import assert from "node:assert/strict";
import test from "node:test";
import { isAppRoute, matchRoute, normalizePath } from "./router.js";

test("static routes match", () => {
  assert.equal(matchRoute("/").name, "landing");
  assert.equal(matchRoute("/app/dashboard").name, "dashboard");
  assert.equal(matchRoute("/app/analytics").name, "analytics");
});

test("a trailing slash is the same route", () => {
  assert.equal(matchRoute("/app/agents/").name, "agents");
  assert.equal(normalizePath("/app/"), "/app");
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("///"), "/");
});

test("the wizard wins over an agent whose id is 'new'", () => {
  assert.equal(matchRoute("/app/agents/new").name, "agent-new");
  assert.deepEqual(matchRoute("/app/agents/42"), { name: "agent-edit", params: { id: "42" }, redirect: null });
});

test("params are decoded, and a broken escape is not a match", () => {
  assert.equal(matchRoute("/app/calls/CALL%2D1").params.id, "CALL-1");
  assert.equal(matchRoute("/app/calls/%E0%A4%A").name, "not-found");
});

test("redirect routes say where they go", () => {
  assert.equal(matchRoute("/app").redirect, "/app/dashboard");
  assert.equal(matchRoute("/app/dashboard").redirect, null);
});

test("the old sign-in and sign-up screens are gone, not redirected", () => {
  assert.equal(matchRoute("/signin").name, "not-found");
  assert.equal(matchRoute("/signup").name, "not-found");
  assert.equal(isAppRoute("signin"), false);
});

test("unknown paths are not-found, never a blank page", () => {
  assert.equal(matchRoute("/nope").name, "not-found");
  assert.equal(matchRoute("/app/agents/1/extra").name, "not-found");
  assert.equal(matchRoute("").name, "landing"); // not a path: treated as the root
  assert.equal(matchRoute(undefined).name, "landing");
});

test("isAppRoute distinguishes the application from the public site", () => {
  assert.equal(isAppRoute("dashboard"), true);
  assert.equal(isAppRoute("console"), true);
  assert.equal(isAppRoute("landing"), false);
  assert.equal(isAppRoute("signin"), false);
  assert.equal(isAppRoute("app"), false); // a redirect, not a screen
});
