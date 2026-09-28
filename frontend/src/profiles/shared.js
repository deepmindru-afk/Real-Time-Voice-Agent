import { AI_DISCLOSURE, NEVER_ASK } from "../runtime/guardrails.js";

export function makeGreeting(introduction, offer) {
  return `${AI_DISCLOSURE} ${introduction} ${NEVER_ASK} ${offer}`;
}

// Rubles, grouped the Russian way: a space every three digits, never a decimal when
// the amount is whole (a spoken "1 800 000" is what a person would say).
export function rubles(amount) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount)} ₽`;
}

// "а, б и в" - the last two are joined with "и", which is what a list of three sounds
// like when it is read aloud.
export function listSentence(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} и ${items[1]}`;

  return `${items.slice(0, -1).join(", ")} и ${items[items.length - 1]}`;
}

// Pulls something like ЗАЯВ-1024 out of what the caller said. The prefix is written
// the way a person would say it, so the digits are what actually has to be there.
export function findRef(text, prefix) {
  const match = text.match(new RegExp(`${prefix}[- ]?(\\d{2,4})`, "i"));

  return match ? `${prefix}-${match[1]}`.toUpperCase() : null;
}
