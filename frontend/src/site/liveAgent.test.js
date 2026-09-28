import assert from "node:assert/strict";
import test from "node:test";
import { liveModeFor, liveStatusFor } from "./liveAgent.js";

test("a live call gives the orb a mode, an absent one gives it back to the script", () => {
  assert.equal(liveModeFor("listening"), "listening");
  assert.equal(liveModeFor("speaking"), "speaking");
  assert.equal(liveModeFor("thinking"), "thinking");
  // Connecting is a thinking orb: something is happening, and it is not the visitor's voice.
  assert.equal(liveModeFor("connecting"), "thinking");

  assert.equal(liveModeFor("idle"), null);
  assert.equal(liveModeFor("ended"), null);
  assert.equal(liveModeFor(), null);
});

test("the status line says what the call is doing", () => {
  assert.equal(liveStatusFor({ callState: "listening", micState: "on" }).label, "Слушает вас");
  assert.equal(liveStatusFor({ callState: "speaking", micState: "on" }).label, "Говорит");
  assert.equal(liveStatusFor({ callState: "connecting" }).tone, "busy");
  assert.equal(liveStatusFor({ callState: "idle" }).label, "Готов говорить");
  assert.equal(liveStatusFor({ callState: "ended" }).label, "Разговор завершён");
});

test("what the visitor can act on outranks what the agent is doing", () => {
  // An error lasts as long as the call does, so nothing else is worth saying.
  const failed = liveStatusFor({ callState: "listening", micState: "on", callError: "Нет LiveKit" });

  assert.equal(failed.tone, "error");
  assert.equal(failed.label, "Нет LiveKit");

  // The browser holding the agent's voice back is a button to press, so it comes before the
  // state it is hiding.
  const muted = liveStatusFor({ callState: "listening", micState: "on", needsAudio: true });

  assert.equal(muted.tone, "warn");
  assert.ok(muted.label.length > 0);

  // A microphone the visitor turned off is the next thing they would want to know about.
  const off = liveStatusFor({ callState: "listening", micState: "off" });

  assert.equal(off.tone, "muted");
  assert.equal(off.label, "Микрофон выключен");
});

test("an unknown state is still something rather than nothing", () => {
  const status = liveStatusFor({ callState: "nonsense", micState: "on" });

  assert.ok(status.label.length > 0);
  assert.equal(status.tone, "live");
});
