import { listSentence, makeGreeting, rubles } from "./shared.js";

// The slots, as a person would name them. A time is always given as a suggestion, so
// a request that names none of these still gets a concrete answer.
const SLOTS = {
  утро: "в четверг в 10:00",
  утром: "в четверг в 10:00",
  день: "в четверг в 16:00",
  днём: "в четверг в 16:00",
  после: "в четверг в 16:00",
  вечер: "в пятницу в 18:00",
  вечером: "в пятницу в 18:00",
};

function requestedSlot(text) {
  const value = text.toLowerCase();
  const key = Object.keys(SLOTS).find((word) => value.includes(word));

  return SLOTS[key ?? "день"];
}

export default {
  id: "admissions",
  name: "Приёмная комиссия",
  vertical: "Приёмная кампания",
  workspaceLabel: "Рабочее пространство приёмной комиссии",
  counterparty: "абитуриента",

  headline: "Чем могу помочь с вашей заявкой?",
  description:
    "Обсудите с голосовым ИИ-агентом статус заявки, условия программы или запись на консультацию.",

  greeting: makeGreeting(
    "Я голосовой ассистент приёмной комиссии АО «Портал», говорю с Кавья Редди.",
    "Я могу помочь со статусом заявки, списком документов, условиями программы и записью на консультацию. Что вас интересует?"
  ),

  prompts: [
    "Какой статус моей заявки?",
    "Какие документы ещё нужны?",
    "Расскажите о программе",
    "Какие сроки подачи?",
    "Записаться на консультацию",
  ],

  capabilities: [
    "проверить статус заявки",
    "показать список документов",
    "рассказать о программе",
    "напомнить о ключевых сроках",
    "записать на консультацию",
  ],

  nextSteps: [
    "Загрузить оставшиеся документы",
    "Подготовиться к собеседованию",
    "Прийти на назначенную консультацию",
  ],

  data: {
    applicant: "Кавья Редди",
    application: {
      id: "ЗАЯВ-2026-0412",
      program: "Магистратура «Аналитика данных»",
      status: "документы проверены, ожидается собеседование",
      checklist: [
        { item: "аттестат", done: true },
        { item: "мотивационное письмо", done: true },
        { item: "рекомендательное письмо", done: false },
        { item: "результаты языкового теста", done: true },
      ],
      interview: "ещё не назначено",
    },
    program: {
      duration: "два года",
      fee: 385000,
      intake: "январь 2027",
      format: "очная форма с возможностью стажировки в компании",
    },
    deadlines: [
      { label: "Приём документов", date: "30 сентября 2026" },
      { label: "Собеседования", date: "первые две недели октября 2026" },
      { label: "Оплата обучения после оферты", date: "15 ноября 2026" },
    ],
    counselorCalls: [],
  },

  intents: [
    {
      id: "book_counselor",
      topic: "Консультация",
      match: /\b(консультац\w*|консультант\w*|записат\w*|назначит\w*|поговорить\s+с|позвоните\s+мне|звонок)\b/i,
      propose: (data, text) => ({
        tool: "schedule_counselor_call",
        args: { slot: requestedSlot(text), application_id: data.application.id },
      }),
    },
    {
      id: "documents",
      topic: "Список документов",
      tool: "get_checklist",
      match: /\b(документ\w*|чек-лист|не\s+хватает|ожида\w*|не\s+пода\w*)\b/i,
      run: (data) => {
        const missing = data.application.checklist.filter((entry) => !entry.done).map((entry) => entry.item);

        return {
          args: { application_id: data.application.id },
          result: data.application.checklist,
          reply: missing.length
            ? `Список почти готов. Осталось предоставить: ${listSentence(missing)}.`
            : "Все документы получены и проверены.",
          ref: `Заявка: ${data.application.id}`,
        };
      },
    },
    {
      id: "program",
      topic: "Условия программы",
      tool: "get_program_details",
      match: /\b(программ\w*|курс\w*|учебн\w*\s+план\w*|длительност\w*|стоимост\w*|сколько\s+стоит|цена)\b/i,
      run: (data) => {
        const { program, application } = data;

        return {
          args: { program: application.program },
          result: program,
          reply: `${application.program} — программа на ${program.duration}, ${program.format}. Ближайший набор — ${program.intake}, стоимость обучения ${rubles(program.fee)}.`,
          ref: `Программа: ${application.program}`,
        };
      },
    },
    {
      id: "deadlines",
      topic: "Сроки приёма",
      tool: "get_deadlines",
      match: /\b(срок\w*|дедлайн\w*|до\s+какого|когда\s+пода\w*|последн\w*\s+день)\b/i,
      run: (data) => ({
        args: {},
        result: data.deadlines,
        reply: `Ключевые даты: ${listSentence(data.deadlines.map((entry) => `${entry.label} — до ${entry.date}`))}.`,
        ref: "Календарь приёмной кампании",
      }),
    },
    {
      id: "status",
      topic: "Статус заявки",
      tool: "get_application_status",
      match: /\b(статус\w*|заявк\w*|как\s+продвига\w*|собеседован\w*|результат\w*)\b/i,
      run: (data) => {
        const { application } = data;

        return {
          args: { application_id: application.id },
          result: application,
          reply: `Ваша заявка ${application.id} на программу «${application.program}» — статус: ${application.status}. Собеседование пока ${application.interview}.`,
          ref: `Заявка: ${application.id}`,
        };
      },
    },
  ],

  actions: {
    schedule_counselor_call: {
      label: "Записать на консультацию",
      describe: (args) => `записать вас на консультацию ${args.slot}`,
      execute: (args, data) => {
        const booking = {
          booking_id: `КОНС-${710 + data.counselorCalls.length}`,
          slot: args.slot,
          application_id: args.application_id,
        };

        data.counselorCalls.push(booking);

        return {
          result: booking,
          summary: `Консультация ${booking.booking_id} назначена на ${args.slot}`,
          reply: `Готово. Вы записаны на консультацию ${args.slot}. Номер подтверждения — ${booking.booking_id}.`,
          ref: `Запись: ${booking.booking_id}`,
        };
      },
    },
  },
};
