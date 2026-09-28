import { listSentence, makeGreeting, rubles } from "./shared.js";

const PLANS = {
  "Безлимит 599": { price: 599, data: "60 ГБ", extras: "безлимитные звонки" },
  "Безлимит 799": { price: 799, data: "120 ГБ", extras: "безлимитные звонки и пакет стриминга" },
  "Безлимит 999": { price: 999, data: "250 ГБ", extras: "безлимитные звонки, пакет стриминга и роуминг" },
};

// The plan is named by its price, so the price is what has to be heard.
function requestedPlan(text) {
  const match = text.match(/\b(799|999)\b/);

  return match ? `Безлимит ${match[1]}` : null;
}

export default {
  id: "telecom",
  name: "Поддержка связи",
  vertical: "Телеком",
  workspaceLabel: "Рабочее пространство поддержки связи",
  counterparty: "абонента",

  headline: "Чем могу помочь по вашему тарифу?",
  description:
    "Обсудите с голосовым ИИ-агентом расход трафика, счёт, продление тарифа или его смену.",

  greeting: makeGreeting(
    "Я голосовой ассистент службы поддержки связи АО «Портал», говорю с Меерой Айер.",
    "Я могу помочь с расходом трафика, счётом, продлением тарифа или его сменой. Чем помочь?"
  ),

  prompts: [
    "Сколько трафика израсходовано?",
    "Какой у меня счёт?",
    "Когда продление тарифа?",
    "Какие тарифы доступны?",
    "Сменить тариф",
  ],

  capabilities: [
    "проверить расход трафика",
    "объяснить счёт",
    "сообщить дату продления",
    "сменить тариф",
  ],

  nextSteps: [
    "Оплатить текущий счёт до даты",
    "Посмотреть новые условия в приложении",
    "Проверить расход заново перед следующим продлением",
  ],

  data: {
    subscriber: "Меера Айер",
    number: "на 0210",
    plan: "Безлимит 599",
    usage: { usedGb: 42, limitGb: 60, resetsOn: "28 сентября 2026" },
    bill: { amount: 599, dueDate: "25 сентября 2026", status: "не оплачен" },
    plans: PLANS,
  },

  intents: [
    {
      id: "upgrade",
      topic: "Смена тарифа",
      match: /\b(смени\w*|поменя\w*|перейти\s+на|подключит\w*|другой\s+тариф|друго[йе]\s+тариф\w*)\b/i,
      propose: (data, text) => {
        const plan = requestedPlan(text) ?? "Безлимит 799";

        if (plan === data.plan) {
          return { reply: `Вы уже на тарифе «${plan}».` };
        }

        return { tool: "upgrade_plan", args: { plan } };
      },
    },
    {
      id: "plans",
      topic: "Доступные тарифы",
      tool: "list_plans",
      match: /\b(тариф\w*|варианты|доступн\w*|предложен\w*)\b/i,
      run: (data) => {
        const parts = Object.entries(data.plans).map(
          ([name, plan]) => `${name} за ${rubles(plan.price)} — ${plan.data} и ${plan.extras}`
        );

        return {
          args: {},
          result: data.plans,
          reply: `Доступны тарифы: ${listSentence(parts)}. Сейчас у вас «${data.plan}».`,
          ref: "Каталог тарифов",
        };
      },
    },
    {
      id: "usage",
      topic: "Расход трафика",
      tool: "get_usage",
      match: /\b(трафик\w*|интернет\w*|гб|гигабайт\w*|израсходова\w*|остал\w*)\b/i,
      run: (data) => {
        const { usedGb, limitGb, resetsOn } = data.usage;

        return {
          args: {},
          result: data.usage,
          reply: `Вы израсходовали ${usedGb} из ${limitGb} ГБ, осталось ${limitGb - usedGb} ГБ. Обновление пакета — ${resetsOn}.`,
          ref: `Номер ${data.number}`,
        };
      },
    },
    {
      id: "bill",
      topic: "Текущий счёт",
      tool: "get_bill",
      match: /\b(сч[её]т\w*|оплат\w*|плат[её]ж\w*|начислен\w*|сумм\w*)\b/i,
      run: (data) => ({
        args: {},
        result: data.bill,
        reply: `Ваш текущий счёт — ${rubles(data.bill.amount)}, оплатить его нужно до ${data.bill.dueDate}. Статус: ${data.bill.status}.`,
        ref: `Номер ${data.number}`,
      }),
    },
    {
      id: "renewal",
      topic: "Продление тарифа",
      tool: "get_plan",
      match: /\b(продлен\w*|продлит\w*|срок\w*|действ\w*|тариф\w*)\b/i,
      run: (data) => ({
        args: {},
        result: { plan: data.plan, renews: data.usage.resetsOn },
        reply: `У вас тариф «${data.plan}» за ${rubles(data.plans[data.plan].price)} в месяц. Продление — ${data.usage.resetsOn}.`,
        ref: `Номер ${data.number}`,
      }),
    },
  ],

  actions: {
    upgrade_plan: {
      label: "Сменить тариф",
      describe: (args, data) => {
        const plan = data.plans[args.plan];

        return `сменить ваш тариф «${data.plan}» на «${args.plan}» — ${rubles(plan.price)} в месяц с пакетом ${plan.data}. Новая цена действует со следующего счёта`;
      },
      execute: (args, data) => {
        const previous = data.plan;

        data.plan = args.plan;

        return {
          result: { previous_plan: previous, new_plan: args.plan },
          summary: `Тариф изменён: ${previous} → ${args.plan}`,
          reply: `Готово. Теперь у вас тариф «${args.plan}». Новая цена начнёт действовать со следующего счёта.`,
          ref: `Номер ${data.number}`,
        };
      },
    },
  },
};
