import { useEffect, useMemo, useState } from "react";
import AgentResponse from "./AgentResponse";
import CallVisualizer from "../voice/CallVisualizer";
import { declineJob, fetchRing } from "../../runtime/transports.js";
import { formatTime } from "../../runtime/format.js";
import { VOICE_STATE_LABEL, visualForCallState } from "../../runtime/voiceState.js";
import { voiceSupport } from "../../runtime/useVoice.js";
import { useVoiceAgent } from "../../runtime/useVoiceAgent.js";

const STATE_TEXT = {
  connecting: "Соединение...",
  listening: "Слушаю...",
  speaking: "Говорю...",
  processing: "Думаю...",
};

// What the person being called sees. They open the link they were sent, the
// "phone" rings, and they answer or decline. This is the seam a telephony
// provider will later replace: the server side of the call does not change.
export default function CalleeApp({ jobId, token }) {
  const [ring, setRing] = useState({ state: "loading" }); // loading | ringing | unavailable | declined
  const [draft, setDraft] = useState("");

  const profile = useMemo(() => ({ id: ring.profile_id }), [ring.profile_id]);
  const attach = useMemo(() => ({ jobId, token }), [jobId, token]);
  const agent = useVoiceAgent(profile, { attach });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", localStorage.getItem("voice-agent-theme") || "dark");
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchRing(jobId, token)
      .then((info) => {
        if (!cancelled) {
          setRing(info.status === "ringing" ? { state: "ringing", ...info } : { state: "unavailable", ...info });
        }
      })
      .catch(() => {
        if (!cancelled) setRing({ state: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [jobId, token]);

  const decline = async () => {
    try {
      await declineJob(jobId, token);
    } catch {
      // Already gone: nothing more to decline.
    }

    setRing((current) => ({ ...current, state: "declined" }));
  };

  const inCall = agent.callState !== "idle" && agent.callState !== "ended";

  const submit = (event) => {
    event.preventDefault();
    agent.sendText(draft);
    setDraft("");
  };

  let body;

  if (ring.state === "loading") {
    body = <div className="state-block is-loading">Проверяем этот звонок...</div>;
  } else if (ring.state === "declined") {
    body = <div className="state-block">Вы отклонили звонок. Можете закрыть эту страницу.</div>;
  } else if (agent.callState === "ended") {
    body = (
      <div className="state-block">
        {agent.callError ?? "Звонок завершён. Спасибо. Можете закрыть эту страницу."}
      </div>
    );
  } else if (inCall) {
    body = (
      <>
        <div className="callee-orb">
          <CallVisualizer
            state={visualForCallState(agent.callState, Boolean(agent.callError))}
            orbIcon="microphone"
            statusLabel={STATE_TEXT[agent.callState] ?? VOICE_STATE_LABEL[agent.callState]}
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
        {!voiceSupport.recognition && !agent.voice.livekit && (
          <p className="voice-notice">
            Этот браузер не слышит вас (используйте Chrome или Edge). В режиме LiveKit распознавание выполняет агент.
            Вы можете вводить ответы ниже.
          </p>
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
  } else if (ring.state === "ringing") {
    body = (
      <>
        <div className="callee-orb">
          <CallVisualizer
            state="connecting"
            orbIcon="phone"
            statusLabel="Входящий звонок"
            size="lg"
            showWaveform={false}
          />
        </div>

        <p className="callee-note">
          <strong>{ring.organisation ?? "АО «Портал»"}</strong> звонит вам. Это голосовой ИИ-ассистент, и
          разговор сохраняется в виде расшифровки.
        </p>

        <div className="callee-buttons">
          <button className="callee-answer" onClick={agent.beginCall}>
            Ответить
          </button>
          <button className="callee-decline" onClick={decline}>
            Отклонить
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <div className="state-block">
        Этот звонок больше недоступен. Возможно, на него уже ответили, отклонили или он истёк.
      </div>
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
