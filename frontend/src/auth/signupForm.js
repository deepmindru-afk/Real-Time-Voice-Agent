// Checks for the sign-up form, kept apart from the screen so the rules can be tested. They mirror
// what the server enforces (backend/app/main.py SignupRequest, security.hash_password), so most
// mistakes are caught before a request is made; the server still has the last word.

// The backend's password policy (backend/app/security.py MIN_PASSWORD_LENGTH).
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_WORKSPACE_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;

// Something@something.tld, no spaces: deliberately loose (the server decides what is deliverable).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Characters as a person counts them, and as the server does (code points, not UTF-16 units).
export const lengthOf = (text) => [...text].length;

// { workspace, email, password } -> { field: message } for each field that is not acceptable. An
// empty object means the form may be sent.
export function validateSignup({ workspace = "", email = "", password = "" }) {
  const errors = {};
  const name = workspace.trim();
  const address = email.trim();

  if (!name) errors.workspace = "Укажите название рабочего пространства.";
  else if (lengthOf(name) > MAX_WORKSPACE_LENGTH) errors.workspace = `Не более ${MAX_WORKSPACE_LENGTH} символов.`;

  if (!address) errors.email = "Введите адрес электронной почты.";
  else if (address.length > MAX_EMAIL_LENGTH || !EMAIL.test(address)) errors.email = "Это не похоже на адрес электронной почты.";

  if (!password) errors.password = "Придумайте пароль.";
  else if (lengthOf(password) < MIN_PASSWORD_LENGTH) errors.password = `Минимум ${MIN_PASSWORD_LENGTH} символов.`;
  else if (lengthOf(password) > MAX_PASSWORD_LENGTH) errors.password = `Не более ${MAX_PASSWORD_LENGTH} символов.`;

  return errors;
}
