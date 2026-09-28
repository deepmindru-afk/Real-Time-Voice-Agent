import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import ScrollReveal from "./ScrollReveal";
import CallSummary from "./CallSummary";
import { buildCallRecord } from "../../runtime/callRecord.js";
import { clearHistory, deleteCall, historyCounts, readHistory } from "../../runtime/history.js";
import { formatDateTime, formatTime } from "../../runtime/format.js";
import { label } from "../../runtime/results.js";

const CHANNEL = { web: "ссылка в браузере", phone: "телефон" };

const when = (stamp) => (stamp ? formatDateTime(stamp) : "—");

// This history is this browser's. Every entry was written by a call that ran in this tab,
// so the whole list is a local record rather than a query, and clearing it is permanent.
// The screen says so, because a list of calls that looks server-backed but is not would
// be the most misleading thing on it.
export default function CallHistory({ onOpenCall }) {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => setRows(readHistory()), []);

  useEffect(() => {
    // Deferred rather than synchronous in the effect body, matching the other screens.
    const timer = setTimeout(load, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const counts = historyCounts(rows);

  if (detail) {
    return (
      <section className="history-page">
        <button className="history-back" onClick={() => setDetail(null)}>
          ← Назад к истории
        </button>

        <CallSummary
          record={buildCallRecord({
            config: null,
            callState: "ended",
            summary: detail,
            duration: detail.durationSeconds,
            startedAt: detail.startedAt,
            contact: detail.contact ?? "Клиент",
          })}
          configured
          view="summary"
          onViewChange={() => {}}
          onConfigure={() => {}}
        />

        <div className="history-form-buttons">
          <button type="button" onClick={() => setDetail(null)}>
            К списку звонков
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="history-page">
      <div className="history-head">
        <div>
          <h2>История звонков</h2>
          <p className="page-sub">Каждый разговор с агентом, проведённый в этом браузере.</p>
        </div>
        <div className="history-form-buttons">
          <button onClick={load}>Обновить</button>
          {rows.length > 0 && (
            <button onClick={() => window.confirm("Очистить всю историю звонков? Это необратимо.") && (clearHistory(), load(), setDetail(null))}>
              Очистить
            </button>
          )}
          <button className="primary" onClick={onOpenCall}>
            К разговору
          </button>
        </div>
      </div>

      <p className="callee-note">
        История хранится только в этом браузере: {counts.total} звонков, из них завершённых —{" "}
        {counts.completed}. Она не общая для других операторов и исчезнет при очистке данных сайта.
      </p>

      {rows.length === 0 ? (
        <div className="state-block">Звонков пока нет. Начните разговор на главной.</div>
      ) : (
        <ScrollReveal>
          <ul className="call-list" aria-label="Звонки">
            {rows.map((row) => (
              <li key={row.id} className="call-card">
                <div className="cc-head">
                  <span className="cc-who">{row.contact ?? "Клиент"}</span>
                  <StatusBadge tone={row.status === "completed" ? "ok" : row.status === "queued" ? "info" : "warn"}>
                    {row.status === "queued" ? "В очереди" : label(row.status)}
                  </StatusBadge>
                  {row.status !== "queued" && (
                    <button className="history-open cc-open" onClick={() => setDetail(row)}>
                      Открыть
                    </button>
                  )}
                </div>

                <div className="cc-reason">{row.reason ?? row.summary ?? row.workflow ?? "—"}</div>

                <div className="cc-meta">
                  <span>{when(row.createdAt ?? row.startedAt)}</span>
                  <span>{CHANNEL[row.channel] ?? row.channel ?? "—"}</span>
                  {row.agent && <span>{row.agent}</span>}
                  {row.room && <span>комната: {row.room}</span>}
                  {typeof row.durationSeconds === "number" && <span>{formatTime(row.durationSeconds)}</span>}
                  <button className="cc-link" onClick={() => (deleteCall(row.id), load(), setDetail(null))}>
                    удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      )}
    </section>
  );
}
