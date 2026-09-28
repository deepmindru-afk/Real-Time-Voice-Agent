// The "brain" turns one user utterance into a decision. It is the only part of
// the runtime that a real LiveKit agent replaces: with a room connected, the agent
// reasons on its own side and none of this is used. It stays as the offline
// demonstration, so the console still answers when no server is reachable.
//
// respond({ profile, data, text }) resolves to one of:
//   { kind: "answer",   topic, toolCalls, reply, ref }   grounded answer from tools
//   { kind: "propose",  topic, tool, args }              wants to run a guarded action
//   { kind: "chat",     reply }                          small talk, no data involved
//   { kind: "fallback", reply }                          not understood
//
// A brain never executes a guarded action itself. It can only propose one; the
// session asks the caller for confirmation before anything changes.

const COMMON_INTENTS = [
  {
    match: /\b(ты\s+робот|ты\s+человек|ты\s+живой|ты\s+машина|ты\s+бот|ты\s+ии|ты\s+искусственный\s+интеллект)\b|\b(are\s+you|r\s+?u)\b.*\b(human|real|robot|bot|ai|machine|person)\b/i,
    reply: () =>
      "Я ИИ-ассистент, а не человек. Я сообщаю только то, что могу проверить, и всегда спрашиваю разрешение перед любыми изменениями.",
  },
  {
    match: /\b(что\s+ты\s+(умеешь|делаешь|можешь)|чем\s+помочь|как\s+ты\s+мне\s+поможешь|что\s+можно\s+спросить)\b|\bwhat\s+(?:can|do)\s+you\s+(?:do|help)\b/i,
    reply: (profile) => `Я могу помочь вам ${joinList(profile.capabilities)}. Что вы хотите сделать?`,
  },
  {
    match: /\b(спасибо|благодарю|до\s+свидания|всё|это\s+всё|до\s+встречи)\b|\b(thanks|thank you|bye|goodbye|that's all)\b/i,
    reply: () => "Пожалуйста. Если это всё, вы можете завершить звонок в любой момент.",
  },
  {
    match: /^(?:привет|здравствуйте|здравствуй|добрый\s+(?:день|вечер)|доброе\s+утро|хай|приветствую)\b|^(?:hi|hello|hey)\b/i,
    reply: (profile) => `Здравствуйте! Я помогу вам ${joinList(profile.capabilities)}.`,
  },
];

// "посмотреть заявки, проверить риск или назначить звонок" - the last two are joined
// with "или" rather than a comma, which is how a list is read aloud in Russian.
export function joinList(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} или ${items[1]}`;

  return `${items.slice(0, -1).join(", ")} или ${items[items.length - 1]}`;
}

export const localBrain = {
  name: "local-rules",

  async respond({ profile, data, text }) {
    for (const intent of profile.intents) {
      if (!intent.match.test(text)) continue;

      if (intent.propose) {
        const proposal = intent.propose(data, text);

        if (proposal.reply) return { kind: "chat", reply: proposal.reply };

        return {
          kind: "propose",
          topic: intent.topic,
          tool: proposal.tool,
          args: proposal.args,
        };
      }

      if (intent.run) {
        const result = intent.run(data, text);

        return {
          kind: "answer",
          topic: intent.topic,
          toolCalls: [{ name: intent.tool, args: result.args, result: result.result, guarded: false }],
          reply: result.reply,
          ref: result.ref,
        };
      }
    }

    for (const intent of COMMON_INTENTS) {
      if (intent.match.test(text)) return { kind: "chat", reply: intent.reply(profile, data) };
    }

    // Nothing matched, and no tool is close: say so rather than guessing, and say what
    // would have worked instead.
    return {
      kind: "fallback",
      reply: `Я не совсем понял вопрос. Попробуйте сформулировать иначе — я могу помочь вам ${joinList(profile.capabilities)}.`,
    };
  },
};
