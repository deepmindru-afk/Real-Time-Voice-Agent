import { useEffect, useRef, useState } from "react";
import { LIMITS, normalizeLabel, validateLabel } from "../../runtime/agentConfig.js";
import { LIMITS as CL, normalizeConnection, validateConnection } from "../../runtime/livekit/connection.js";

const CONNECTION_FIELDS = ["tokenEndpoint", "url"];

function Field({ id, label, required, hint, error, children }) {
  return (
    <div className="config-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="config-required"> (обязательно)</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="config-hint" id={`${id}-note`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="config-error" id={`${id}-note`} role="alert">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

// Two things to get right, and they fail for different reasons.
//
//   "Подключение" - can this browser reach a LiveKit agent at all. The endpoint ships
//   with the app and answers on /api/livekit/token; the only thing it needs is a grant.
//   "Агент"       - what to call it in this console. A label, not a configuration: the
//   endpoint decides which agent answers, and there is nothing here that changes it.
export default function AgentConfigPanel({ label, connection, onSaveLabel, onSaveConnection, onCancel }) {
  const dialogRef = useRef(null);
  const [agent, setAgent] = useState(() => normalizeLabel(label));
  const [agentAttempted, setAgentAttempted] = useState(false);
  const [link, setLink] = useState(() => normalizeConnection(connection));
  const [linkAttempted, setLinkAttempted] = useState(false);
  const [saved, setSaved] = useState(null);

  const agentErrors = agentAttempted ? validateLabel(agent) : {};
  const linkErrors = linkAttempted ? validateConnection(link) : {};

  useEffect(() => {
    const dialog = dialogRef.current;

    // The modal closes on Escape; the guard covers a remount in development.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const setAgentField = (key) => (event) => setAgent({ ...agent, [key]: event.target.value });
  const setLinkField = (key) => (event) => setLink({ ...link, [key]: event.target.value });

  // A nested <form> is invalid HTML, so each half saves from its own handler.
  const saveLink = () => {
    setLinkAttempted(true);

    const problems = validateConnection(link);
    const first = CONNECTION_FIELDS.find((key) => problems[key]) ?? Object.keys(problems)[0];

    if (first) {
      dialogRef.current.querySelector(`[name="lk-${first}"]`)?.focus();
      return;
    }

    onSaveConnection(link);
    setLink(normalizeConnection(link));
    setSaved("connection");
  };

  const submit = (event) => {
    event.preventDefault();
    setAgentAttempted(true);

    const problems = validateLabel(agent);
    const first = Object.keys(problems)[0];

    if (first) {
      dialogRef.current.querySelector(`[name="${first}"]`)?.focus();
      return;
    }

    onSaveLabel(agent);
    setAgent(normalizeLabel(agent));
    setSaved("label");
  };

  const agentAttrs = (key, hint) => ({
    name: key,
    id: `config-${key}`,
    "aria-invalid": agentErrors[key] ? true : undefined,
    "aria-describedby": agentErrors[key] || hint ? `config-${key}-note` : undefined,
  });

  const linkAttrs = (key, hint) => ({
    name: `lk-${key}`,
    id: `config-lk-${key}`,
    "aria-invalid": linkErrors[key] ? true : undefined,
    "aria-describedby": linkErrors[key] || hint ? `config-lk-${key}-note` : undefined,
  });

  return (
    <dialog ref={dialogRef} className="config-dialog" aria-labelledby="config-title" onClose={onCancel}>
      <form className="config-form" onSubmit={submit} noValidate>
        <header className="config-header">
          <div>
            <h2 id="config-title">Подключение к Порталу</h2>
            <p>Куда подключаться и как называть агента в этой консоли.</p>
          </div>
          <button type="button" className="config-close" aria-label="Закрыть без сохранения" onClick={onCancel}>
            ×
          </button>
        </header>

        <div className="config-body">
          <section aria-labelledby="config-connection">
            <h3 id="config-connection">Подключение</h3>

            <Field
              id="config-lk-tokenEndpoint"
              label="Эндпоинт токенов"
              required
              error={linkErrors.tokenEndpoint}
              hint="По умолчанию /api/portalos/token — он поставляется вместе с приложением. Укажите полный URL, только если сервис токенов живёт на другом хосте и разрешает CORS для этого сайта."
            >
              <input
                {...linkAttrs("tokenEndpoint", true)}
                type="text"
                value={link.tokenEndpoint}
                maxLength={CL.tokenEndpoint}
                placeholder="/api/portalos/token"
                onChange={setLinkField("tokenEndpoint")}
              />
            </Field>

            <div className="config-row">
              <Field
                id="config-lk-participantName"
                label="Ваше имя в звонке"
                hint="Так вас увидит агент. Оставьте пустым — будет «Оператор»."
              >
                <input
                  {...linkAttrs("participantName", true)}
                  type="text"
                  value={link.participantName}
                  maxLength={CL.participantName}
                  placeholder="Оператор"
                  onChange={setLinkField("participantName")}
                />
              </Field>

              <Field
                id="config-lk-url"
                label="Адрес Портала"
                error={linkErrors.url}
                hint="Нужен только вместе с готовым токеном: эндпоинт свой адрес возвращает сам."
              >
                <input
                  {...linkAttrs("url", true)}
                  type="text"
                  value={link.url}
                  maxLength={CL.url}
                  placeholder="wss://your-project.portalos.ru"
                  onChange={setLinkField("url")}
                />
              </Field>
            </div>

            <Field
              id="config-lk-token"
              label="Готовый токен (запасной вариант)"
              hint="Используется, только если эндпоинт пуст. Токен одноразовый и имеет срок действия — это способ указать руками, а не рабочий режим."
            >
              <input
                {...linkAttrs("token", true)}
                type="text"
                value={link.token}
                maxLength={CL.token}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                onChange={setLinkField("token")}
              />
            </Field>

            <div className="config-footer-inline">
              <p className="config-note" role="status">
                {saved === "connection" ? "✓ Подключение сохранено" : "Ключ и секрет хранятся только на сервере."}
              </p>
              <button type="button" className="config-save" onClick={saveLink}>
                Сохранить подключение
              </button>
            </div>
          </section>

          <section aria-labelledby="config-agent">
            <h3 id="config-agent">Агент</h3>

            <p className="config-hint">
              Это подпись для консоли: она попадает в заголовок записи звонка и в приветствие. Кто именно
              отвечает на линии, задаёт эндпоинт токенов (переменная AGENT_NAME) — из браузера это
              изменить нельзя и не нужно.
            </p>

            <Field id="config-agentName" label="Название агента" required error={agentErrors.agentName}>
              <input
                {...agentAttrs("agentName")}
                type="text"
                value={agent.agentName}
                maxLength={LIMITS.agentName}
                placeholder="Ассистент Портал"
                onChange={setAgentField("agentName")}
              />
            </Field>

            <Field id="config-role" label="Роль" hint="Например: Координатор приёма">
              <input
                {...agentAttrs("role", true)}
                type="text"
                value={agent.role}
                maxLength={LIMITS.role}
                onChange={setAgentField("role")}
              />
            </Field>

            <Field id="config-purpose" label="Назначение" hint={`${agent.purpose.length}/${LIMITS.purpose}`}>
              <textarea
                {...agentAttrs("purpose", true)}
                rows={3}
                value={agent.purpose}
                maxLength={LIMITS.purpose}
                placeholder="Записывает на приём и переносит его по звонку."
                onChange={setAgentField("purpose")}
              />
            </Field>
          </section>
        </div>

        <footer className="config-footer">
          <p className="config-note" role="status">
            {saved === "label" ? "✓ Агент сохранён" : "Всё на этой панели хранится только в этом браузере."}
          </p>
          <div className="config-actions">
            <button type="button" className="config-cancel" onClick={onCancel}>
              Закрыть
            </button>
            <button type="submit" className="config-save">
              Сохранить агента
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
