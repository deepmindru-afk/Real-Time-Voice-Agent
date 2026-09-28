import { useId } from "react";
import Icon from "./Icon";
import { INDUSTRIES, LIMITS, OTHER, ROLE_SUGGESTIONS } from "../../runtime/agentConfig.js";

// The sidebar's "Сценарий применения и настройка агента" item. It is its own section, not
// a parent of the other pages: it only expands to show the few fields that matter
// most. The rest of the configuration lives in the full panel it opens.
export default function AgentUseCaseConfig({
  expanded,
  onToggle,
  draft,
  onDraftChange,
  configured,
  dirty,
  locked,
  saved,
  onConfigure,
  children,
}) {
  const bodyId = useId();
  const roleListId = useId();
  const roles = ROLE_SUGGESTIONS[draft.industry] ?? [];

  const set = (key) => (event) => onDraftChange({ [key]: event.target.value });

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
        <span>Сценарий применения и настройка агента</span>
        <Icon name={expanded ? "chevronUp" : "chevronRight"} size={18} />
      </button>

      {expanded && (
        <div className="config-body-side" id={bodyId}>
          <p className="config-intro">Опишите, что должен делать ваш голосовой агент.</p>

          <fieldset className="config-quick" disabled={locked}>
            <label htmlFor="side-industry">Сценарий применения / отрасль</label>
            <select id="side-industry" value={draft.industry} onChange={set("industry")}>
              <option value="">Выберите сценарий...</option>
              {INDUSTRIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {draft.industry === OTHER && (
              <input
                type="text"
                aria-label="Ваш сценарий применения или отрасль"
                value={draft.industryOther}
                maxLength={LIMITS.short}
                placeholder="Ваша отрасль, например «Логистика»"
                onChange={set("industryOther")}
              />
            )}

            <label htmlFor="side-agent-name">Название агента</label>
            <input
              id="side-agent-name"
              type="text"
              value={draft.agentName}
              maxLength={LIMITS.agentName}
              placeholder="например, АссистентПортал"
              onChange={set("agentName")}
            />

            <label htmlFor="side-role">Роль агента</label>
            <input
              id="side-role"
              type="text"
              list={roles.length ? roleListId : undefined}
              value={draft.role}
              maxLength={LIMITS.role}
              placeholder={roles[0] ?? "Какую роль он выполняет?"}
              onChange={set("role")}
            />
            {roles.length > 0 && (
              <datalist id={roleListId}>
                {roles.map((role) => (
                  <option key={role} value={role} />
                ))}
              </datalist>
            )}

            <label htmlFor="side-purpose">Назначение</label>
            <textarea
              id="side-purpose"
              rows={3}
              value={draft.purpose}
              maxLength={LIMITS.purpose}
              placeholder="В чём он поможет пользователям?"
              onChange={set("purpose")}
            />
          </fieldset>

          <button type="button" className="config-open" disabled={locked} onClick={onConfigure}>
            {configured ? "Изменить настройку" : "Настроить агента"}
            <Icon name="arrowRight" size={16} />
          </button>

          <p className="config-status" role="status">
            {saved
              ? "✓ Настройка агента сохранена"
              : dirty
                ? "Есть несохранённые изменения. Откройте «Настроить агента», чтобы сохранить."
                : configured
                  ? "✓ Настроен"
                  : ""}
          </p>

          {locked && <p className="profile-hint">Завершите звонок, чтобы изменить настройки.</p>}

          {children}
        </div>
      )}
    </section>
  );
}
