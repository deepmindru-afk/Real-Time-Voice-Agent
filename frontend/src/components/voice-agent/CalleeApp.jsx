import { useEffect, useMemo, useState } from "react";
import AgentResponse from "./AgentResponse";
import CallVisualizer from "../voice/CallVisualizer";
import { formatTime } from "../../runtime/format.js";
import { loadConnection } from "../../runtime/livekit/connection.js";
import { VOICE_STATE_LABEL, visualForCallState } from "../../runtime/voiceState.js";
import { useVoiceAgent } from "../../runtime/useVoiceAgent.js";

const STATE_TEXT = {
  connecting: "Соединение...",
  listening: "Слушаю...",
  speaking: "Говорю...",
  processing: "Думаю...",
};

// What a person on a phone browser sees when they open a call link.
//
// There is no incoming-call record to look up and nobody to ring. The endpoint mints a
// fresh room and a fresh agent for every grant, so the link carries no room at all - it
// only names the person, and answering means asking for a grant and joining whatever room
// that grant opens. The "answer/decline" step is gone; the call it was wrapping is not.
//
// The connection is read from this browser, so a link only works for someone who has
// already opened the console once and had a token endpoint configured. That is the honest
// shape of a frontend with no server of its own: there is nowhere else to read it from.
export default function CalleeApp({ name }) {
  const [draft, setDraft] = useState("");

  const connection = useMemo(() => loadConnection(), []);
  const callerName = (name ?? "").trim() || "Клиент";
  const agent = useVoiceAgent({ connection, participantName: callerName });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", localStorage.getItem("voice-agent-theme") || "dark");
  }, []);

  const inCall = agent.callState !== "idle" && agent.callState !== "ended";
  const label = STATE_TEXT[agent.callState] ?? VOICE_STATE_LABEL[agent.callState];

  const submit = (event) => {
    event.preventDefault();
    agent.sendText(draft);
    setDraft("");
  };

  let body;

  if (!agent.engine.ok) {
    body = (
      <div className="state-block">
        <p>{agent.engine.note}</p>
        <p>Подключение настраивается в консоли на компьютере, в разделе «Подключение к LiveKit».</p>
      </div>
    );
  } else if (agent.callState === "ended") {
    body = <div className="state-block">{agent.callError ?? "Звонок завершён. Спасибо. Можете закрыть эту страницу."}</div>;
  } else if (inCall) {
    body = (
      <>
        <div className="callee-orb">
          <CallVisualizer
            state={visualForCallState(agent.callState, Boolean(agent.callError))}
            orbIcon="microphone"
            statusLabel={label}
            size="lg"
          />
        </div>

        <div className="timer callee-timer">{formatTime(agent.duration)}</div>

        <div className="live-caption" aria-live="polite">
          {agent.voice.interim ? `«${agent.voice.interim}»` : " "}
        </div>

        {agent.needsAudio && (
          <p className="voice-notice">
            Браузер не разрешает включать звук без вашего действия.
            <button type="button" className="callee-answer" onClick={agent.unlockAudio}>
              Включить звук
            </button>
          </p>
        )}

        {agent.voice.micState === "blocked" && (
          <p className="voice-notice">Доступ к микрофону заблокирован. Вы можете вводить ответы ниже.</p>
        )}

        <div className="callee-transcript">
          <AgentResponse
            title="Разговор"
            messages={agent.messages}
            pending={agent.pending}
            onRespond={agent.sendText}
            showTools={false}
          />
        </div>

        <form className="type-row" onSubmit={submit}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Или введите ответ..."
            aria-label="Введите сообщение"
          />
          <button type="submit" disabled={!draft.trim()}>
            Отправить
          </button>
        </form>

        <button className="stop-button" onClick={agent.endCall}>
          <span className="stop-square" />
          Завершить звонок
        </button>
      </>
    );
  } else {
    body = (
      <>
        <div className="callee-orb">
          <CallVisualizer state="idle" orbIcon="phone" statusLabel="Готовы принять звонок" size="lg" showWaveform={false} />
        </div>

        <p className="callee-note">
          <strong>АО «Портал»</strong> приглашает {callerName} на разговор с голосовым ИИ-агентом. Комната
          создаётся специально для этого звонка, а разговор сохраняется в виде расшифровки.
        </p>

        <div className="callee-buttons">
          <button className="callee-answer" onClick={agent.beginCall}>
            Ответить
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="callee-page">
      <header className="callee-header">
        <div className="brand-logo">
          <span>П</span>
        </div>
        <h1>АО «Портал» — голосовой ИИ-агент</h1>
      </header>

      <main className="callee-card">{body}</main>
    </div>
  );
}
