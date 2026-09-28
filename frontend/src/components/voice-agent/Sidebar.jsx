import Icon from "./Icon";
import AgentUseCaseConfig from "./AgentUseCaseConfig";
import { isLiveKitSupported, liveKitSupport } from "../../runtime/livekit/support.js";
import { voiceSupport } from "../../runtime/useVoice.js";

// Independent destinations. None of them contains another.
// [icon, label, view it opens]
const NAVIGATION = [
  ["home", "Главная", "home"],
  ["applications", "Заявки", "applications"],
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

// Which engine is answering. LiveKit is the product; the other two are what is left
// when it is not available, and the operator is told which one they are looking at.
function brainStatus(brain) {
  if (brain.source === "livekit") return ["Готов (LiveKit)", true];
  if (brain.source === "server") return [`Готов (${brain.name})`, true];
  if (brain.source === "local") return ["Готов (локальные правила, офлайн)", true];

  return ["Проверяем...", null];
}

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
  profiles,
  profile,
  profileLocked,
  onProfileChange,
  voice,
  brain,
  view,
  onNavigate,
  customers = [],
  customerRef = "",
  onCustomerChange,
  configExpanded,
  onToggleConfig,
  configDraft,
  onConfigDraftChange,
  configured = false,
  configDirty = false,
  configSaved = false,
  onConfigure,
}) {
  // With LiveKit running, readiness is the room's, not the browser's: the browser only
  // has to be able to capture a microphone and play audio, which the SDK reports.
  const onLiveKit = brain.source === "livekit";
  const ready = onLiveKit
    ? isLiveKitSupported()
    : voiceSupport.recognition && voiceSupport.synthesis;
  const [micText, micOk] = MIC_STATUS[voice.micState] ?? MIC_STATUS.off;
  const [brainText, brainOk] = brainStatus(brain);

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
            locked={profileLocked}
            saved={configSaved}
            onConfigure={onConfigure}
          >
            <div className="config-data">
              <label htmlFor="agent-profile">Подключённые данные и инструменты</label>
              <select
                id="agent-profile"
                className="profile-select"
                value={profile.id}
                disabled={profileLocked}
                onChange={(event) => onProfileChange(event.target.value)}
              >
                {profiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              {customers.length > 0 && (
                <>
                  <label htmlFor="agent-customer">Клиент</label>
                  <select
                    id="agent-customer"
                    className="profile-select"
                    value={customerRef}
                    disabled={profileLocked}
                    onChange={(event) => onCustomerChange(event.target.value)}
                  >
                    <option value="">Демо-данные</option>
                    {customers.map((customer) => (
                      <option key={customer.ref} value={customer.ref}>
                        {customer.display_name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <p className="profile-hint">
                {profileLocked
                  ? "Завершите звонок, чтобы сменить данные и инструменты."
                  : "Запросы и действия, доступные агенту."}
              </p>
            </div>
          </AgentUseCaseConfig>
        </div>
      </div>

      <div className="service-card">
        <div className="service-title">
          <span className={`online-dot ${ready ? "" : "offline-dot"}`} />
          {ready ? "Голосовая служба готова" : "Голос ограничен"}
        </div>

        <ul className="service-list">
          <StatusRow label="Микрофон" value={micText} ok={micOk} />
          <StatusRow
            label="Распознавание речи"
            value={onLiveKit ? (liveKitSupport.secure ? "Готово" : "Требуется HTTPS") : voiceSupport.recognition ? "Готово" : "Недоступно"}
            ok={onLiveKit ? liveKitSupport.secure : voiceSupport.recognition}
          />
          <StatusRow
            label="Озвучивание речи"
            value={onLiveKit || voiceSupport.synthesis ? "Готово" : "Недоступно"}
            ok={onLiveKit ? true : voiceSupport.synthesis}
          />
          <StatusRow label="ИИ-агент" value={brainText} ok={brainOk} />
        </ul>

        {brain.note && <p className="brain-note">{brain.note}</p>}

        {callState === "processing" && <div className="service-processing">Обработка разговора...</div>}
      </div>
    </aside>
  );
}
