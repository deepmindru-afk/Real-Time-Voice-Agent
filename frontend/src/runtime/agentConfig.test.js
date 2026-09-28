import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LIMITS,
  emptyLabel,
  isConfigured,
  loadLabel,
  normalizeLabel,
  sameLabel,
  saveLabel,
  validateLabel,
} from "./agentConfig.js";

const storage = (initial = {}) => {
  const map = new Map(Object.entries(initial));

  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
};

const full = () => ({ agentName: "Ассистент Портал", role: "Координатор приёма", purpose: "Записывает и переносит приёмы." });

test("a missing label is an empty one, not undefined", () => {
  assert.deepEqual(normalizeLabel(undefined), emptyLabel());
  assert.deepEqual(normalizeLabel(null), emptyLabel());
  assert.deepEqual(normalizeLabel("nonsense"), emptyLabel());
});

test("values are trimmed and capped", () => {
  const value = normalizeLabel({ agentName: `  ${"а".repeat(200)}  `, role: "  роль  ", purpose: "x".repeat(1000) });

  assert.equal(value.agentName.length, LIMITS.agentName);
  assert.equal(value.role, "роль");
  assert.equal(value.purpose.length, LIMITS.purpose);
});

test("only a name is required", () => {
  assert.equal(isConfigured(emptyLabel()), false);
  assert.equal(isConfigured({ agentName: "Агент" }), true);
  assert.equal(isConfigured({ role: "роль без имени" }), false);

  assert.deepEqual(validateLabel(emptyLabel()), { agentName: "Укажите, как называть агента." });
  assert.deepEqual(validateLabel(full()), {});
});

test("sameLabel ignores whitespace and key order", () => {
  assert.equal(sameLabel({ agentName: "Агент", role: "Роль" }, { role: " Роль ", agentName: "Агент " }), true);
  assert.equal(sameLabel({ agentName: "Агент" }, { agentName: "Другой" }), false);
});

test("the label round-trips through storage", () => {
  const store = storage();

  assert.equal(saveLabel(full(), store), true);
  assert.deepEqual(loadLabel(store), full());
});

test("unreadable or missing storage yields an empty label, never a throw", () => {
  assert.deepEqual(loadLabel(storage({ "portal-agent-label": "{not json" })), emptyLabel());
  assert.deepEqual(loadLabel(storage()), emptyLabel());
  assert.deepEqual(loadLabel(undefined), emptyLabel()); // no localStorage at all, as in Node
});

test("blocked storage reports failure instead of pretending", () => {
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };

  assert.equal(saveLabel(full(), blocked), false);
  assert.deepEqual(loadLabel(blocked), emptyLabel());
});
