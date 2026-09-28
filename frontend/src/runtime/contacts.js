// Contacts, kept in this browser.
//
// A contact is someone your agents may call: a name, how to reach them, whether they
// agreed to be called, and when they are reachable. Consent is the field that matters -
// the workflow screen refuses to run for anyone who has not given it, so it is stored
// explicitly and never inferred from the absence of an objection.
//
// Records carry a snake_case `preferred_contact_time` because that is the shape the
// scheduling code reads, and inventing a second format here would mean translating
// between them forever.

import { localId, readJson, writeJson } from "./store.js";

const KEY = "portal-contacts";

export const CONSENT_OPTIONS = ["unknown", "granted", "revoked"];

export const CONSENT_LABEL = {
  unknown: "неизвестно",
  granted: "дано",
  revoked: "отозвано",
};

export const CONSENT_TONE = { granted: "ok", revoked: "warn", unknown: "info" };

const clean = (value) => (typeof value === "string" ? value.trim() : "");

// A contact can carry the dates a workflow triggers on. Kept as a flat map of field id to
// an ISO date string so adding a trigger type is a matter of naming a field, not reshaping
// every record.
const DATES = ["appointment_date", "renewal_date", "payment_due_date", "callback_date"];

function dates(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const out = {};

  for (const field of DATES) {
    const value = clean(input[field]).slice(0, 10);

    if (value && !Number.isNaN(new Date(value).getTime())) out[field] = value;
  }

  return out;
}

export function normalizeContact(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const { start, end, timezone } = input.preferred_contact_time ?? {};

  return {
    id: input.id ?? localId("КОНТАКТ"),
    name: clean(input.name).slice(0, 120),
    phone: clean(input.phone).slice(0, 24) || null,
    email: clean(input.email).slice(0, 254) || null,
    consent_status: CONSENT_OPTIONS.includes(input.consent_status) ? input.consent_status : "unknown",
    preferred_language: clean(input.preferred_language).slice(0, 16) || null,
    // Null, not an empty object: "no preferred window" and "an empty window" are
    // different, and only the first one means we may call at any time.
    preferred_contact_time:
      clean(start) || clean(end) || clean(timezone)
        ? { start: clean(start), end: clean(end), timezone: clean(timezone) }
        : null,
    dates: dates(input.dates),
    createdAt: input.createdAt ?? Date.now(),
  };
}

export function readContacts() {
  const rows = readJson(KEY, []);

  return Array.isArray(rows) ? rows.map(normalizeContact) : [];
}

const persist = (rows) => {
  writeJson(
    KEY,
    rows.map((row) => normalizeContact(row))
  );

  return rows.map((row) => normalizeContact(row));
}

export function createContact(data) {
  const created = normalizeContact({ ...data, id: localId("КОНТАКТ") });

  persist([...readContacts(), created]);

  return created;
}

export function updateContact(id, data) {
  const rows = readContacts();
  const at = rows.findIndex((row) => row.id === id);

  if (at === -1) return null;

  rows[at] = { ...rows[at], ...data, id };

  return persist(rows).find((row) => row.id === id);
}

export function deleteContact(id) {
  return persist(readContacts().filter((row) => row.id !== id));
}

// Whether this person may be called right now, and why not if they may not. Both halves
// are the same question: consent, and the window they asked to be reached in.
export function callPermission(contact, at = new Date()) {
  if (contact.consent_status === "revoked") {
    return { allowed: false, reason: "Согласие на звонки отозвано" };
  }

  if (contact.consent_status !== "granted") {
    return { allowed: false, reason: "Согласие на звонки не получено" };
  }

  const window = contact.preferred_contact_time;

  if (!window?.start || !window?.end) return { allowed: true, reason: null };

  // A preferred window is a local time of day, and only its bounds are recorded - there
  // is no zone to convert with, so it is read in the browser's own zone.
  const minutes = at.getHours() * 60 + at.getMinutes();
  const [from, to] = [window.start, window.end].map((value) => {
    const [hours, mins] = clean(value).split(":").map(Number);

    return Number.isFinite(hours) ? hours * 60 + (mins || 0) : Number.NaN;
  });

  if (!Number.isFinite(from) || !Number.isFinite(to)) return { allowed: true, reason: null };

  // A window that wraps past midnight is still a window, so the comparison is split
  // rather than assuming to > from.
  const inside = from <= to ? minutes >= from && minutes <= to : minutes >= from || minutes <= to;

  return inside
    ? { allowed: true, reason: null }
    : { allowed: false, reason: `Вне удобного времени (${window.start}–${window.end})` };
}
