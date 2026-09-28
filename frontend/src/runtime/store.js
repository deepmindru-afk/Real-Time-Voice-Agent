// localStorage, once.
//
// Every store in the app is the same three steps - read a JSON array, write one back,
// never let a missing or blocked storage break the feature - so it is written once here
// instead of five times. Private windows and full quotas are a normal condition, not an
// error: a store that cannot persist still works for the visit.

const memory = new Map();

function backing(key) {
  try {
    // Probe once: if this throws, every later call would too.
    globalThis.localStorage.getItem(key);

    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readJson(key, fallback) {
  const store = backing(key);

  if (store) {
    try {
      const raw = store.getItem(key);

      if (raw != null) return JSON.parse(raw);
    } catch {
      // Corrupt or truncated: fall through to the in-memory copy, then to the fallback.
    }
  }

  return memory.get(key) ?? fallback;
}

export function writeJson(key, value) {
  memory.set(key, value);

  const store = backing(key);

  if (!store) return false;

  try {
    store.setItem(key, JSON.stringify(value));

    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  memory.delete(key);

  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // Nothing to do: the value is gone from memory either way.
  }
}

// A readable, sortable id for records created in the browser. The time prefix keeps them
// in creation order when sorted as text, which matters for the history list.
export function localId(prefix = "REC") {
  const stamp = Date.now().toString(36).toUpperCase().padStart(9, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}-${stamp}${random}`;
}
