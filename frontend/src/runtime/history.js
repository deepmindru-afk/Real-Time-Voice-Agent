// Call history, kept in this browser.
//
// A call's transcript, summary and outcome are all produced in the tab that ran the
// call, so they are all the tab can store. That is also the honest limit of this file:
// it is a log for this browser and this browser only. It is not shared between operators,
// it is not backed up, and clearing site data clears it - which is why the export button
// exists.
//
// Every record is self-contained, so one unreadable entry cannot cost us the rest.

import { localId, readJson, writeJson } from "./store.js";

const KEY = "portal-call-history";

// Enough history to be useful in a demo and small enough that localStorage never becomes
// the reason a call fails to start. The oldest entries fall off the end.
const LIMIT = 50;

// status: live | completed | failed | queued
export function readHistory() {
  const rows = readJson(KEY, []);

  if (!Array.isArray(rows)) return [];

  return rows.filter((row) => row && typeof row === "object");
}

const persist = (rows) => {
  writeJson(KEY, rows.slice(0, LIMIT));

  return rows;
};

// Newest first, which is the order every screen shows them in.
export function addCall(record) {
  const rows = readHistory();
  const entry = {
    id: record.id ?? localId("ЗВОНОК"),
    createdAt: record.createdAt ?? Date.now(),
    status: record.status ?? "completed",
    ...record,
  };

  return persist([entry, ...rows.filter((row) => row.id !== entry.id)]);
}

export function updateCall(id, patch) {
  const rows = readHistory();
  const next = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

  return persist(next);
}

export function deleteCall(id) {
  return persist(readHistory().filter((row) => row.id !== id));
}

export function clearHistory() {
  return persist([]);
}

// The small counts the dashboard and the sidebar read.
export function historyCounts(rows = readHistory()) {
  return {
    total: rows.length,
    completed: rows.filter((row) => row.status === "completed").length,
    failed: rows.filter((row) => row.status === "failed").length,
    queued: rows.filter((row) => row.status === "queued").length,
  };
}
