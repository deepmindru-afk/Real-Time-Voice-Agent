import { useId } from "react";
import Icon from "./Icon";
import { LIMITS } from "../../runtime/agentConfig.js";

// The sidebar's "Подключение и агент" item. It is its own section rather than a parent of
// the other screens: it shows whether the endpoint is set and how the agent is called, and
// opens the panel where both are edited.
export default function AgentUseCaseConfig({
  expanded,
  onToggle,
  label,
  onDraftChange,
  configured,
  dirty,
  saved,
  onConfigure,
  connection,
}) {
  const bodyId = useId();

  const set = (key) => (event) => onDraftChange({ ...label, [key]: event.target.value });

  return (
    <section className={`config-section ${expanded ? "is-open" : ""}`}>
      <button
        type="button"
        className="nav-item config-toggle"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <Icon name="settings" size={21} />
        <span>Подключение и агент</span>
        <Icon name={expanded ? "chevronUp" : "chevronRight"} size={18} />
      </button>

      {expanded && (
        <div className="config-body-side" id={bodyId}>
          <fieldset className="config-quick">
            <label htmlFor="side-agent-name">Название агента</label>
            <input
              id="side-agent-name"
              type="text"
              value={label.agentName}
              maxLength={LIMITS.agentName}
              placeholder="Ассистент FALX"
              onChange={set("agentName")}
            />

            <label htmlFor="side-role">Роль</label>
            <input
              id="side-role"
              type="text"
              value={label.role}
              maxLength={LIMITS.role}
              placeholder="Координатор приёма"
              onChange={set("role")}
            />

            <label htmlFor="side-purpose">Назначение</label>
            <textarea
              id="side-purpose"
              rows={2}
              value={label.purpose}
              maxLength={LIMITS.purpose}
              placeholder="В одной строке: зачем он нужен"
              onChange={set("purpose")}
            />
          </fieldset>

          <button type="button" className="config-open" onClick={onConfigure}>
            Открыть подключение
            <Icon name="arrowRight" size={16} />
          </button>

          <p className="config-status" role="status">
            {saved ? "✓ Сохранено" : dirty ? "Есть несохранённые изменения." : configured ? "✓ Настроено" : ""}
          </p>

          <div className="config-data">
            <p className="profile-hint">
              {connection?.tokenEndpoint
                ? `Эндпоинт токенов: ${connection.tokenEndpoint}`
                : connection?.token
                  ? "Задан готовый токен без эндпоинта."
                  : "Эндпоинт токенов не задан."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
