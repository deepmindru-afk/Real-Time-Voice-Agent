import assert from "node:assert/strict";
import test from "node:test";

import { buildCallRecord, callStatus, conversationTitle, describeAgent, flowStep } from "./callRecord.js";

const label = (agentName = "Ассистент Портал", role = "Координатор приёма", industry = "Медицина и здоровье") => ({
  agentName,
  role,
  industry,
  purpose: "Записывает на приём и переносит его.",
});

// The shape buildTranscriptSummary() produces (src/runtime/livekit/summary.js): the
// call record is only ever fed by that, so the test uses its own wording.
const summary = {
  callId: "ЗВОНОК-20260920-104406",
  startedAt: Date.parse("2026-09-20T10:44:00Z"),
  durationSeconds: 272,
  outcome: "completed",
  summary: "Агент ответил в 4 реплики.",
  keyPoints: ["Обсуждено: перенос приёма", "Обсуждено: свободное окно", "Вопросов не поступило"],
  actionsTaken: ["В начале разговора сообщено, что на линии ИИ-ассистент"],
  nextSteps: [],
  evidence: [],
  transcript: [],
  audit: [],
};

// The role is used whole: a Russian job title is a genitive noun phrase, so trimming the
// leading "Ассистент" would leave "поддержки пациентов", which is not a title.
test("the title follows the configured role, whatever the domain", () => {
  assert.equal(conversationTitle({ role: "Ассистент поддержки пациентов" }), "Разговор — Ассистент поддержки пациентов");
  assert.equal(conversationTitle({ role: "Специалист поддержки клиентов" }), "Разговор — Специалист поддержки клиентов");
  assert.equal(conversationTitle({ role: "Поддержка добывающих операций" }), "Разговор — Поддержка добывающих операций");
  assert.equal(conversationTitle({ role: "Ассистент" }), "Разговор — Ассистент");
});

test("the title falls back to the industry, then the given name, then a generic one", () => {
  assert.equal(conversationTitle({ industry: "Образование" }), "Разговор — Образование");
  assert.equal(conversationTitle({ fallback: "Поддержка связи" }), "Разговор — Поддержка связи");
  assert.equal(conversationTitle({}), "Голосовой разговор");
});

test("an undescribed agent is named generically, and says it is undescribed", () => {
  assert.deepEqual(describeAgent(null), {
    configured: false,
    agentName: "Голосовой агент",
    role: "",
    industry: "",
    purpose: "",
  });

  assert.equal(describeAgent(label("Ассистент Портал")).agentName, "Ассистент Портал");
});

test("call status follows the call state and whether a summary exists", () => {
  assert.equal(callStatus("idle", null, false), "idle");
  assert.equal(callStatus("listening", null, false), "live");
  assert.equal(callStatus("processing", null, false), "live");
  assert.equal(callStatus("ended", null, true), "summarizing");
  assert.equal(callStatus("ended", null, false), "unavailable");
  assert.equal(callStatus("ended", summary, false), "completed");
});

test("the flow moves Настроить -> Начать -> Завершить -> Изучить", () => {
  assert.equal(flowStep("idle", false), 0);
  assert.equal(flowStep("idle", true), 1);
  assert.equal(flowStep("live", true), 2);
  assert.equal(flowStep("summarizing", true), 2);
  assert.equal(flowStep("completed", true), 3);
});

test("a finished call becomes a complete record", () => {
  const record = buildCallRecord({
    config: label("Ассистент Портал", "Ассистент поддержки пациентов", "Медицина и здоровье"),
    callState: "ended",
    summary,
    contact: "Анна",
  });

  assert.equal(record.status, "completed");
  assert.equal(record.title, "Разговор — Ассистент поддержки пациентов");
  assert.equal(record.contact, "Анна");
  assert.equal(record.agent.role, "Ассистент поддержки пациентов");
  assert.equal(record.callId, "ЗВОНОК-20260920-104406");
  assert.equal(record.durationSeconds, 272);
  assert.deepEqual(record.topics, ["перенос приёма", "свободное окно"]);
  assert.equal(record.outcome.ok, true);
  assert.equal(record.outcome.detail, "Разговор проведён агентом «Ассистент Портал».");
  assert.match(record.notes, /Анна спрашивал\(а\): перенос приёма, свободное окно\./);
  assert.match(record.notes, /Ассистент Портал предоставил\(а\) запрошенную информацию\./);
});

test("confirmed actions are counted in the notes", () => {
  const record = buildCallRecord({
    config: null,
    callState: "ended",
    summary: {
      ...summary,
      actionsTaken: ["В начале разговора сообщено, что на линии ИИ-ассистент", "Выполнено: перенос приёма"],
    },
  });

  assert.match(record.notes, /Оператор спрашивал\(а\)/);
  assert.match(record.notes, /выполнил\(а\) 1 подтверждённое действие\./);
});

test("a call with no questions has no topics and says so", () => {
  const record = buildCallRecord({
    config: null,
    callState: "ended",
    summary: { ...summary, keyPoints: ["Вопросов не поступило"] },
  });

  assert.deepEqual(record.topics, []);
  assert.match(record.notes, /не задал\(а\) вопросов/);
});

test("a call that did not complete says what happened instead of succeeding", () => {
  const record = buildCallRecord({
    config: null,
    callState: "ended",
    summary: { ...summary, outcome: "wrong_person" },
  });

  assert.equal(record.outcome.ok, false);
  assert.equal(record.outcome.headline, "Звонок завершён: wrong person");
});

test("before a call there is nothing to summarise and no invented details", () => {
  const record = buildCallRecord({ config: null, callState: "idle" });

  assert.equal(record.status, "idle");
  assert.equal(record.callId, null);
  assert.equal(record.durationSeconds, null);
  assert.equal(record.outcome, null);
  assert.equal(record.notes, "");
  assert.equal(record.contact, "Оператор");
});

test("a live call shows its running duration and start time", () => {
  const record = buildCallRecord({ config: null, callState: "listening", duration: 12, startedAt: 5 });

  assert.equal(record.status, "live");
  assert.equal(record.durationSeconds, 12);
  assert.equal(record.startedAt, 5);
});

test("a call that ended without a summary carries the connection error", () => {
  const record = buildCallRecord({ config: null, callState: "ended", callError: "Не удалось получить токен LiveKit." });

  assert.equal(record.status, "unavailable");
  assert.equal(record.error, "Не удалось получить токен LiveKit.");
});
