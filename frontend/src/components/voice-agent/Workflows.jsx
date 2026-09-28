import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import ScrollReveal from "./ScrollReveal";
import { readContacts } from "../../runtime/contacts.js";
import {
  REFERENCE_FIELDS,
  STATUS_LABEL,
  STATUS_OPTIONS,
  STATUS_TONE,
  TRIGGER_TYPES,
  createWorkflow,
  deleteWorkflow,
  evaluateWorkflow,
  readWorkflows,
  runWorkflow,
  updateWorkflow,
} from "../../runtime/workflows.js";

// One form, reused for "add a workflow" (initial is null) and "edit this one". The two
// blobs the trigger reads - when it fires and what it does - are edited as plain fields
// and assembled back into the record's own shape. Nothing here is stored that this app
// could not later evaluate.
function WorkflowForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    status: initial?.status ?? "draft",
    referenceField: initial?.trigger_config?.reference_field ?? "appointment_date",
    offsetDays: String(initial?.trigger_config?.offset_days ?? -1),
    time: initial?.trigger_config?.time ?? "10:00",
    timezone: initial?.trigger_config?.timezone ?? "Europe/Moscow",
    reason: initial?.action_config?.reason ?? "",
    channel: initial?.action_config?.channel ?? "web",
    roomName: initial?.action_config?.room_name ?? "",
  }));
  const [error, setError] = useState(null);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = (event) => {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Укажите название сценария.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      status: form.status,
      trigger_type: "date_offset",
      trigger_config: {
        reference_field: form.referenceField,
        offset_days: Number(form.offsetDays),
        time: form.time.trim(),
        timezone: form.timezone.trim(),
      },
      action_config: {
        reason: form.reason.trim(),
        channel: form.channel,
        room_name: form.roomName.trim(),
      },
    };

    try {
      onSaved(initial ? updateWorkflow(initial.id, payload) : createWorkflow(payload));
    } catch (failure) {
      // The form (and whatever was typed) stays exactly as it was.
      setError(failure.message ?? "Не удалось сохранить сценарий.");
    }
  };

  return (
    <form className="history-form" onSubmit={submit} noValidate>
      <label htmlFor="wf-name">Название</label>
      <input id="wf-name" value={form.name} onChange={set("name")} maxLength={120} required />

      <label htmlFor="wf-status">Статус</label>
      <select id="wf-status" value={form.status} onChange={set("status")}>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status] ?? status}
          </option>
        ))}
      </select>

      <label htmlFor="wf-trigger-type">Событие запуска</label>
      <select id="wf-trigger-type" value="date_offset" disabled>
        {TRIGGER_TYPES.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>

      <div className="history-form-buttons">
        <label className="field-inline" htmlFor="wf-field">
          Поле с датой
          <select id="wf-field" value={form.referenceField} onChange={set("referenceField")}>
            {REFERENCE_FIELDS.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline" htmlFor="wf-offset">
          Смещение, дней
          <input id="wf-offset" type="number" value={form.offsetDays} onChange={set("offsetDays")} />
        </label>
        <label className="field-inline" htmlFor="wf-time">
          Время
          <input id="wf-time" value={form.time} onChange={set("time")} placeholder="10:00" />
        </label>
        <label className="field-inline" htmlFor="wf-zone">
          Часовой пояс
          <input id="wf-zone" value={form.timezone} onChange={set("timezone")} placeholder="Europe/Moscow" />
        </label>
      </div>

      <label htmlFor="wf-reason">Зачем совершается звонок (проговаривается клиенту)</label>
      <input
        id="wf-reason"
        value={form.reason}
        onChange={set("reason")}
        maxLength={200}
        placeholder="напоминание о приёме завтра"
        required
      />

      <label htmlFor="wf-channel">Как выполняется звонок</label>
      <select id="wf-channel" value={form.channel} onChange={set("channel")}>
        <option value="web">Ссылка в браузере (человек открывает её и отвечает)</option>
        <option value="phone">Телефонный звонок (требует телефонии на вашей стороне)</option>
      </select>

      <label htmlFor="wf-room">Имя комнаты (необязательно)</label>
      <input
        id="wf-room"
        value={form.roomName}
        onChange={set("roomName")}
        maxLength={120}
        placeholder="Если пусто, комнату выберет сервис токенов"
      />

      {error && (
        <p className="voice-notice" role="alert">
          {error}
        </p>
      )}

      <div className="history-form-buttons">
        <button type="button" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="primary">
          {initial ? "Сохранить изменения" : "Добавить сценарий"}
        </button>
      </div>
    </form>
  );
}

// What this workflow would do for one contact right now, and the one-click run. Both are
// decided here, in the browser, by the same evaluation - there is no scheduler behind it,
// and the panel does not pretend there is.
function EligibilityPanel({ contacts, workflows, onRun }) {
  const [picked, setPicked] = useState({ workflow: "", contact: "" });
  const stillThere = (list, id) => list.some((item) => String(item.id) === id);
  const workflowId = stillThere(workflows, picked.workflow) ? picked.workflow : workflows[0] ? String(workflows[0].id) : "";
  const contactId = stillThere(contacts, picked.contact) ? picked.contact : contacts[0] ? String(contacts[0].id) : "";
  const [outcome, setOutcome] = useState(null);

  const workflow = workflows.find((row) => String(row.id) === workflowId) ?? null;
  const contact = contacts.find((row) => String(row.id) === contactId) ?? null;
  const check = workflow && contact ? evaluateWorkflow(workflow, contact) : null;
  const ready = Boolean(workflow && contact);

  if (workflows.length === 0 || contacts.length === 0) {
    return (
      <div className="state-block">
        {workflows.length === 0
          ? "Добавьте сценарий, чтобы проверить его на контакте."
          : "Добавьте контакт, чтобы проверить сценарий на нём."}
      </div>
    );
  }

  const run = () => {
    const result = runWorkflow(workflow, contact);

    setOutcome(result);
    onRun?.();
  };

  return (
    <div className="history-form">
      <label htmlFor="ep-workflow">Сценарий</label>
      <select id="ep-workflow" value={workflowId} onChange={(event) => setPicked((c) => ({ ...c, workflow: event.target.value }))}>
        {workflows.map((row) => (
          <option key={row.id} value={String(row.id)}>
            {row.name}
          </option>
        ))}
      </select>

      <label htmlFor="ep-contact">Контакт</label>
      <select id="ep-contact" value={contactId} onChange={(event) => setPicked((c) => ({ ...c, contact: event.target.value }))}>
        {contacts.map((row) => (
          <option key={row.id} value={String(row.id)}>
            {row.name}
          </option>
        ))}
      </select>

      {check && (
        <div className={`eligibility-result ${check.eligible ? "" : "is-blocked"}`} role="status">
          <div className="er-head">{check.eligible ? "Допуск есть" : "Допуска нет"}</div>
          <p className="er-copy">
            {check.reason}
            {check.detail ? ` — ${check.detail}` : ""}.
          </p>
        </div>
      )}

      {outcome && (
        <div className={`eligibility-result ${outcome.call_created ? "" : "is-blocked"}`} role="status">
          <div className="er-head">{outcome.call_created ? "Задача создана" : "Задача не создана"}</div>
          <p className="er-copy">
            {outcome.call_created
              ? `Звонок ${outcome.job_id} поставлен в очередь. Никто ещё не позвонил — начните разговор на главной.`
              : `${outcome.reason}${outcome.detail ? ` — ${outcome.detail}` : ""}.`}
          </p>
        </div>
      )}

      <div className="history-form-buttons">
        <button type="button" className="primary" onClick={run} disabled={!ready || !check?.eligible}>
          Поставить звонок в очередь
        </button>
      </div>
    </div>
  );
}

export default function Workflows() {
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(() => {
    setError(null);

    try {
      setRows(readWorkflows());
      setContacts(readContacts());
    } catch (failure) {
      setError(failure.message ?? "Не удалось прочитать сценарии.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const saved = (workflow) => {
    if (!workflow) return;

    setRows((list) => (list.some((row) => row.id === workflow.id) ? list.map((row) => (row.id === workflow.id ? workflow : row)) : [...list, workflow]));
    setFormOpen(false);
  };

  const remove = (workflowId) => {
    if (!window.confirm("Удалить этот сценарий? Это действие необратимо.")) return;

    setDeletingId(workflowId);

    try {
      deleteWorkflow(workflowId);
      setRows((list) => list.filter((row) => row.id !== workflowId));
    } catch (failure) {
      setError(failure.message ?? "Не удалось удалить сценарий.");
    } finally {
      setDeletingId(null);
    }
  };

  const editingWorkflow = editingId ? rows.find((row) => row.id === editingId) ?? null : null;

  return (
    <section className="history-page">
      <div className="history-head">
        <div>
          <h2>Сценарии</h2>
          <p className="page-sub">Когда пора звонить клиенту и зачем.</p>
        </div>
        <div className="history-form-buttons">
          <button onClick={load}>Обновить</button>
          <button className="primary" onClick={() => (formOpen ? setFormOpen(false) : openCreate())}>
            {formOpen ? "Закрыть" : "Добавить сценарий"}
          </button>
        </div>
      </div>

      <p className="callee-note">
        Сценарии хранятся и вычисляются в этом браузере. Ничего не выполняется по расписанию: проверка
        запускается здесь и сейчас, а «в очередь» лишь записывает задачу в историю — начать разговор нужно
        вручную на главной.
      </p>

      <div className="workflow-path" aria-label="Как выполняется сценарий">
        <span>Событие</span>
        <i />
        <span>Проверка</span>
        <i />
        <span>Задача</span>
        <i />
        <span>Разговор</span>
      </div>

      {error && (
        <p className="voice-notice" role="alert">
          {error}
        </p>
      )}

      {formOpen && <WorkflowForm key={editingId ?? "new"} initial={editingWorkflow} onSaved={saved} onCancel={() => setFormOpen(false)} />}

      <h3>Настроенные сценарии</h3>
      {rows.length === 0 ? (
        <div className="state-block">Сценариев пока нет.</div>
      ) : (
        <ScrollReveal>
          <ul className="workflow-list" aria-label="Настроенные сценарии">
            {rows.map((workflow) => {
              const field = REFERENCE_FIELDS.find((item) => item.id === workflow.trigger_config.reference_field);

              const nodes = [
                ["Событие", `за ${workflow.trigger_config.offset_days} дн. до «${field?.label ?? workflow.trigger_config.reference_field}», в ${workflow.trigger_config.time}`],
                ["Канал", workflow.action_config.channel === "phone" ? "телефон" : "ссылка в браузере"],
                ["Комната", workflow.action_config.room_name || "выберет сервис токенов"],
                ["Цель", workflow.action_config.reason || "—"],
              ];

              return (
                <li key={workflow.id} className={`workflow-card is-${workflow.status}`}>
                  <div className="wf-head">
                    <h4>{workflow.name}</h4>
                    <StatusBadge tone={STATUS_TONE[workflow.status] ?? "info"}>{STATUS_LABEL[workflow.status] ?? workflow.status}</StatusBadge>
                    <span className="wf-actions">
                      <button className="history-open" onClick={() => (setEditingId(workflow.id), setFormOpen(true))}>
                        Изменить
                      </button>
                      <button className="history-open" onClick={() => remove(workflow.id)} disabled={deletingId === workflow.id}>
                        {deletingId === workflow.id ? "Удаляем…" : "Удалить"}
                      </button>
                    </span>
                  </div>
                  <ol className="wf-nodes">
                    {nodes.map(([kind, detail]) => (
                      <li key={kind} className="wf-node" tabIndex={0}>
                        <span className="wf-kind">{kind}</span>
                        <span className="wf-detail">{detail}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>
        </ScrollReveal>
      )}

      <h3>Проверить сценарий на контакте</h3>
      <EligibilityPanel contacts={contacts} workflows={rows} />
    </section>
  );
}
