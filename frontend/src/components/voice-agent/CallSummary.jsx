import Icon from "./Icon";
import { flowStep } from "../../runtime/callRecord.js";
import { LOCALE, formatDateTime, formatTime } from "../../runtime/format.js";

const STEPS = ["Настроить", "Начать разговор", "Завершить звонок", "Изучить итоги"];

const BADGE = {
  idle: ["Не начат", "badge-idle"],
  live: ["Идёт", "badge-info"],
  summarizing: ["Формируется итог", "badge-info"],
  completed: ["Звонок завершён", "badge-ok"],
  unavailable: ["Нет итогов", "badge-warn"],
};

const VIEWS = [
  ["summary", "Итоги"],
  ["transcript", "Расшифровка"],
  ["audit", "Журнал"],
];

function Flow({ step }) {
  return (
    <ol className="flow" aria-label="Этапы звонка">
      {STEPS.map((name, index) => (
        <li key={name} className={index < step ? "is-done" : index === step ? "is-current" : ""}>
          <span className="flow-dot">{index < step ? <Icon name="check" size={12} /> : index + 1}</span>
          {name}
        </li>
      ))}
    </ol>
  );
}

function Empty({ record, onConfigure }) {
  const { agent, status } = record;

  if (status === "live") {
    return (
      <p className="summary-empty">
        Разговор с агентом «{agent.agentName}» ещё идёт. Итоги будут сформированы после завершения звонка.
      </p>
    );
  }

  if (status === "summarizing") {
    return <p className="summary-empty">Формируем итоги звонка...</p>;
  }

  if (status === "unavailable") {
    return (
      <p className="summary-empty">
        {record.error ?? "По этому звонку нет доступных итогов."} Начните новый разговор, чтобы повторить попытку.
      </p>
    );
  }

  return (
    <div className="summary-empty">
      <p>
        {agent.configured
          ? `Агент «${agent.agentName}» настроен на роль «${agent.role}». Начните разговор, и его итоги появятся здесь после завершения звонка.`
          : `Агент ещё не настроен, поэтому звонки используют встроенные настройки «${agent.agentName}». Настройте агента, чтобы задать его поведение.`}
      </p>

      {!agent.configured && (
        <button type="button" className="config-open summary-configure" onClick={onConfigure}>
          Настроить агента
          <Icon name="arrowRight" size={16} />
        </button>
      )}
    </div>
  );
}

function Transcript({ transcript }) {
  if (!transcript.length) return <p className="summary-empty">По этому звонку нет расшифровки.</p>;

  return (
    <ol className="detail-list">
      {transcript.map((message) => (
        <li key={message.id}>
          <span>{message.time}</span>
          <strong>{message.speaker === "Agent" ? "Агент" : "Вы"}</strong>
          {message.text}
        </li>
      ))}
    </ol>
  );
}

function Audit({ audit }) {
  if (!audit.length) return <p className="summary-empty">По этому звонку нет событий журнала.</p>;

  return (
    <ol className="detail-list">
      {audit.map((event, index) => (
        <li key={index}>
          <span>{new Date(event.at).toLocaleTimeString(LOCALE)}</span>
          <strong>{event.type}</strong>
          {event.tool ?? event.direction ?? event.text ?? ""}
        </li>
      ))}
    </ol>
  );
}

function Section({ icon, title, children }) {
  return (
    <section className="summary-block">
      <h4>
        <Icon name={icon} size={18} />
        {title}
      </h4>
      {children}
    </section>
  );
}

// What was said and done in the call between the person and the configured
// agent. Every label comes from the record, so it reads the same for any domain.
export default function CallSummary({ record, configured, view, onViewChange, onConfigure }) {
  const { agent, status } = record;
  const [badgeText, badgeClass] = BADGE[status];
  const completed = status === "completed";
  const shown = completed ? view : "summary";

  return (
    <section className="call-summary-card" id="call-summary" aria-labelledby="call-summary-title">
      <header className="call-summary-head">
        <span className="summary-icon">
          <Icon name="document" size={22} />
        </span>

        <div>
          <h3 id="call-summary-title">Итоги звонка</h3>
          <p>Кратко о том, что обсуждалось с агентом и что было сделано.</p>
        </div>

        <span className={`status-badge ${badgeClass}`}>{badgeText}</span>
      </header>

      <Flow step={flowStep(status, configured)} />

      <div className="call-headline">
        <span className="call-headline-icon">
          <Icon name="agent" size={26} />
        </span>

        <div>
          <h4>{record.title}</h4>

          <ul className="call-headline-meta">
            <li>
              <Icon name="calendar" size={15} />
              {record.startedAt ? formatDateTime(record.startedAt) : "Не начат"}
            </li>
            <li>
              <Icon name="clock" size={15} />
              {record.durationSeconds === null ? "--:--" : formatTime(record.durationSeconds)}
            </li>
            <li>
              <Icon name="tag" size={15} />
              {agent.agentName}
            </li>
          </ul>
        </div>
      </div>

      {completed && (
        <div className="summary-tabs" role="tablist" aria-label="Представление записи звонка">
          {VIEWS.map(([id, name]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={shown === id}
              className={shown === id ? "is-active" : ""}
              onClick={() => onViewChange(id)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {shown === "transcript" && <Transcript transcript={record.transcript} />}
      {shown === "audit" && <Audit audit={record.audit} />}

      {shown === "summary" && !completed && <Empty record={record} onConfigure={onConfigure} />}

      {shown === "summary" && completed && (
        <>
          <Section icon="document" title="Итоги разговора">
            <p className="summary-text">{record.summaryText}</p>
          </Section>

          <Section icon="tag" title="Обсуждённые темы">
            {record.topics.length ? (
              <ul className="topic-chips">
                {record.topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            ) : (
              <p className="summary-empty">В этом звонке темы не поднимались.</p>
            )}
          </Section>

          <Section icon="check" title="Действия и результат">
            <ul className="check-list">
              {record.actions.map((action) => (
                <li key={action}>
                  <span className="check-mark">
                    <Icon name="check" size={13} />
                  </span>
                  {action}
                </li>
              ))}
            </ul>

            {record.nextSteps.length > 0 && (
              <>
                <h5>Дальнейшие шаги</h5>
                <ul className="plain-list">
                  {record.nextSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {record.outcome && (
            <div className={`outcome ${record.outcome.ok ? "" : "outcome-warn"}`} role="status">
              <span className="outcome-icon">
                <Icon name={record.outcome.ok ? "chart" : "cross"} size={22} />
              </span>
              <div>
                <strong>{record.outcome.headline}</strong>
                <p>{record.outcome.detail}</p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
