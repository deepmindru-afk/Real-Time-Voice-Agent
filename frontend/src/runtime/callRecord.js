// Turns what the console knows (the agent description, the call state and the finished
// call's result) into the "call record" the Home page shows: a summary in the centre and
// phone-call style details on the right. Nothing here is domain-specific: every label
// comes from the agent description or the call itself.

import { label, toneOf } from "./results.js";

// What the card is titled. A role reads as a job title, and a call is not that job - it
// is a conversation with the client - so the title labels the role rather than repeating
// it back as a sentence.
//
// The role is used exactly as the operator wrote it. An earlier version stripped a leading
// "Ассистент", the way the English version stripped a trailing "Assistant", and was left
// with "поддержки пациентов" - the genitive of "поддержка пациентов", and not a title.
// Russian job titles are noun phrases in the genitive, so they cannot be truncated and
// re-cased by string surgery; they are shown whole or not at all.
const COVERED = "Обсуждено: ";
const NO_QUESTIONS = "Вопросов не поступило";

const LIVE_STATES = ["connecting", "listening", "processing", "speaking"];

const plural = (count, one, few, many) => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;

  return `${count} ${many}`;
};

// "Ассистент поддержки пациентов" -> "Поддержка пациентов". With nothing described at
// all, a call is still a call, and it is called that.
export function conversationTitle({ role, industry, fallback } = {}) {
  const value = (role || industry || fallback || "").trim();

  return value ? `Разговор — ${value}` : "Голосовой разговор";
}

// Who the agent is. Before the agent is described there is no name to show, so the
// generic one is used - which is honest, and is what the UI says it is.
export function describeAgent(config) {
  return {
    configured: Boolean(config),
    agentName: config?.agentName || "Голосовой агент",
    role: config?.role || "",
    industry: config?.industry || "",
    purpose: config?.purpose || "",
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

// Key points that are neither a topic nor the "nothing asked" filler.
function flagsOf(summary) {
  return (summary?.keyPoints ?? []).filter((point) => !point.startsWith(COVERED) && point !== NO_QUESTIONS);
}

function buildNotes({ summary, topics, contact, agentName }) {
  if (!summary) return "";

  const executed = summary.actionsTaken.filter((action) => action.startsWith("Выполнено")).length;
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
  callState,
  summary = null,
  summaryPending = false,
  duration = 0,
  startedAt = null,
  callError = null,
  contact = "Оператор",
}) {
  const agent = describeAgent(config);
  const status = callStatus(callState, summary, summaryPending);
  const topics = topicsOf(summary);

  return {
    status,
    agent,
    contact,
    title: conversationTitle({ role: agent.role, industry: agent.industry, fallback: agent.agentName }),
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
