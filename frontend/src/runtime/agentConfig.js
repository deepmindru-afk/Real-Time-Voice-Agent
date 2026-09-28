// What the operator wants the voice agent to do: its use case, role, audience,
// tasks, tone, language and rules. This is structured data, not display text, so
// it can be handed to the call (and to the LiveKit token request, which is what
// picks the agent that joins the room) as the agent's operating context. It is
// domain-agnostic: no industry is special.
//
// Every list here is the choice the operator actually sees, so the Russian is the
// stored value too - which is what makes the agent's own instructions Russian.

export const OTHER = "Другое";
export const CUSTOM = "Своё";

export const INDUSTRIES = [
  "Клиентская поддержка",
  "Медицина и здоровье",
  "Образование",
  "Банки и финансы",
  "Продажи",
  "Добыча полезных ископаемых",
  "Персонал и подбор",
  "Ресепшен",
  "Техническая поддержка",
  OTHER,
];

export const TARGET_USERS = [
  "Клиенты",
  "Сотрудники",
  "Студенты",
  "Операторы",
  "Пациенты",
  "Руководители",
  "Пользователи портала",
];

export const TASK_SUGGESTIONS = [
  "Отвечать на вопросы пользователей",
  "Искать по документам",
  "Предоставлять информацию",
  "Анализировать данные",
  "Назначать встречи",
  "Обрабатывать обращения клиентов",
  "Давать технические рекомендации",
  "Формировать краткие отчёты",
  "Выполнять действия в системах",
];

export const BEHAVIORS = [
  "Профессиональный",
  "Дружелюбный",
  "Краткий",
  "Подробный",
  "Технический",
  "Разговорный",
  CUSTOM,
];

export const LANGUAGES = ["Русский", "Английский", "Русский + английский", OTHER];

// Suggestions only: the role stays free text, so any domain works. Unknown
// industries (and "Другое") simply get no suggestions.
export const ROLE_SUGGESTIONS = {
  "Клиентская поддержка": ["Специалист поддержки клиентов", "Ассистент по заказам", "Специалист по обращениям"],
  "Медицина и здоровье": ["Ассистент поддержки пациентов", "Координатор приёма", "Навигатор по медицинским услугам"],
  Образование: ["Ассистент поддержки абитуриентов", "Консультант по приёму", "Советник по курсам"],
  "Банки и финансы": ["Ассистент банковской поддержки", "Ассистент по кредитным заявкам", "Агент по напоминаниям о платежах"],
  Продажи: ["Менеджер по продажам", "Консультант по продукту", "Ассистент квалификации лидов"],
  "Добыча полезных ископаемых": ["Поддержка добывающих операций", "Ассистент инструктажей по ТБ", "Ассистент оперативной отчётности"],
  "Персонал и подбор": ["Ассистент отдела кадров", "Скрининг резюме", "Ассистент адаптации"],
  Ресепшен: ["Виртуальный ресепшен", "Координатор приёма посетителей"],
  "Техническая поддержка": ["Инженер технической поддержки", "Ассистент ИТ-службы"],
};

export const LIMITS = {
  agentName: 60,
  role: 80,
  purpose: 500,
  domainContext: 1500,
  additionalInstructions: 1500,
  short: 60, // industryOther, languageOther, behaviorCustom and each chip
  chips: 12, // per list
};

const STORAGE_KEY = "voice-agent-config";

export function emptyConfig() {
  return {
    industry: "",
    industryOther: "",
    agentName: "",
    role: "",
    purpose: "",
    targetUsers: [],
    primaryTasks: [],
    domainContext: "",
    conversationBehavior: [],
    behaviorCustom: "",
    language: "Русский",
    languageOther: "",
    voice: "", // "" means the server's own default voice for the agent
    additionalInstructions: "",
  };
}

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// Trimmed, capped and de-duplicated (ignoring case), in the order given.
function list(value, max = LIMITS.short) {
  const seen = new Set();
  const items = [];

  for (const entry of Array.isArray(value) ? value : []) {
    const item = text(entry, max);

    if (item && !seen.has(item.toLowerCase()) && items.length < LIMITS.chips) {
      seen.add(item.toLowerCase());
      items.push(item);
    }
  }

  return items;
}

// Always returns a complete, clean config, whatever it is given (a form, or
// something read back from storage that an older version wrote).
export function normalizeConfig(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const blank = emptyConfig();
  const industry = INDUSTRIES.includes(input.industry) ? input.industry : blank.industry;
  const language = LANGUAGES.includes(input.language) ? input.language : blank.language;
  const behaviors = list(input.conversationBehavior).filter((item) => BEHAVIORS.includes(item));

  return {
    industry,
    industryOther: industry === OTHER ? text(input.industryOther, LIMITS.short) : "",
    agentName: text(input.agentName, LIMITS.agentName),
    role: text(input.role, LIMITS.role),
    purpose: text(input.purpose, LIMITS.purpose),
    targetUsers: list(input.targetUsers),
    primaryTasks: list(input.primaryTasks),
    domainContext: text(input.domainContext, LIMITS.domainContext),
    conversationBehavior: behaviors,
    behaviorCustom: behaviors.includes(CUSTOM) ? text(input.behaviorCustom, LIMITS.short) : "",
    language,
    languageOther: language === OTHER ? text(input.languageOther, LIMITS.short) : "",
    voice: text(input.voice, 200),
    additionalInstructions: text(input.additionalInstructions, LIMITS.additionalInstructions),
  };
}

// {field: message} for everything that stops this being a specialised agent.
// Empty means valid. Additional instructions, tasks and users stay optional.
export function validateConfig(config) {
  const value = normalizeConfig(config);
  const errors = {};

  if (!value.industry) errors.industry = "Выберите сценарий применения или отрасль.";
  else if (value.industry === OTHER && !value.industryOther) errors.industryOther = "Опишите ваш сценарий применения или отрасль.";

  if (!value.agentName) errors.agentName = "Укажите название агента.";
  if (!value.role) errors.role = "Укажите, какую роль должен выполнять агент.";
  if (!value.purpose) errors.purpose = "Опишите, что агент должен помочь сделать пользователю.";

  if (value.language === OTHER && !value.languageOther) errors.languageOther = "Укажите язык общения.";
  if (value.conversationBehavior.includes(CUSTOM) && !value.behaviorCustom) {
    errors.behaviorCustom = "Опишите собственное поведение или снимите выбор «Своё».";
  }

  return errors;
}

export const isConfigured = (config) => Object.keys(validateConfig(config)).length === 0;

// The flat shape a call reads: "Другое" and "Своё" replaced by what the operator
// actually typed. Null unless the config is valid.
export function resolveConfig(config) {
  if (!isConfigured(config)) return null;

  const value = normalizeConfig(config);

  return {
    industry: value.industry === OTHER ? value.industryOther : value.industry,
    agentName: value.agentName,
    role: value.role,
    purpose: value.purpose,
    targetUsers: value.targetUsers,
    primaryTasks: value.primaryTasks,
    domainContext: value.domainContext,
    conversationBehavior: value.conversationBehavior.map((item) => (item === CUSTOM ? value.behaviorCustom : item)),
    language: value.language === OTHER ? value.languageOther : value.language,
    voice: value.voice,
    additionalInstructions: value.additionalInstructions,
  };
}

// True when two configs are the same once cleaned, so "unsaved changes" ignores
// whitespace and key order.
export function sameConfig(a, b) {
  return JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b));
}

// --- the backend Agent ------------------------------------------------------------------------
//
// Field mapping (see the Step 18B report for the full audit):
//
//   agentName              -> name
//   role                   -> role
//   industry/industryOther -> industry          ("Другое" resolved to what was typed, like resolveConfig)
//   purpose                -> purpose
//   targetUsers            -> target_users
//   primaryTasks           -> primary_tasks
//   conversationBehavior   -> behavior_config.tone   (a list; the backend column is a free dict,
//                                                      so this is the one key this app writes to it)
//   domainContext          -> instructions.domain_context
//   additionalInstructions -> instructions.additional_instructions
//   language/languageOther -> language          (sent verbatim: the backend column is an unconstrained
//                                                 string, so there is no code to translate to or from)
//   voice                  -> voice
//
// `id`, `organization_id` and `status` are never sent from here: the server decides all three.

// The shape POST/PUT /api/agents reads. Null unless the form is valid (same rule as resolveConfig,
// which this is built on).
export function toAgentPayload(config) {
  const value = resolveConfig(config);

  if (!value) return null;

  return {
    name: value.agentName,
    role: value.role,
    industry: value.industry,
    purpose: value.purpose,
    target_users: value.targetUsers,
    primary_tasks: value.primaryTasks,
    behavior_config: { tone: value.conversationBehavior },
    instructions: { domain_context: value.domainContext, additional_instructions: value.additionalInstructions },
    language: value.language,
    voice: value.voice || null,
  };
}

// The reverse: an AgentResponse (GET/POST/PUT's JSON body) back into the form's own shape. A
// stored value that is no longer one of the fixed choices (industry, language, a behavior chip)
// is not dropped: it round-trips through "Другое"/"Своё", exactly as if the operator had just
// typed it, so nothing saved through this app can ever be silently lost by loading it back.
export function fromAgentPayload(agent) {
  const storedBehaviors = Array.isArray(agent.behavior_config?.tone) ? agent.behavior_config.tone : [];
  const knownBehaviors = storedBehaviors.filter((item) => BEHAVIORS.includes(item) && item !== CUSTOM);
  const customBehavior = storedBehaviors.find((item) => !BEHAVIORS.includes(item));
  const knownIndustry = INDUSTRIES.includes(agent.industry) ? agent.industry : agent.industry ? OTHER : "";
  const knownLanguage = LANGUAGES.includes(agent.language) ? agent.language : agent.language ? OTHER : "Русский";

  return normalizeConfig({
    industry: knownIndustry,
    industryOther: knownIndustry === OTHER ? agent.industry : "",
    agentName: agent.name ?? "",
    role: agent.role ?? "",
    purpose: agent.purpose ?? "",
    targetUsers: agent.target_users ?? [],
    primaryTasks: agent.primary_tasks ?? [],
    domainContext: agent.instructions?.domain_context ?? "",
    conversationBehavior: customBehavior ? [...knownBehaviors, CUSTOM] : knownBehaviors,
    behaviorCustom: customBehavior ?? "",
    language: knownLanguage,
    languageOther: knownLanguage === OTHER ? agent.language : "",
    voice: agent.voice ?? "",
    additionalInstructions: agent.instructions?.additional_instructions ?? "",
  });
}

// Storage can be missing, full or blocked (private windows): never let that
// break the console. A stored config that no longer validates is ignored.
export function loadConfig(storage = globalThis.localStorage) {
  try {
    const stored = normalizeConfig(JSON.parse(storage.getItem(STORAGE_KEY)));

    return isConfigured(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveConfig(config, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeConfig(config)));
    return true;
  } catch {
    return false;
  }
}
