// Turns what the console knows (the agent configuration, the call state and the
// finished call's result) into the "call record" the Home page shows: a
// summary in the centre and phone-call style details on the right. Nothing here
// is specific to a domain: every label comes from the configuration or the call.

import { displayName } from "./format.js";
import { label, toneOf } from "./results.js";

// A configured role reads as a job title ("Ассистент поддержки"), and a call is
// not that job - it is a conversation with the client. The title is dropped and
// what is left is what the conversation is about.
const JOB_TITLE = /\s+(ассистент|агент|оператор|специалист|консультант|менеджер|помощник|бот)$/i;
const COVERED = "Обсуждено: ";
const NO_QUESTIONS = "Вопросов не поступило";
const EXECUTED = "Выполнено после подтверждения";

const LIVE_STATES = ["connecting", "listening", "processing", "speaking"];

const plural = (count, one, few, many) => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;

  return `${count} ${many}`;
};

// "Ассистент поддержки клиентов" -> "Поддержка клиентов". Falls back to the
// industry, then the built-in profile, so an unconfigured agent still has a name.
export function conversationTitle({ role, industry, fallback } = {}) {
  const base = (role || industry || fallback || "").replace(JOB_TITLE, "").trim();

  return base ? `Разговор: ${base}` : "Голосовой разговор";
}

// Who the agent is, from the saved configuration when there is one and from the
// built-in profile otherwise (calls still work before anything is configured).
export function describeAgent(config, profile) {
  return {
    configured: Boolean(config),
    agentName: config?.agentName || profile.name,
    role: config?.role || profile.name,
    industry: config?.industry || "",
    purpose: config?.purpose || profile.description || "",
  };
}

// idle | live | summarizing | completed | unavailable
export function callStatus(callState, summary, summaryPending) {
  if (LIVE_STATES.includes(callState)) return "live";
  if (callState !== "ended") return "idle";
  if (summary) return "completed";

  return summaryPending ? "summarizing" : "unavailable";
}

// Which step of Настроить -> Начать -> Завершить -> Изучить the person is on.
export function flowStep(status, configured) {
  if (status === "idle") return configured ? 1 : 0;
  if (status === "live") return 2;

  return status === "summarizing" ? 2 : 3;
}

function topicsOf(summary) {
  return (summary?.keyPoints ?? [])
    .filter((point) => point.startsWith(COVERED))
    .map((point) => point.slice(COVERED.length));
}

// Key points that are neither a topic nor the "nothing asked" filler, such as
// how many attempts the guardrails blocked.
function flagsOf(summary) {
  return (summary?.keyPoints ?? []).filter((point) => !point.startsWith(COVERED) && point !== NO_QUESTIONS);
}

function buildNotes({ summary, topics, contact, agentName }) {
  if (!summary) return "";

  const executed = summary.actionsTaken.filter((action) => action.startsWith(EXECUTED)).length;
  const notes = [];

  if (topics.length) {
    notes.push(`${contact} спрашивал(а): ${topics.join(", ").toLowerCase()}.`);
    notes.push(
      executed
        ? `${agentName} выполнил(а) ${plural(executed, "подтверждённое действие", "подтверждённых действия", "подтверждённых действий")}.`
        : `${agentName} предоставил(а) запрошенную информацию.`
    );
  } else {
    notes.push(`${contact} не задал(а) вопросов до завершения звонка.`);
  }

  flagsOf(summary).forEach((flag) => notes.push(`${flag}.`));

  return notes.join(" ");
}

function outcomeOf(summary, agentName) {
  if (!summary) return null;

  const ok = toneOf(summary.outcome) === "ok";

  return {
    ok,
    headline: ok ? "Звонок успешно завершён" : `Звонок завершён: ${label(summary.outcome)}`,
    detail: ok
      ? `Разговор проведён агентом «${agentName}».`
      : `${agentName} не удалось полностью завершить этот звонок.`,
  };
}

export function buildCallRecord({
  config,
  profile,
  user,
  callState,
  summary = null,
  summaryPending = false,
  duration = 0,
  startedAt = null,
  callError = null,
}) {
  const agent = describeAgent(config, profile);
  const status = callStatus(callState, summary, summaryPending);
  const contact = displayName(user);
  const topics = topicsOf(summary);

  return {
    status,
    agent,
    contact,
    title: conversationTitle({ role: agent.role, industry: agent.industry, fallback: profile.name }),
    callId: summary?.callId ?? null,
    startedAt: summary?.startedAt ?? startedAt,
    durationSeconds: summary ? summary.durationSeconds : status === "idle" ? null : duration,
    summaryText: summary?.summary ?? "",
    topics,
    actions: summary?.actionsTaken ?? [],
    nextSteps: summary?.nextSteps ?? [],
    evidence: summary?.evidence ?? [],
    transcript: summary?.transcript ?? [],
    audit: summary?.audit ?? [],
    notes: buildNotes({ summary, topics, contact, agentName: agent.agentName }),
    outcome: outcomeOf(summary, agent.agentName),
    error: status === "unavailable" ? callError : null,
  };
}
