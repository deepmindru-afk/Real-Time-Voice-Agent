import Icon from "./Icon";
import AgentUseCaseConfig from "./AgentUseCaseConfig";
import { isLiveKitSupported, liveKitSupport } from "../../runtime/livekit/support.js";

// Independent destinations. None of them contains another.
// [icon, label, view it opens]
const NAVIGATION = [
  ["home", "Главная", "home"],
  ["workflow", "Сценарии", "workflows"],
  ["phone", "История звонков", "history"],
  ["user", "Контакты", "contacts"],
  ["analytics", "Аналитика", "analytics"],
];

const MIC_STATUS = {
  off: ["Не включён", true],
  on: ["Слушает", true],
  blocked: ["Заблокирован", false],
  error: ["Ошибка", false],
};

function StatusRow({ label, value, ok }) {
  return (
    <li className={ok === false ? "is-bad" : ok === null ? "is-pending" : ""}>
      <Icon name={ok === false ? "cross" : "check"} size={14} />
      <span>
        {label}: {value}
      </span>
    </li>
  );
}

export default function Sidebar({
  open,
  callState,
  view,
  onNavigate,
  engine,
  mic = "off",
  connection,
  configExpanded,
  onToggleConfig,
  configDraft,
  onConfigDraftChange,
  configured = false,
  configDirty = false,
  configSaved = false,
  onConfigure,
}) {
  const [micText, micOk] = MIC_STATUS[mic] ?? MIC_STATUS.off;
  const ready = isLiveKitSupported() && engine.ok;
  const endpoint = connection?.tokenEndpoint;

  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`} id="app-sidebar" aria-label="Боковое меню">
      <div className="sidebar-scroll">
        <nav className="navigation" aria-label="Основная навигация">
          {NAVIGATION.map(([icon, name, target]) => (
            <button
              key={name}
              type="button"
              className={`nav-item ${target === view ? "active" : ""}`}
              aria-current={target === view ? "page" : undefined}
              onClick={() => onNavigate(target)}
            >
              <Icon name={icon} size={21} />
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="navigation navigation-config">
          <AgentUseCaseConfig
            expanded={configExpanded}
            onToggle={onToggleConfig}
            draft={configDraft}
            onDraftChange={onConfigDraftChange}
            configured={configured}
            dirty={configDirty}
            saved={configSaved}
            onConfigure={onConfigure}
            connection={connection}
          />
        </div>
      </div>

      <div className="service-card">
        <div className="service-title">
          <span className={`online-dot ${ready ? "" : "offline-dot"}`} />
          {ready ? "Голосовая служба готова" : "Голос не настроен"}
        </div>

        <ul className="service-list">
          <StatusRow
            label="Микрофон"
            value={micText}
            ok={micOk}
          />
          <StatusRow
            label="WebRTC"
            value={liveKitSupport.rtc && liveKitSupport.secure ? "Готово" : "Недоступно"}
            ok={liveKitSupport.rtc && liveKitSupport.secure}
          />
          <StatusRow
            label="Адрес сервера"
            value={connection?.url || (endpoint ? "от эндпоинта" : "не задан")}
            ok={Boolean(connection?.url) || Boolean(endpoint)}
          />
          <StatusRow
            label="ИИ-агент"
            value={engine.state === "ready" ? "Готов (Портал)" : engine.state === "unsupported" ? "Браузер не поддерживает" : "Не настроен"}
            ok={engine.state === "ready"}
          />
        </ul>

        {engine.note && <p className="brain-note">{engine.note}</p>}

        {callState === "processing" && <div className="service-processing">Обработка разговора...</div>}
      </div>
    </aside>
  );
}
