// The call result for a LiveKit call, built from what this browser actually saw.
//
// When the deployment ties a room to a call record, the server's own summary is
// used instead (see session.js). This exists so a call still produces a result -
// outcome, transcript, what the agent did - when there is nothing on the server to
// ask, rather than leaving the console with an empty card.
//
// It is deliberately factual: it reports what was said and which tools the agent
// published, and makes no claim about anything it cannot see.

const plural = (count, one, few, many) => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;

  return `${count} ${many}`;
};

const ROLES = { You: "оператор", Agent: "голосовой агент" };

export function buildTranscriptSummary({ callId = null, startedAt = 0, durationSeconds = 0, transcript = [], tools = [] } = {}) {
  const userTurns = transcript.filter((entry) => entry.speaker === "You");
  const agentTurns = transcript.filter((entry) => entry.speaker === "Agent");

  const said = agentTurns
    .map((entry) => entry.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const summary = said
    ? `Агент ответил в ${plural(agentTurns.length, "реплику", "реплики", "реплик")}.`
    : "Агент не ответил ни одной репликой.";

  const keyPoints = userTurns.length
    ? userTurns.map((entry) => `Обсуждено: ${entry.text}`)
    : ["Вопросов не поступило"];

  return {
    callId: callId ?? `LK-${startedAt}`,
    startedAt,
    durationSeconds,
    profileId: null,
    profileName: "LiveKit",
    type: "Разговор в реальном времени (LiveKit)",
    outcome: agentTurns.length ? "completed" : "no_answer",
    summary,
    keyPoints,
    actionsTaken: [
      "В начале разговора сообщено, что на линии ИИ-агент",
      ...tools.map((tool) => `Выполнен вызов инструмента: ${tool.name}`),
    ],
    nextSteps: [],
    evidence: [
      `Расшифровка разговора (${plural(userTurns.length, "реплика", "реплики", "реплик")} ${ROLES.You})`,
      `Журнал инструментов агента (${plural(tools.length, "вызов", "вызова", "вызовов")})`,
    ],
    transcript,
    audit: transcript.map((entry) => ({
      at: new Date(entry.time ?? entry.at ?? startedAt).toISOString(),
      type: entry.speaker === "Agent" ? "agent_turn" : "user_turn",
      text: entry.text,
    })),
  };
}
