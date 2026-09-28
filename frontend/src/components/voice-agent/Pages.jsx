import Icon from "./Icon";

// A destination that exists in the navigation but is not built yet. It says so
// instead of showing invented data.
export function SectionPlaceholder({ icon, title, description }) {
  return (
    <section className="page-card page-placeholder">
      <span className="summary-icon">
        <Icon name={icon} size={24} />
      </span>

      <h2>{title}</h2>
      <p>{description}</p>
      <span className="status-badge badge-idle">Скоро будет</span>
    </section>
  );
}

export function ProfilePage({ user }) {
  return (
    <section className="page-card">
      <h2>Профиль</h2>

      <dl className="page-facts">
        <div>
          <dt>Почта</dt>
          <dd>{user?.email ?? "Вы не вошли (офлайн-режим)"}</dd>
        </div>
        {user?.role && (
          <div>
            <dt>Роль</dt>
            <dd>{user.role[0].toUpperCase() + user.role.slice(1)}</dd>
          </div>
        )}
        {user?.organization_id != null && (
          <div>
            <dt>ID организации</dt>
            <dd>{user.organization_id}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function SettingsPage({ theme, onThemeChange, onConfigure, configLocked }) {
  return (
    <section className="page-card">
      <h2>Настройки</h2>

      <fieldset className="page-setting">
        <legend>Оформление</legend>

        <div className="segmented">
          {["light", "dark"].map((mode) => (
            <label key={mode} className={theme === mode ? "is-active" : ""}>
              <input
                type="radio"
                name="theme"
                value={mode}
                checked={theme === mode}
                onChange={() => onThemeChange(mode)}
              />
              <Icon name={mode === "dark" ? "moon" : "sun"} size={16} />
              {mode === "dark" ? "Тёмная" : "Светлая"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="page-setting">
        <h3>Агент</h3>
        <p>Задачи голосового агента задаются в разделе «Сценарий применения и настройка агента».</p>

        <button type="button" className="config-open" disabled={configLocked} onClick={onConfigure}>
          Открыть настройку
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </section>
  );
}
