import { useState } from "react";
import Icon from "./Icon";
import CallVisualizer from "../voice/CallVisualizer";
import AiActivity from "../voice/AiActivity";
import { visualForCallState } from "../../runtime/voiceState.js";
import { CALL_STATE_TEXT, formatTime } from "../../runtime/format.js";

// The call controls: start or stop the conversation, or type instead of speaking. The
// conversation itself is shown in Agent Response and the outcome in Call Summary.
//
// There are no suggestion chips here. They used to come from a built-in vertical profile
// and there is no longer one: what the agent can be asked is the agent's own business,
// and a list of prompts invented by this app would only be a guess about it.
export default function VoicePanel({
  callState,
  duration,
  interim,
  micState,
  onStart,
  onStop,
  onSend,
  onReset,
  onViewHistory,
  acting = false,
  needsAudio = false,
  onUnlockAudio,
  engine,
}) {
  const [draft, setDraft] = useState("");

  const isActive =
    callState === "connecting" ||
    callState === "listening" ||
    callState === "speaking" ||
    callState === "processing";

  const submit = (event) => {
    event.preventDefault();
    onSend(draft);
    setDraft("");
  };

  return (
    <section className={`voice-panel voice-dock state-${callState}`} aria-label="Управление звонком">
      <div className="dock-main">
        <div className={`dock-stage is-${callState}`}>
          <button
            type="button"
            className="voice-orb-button"
            onClick={isActive ? onStop : callState === "ended" ? onReset : onStart}
            disabled={!isActive && !engine?.ok}
            aria-label={
              isActive
                ? "Завершить разговор"
                : callState === "ended"
                  ? "Начать новый разговор"
                  : "Начать разговор"
            }
          >
            <CallVisualizer
              state={visualForCallState(callState)}
              orbIcon="microphone"
              orbLabel={CALL_STATE_TEXT[callState]}
              statusLabel={CALL_STATE_TEXT[callState]}
              size="xl"
            />
          </button>
        </div>

        {isActive && <AiActivity state={visualForCallState(callState)} acting={acting} />}

        <div className="dock-meta">
          {isActive ? (
            <>
              <div className="timer">{formatTime(duration)}</div>
              <div className="live-caption" aria-live="polite">
                {interim ? `«${interim}»` : " "}
              </div>
            </>
          ) : (
            <div className="dock-hint">
              {engine?.ok ? "Говорите или введите текст ниже" : "Сначала настройте подключение к FALX"}
            </div>
          )}
        </div>

        <div className="dock-actions">
          {isActive ? (
            <button type="button" className="stop-button" onClick={onStop}>
              <span className="stop-square" />
              Нажмите, чтобы завершить
            </button>
          ) : (
            <button
              type="button"
              className="start-button"
              onClick={callState === "ended" ? onReset : onStart}
              disabled={!engine?.ok}
            >
              <Icon name="microphone" size={18} />
              {callState === "ended" ? "Начать новый разговор" : "Начать разговор"}
            </button>
          )}

          {/* A browser will not autoplay the agent's voice until the page has been
              touched. This is that touch, and it is the only way to unlock it. */}
          {needsAudio && onUnlockAudio && (
            <button type="button" className="start-button" onClick={onUnlockAudio}>
              <Icon name="speaker" size={18} />
              Включить звук
            </button>
          )}

          {!isActive && onViewHistory && (
            <button type="button" className="history-button" onClick={onViewHistory}>
              <Icon name="clock" size={18} />
              История звонков
            </button>
          )}
        </div>
      </div>

      {micState === "blocked" && (
        <p className="voice-notice">
          Доступ к микрофону заблокирован. Разрешите его в настройках браузера или введите текст ниже.
        </p>
      )}

      {!engine?.ok && engine?.note && <p className="voice-notice">{engine.note}</p>}

      <form className="type-row" onSubmit={submit}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={isActive ? "Или введите ответ..." : "Введите сообщение, чтобы начать звонок..."}
          disabled={callState === "ended"}
          aria-label="Введите сообщение"
        />
        <button type="submit" disabled={!draft.trim() || callState === "ended"}>
          Отправить
        </button>
      </form>

    </section>
  );
}
