// The server's call result (snake_case) as the summary card wants it, plus how an
// outcome or job status should read in Russian.
export function mapResult(result) {
  return {
    callId: result.call_id,
    startedAt: Date.parse(result.started_at),
    durationSeconds: result.duration_seconds,
    profileId: result.profile_id,
    profileName: result.profile_name,
    type: result.type,
    outcome: result.outcome,
    summary: result.summary,
    keyPoints: result.key_points ?? [],
    actionsTaken: result.actions_taken ?? [],
    nextSteps: result.next_steps ?? [],
    evidence: result.evidence ?? [],
    transcript: result.transcript ?? [],
    audit: result.audit ?? [],
  };
}

const GOOD = ["completed", "action_completed"];
const IN_FLIGHT = ["ringing", "in_progress", "answered"];

// How an outcome or job status should look: ok | info | warn
export function toneOf(status) {
  if (GOOD.includes(status)) return "ok";
  if (IN_FLIGHT.includes(status)) return "info";
  return "warn";
}

// The status, in words. These are values the server sends, so the Russian is a
// lookup rather than a guess; anything unrecognised is shown as the raw code
// instead of being flattened into a wrong word.
const LABEL = {
  completed: "Завершён",
  action_completed: "Действие выполнено",
  no_answer: "Нет ответа",
  declined: "Отклонён",
  cancelled: "Отменён",
  failed: "Не удался",
  ringing: "Звонит",
  answered: "Отвечен",
  in_progress: "В работе",
  queued: "В очереди",
  recorded: "Записан",
  none: "—",
};

export function label(status) {
  return LABEL[status] ?? String(status ?? "").replace(/_/g, " ");
}
