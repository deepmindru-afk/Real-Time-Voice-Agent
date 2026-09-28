import { useEffect, useRef } from "react";
import RealtimeSignal from "../voice/RealtimeSignal";

const TOOL_TAG = "подтверждённое действие";

function ToolCall({ call }) {
  const args = Object.entries(call.args ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return (
    <details className={`tool-call ${call.guarded ? "tool-call-guarded" : ""}`}>
      <summary>
        <code>{call.name}</code>
        {args && <span className="tool-args">({args})</span>}
        {call.guarded && <span className="tool-tag">{TOOL_TAG}</span>}
      </summary>

      <pre>{JSON.stringify(call.result, null, 2)}</pre>
    </details>
  );
}

export default function AgentResponse({
  messages,
  pending,
  onRespond,
  onClear,
  canClear,
  title = "Ответ агента",
  showTools = true,
  agentName = null,
  status = null,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    // With nothing to show there is nothing to scroll to, and scrollIntoView moves the whole page,
    // which on first load hid the top bar (and with it the profile menu) behind the fold.
    if (messages.length === 0 && !pending) return;

    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  return (
    <section className="response-card">
      <div className="card-header">
        <div>
          <span className="card-icon">▤</span>
          <h3>
            {title} <span>(в реальном времени)</span>
          </h3>
        </div>

        {onClear && (
          <button className="clear-button" onClick={onClear} disabled={!canClear}>
            Очистить
          </button>
        )}
      </div>

      {status && (
        <div className="live-status" role="status">
          <RealtimeSignal tone="accent" className="live-signal" />
          {status}
        </div>
      )}

      <div className="transcript">
        {messages.length === 0 ? (
          <div className="empty-transcript">Здесь появится расшифровка вашего разговора...</div>
        ) : (
          messages.map((message) => (
            <div
              className={`message ${
                message.speaker === "Agent" ? "agent-message" : "user-message"
              } ${message.blocked ? "blocked-message" : ""}`}
              key={message.id}
            >
              <div className="message-top">
                <strong>
                  {message.speaker === "Agent" && agentName ? agentName : message.speaker === "Agent" ? "Агент" : "Вы"}
                  {message.blocked && <em className="message-tag">защита</em>}
                  {message.interrupted && <em className="message-tag">прервано</em>}
                </strong>
                <span>{message.time}</span>
              </div>

              <p>{message.text}</p>

              {showTools && message.toolCalls?.map((call, index) => (
                <ToolCall call={call} key={index} />
              ))}
            </div>
          ))
        )}

        {pending && (
          <div className="confirm-card" role="alertdialog" aria-label="Подтверждение действия">
            <div className="confirm-title">Требуется подтверждение</div>
            <p>Агент хочет {pending.label}.</p>

            <div className="confirm-buttons">
              <button className="confirm-yes" onClick={() => onRespond("Да, подтверждаю")}>
                Да, подтверждаю
              </button>
              <button className="confirm-no" onClick={() => onRespond("Нет, отменить")}>
                Нет, отменить
              </button>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </section>
  );
}
