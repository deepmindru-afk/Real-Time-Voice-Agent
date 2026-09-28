import { listSentence, makeGreeting, rubles } from "./shared.js";

// What a claim can be about, in the words a person would use, mapped to the type the
// system stores. Accepts the words as they are actually said out loud.
const CLAIM_TYPES = {
  "стационар": "госпитализация",
  "больниц": "госпитализация",
  "госпитализа": "госпитализация",
  "операц": "госпитализация",
  "лекарств": "возмещение лекарств",
  "аптек": "возмещение лекарств",
  "диагност": "диагностика",
  "обследован": "диагностика",
  "анализ": "диагностика",
};

function claimType(text) {
  const value = text.toLowerCase();
  const word = Object.keys(CLAIM_TYPES).find((key) => value.includes(key));

  return word ? CLAIM_TYPES[word] : null;
}

export default {
  id: "insurance",
  name: "Страховая служба",
  vertical: "Страхование",
  workspaceLabel: "Рабочее пространство страховой службы",
  counterparty: "страхователя",

  headline: "Чем могу помочь по вашему договору?",
  description:
    "Обсудите с голосовым ИИ-агентом продление договора, статус обращения, покрытие или оформление нового обращения.",

  greeting: makeGreeting(
    "Я голосовой ассистент страховой службы АО «Портал», говорю с Аргуном Nair.",
    "Я могу помочь с продлением договора, текущим обращением, покрытием или оформлением нового обращения. Что вас интересует?"
  ),

  prompts: [
    "Когда продление договора?",
    "Какой статус обращения?",
    "Что покрывает мой договор?",
    "Оформить обращение по стационару",
  ],

  capabilities: [
    "проверить срок продления",
    "сообщить статус обращения",
    "объяснить условия покрытия",
    "оформить новое обращение",
  ],

  nextSteps: [
    "Загрузить выписку по обращению ОБР-5521",
    "Оплатить страховую премию до даты продления",
    "Отследить новое обращение в портале",
  ],

  data: {
    policyholder: "Аргун Наир",
    policy: {
      id: "ДОГ-88213",
      type: "семейное медицинское",
      sumInsured: 500000,
      premium: 14200,
      renewalDate: "14 октября 2026",
      daysToRenewal: 25,
      covers: ["госпитализация", "дневной стационар", "расходы до и после госпитализации", "расходы на скорую помощь"],
    },
    claims: [
      {
        id: "ОБР-5521",
        type: "госпитализация",
        status: "на рассмотрении",
        amount: 62000,
        pendingDocs: ["выписка из стационара"],
      },
    ],
  },

  intents: [
    {
      id: "file_claim",
      topic: "Новое обращение",
      match: /\b(оформи\w*|пода\w*|заяв\w*)\b[^.?!\n]{0,30}\b(обращен\w*|страхов\w*\s+случа)\w*/i,
      propose: (data, text) => {
        const type = claimType(text);

        if (!type) {
          return {
            reply: "Конечно. Уточните, пожалуйста: обращение по госпитализации, по лекарствам или по диагностике?",
          };
        }

        return { tool: "file_claim", args: { policy_id: data.policy.id, type } };
      },
    },
    {
      id: "claim_status",
      topic: "Статус обращения",
      tool: "get_claim_status",
      match: /\b(обращен\w*|случа\w*)\b/i,
      run: (data) => {
        const claim = data.claims[0];
        const docs = claim.pendingDocs.length
          ? `Мы всё ещё ждём ${listSentence(claim.pendingDocs)}.`
          : "Все документы получены.";

        return {
          args: { claim_id: claim.id },
          result: claim,
          reply: `Обращение ${claim.id} — ${claim.type} на ${rubles(claim.amount)} — находится в статусе «${claim.status}». ${docs}`,
          ref: `Обращение: ${claim.id}`,
        };
      },
    },
    {
      id: "renewal",
      topic: "Продление договора",
      tool: "get_renewal",
      match: /\b(продлен\w*|продлит\w*|преми\w*|срок\w*|истека\w*|истечени\w*)\b/i,
      run: (data) => {
        const { policy } = data;

        return {
          args: { policy_id: policy.id },
          result: { renewal_date: policy.renewalDate, premium: policy.premium },
          reply: `Договор ${policy.id} (${policy.type}) продлевается ${policy.renewalDate} — это через ${policy.daysToRenewal} дн. Страховая премия составит ${rubles(policy.premium)}.`,
          ref: `Договор: ${policy.id}`,
        };
      },
    },
    {
      id: "coverage",
      topic: "Покрытие",
      tool: "get_policy",
      match: /\b(покрыва\w*|покрыти\w*|договор\w*|страховк\w*|сумм\w*\s+покрыт\w*|льгот\w*)\b/i,
      run: (data) => {
        const { policy } = data;

        return {
          args: { policy_id: policy.id },
          result: policy,
          reply: `Договор ${policy.id} (${policy.type}) имеет сумму покрытия ${rubles(policy.sumInsured)}. Он покрывает: ${listSentence(policy.covers)}.`,
          ref: `Договор: ${policy.id}`,
        };
      },
    },
  ],

  actions: {
    file_claim: {
      label: "Оформить обращение",
      describe: (args) => `оформить новое обращение (${args.type}) по договору ${args.policy_id}`,
      execute: (args, data) => {
        const claim = {
          id: `ОБР-${5530 + data.claims.length - 1}`,
          type: args.type,
          status: "зарегистрировано",
          amount: 0,
          pendingDocs: ["заявление о страховом случае", "подтверждающие документы"],
        };

        data.claims.unshift(claim);

        return {
          result: claim,
          summary: `Обращение ${claim.id} оформлено (${claim.type})`,
          reply: `Готово. Обращение ${claim.id} по типу «${claim.type}» зарегистрировано. Вам нужно будет отправить ${listSentence(claim.pendingDocs)}, после чего с вами свяжется специалист по обращениям.`,
          ref: `Обращение: ${claim.id}`,
        };
      },
    },
  },
};
