// Workflows, kept in this browser.
//
// A workflow says when to call someone and what the call is for. Both halves used to be
// decided by a scheduler on a server; here the decision is made in the browser, at the
// moment you ask for it, by evaluateWorkflow() below. That is a real change in what this
// file is, so it is worth being precise about it:
//
//   - Eligibility is genuinely evaluated. Consent and the contact's preferred window are
//     both checked, and a refusal says which one stopped it.
//   - "Run now" does not dial anybody. It cannot: there is no telephony here, and the
//     app does not pretend otherwise. It records a call job in the history, queued, and
//     from there the call is started by hand in the console - which is the one thing this
//     app can actually do.
//   - Nothing runs on a schedule. A date_offset trigger describes when a call *would* be
//     due, and that is as far as it goes without a process that is awake to notice.

import { callPermission } from "./contacts.js";
import { addCall } from "./history.js";
import { localId, readJson, writeJson } from "./store.js";

const KEY = "portal-workflows";

export const STATUS_OPTIONS = ["draft", "active", "paused", "archived"];

export const STATUS_LABEL = {
  draft: "черновик",
  active: "активен",
  paused: "приостановлен",
  archived: "в архиве",
};

export const STATUS_TONE = { active: "ok", draft: "info", paused: "warn", archived: "warn" };

// The one trigger that can be evaluated here: a date field on the contact, offset by N
// days. Anything else is refused rather than stored, because an unevaluatable trigger
// would be a promise this app cannot keep.
export const TRIGGER_TYPES = [{ id: "date_offset", label: "Смещение по дате (дата в карточке контакта + N дней)" }];

// The fields a contact can carry a date in. The workflow picks one, so there is something
// concrete to be offset from.
export const REFERENCE_FIELDS = [
  { id: "appointment_date", label: "Дата приёма" },
  { id: "renewal_date", label: "Дата продления" },
  { id: "payment_due_date", label: "Дата платежа" },
  { id: "callback_date", label: "Дата обратного звонка" },
];

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const days = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

export function normalizeWorkflow(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const trigger = input.trigger_config ?? {};
  const action = input.action_config ?? {};
  const offset = days(trigger.offset_days);

  return {
    id: input.id ?? localId("СЦЕНАРИЙ"),
    name: clean(input.name).slice(0, 120),
    status: STATUS_OPTIONS.includes(input.status) ? input.status : "draft",
    trigger_type: "date_offset",
    trigger_config: {
      reference_field: clean(trigger.reference_field) || "appointment_date",
      offset_days: offset ?? -1,
      time: clean(trigger.time) || "10:00",
      timezone: clean(trigger.timezone) || "Europe/Moscow",
    },
    action_config: {
      reason: clean(action.reason).slice(0, 200),
      channel: action.channel === "phone" ? "phone" : "web",
      room_name: clean(action.room_name).slice(0, 120),
    },
    createdAt: input.createdAt ?? Date.now(),
  };
}

export function readWorkflows() {
  const rows = readJson(KEY, []);

  return Array.isArray(rows) ? rows.map(normalizeWorkflow) : [];
}

const persist = (rows) => {
  const cleanRows = rows.map(normalizeWorkflow);

  writeJson(KEY, cleanRows);

  return cleanRows;
}

export function createWorkflow(data) {
  const created = normalizeWorkflow({ ...data, id: localId("СЦЕНАРИЙ") });

  persist([...readWorkflows(), created]);

  return created;
}

export function updateWorkflow(id, data) {
  const rows = readWorkflows();

  if (!rows.some((row) => row.id === id)) return null;

  return persist(rows.map((row) => (row.id === id ? { ...row, ...data, id } : row))).find((row) => row.id === id);
}

export function deleteWorkflow(id) {
  return persist(readWorkflows().filter((row) => row.id !== id));
}

// The date a trigger is offset from, read off the contact. Returns null when the contact
// has no such date, which is a legitimate "not due" rather than an error.
function dueDate(contact, field) {
  const value = contact?.dates?.[field];

  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

// Would this workflow call this contact right now? The same two questions, in the order
// that stops the fewest wasted checks: is the workflow switched on, is the contact due,
// and may we call them.
export function evaluateWorkflow(workflow, contact, at = new Date()) {
  const name = workflow?.name ?? "Сценарий";

  if (!contact) return { eligible: false, reason: "Контакт не найден", detail: null, dueOn: null };

  if (workflow.status !== "active") {
    return { eligible: false, reason: `Сценарий «${name}» не активен`, detail: null, dueOn: null };
  }

  const due = dueDate(contact, workflow.trigger_config.reference_field);

  if (!due) {
    return {
      eligible: false,
      reason: `У контакта не заполнена дата «${REFERENCE_FIELDS.find((item) => item.id === workflow.trigger_config.reference_field)?.label ?? workflow.trigger_config.reference_field}»`,
      detail: null,
      dueOn: null,
    };
  }

  const triggerAt = new Date(due);
  triggerAt.setDate(triggerAt.getDate() + workflow.trigger_config.offset_days);
  triggerAt.setHours(...workflow.trigger_config.time.split(":").map(Number));

  if (at < triggerAt) {
    const days = Math.ceil((triggerAt - at) / 86_400_000);

    return {
      eligible: false,
      reason: `Срок ещё не наступил: через ${days} дн.`,
      detail: triggerAt.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }),
      dueOn: triggerAt.getTime(),
    };
  }

  const permission = callPermission(contact, at);

  if (!permission.allowed) {
    return { eligible: false, reason: permission.reason, detail: null, dueOn: triggerAt.getTime() };
  }

  return { eligible: true, reason: "Сценарий готов выполнить звонок", detail: null, dueOn: triggerAt.getTime() };
}

// Records the call as queued. It is a real entry in the real history - the one honest
// thing this app can do with it - and it says plainly that nobody has been called yet.
export function runWorkflow(workflow, contact, at = new Date()) {
  const check = evaluateWorkflow(workflow, contact, at);

  if (!check.eligible) {
    return { call_created: false, reason: check.reason, detail: check.detail, job_id: null };
  }

  const job = addCall({
    id: localId("ЗАДАЧА"),
    status: "queued",
    kind: "workflow",
    contact: contact.name,
    reason: workflow.action_config.reason || `Сценарий «${workflow.name}»`,
    channel: workflow.action_config.channel,
    room: workflow.action_config.room_name || null,
    workflow: workflow.name,
    createdAt: at.getTime(),
  });

  return { call_created: true, reason: "Задача создана", detail: null, job_id: job.id };
}
