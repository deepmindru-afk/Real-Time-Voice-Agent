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

// There is no account to show, because there is no sign-in. What the operator does have
// is the two pieces of configuration that decide what happens on the next call, and
// showing them here is more useful than an invented profile.
export function ProfilePage({ connection, agent }) {
  const blank = "—";

  return (
    <section className="page-card">
      <h2>Подключение</h2>

      <dl className="page-facts">
        <div>
          <dt>Адрес FALX</dt>
          <dd>{connection?.url || "возвращается эндпоинтом токенов"}</dd>
        </div>
        <div>
          <dt>Эндпоинт токенов</dt>
          <dd>{connection?.tokenEndpoint || blank}</dd>
        </div>
        <div>
          <dt>Ваше имя в звонке</dt>
          <dd>{connection?.participantName || "Оператор"}</dd>
        </div>
        <div>
          <dt>Хранение данных</dt>
          <dd>Только этот браузер</dd>
        </div>
      </dl>

      <h2 style={{ marginTop: 24 }}>Агент</h2>

      <dl className="page-facts">
        <div>
          <dt>Название</dt>
          <dd>{agent?.agentName || "не описан"}</dd>
        </div>
        <div>
          <dt>Роль</dt>
          <dd>{agent?.role || blank}</dd>
        </div>
        <div>
          <dt>Отрасль</dt>
          <dd>{agent?.industry || blank}</dd>
        </div>
        <div>
          <dt>Назначение</dt>
          <dd>{agent?.purpose || blank}</dd>
        </div>
      </dl>
    </section>
  );
}

export function SettingsPage({ theme, onThemeChange, onConfigure, configLocked, onOpenConnection }) {
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
        <h3>Подключение</h3>
        <p>Эндпоинт токенов FALX, имя агента и комнаты задаются в панели подключения.</p>

        <button type="button" className="config-open" onClick={onOpenConnection}>
          Открыть подключение
          <Icon name="arrowRight" size={16} />
        </button>
      </div>

      <div className="page-setting">
        <h3>Агент</h3>
        <p>Что агент делает, придя на линию, — это метаданные подключения, а не его настройка.</p>

        <button type="button" className="config-open" disabled={configLocked} onClick={onConfigure}>
          Описать агента
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </section>
  );
}
