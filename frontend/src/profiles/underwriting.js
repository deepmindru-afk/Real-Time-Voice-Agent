import { findRef, listSentence, makeGreeting, rubles } from "./shared.js";

function resolveApplication(data, text) {
  const id = findRef(text, "ЗАЯВ") ?? data.currentId;

  return { id, application: data.applications[id] };
}

const notFound = (id) => ({
  args: { application_id: id },
  result: { found: false },
  reply: `Я не нашёл заявку ${id} в системе и не буду ничего додумывать. Проверьте, пожалуйста, номер.`,
});

export default {
  id: "underwriting",
  name: "Анкетирование и лизинг",
  vertical: "Финансы",
  workspaceLabel: "Рабочее пространство анкетирования",
  counterparty: "заявителя",

  headline: "Чем могу помочь?",
  description:
    "Обсудите с голосовым ИИ-агентом любую заявку, финансовые показатели, риски или результаты проверки.",

  greeting: makeGreeting(
    "Я голосовой ассистент по анкетированию АО «Портал».",
    "Сейчас открыта заявка ЗАЯВ-1024. Спросите о ней, об очереди или о рисках, либо попросите назначить заявителю обратный звонок."
  ),

  prompts: [
    "Покажи заявки в работе",
    "Кратко о заявителе",
    "Какие основные риски?",
    "Какие документы отсутствуют?",
    "Позвонить заявителю",
    "Покажи события за сегодня",
  ],

  capabilities: [
    "посмотреть заявки в работе",
    "кратко описать заявителя",
    "объяснить оценку риска",
    "проверить недостающие документы",
    "назначить обратный звонок",
  ],

  nextSteps: [
    "Получить недостающие документы",
    "Продолжить проверку заявки",
    "Убедиться, что обратный звонок состоялся",
  ],

  data: {
    currentId: "ЗАЯВ-1024",
    applications: {
      "ЗАЯВ-1024": {
        applicant: "Равш Менон",
        product: "лизинг оборудования",
        amount: 1800000,
        status: "на финансовой проверке",
        riskScore: 0.28,
        riskBand: "умеренный",
        missingDocs: ["выписка по счёту за последний месяц"],
        riskFactors: ["отношение долга к доходу 41 процент", "недавняя нестабильность выручки", "непредоставленная выписка"],
        pending: true,
      },
      "ЗАЯВ-1031": {
        applicant: "Снеха Кулкарни",
        product: "ипотека",
        amount: 4200000,
        status: "ожидает документы",
        riskScore: 0.41,
        riskBand: "повышенный",
        missingDocs: ["подтверждение личности", "справка о доходах"],
        riskFactors: ["короткий трудовой стаж", "два пропущенных платежа по карте за прошлый год"],
        pending: true,
      },
      "ЗАЯВ-1040": {
        applicant: "Имран Шейх",
        product: "автокредит",
        amount: 950000,
        status: "готов к решению",
        riskScore: 0.19,
        riskBand: "низкий",
        missingDocs: [],
        riskFactors: ["ничего существенного"],
        pending: false,
      },
    },
    activities: [
      "09:10, на ЗАЯВ-1040 подтверждён доход",
      "11:25, по ЗАЯВ-1031 отправлен запрос документов",
      "13:40, по ЗАЯВ-1024 пересчитана оценка риска",
    ],
    callJobs: [],
  },

  intents: [
    {
      id: "follow_up_call",
      topic: "Обратный звонок",
      match: /\b(звонок|позвонить|позвони|телефон|назначить|обратн(ый|ая)\s+связ(ь|и)|перезвонить)\b|\b(call|phone|ring|schedule|follow[- ]?up)\b/i,
      propose: (data, text) => {
        const { id, application } = resolveApplication(data, text);

        if (!application) return notFound(id);

        return { tool: "schedule_followup_call", args: { application_id: id } };
      },
    },
    {
      id: "pending",
      topic: "Заявки в работе",
      tool: "list_pending_applications",
      match: /\b(в\s+работе|очеред|ожида\w*|необработанн\w*|незавершённ\w*|незавершенн\w*|покажи\s+заявки)\b|\b(pending|queue|waiting|outstanding applications)\b/i,
      run: (data) => {
        const pending = Object.entries(data.applications).filter(([, app]) => app.pending);
        const parts = pending.map(([id, app]) => `${id} — ${app.applicant}, ${app.status}`);

        return {
          args: {},
          result: pending.map(([id, app]) => ({ id, applicant: app.applicant, status: app.status })),
          reply: `В работе ${pending.length} заявки: ${listSentence(parts)}.`,
        };
      },
    },
    {
      id: "risk",
      topic: "Оценка риска",
      tool: "get_risk_factors",
      match: /\b(риск|риски|оценк(а|и)|оценка\s+риска|сколько\s+риска|рискован)\w*/i,
      run: (data, text) => {
        const { id, application } = resolveApplication(data, text);

        if (!application) return notFound(id);

        return {
          args: { application_id: id },
          result: { risk_score: application.riskScore, band: application.riskBand, factors: application.riskFactors },
          reply: `По заявке ${id} оценка риска составляет ${application.riskScore}, риск ${application.riskBand}. Основные факторы: ${listSentence(application.riskFactors)}.`,
          ref: `Заявка: ${id}`,
        };
      },
    },
    {
      id: "documents",
      topic: "Проверка документов",
      tool: "get_missing_documents",
      match: /\b(документ\w*|не\s+хватает|отсутству\w*|выписк\w*|справк\w*|чек-лист)\b|\b(document|documents|missing|statement|checklist)\b/i,
      run: (data, text) => {
        const { id, application } = resolveApplication(data, text);

        if (!application) return notFound(id);

        const missing = application.missingDocs;

        return {
          args: { application_id: id },
          result: { missing },
          reply: missing.length
            ? `По заявке ${id} всё ещё не хватает: ${listSentence(missing)}.`
            : `По заявке ${id} все необходимые документы получены.`,
          ref: "Проверка документов",
        };
      },
    },
    {
      id: "activities",
      topic: "События за сегодня",
      tool: "get_todays_activity",
      match: /\b(сегодня|событи\w*|активност\w*|что\s+произошл\w*)\b|\b(today|activity|activities|happened)\b/i,
      run: (data) => ({
        args: {},
        result: data.activities,
        reply: `Сегодня произошло: ${listSentence(data.activities)}.`,
      }),
    },
    {
      id: "summary",
      topic: "Обзор заявки",
      tool: "get_application",
      match: /\b(кратк\w*|резюме|заявител\w*|статус|заявк\w*|ЗАЯВ-?\d+|расскажи)\b|\b(summari[sz]e|summary|applicant|status|application|APP-?\d+|tell me about)\b/i,
      run: (data, text) => {
        const { id, application } = resolveApplication(data, text);

        if (!application) return notFound(id);

        const docs = application.missingDocs.length
          ? `Всё ещё не хватает: ${listSentence(application.missingDocs)}.`
          : "Все необходимые документы получены.";

        return {
          args: { application_id: id },
          result: application,
          reply: `${id} — это ${rubles(application.amount)} на ${application.product} для ${application.applicant}. Сейчас заявка ${application.status}. ${docs} Оценка риска ${application.riskScore}, риск ${application.riskBand}.`,
          ref: `Заявка: ${id}`,
        };
      },
    },
  ],

  actions: {
    schedule_followup_call: {
      label: "Назначить обратный звонок",
      describe: (args, data) =>
        `создать задачу на исходящий звонок ${data.applications[args.application_id].applicant} по заявке ${args.application_id}`,
      execute: (args, data) => {
        const application = data.applications[args.application_id];
        const job = {
          job_id: `ЗВОНОК-${3001 + data.callJobs.length}`,
          applicant: application.applicant,
          application_id: args.application_id,
          reason: application.missingDocs.length ? `Запросить ${listSentence(application.missingDocs)}` : "Уточнить статус",
          profile: "underwriting",
        };

        data.callJobs.push(job);

        return {
          result: job,
          summary: `Создана задача на исходящий звонок ${job.job_id} для ${application.applicant}`,
          reply: `Готово. Создана задача на исходящий звонок ${job.job_id} для ${application.applicant} по заявке ${args.application_id}. Сервис телефонных звонков перезвонит.`,
          ref: `Задача звонка: ${job.job_id}`,
        };
      },
    },
  },
};
