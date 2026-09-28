export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

// The locale is pinned to ru-RU rather than left to the browser: a call record is
// read by the operator's colleagues, and it must read the same for all of them.
export const LOCALE = "ru-RU";

export function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLongDate(timestamp) {
  return new Date(timestamp).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Who the console is working as. The sign-in only has an email, so the name is
// its local part; with no sign-in (offline mode) it is just "Оператор".
export function displayName(user) {
  const local = user?.email?.split("@")[0]?.trim();

  return local || "Оператор";
}

export const CALL_STATE_TEXT = {
  idle: "Готов начать",
  connecting: "Соединение...",
  listening: "Слушаю...",
  speaking: "Говорю...",
  processing: "Обрабатываю...",
  ended: "Звонок завершён",
};
