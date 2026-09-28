import { useEffect, useRef, useState } from "react";
import { formatTime } from "../runtime/format.js";
import "./liveAgent.css";

// The agent, in the corner of the page: what it is doing, what it said, and the two controls
// that matter to someone who wandered into this page rather than into a call - stop hearing me,
// and stop the call.
//
// It is a pill until there is something to read, and a transcript after that. The page is still
// the page: the panel is in a corner, it never moves anything, and it goes away by itself once
// the call is over.
export default function LiveAgentPanel({ agent }) {
  const { live, duration, messages, interim, micState, needsAudio, callError, status } = agent;

  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false); // the visitor has an opinion about the panel now
  const threadRef = useRef(null);

  // The point of a live agent on this page is hearing it answer, so the transcript opens itself
  // the first time there is one - and never again, once the visitor has closed or opened it. That
  // is a value derived from what has already happened, not something to arrange in an effect.
  const expanded = open || (!touched && messages.length > 0);

  useEffect(() => {
    const thread = threadRef.current;

    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages.length, interim, expanded]);

  const fold = (next) => {
    setTouched(true);
    setOpen(next);
  };

  // Nothing to say: no call, and no failure to explain. The page is the page again.
  if (!live && !callError) return null;

  const showThread = expanded && (messages.length > 0 || interim);

  return (
    <aside className={`lp-live is-${status.tone} ${expanded ? "is-open" : ""}`} aria-label="Голосовой агент на этой странице">
      <button
        type="button"
        className="lp-live-summary"
        onClick={() => fold(!expanded)}
        aria-expanded={expanded}
        aria-controls="lp-live-thread"
      >
        <span className="lp-live-dot" aria-hidden="true" />
        <span className="lp-live-label">{status.label}</span>
        {live && <span className="lp-live-clock">{formatTime(duration)}</span>}
        <i className="lp-live-chevron" aria-hidden="true" />
      </button>

      {showThread && (
        <div className="lp-live-thread" id="lp-live-thread" ref={threadRef}>
          {messages.map((message) => (
            <p key={message.id} className={`lp-live-say is-${message.speaker === "Agent" ? "agent" : "you"}`}>
              <b>{message.speaker === "Agent" ? "Агент" : "Вы"}</b>
              <span>{message.text}</span>
            </p>
          ))}

          {interim && (
            <p className="lp-live-say is-you is-interim">
              <b>Вы</b>
              <span>{interim}</span>
            </p>
          )}
        </div>
      )}

      <div className="lp-live-actions">
        {needsAudio && (
          <button type="button" className="lp-live-audio" onClick={agent.unlockAudio}>
            Включить звук
          </button>
        )}

        {callError && (
          <button type="button" className="lp-live-retry" onClick={agent.toggle}>
            Попробовать снова
          </button>
        )}

        {live && (
          <>
            <button
              type="button"
              className={`lp-live-mic ${micState === "on" ? "is-on" : ""}`}
              onClick={agent.toggleMic}
              aria-pressed={micState === "on"}
            >
              {micState === "on" ? "Микрофон включён" : "Микрофон выключен"}
            </button>

            <button type="button" className="lp-live-end" onClick={agent.stop}>
              Завершить
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
