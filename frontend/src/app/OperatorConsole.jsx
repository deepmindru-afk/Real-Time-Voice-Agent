import { useCallback, useEffect, useState } from "react";
import { addCall } from "../runtime/history.js";
import AgentConfigPanel from "../components/voice-agent/AgentConfigPanel";
import { loadLabel, normalizeLabel, saveLabel } from "../runtime/agentConfig.js";
import { CALL_STATE_TEXT } from "../runtime/format.js";
import { isConfigured as isConnectionConfigured, loadConnection, normalizeConnection, saveConnection } from "../runtime/livekit/connection.js";
import TopNavbar from "../components/voice-agent/TopNavbar";
import Sidebar from "../components/voice-agent/Sidebar";
import VoicePanel from "../components/voice-agent/VoicePanel";
import AgentResponse from "../components/voice-agent/AgentResponse";
import CallSummary from "../components/voice-agent/CallSummary";
import CallDetails from "../components/voice-agent/CallDetails";
import WelcomeBar from "../components/voice-agent/WelcomeBar";
import { ProfilePage, SectionPlaceholder, SettingsPage } from "../components/voice-agent/Pages";
import CallHistory from "../components/voice-agent/CallHistory";
import Contacts from "../components/voice-agent/Contacts";
import Workflows from "../components/voice-agent/Workflows";
import { useRouter } from "../router/context.js";
import { buildCallRecord } from "../runtime/callRecord.js";
import { useVoiceAgent } from "../runtime/useVoiceAgent.js";
import "../styles/voice-agent.css";

// The operator console. One call at a time, a transcript of it, its result, and the
// local records around it. Nothing here needs a server: the only thing it talks to is a
// LiveKit agent, through a token the operator's own token service mints.
//
// route name -> which of the console's screens it shows
const VIEW_FOR_ROUTE = {
  dashboard: "home",
  console: "home",
  calls: "history",
  "call-detail": "history",
  contacts: "contacts",
  workflows: "workflows",
  analytics: "analytics",
  settings: "settings",
};

// ...and the reverse: where each screen lives. "profile" has no URL of its own (it is a
// screen of the account menu, not a section of Settings), so the console remembers it.
const PATH_FOR_VIEW = {
  home: "/app/dashboard",
  history: "/app/calls",
  contacts: "/app/contacts",
  workflows: "/app/workflows",
  analytics: "/app/analytics",
  settings: "/app/settings",
};

const DEFAULT_THEME = "dark";

// The product is not tied to one industry, so the header does not name one.
const TAGLINE = "Один голосовой движок. Любая роль. Любая отрасль.";

export default function OperatorConsole() {
  const { route, path, navigate: goTo } = useRouter();
  const [theme, setTheme] = useState(() => localStorage.getItem("voice-agent-theme") || DEFAULT_THEME);

  // How to reach a LiveKit agent. Persisted, because it does not change between calls.
  const [connection, setConnection] = useState(() => normalizeConnection(loadConnection()));
  // How the agent is called in this console. A local label; see agentConfig.js for why it
  // is not sent anywhere.
  const [agentLabel, setAgentLabel] = useState(() => loadLabel());
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(() => !isConnectionConfigured(loadConnection()));

  const [navOpen, setNavOpen] = useState(false); // the sidebar drawer on small screens

  const agent = useVoiceAgent({ connection, participantName: connection.participantName || undefined });

  const [own, setOwn] = useState(null);
  const view = own && own.path === path ? own.view : (VIEW_FOR_ROUTE[route] ?? "home");
  // Which part of a finished call the centre shows. Tied to the call, so a new call
  // starts on its summary again.
  const [recordView, setRecordView] = useState({ callId: null, view: "summary" });

  const isActive = agent.callState !== "idle" && agent.callState !== "ended";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("voice-agent-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!configSaved) return undefined;

    const timer = setTimeout(() => setConfigSaved(false), 4000);

    return () => clearTimeout(timer);
  }, [configSaved]);

  useEffect(() => {
    if (!navOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setNavOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  const saveAgentLabel = useCallback((next) => {
    // Local only, so this always succeeds. The panel says so, and says where it lives.
    saveLabel(next);
    setAgentLabel(normalizeLabel(next));
    setConfigSaved(true);
  }, []);

  const saveLiveKitConnection = useCallback(
    (next) => {
      saveConnection(next);
      setConnection(normalizeConnection(next));
      setConfigOpen(false);
      setConfigSaved(true);
    },
    []
  );

  const openConfig = useCallback(() => {
    setNavOpen(false);
    setConfigOpen(true);
  }, []);

  const isConfiguredAgent = Boolean(agentLabel.agentName);

  const navigate = (target) => {
    setNavOpen(false);

    if (PATH_FOR_VIEW[target]) {
      setOwn(null);
      goTo(PATH_FOR_VIEW[target]);
    } else {
      setOwn({ view: target, path });
    }
  };

  // A finished call belongs in this browser's history, and it is the only record of it
  // that will ever exist. This runs once per call, on the transition into "ended".
  useEffect(() => {
    if (agent.callState !== "ended" || !agent.summary) return;

    addCall({
      status: "completed",
      channel: "web",
      agent: agentLabel.agentName || null,
      ...agent.summary,
    });
  }, [agent.callState, agent.summary, agentLabel.agentName]);

  const record = buildCallRecord({
    config: agentLabel,
    callState: agent.callState,
    summary: agent.summary,
    summaryPending: agent.summaryPending,
    duration: agent.duration,
    startedAt: agent.startedAt,
    callError: agent.callError,
  });

  const summaryView = recordView.callId === record.callId ? recordView.view : "summary";

  const showTranscript = () => {
    setRecordView({ callId: record.callId, view: "transcript" });
    document.getElementById("call-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleTheme = () => setTheme((current) => (current === "light" ? "dark" : "light"));

  return (
    <div className="voice-app">
      <TopNavbar
        theme={theme}
        onToggleTheme={toggleTheme}
        workspaceLabel={TAGLINE}
        onNavigate={navigate}
        sidebarOpen={navOpen}
        onToggleSidebar={() => setNavOpen(!navOpen)}
      />

      <div className="voice-layout">
        <Sidebar
          open={navOpen}
          callState={agent.callState}
          view={view}
          onNavigate={navigate}
          engine={agent.engine}
          mic={agent.voice.micState}
          connection={connection}
          configExpanded={configExpanded}
          onToggleConfig={() => setConfigExpanded(!configExpanded)}
          label={agentLabel}
          onDraftChange={setAgentLabel}
          configured={isConfiguredAgent}
          configSaved={configSaved}
          onConfigure={openConfig}
        />

        {navOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Закрыть навигацию"
            onClick={() => setNavOpen(false)}
          />
        )}

        {configOpen && (
          <AgentConfigPanel
            label={agentLabel}
            onSaveLabel={saveAgentLabel}
            connection={connection}
            onSaveConnection={saveLiveKitConnection}
            onCancel={() => setConfigOpen(false)}
          />
        )}

        {view === "history" && (
          <main key={view} className="view-frame history-main">
            <CallHistory onOpenCall={() => navigate("home")} />
          </main>
        )}

        {view === "contacts" && (
          <main key={view} className="view-frame history-main">
            <Contacts />
          </main>
        )}

        {view === "workflows" && (
          <main key={view} className="view-frame history-main">
            <Workflows />
          </main>
        )}

        {view === "analytics" && (
          <main key={view} className="view-frame history-main">
            <SectionPlaceholder
              icon="analytics"
              title="Аналитика"
              description="Сводка по звонкам, их результатам и длительности появится здесь."
            />
          </main>
        )}

        {view === "profile" && (
          <main key={view} className="view-frame history-main">
            <ProfilePage connection={connection} agent={agentLabel} />
          </main>
        )}

        {view === "settings" && (
          <main key={view} className="view-frame history-main">
            <SettingsPage
              theme={theme}
              onThemeChange={setTheme}
              onConfigure={openConfig}
              configLocked={isActive}
              onOpenConnection={openConfig}
            />
          </main>
        )}

        {view === "home" && (
          <main key={view} className="view-frame voice-main">
            <div className="home-center">
              <WelcomeBar contact={record.contact} agentName={record.agent.agentName} status={record.status} />

              <CallSummary
                record={record}
                configured={isConfiguredAgent}
                view={summaryView}
                onViewChange={(next) => setRecordView({ callId: record.callId, view: next })}
                onConfigure={openConfig}
              />

              <VoicePanel
                callState={agent.callState}
                duration={agent.duration}
                interim={agent.voice.interim}
                micState={agent.voice.micState}
                onStart={agent.beginCall}
                onStop={agent.endCall}
                onSend={agent.sendText}
                onReset={agent.reset}
                onViewHistory={() => navigate("history")}
                acting={Boolean(agent.messages.at(-1)?.toolCalls?.length) && isActive}
                needsAudio={agent.needsAudio}
                onUnlockAudio={agent.unlockAudio}
                engine={agent.engine}
              />
            </div>

            <div className="voice-right-column">
              <AgentResponse
                messages={agent.messages}
                pending={agent.pending}
                onRespond={agent.sendText}
                onClear={agent.clearMessages}
                canClear={!isActive}
                agentName={record.agent.agentName}
                status={isActive ? CALL_STATE_TEXT[agent.callState] : null}
              />

              <CallDetails record={record} summary={agent.summary} onViewTranscript={showTranscript} />
            </div>
          </main>
        )}
      </div>

      {!agent.engine.ok && <ConnectionHint engine={agent.engine} onOpen={openConfig} />}
    </div>
  );
}

// Shown once at the foot of the console when a call cannot be started at all. It is a
// link, not a dialog: the console is still fully usable, and a modal would be in the way
// of reading a call record.
function ConnectionHint({ engine, onOpen }) {
  return (
    <div className="voice-notice-bar" role="status">
      <span>{engine.note}</span>
      <button type="button" onClick={onOpen}>
        Открыть настройки подключения
      </button>
    </div>
  );
}
