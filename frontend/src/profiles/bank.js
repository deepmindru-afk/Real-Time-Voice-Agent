import { findRef, listSentence, makeGreeting, rubles } from "./shared.js";

function resolveCard(data, text) {
  const id = findRef(text, "КАРТ") ?? data.currentId;

  return { id, card: data.cards[id] };
}

const notFound = (id) => ({
  args: { card_id: id },
  result: { found: false },
  reply: `Я не нашёл карту ${id} в системе и не буду ничего додумывать. Проверьте, пожалуйста, номер.`,
});

export default {
  id: "bank",
  name: "Банковское обслуживание",
  vertical: "Банки и финансы",
  workspaceLabel: "Рабочее пространство банковского обслуживания",
  counterparty: "клиента",

  headline: "Чем могу помочь?",
  description:
    "Обсудите с голосовым ИИ-агентом операции по счёту, карту, лимиты, входящие платежи или оформление заявки.",

  greeting: makeGreeting(
    "Я голосовой ассистент по банковскому обслуживанию АО «Портал».",
    "Сейчас открыта карта КАРТ-7781. Спросите о последних операциях, лимитах или остатке, либо попросите заблокировать карту."
  ),

  prompts: [
    "Последние операции",
    "Остаток на счёте",
    "Какие лимиты действуют?",
    "Заблокировать карту",
    "Когда придёт перевод?",
    "Оформить заявку на лимит",
  ],

  capabilities: [
    "показать последние операции",
    "сообщить остаток и лимиты",
    "проверить статус перевода",
    "заблокировать карту",
    "оформить заявку на увеличение лимита",
  ],

  nextSteps: [
    "Подтвердить получение заявки",
    "Проверить статус исходящего перевода",
    "Убедиться, что карта разблокирована",
  ],

  data: {
    currentId: "КАРТ-7781",
    cards: {
      "КАРТ-7781": {
        holder: "Анна Петрова",
        last4: "4417",
        balance: 128450.5,
        currency: "RUB",
        limit: 300000,
        spent: 41230.2,
        status: "активна",
        frozen: false,
        transfers: [
          { direction: "in", counterparty: "ООО «Ромашка»", amount: 85000, date: "12 мая" },
          { direction: "out", counterparty: "Пятёрочка", amount: 3240.9, date: "12 мая" },
          { direction: "out", counterparty: "Яндекс Такси", amount: 780, date: "11 мая" },
        ],
        pendingTransfers: [{ counterparty: "ИП Соколов", amount: 24000, eta: "сегодня к 18:00" }],
      },
      "КАРТ-4402": {
        holder: "Дмитрий Орлов",
        last4: "9032",
        balance: 15210,
        currency: "RUB",
        limit: 100000,
        spent: 84790,
        status: "активна",
        frozen: false,
        transfers: [{ direction: "out", counterparty: "Сбербанк", amount: 5000, date: "10 мая" }],
        pendingTransfers: [],
      },
      "КАРТ-1120": {
        holder: "Мария Лебедева",
        last4: "2288",
        balance: 0,
        currency: "RUB",
        limit: 150000,
        spent: 150000,
        status: "заблокирована",
        frozen: true,
        transfers: [],
        pendingTransfers: [],
      },
    },
    callJobs: [],
  },

  intents: [
    {
      id: "block_card",
      topic: "Блокировка карты",
      match: /\b(блокир\w*|заблокир\w*|замороз\w*|останов\w*\s+карт\w*|не\s+работает\s+карта)\b|\b(block|freeze|lock)\b/i,
      propose: (data, text) => {
        const { id, card } = resolveCard(data, text);

        if (!card) return notFound(id);

        return { tool: "block_card", args: { card_id: id } };
      },
    },
    {
      id: "limit_request",
      topic: "Заявка на лимит",
      match: /\b(лимит\w*|увеличит\w*\s+лимит|повысит\w*\s+лимит|поднят\w*\s+лимит)\b|\b(limit)\b/i,
      propose: (data, text) => {
        const { id, card } = resolveCard(data, text);

        if (!card) return notFound(id);

        return { tool: "request_limit_increase", args: { card_id: id } };
      },
    },
    {
      id: "transfers",
      topic: "Операции по счёту",
      tool: "list_recent_transactions",
      match: /\b(операци\w*|транзакц\w*|движен\w*|последн\w*\s+(операци|платёж|перевод)|истори\w*|покажи\s+трат\w*)\b|\b(transaction|history|recent|statement|spending)\b/i,
      run: (data, text) => {
        const { id, card } = resolveCard(data, text);

        if (!card) return notFound(id);

        const parts = card.transfers.map(
          (item) => `${item.date}, ${item.direction === "in" ? "поступление" : "списание"} ${rubles(item.amount)} — ${item.counterparty}`
        );

        return {
          args: { card_id: id },
          result: card.transfers,
          reply: parts.length ? `Последние операции по карте ${id}: ${listSentence(parts)}.` : `По карте ${id} операций пока не было.`,
          ref: `Карта: ${id}`,
        };
      },
    },
    {
      id: "balance",
      topic: "Остаток и лимиты",
      tool: "get_balance",
      match: /\b(остаток\w*|баланс\w*|сколько\s+денег|сколько\s+на\s+сч[её]т\w*|лимит\w*|сколько\s+лимит)\b|\b(balance|how much|limit)\b/i,
      run: (data, text) => {
        const { id, card } = resolveCard(data, text);

        if (!card) return notFound(id);

        return {
          args: { card_id: id },
          result: { balance: card.balance, limit: card.limit, spent: card.spent, status: card.status },
          reply: `На карте ${id} сейчас ${rubles(card.balance)}. Лимит ${rubles(card.limit)}, израсходовано ${rubles(card.spent)}. Карта ${card.status}.`,
          ref: `Карта: ${id}`,
        };
      },
    },
    {
      id: "pending_transfer",
      topic: "Входящий перевод",
      tool: "get_pending_transfer",
      match: /\b(перевод\w*|поступлен\w*|когда\s+прид[её]т|когда\s+придут|в\s+пути|ожидаем\w*)\b|\b(transfer|pending|incoming)\b/i,
      run: (data, text) => {
        const { id, card } = resolveCard(data, text);

        if (!card) return notFound(id);

        const pending = card.pendingTransfers;

        return {
          args: { card_id: id },
          result: { pending },
          reply: pending.length
            ? `Ожидается перевод ${rubles(pending[0].amount)} от ${pending[0].counterparty}, ${pending[0].eta}.`
            : `Ожидающих переводов по карте ${id} нет.`,
          ref: `Карта: ${id}`,
        };
      },
    },
    {
      id: "summary",
      topic: "Обзор карты",
      tool: "get_card",
      match: /\b(карт\w*|сч[её]т\w*|обзор|расскажи|мои\s+деньги)\b|\b(card|account|tell me about)\b/i,
      run: (data, text) => {
        const { id, card } = resolveCard(data, text);

        if (!card) return notFound(id);

        return {
          args: { card_id: id },
          result: card,
          reply: `Карта ${id} на ${card.last4} оформлена на ${card.holder}. Баланс ${rubles(card.balance)}, лимит ${rubles(card.limit)}. Статус: ${card.status}.`,
          ref: `Карта: ${id}`,
        };
      },
    },
  ],

  actions: {
    block_card: {
      label: "Заблокировать карту",
      describe: (args, data) => `заблокировать карту ${args.card_id} (владелец ${data.cards[args.card_id].holder})`,
      execute: (args, data) => {
        const card = data.cards[args.card_id];

        card.frozen = true;
        card.status = "заблокирована";

        return {
          result: { card_id: args.card_id, status: card.status },
          summary: `Карта ${args.card_id} заблокирована`,
          reply: `Готово. Карта ${args.card_id} заблокирована, операции по ней остановлены. Разблокировать её можно в приложении или по горячей линии.`,
          ref: `Карта: ${args.card_id}`,
        };
      },
    },
    request_limit_increase: {
      label: "Оформить заявку на увеличение лимита",
      describe: (args) => `оформить заявку на увеличение кредитного лимита по карте ${args.card_id}`,
      execute: (args, data) => {
        const card = data.cards[args.card_id];
        const requested = card.limit + 100000;

        return {
          result: { card_id: args.card_id, current_limit: card.limit, requested_limit: requested, status: "pending" },
          summary: `Заявка на лимит ${rubles(requested)} по карте ${args.card_id} принята в обработку`,
          reply: `Готово. Заявка на увеличение лимита до ${rubles(requested)} по карте ${args.card_id} отправлена. Решение обычно принимается в течение одного рабочего дня.`,
          ref: `Заявка по карте: ${args.card_id}`,
        };
      },
    },
  },
};
