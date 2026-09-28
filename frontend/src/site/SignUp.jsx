import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/context.js";
import { decideSignIn } from "../auth/guard.js";
import { MIN_PASSWORD_LENGTH, validateSignup } from "../auth/signupForm.js";
import Splash from "../components/Splash.jsx";
import { useRouter } from "../router/context.js";
import Link from "../router/Link.jsx";
import Arrow from "./Arrow.jsx";
import AuthLayout from "./AuthLayout.jsx";
import { withNext } from "./withNext.js";

const ART_TITLE = "Первый агент начинается здесь.";
const ART_TEXT = "Создайте рабочее пространство, опишите задачу — и агент готов к работе.";

// Creating an account: a workspace name, an email and a password. The server creates the account
// together with a workspace of its own, signs it in, and this screen follows the auth STATUS to the
// app (never navigating straight after the request), exactly as the sign-in screen does.
export default function SignUp() {
  const { status, error: serverError, backend, signUp, retry, enterOffline } = useAuth();
  const { navigate, search } = useRouter();
  const [values, setValues] = useState({ workspace: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [attempted, setAttempted] = useState(false); // field errors appear once they have tried to submit
  const [failure, setFailure] = useState(null); // { message, taken }: what the server said
  const [pending, setPending] = useState(false);
  const justSignedUp = useRef(false); // signed up on this screen (get the curtain), as opposed to arriving already signed in

  const decision = decideSignIn({ status, next: search.get("next") });

  useEffect(() => {
    if (decision.kind === "redirect") navigate(decision.to, { replace: true, transition: justSignedUp.current });
  }, [decision.kind, decision.to, navigate]);

  const set = (field) => (event) => setValues({ ...values, [field]: event.target.value });
  const setPassword = (password) => setValues((current) => ({ ...current, password }));
  const errors = attempted ? validateSignup(values) : {};

  const submit = async (event) => {
    event.preventDefault();
    setAttempted(true);
    setFailure(null);

    const problems = validateSignup(values);

    if (Object.keys(problems).length > 0) {
      // Take the person to the first thing to fix.
      document.getElementById(problems.workspace ? "su-workspace" : problems.email ? "su-email" : "su-password")?.focus();
      return;
    }

    setPending(true);
    justSignedUp.current = true;

    try {
      await signUp(values.email.trim(), values.password, values.workspace.trim());
      // Nothing more to do: the status is now "authenticated" and the effect above takes over.
      // The form stays busy until this screen is replaced.
    } catch (error) {
      justSignedUp.current = false;
      setFailure({ message: error.message, taken: error.cause?.status === 409 });
      setPassword("");
      setPending(false);
    }
  };

  if (decision.kind === "redirect") return <Splash label="Настраиваем рабочее пространство" />;

  const initializing = status === "initializing";
  const open = status === "open";
  const unavailable = status === "unavailable";
  // The server said sign-up is closed (only a reachable server can say so)
  const closed = backend.reachable && !backend.signupEnabled;

  return (
    <AuthLayout working={pending} title={ART_TITLE} text={ART_TEXT}>
      <p className="lp-eyebrow">
        <span className="live-dot" aria-hidden="true" /> {open ? "Открытое рабочее пространство" : closed ? "Регистрация закрыта" : "Начнём"}
      </p>

      {open ? (
        <>
          <h1>Аккаунт не нужен</h1>

          <p className="signin-lead">
            {backend.reachable ? "На этом сервере вход отключён, поэтому рабочее пространство открыто." : "Вы выбрали работу без сервера, поэтому консоль работает только на этом устройстве."}
          </p>

          <Link to="/app/dashboard" transition className="lp-btn lp-btn--primary signin-submit">
            Открыть рабочее пространство <Arrow />
          </Link>
        </>
      ) : closed ? (
        <>
          <h1>Регистрация закрыта</h1>

          <p className="signin-lead">Сейчас на этом сервере нельзя создать новый аккаунт. Попросите администратора рабочего пространства добавить вас или войдите, если аккаунт уже есть.</p>

          <Link to={withNext("/signin", search)} transition className="lp-btn lp-btn--primary signin-submit">
            Войти <Arrow />
          </Link>
        </>
      ) : (
        <>
          <h1>Создание аккаунта</h1>

          <p className="signin-lead">Назовите рабочее пространство и зарегистрируйтесь по почте. Вход произойдёт сразу.</p>

          {unavailable && (
            <div className="signin-banner" role="alert">
              <p>
                <b>Не удалось связаться с сервером.</b> {serverError}
              </p>

              <span>
                <button type="button" onClick={retry}>
                  Попробовать снова
                </button>

                <button type="button" onClick={enterOffline}>
                  Продолжить без сервера
                </button>
              </span>
            </div>
          )}

          <form className="signin-form" onSubmit={submit} noValidate>
            <label htmlFor="su-workspace">Название рабочего пространства</label>

            <input
              id="su-workspace"
              type="text"
              autoComplete="organization"
              autoFocus
              maxLength={120}
              value={values.workspace}
              onChange={set("workspace")}
              aria-invalid={errors.workspace ? true : undefined}
              aria-describedby={errors.workspace ? "su-workspace-error" : undefined}
              required
            />
            {errors.workspace && (
              <p className="signin-field-error" id="su-workspace-error">
                {errors.workspace}
              </p>
            )}

            <label htmlFor="su-email">Электронная почта</label>

            <input
              id="su-email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={set("email")}
              aria-invalid={errors.email || failure?.taken ? true : undefined}
              aria-describedby={errors.email ? "su-email-error" : undefined}
              required
            />
            {errors.email && (
              <p className="signin-field-error" id="su-email-error">
                {errors.email}
              </p>
            )}

            <label htmlFor="su-password">Пароль</label>

            <span className="signin-password">
              <input
                id="su-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={values.password}
                onChange={set("password")}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "su-password-error" : "su-password-hint"}
                required
              />

              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Скрыть пароль" : "Показать пароль"}>
                {show ? "Скрыть" : "Показать"}
              </button>
            </span>
            {errors.password ? (
              <p className="signin-field-error" id="su-password-error">
                {errors.password}
              </p>
            ) : (
              <p className="signin-hint" id="su-password-hint">
                Минимум {MIN_PASSWORD_LENGTH} символов. Подойдёт короткая фраза.
              </p>
            )}

            {failure && (
              <p className="signin-error" role="alert">
                {failure.message}{" "}
                {failure.taken && <Link to={withNext("/signin", search)}>Войти вместо этого</Link>}
              </p>
            )}

            <button className="lp-btn lp-btn--primary signin-submit" type="submit" disabled={pending || initializing}>
              {pending ? "Создаём аккаунт…" : initializing ? "Соединение…" : "Создать аккаунт"}{" "}
              {!pending && !initializing && <Arrow />}
            </button>
          </form>

          <p className="signin-foot">
            Уже есть аккаунт? <Link to={withNext("/signin", search)}>Войти</Link>. <Link to="/">Вернуться на сайт</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
