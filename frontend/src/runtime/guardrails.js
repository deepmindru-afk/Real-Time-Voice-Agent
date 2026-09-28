// Non-negotiable behavior shared by every profile.
// 1. The agent discloses that it is an AI at the start of the call.
// 2. The agent never asks for, and never accepts, a password, PIN, one-time
//    passcode or full payment card number.
//
// These speak Russian, so the words that unlock them are Russian too: a person
// answering "да" or "нет" must be understood, and a spoken card number must be
// caught even though a Russian one is written "4276 3800 1234 5678".

export const AI_DISCLOSURE = "Здравствуйте! Я голосовой ИИ-ассистент АО «Портал».";

export const NEVER_ASK =
  "В целях вашей безопасности я никогда не спрашиваю пароль, ПИН-код, код из SMS или полный номер банковской карты.";

export const SENSITIVE_REFUSAL =
  "В целях безопасности, пожалуйста, не произносите это вслух. Я не могу принимать пароли, ПИН-коды, коды из SMS или полные номера карт, поэтому я это удалил. Продолжим без этого.";

const SENSITIVE_PATTERNS = [
  // a run of 13-19 digits, optionally spaced or dashed: a full card number
  /\b(?:\d[ -]?){13,19}\b/g,
  // a secret keyword followed closely by digits
  /\b(?:пин|пин-код|пароль|код\s+из\s+sms|одноразовый\s+пароль|одноразовый\s+код|cvv|cvc|код\s+карты)\b[^.\n]{0,30}?\b\d{3,8}\b/gi,
  // a secret keyword followed by "is" ("мой пин - ...")
  /\b(?:мой|мои|мой\s+пин|пароль|пин-код)\s*(?:равен|-|:|—)\s*[^\s.!?\n]*/gi,
];

// The same three, in English, so a code or a card number spoken in either language is caught.
const SENSITIVE_PATTERNS_LATIN = [
  /\b(?:pin|otp|password|passcode|cvv|cvc|one[- ]time (?:password|passcode|code))\b[^.\n]{0,30}?\b\d{3,8}\b/gi,
  /\b(?:my|the)\s+(?:pin|otp|password|passcode|cvv|cvc)\s+(?:is|was)\b[^.\n]*/gi,
];

const ALL_PATTERNS = [...SENSITIVE_PATTERNS, ...SENSITIVE_PATTERNS_LATIN];

export function detectSensitive(text) {
  return ALL_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

// Used for anything that is displayed, logged or stored.
export function redactSensitive(text) {
  return ALL_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[скрыто]"), text);
}

// Last line of defence on agent output, for any brain (rule-based or LLM): an
// agent utterance that solicits a secret is replaced before it is spoken.
const SOLICITATION =
  /\b(?:назови|сообщи|дай|передай|введи|скажи|прочитай|отправь|подтверди|напиши)\b[^.?!\n]{0,40}\b(?:парол[ьи]|пин[- ]?код|код\s+из\s+sms|одноразовый\s+(?:парол[ьи]|код)|cvv|cvc|номер\s+карты|номер\s+банковской\s+карты)\b/i;

export function sanitizeAgentText(text) {
  if (!SOLICITATION.test(text)) return { text, blocked: false };

  return {
    text: "Извините, я не могу сделать это по телефону. Я никогда не спрашиваю пароли, ПИН-коды, коды из SMS или номера карт.",
    blocked: true,
  };
}

// A confirmation answer, said aloud. Starts with the whole word so "нет" cannot be
// found inside "невозможно", and accepts the ways a person actually answers a
// yes/no question on a phone.
const YES =
  /^(?:да|ага|агась|ага-га|угу|хорошо|хорошо\s+да|подтверждаю|подтверждаю\s+да|в\s+порядке|ок|окей|okay|добро|можно|выполняй|совершай|согласен|согласна|верно|именно\s+так|всё\s+верно|все\s+верно|отлично|вперед|вперёд|действуй|yes|yeah|yep|yup|sure|confirm|confirmed|go ahead|please do|do it|proceed|correct|that's right)\b/i;
const NO =
  /^(?:нет|неа|не|no|nope|nah|отмена|отменить|стоп|остановись|не\s+нужно|не\s+надо|не\s+стоит|не\s+хочу|ни\s+в\s+коем|ни\s+в\s+каком|никогда|не\s+сейчас|в\s+другой\s+раз|отложить|cancel|stop|don't|do not|never mind|nevermind|not now|abort)\b/i;

export function classifyConfirmation(text) {
  const value = text.trim();

  if (NO.test(value)) return "no";
  if (YES.test(value)) return "yes";
  return "other";
}
