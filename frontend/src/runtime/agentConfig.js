// What to call the agent in this console.
//
// This is a label, not a configuration. The agent that answers is chosen by the token
// endpoint, from the deployment's own environment (LIVEKIT_AGENT_NAME), and a browser has
// no business choosing it: letting a caller pick the agent would be another route to the
// API secret. So nothing here reaches the agent worker, and pretending otherwise would be
// the worst kind of lie in a console - a form full of chips that go nowhere.
//
// What it is for is the parts of the UI that need a name and a purpose: the call record
// title, the welcome line, and the note beside the agent's own output. Three fields, kept
// honest about what they affect, stored in this browser.

const KEY = "portal-agent-label";

export const LIMITS = {
  agentName: 60,
  role: 80,
  purpose: 240,
};

export function emptyLabel() {
  return { agentName: "", role: "", purpose: "" };
}

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function normalizeLabel(raw) {
  const input = raw && typeof raw === "object" ? raw : {};

  return {
    agentName: text(input.agentName, LIMITS.agentName),
    role: text(input.role, LIMITS.role),
    purpose: text(input.purpose, LIMITS.purpose),
  };
}

// {field: message} for the fields that must be filled in for the label to be worth
// showing. Only the name is required: a name with no role is still a name, which is what
// most of the UI needs.
export function validateLabel(label) {
  const value = normalizeLabel(label);
  const errors = {};

  if (!value.agentName) errors.agentName = "Укажите, как называть агента.";

  return errors;
}

export const isConfigured = (label) => Object.keys(validateLabel(label)).length === 0;

export const sameLabel = (a, b) =>
  JSON.stringify(normalizeLabel(a)) === JSON.stringify(normalizeLabel(b));

export function loadLabel(storage = globalThis.localStorage) {
  try {
    return normalizeLabel(JSON.parse(storage.getItem(KEY)));
  } catch {
    return emptyLabel();
  }
}

export function saveLabel(label, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(normalizeLabel(label)));

    return true;
  } catch {
    return false;
  }
}
