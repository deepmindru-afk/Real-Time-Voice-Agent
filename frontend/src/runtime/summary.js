// Builds the "call result" for a finished call: outcome, transcript and audit
// trail. This is the shape a business workflow would receive back from an
// outbound call job.

function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;

  return `${count} ${many}`;
}

export function buildSummary(session, durationSeconds, transcript = []) {
  const { profile } = session;
  const userTurns = session.audit.filter((event) => event.type === "user_turn").length;
  const toolCalls = session.audit.filter((event) => event.type === "tool_call").length;

  const sentences = [];

  if (session.topics.length) {
    sentences.push(`Обсуждены темы: ${session.topics.join(", ").toLowerCase()}.`);
  } else {
    sentences.push(`Звонок завершён без запросов со стороны ${profile.counterparty}.`);
  }

  session.executed.forEach((item) => sentences.push(`${item.summary}.`));
  session.declined.forEach((item) => sentences.push(`Отменено по просьбе клиента: ${item.label.toLowerCase()}.`));
  session.lapsed.forEach((item) => sentences.push(`Не подтверждено, действие не выполнено: ${item.label.toLowerCase()}.`));

  const keyPoints = session.topics.length
    ? session.topics.map((topic) => `Обсуждено: ${topic}`)
    : ["Вопросов не поступило"];

  if (session.blockedCount) {
    keyPoints.push(`Заблокировано попыток передачи конфиденциальных данных: ${session.blockedCount}`);
  }

  const actionsTaken = [
    "В начале звонка сообщено, что на линии ИИ-агент",
    ...session.executed.map((item) => `Выполнено после подтверждения: ${item.label}`),
    ...session.declined.map((item) => `Отклонено клиентом: ${item.label}`),
    ...session.lapsed.map((item) => `Не подтверждено: ${item.label}`),
  ];

  return {
    callId: session.id,
    startedAt: session.startedAt,
    durationSeconds,
    profileId: profile.id,
    profileName: profile.name,
    type: `Живой разговор (ИИ ↔ ${profile.counterparty})`,
    outcome: session.executed.length ? "action_completed" : "completed",
    summary: sentences.join(" "),
    keyPoints,
    actionsTaken,
    nextSteps: profile.nextSteps,
    evidence: [
      ...session.refs,
      `Расшифровка разговора (${plural(userTurns, "реплика", "реплики", "реплик")})`,
      `Журнал вызовов инструментов (${plural(toolCalls, "вызов", "вызова", "вызовов")})`,
    ],
    transcript,
    audit: session.audit,
  };
}
