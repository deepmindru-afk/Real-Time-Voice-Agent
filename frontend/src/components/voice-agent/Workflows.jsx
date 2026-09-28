import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import ScrollReveal from "./ScrollReveal";
import { fetchAgents } from "../../runtime/agents.js";
import { fetchContacts } from "../../runtime/contacts.js";
import {
  checkWorkflowEligibility,
  createWorkflow,
  deleteWorkflow,
  fetchWorkflows,
  triggerWorkflow,
  updateWorkflow,
} from "../../runtime/workflows.js";

// The server stores these codes; the operator reads them in Russian.
const STATUS_OPTIONS = ["draft", "active", "paused", "archived"];
const STATUS_LABEL = { draft: "черновик", active: "активен", paused: "приостановлен", archived: "в архиве" };
const STATUS_TONE = { active: "ok", draft: "info", paused: "warn", archived: "warn" };

// The engine's only supported trigger (app/workflows/triggers.py's TRIGGERS dict has exactly one
// entry: "date_offset"). Any other trigger_type is refused by evaluate_trigger() as
// UNSUPPORTED_TRIGGER_TYPE - not just for the scheduler, but for the manual "Run now" button too
// (both call the same evaluate_workflow()), so a workflow saved with one could never actually run
// either way. The form only ever offers what can really work.
const TRIGGER_TYPES = [{ id: "date_offset", label: "Смещение по дате (дата в карточке контакта + N дней)" }];

const PROFILES_FOR_FORM = [
  { id: "underwriting", name: "Анкетирование и лизинг" },
  { id: "bank", name: "Банковское обслуживание" },
  { id: "insurance", name: "Страховая служба" },
  { id: "telecom", name: "Поддержка связи" },
  { id: "admissions", name: "Приёмная комиссия" },
];

// One form, reused for "add a workflow" (initial is null) and "edit this one". The two JSON
// blobs the engine reads - trigger_config (when it fires) and action_config (what it does) - are
// edited as plain fields, assembled back into the model's own object shapes. conditions stays
// [] (the engine stops on any condition as unsupported) and retry_policy stays {}.
function WorkflowForm({ agents, initial, profiles, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    agentId: initial?.agent_id != null ? String(initial.agent_id) : agents[0]?.id != null ? String(agents[0].id) : "",
    status: initial?.status ?? "draft",
    triggerType: initial?.trigger_type ?? "date_offset",
    referenceField: initial?.trigger_config?.reference_field ?? "appointment_date",
    offsetDays: initial?.trigger_config?.offset_days != null ? String(initial.trigger_config.offset_days) : "-1",
    time: initial?.trigger_config?.time ?? "10:00",
    timezone: initial?.trigger_config?.timezone ?? "Europe/Moscow",
    profileId: initial?.action_config?.profile_id ?? profiles[0]?.id ?? "bank",
    reason: initial?.action_config?.reason ?? "",
    channel: initial?.action_config?.channel ?? "phone",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    if (!form.agentId) {
      setError("Нужен агент. Сначала создайте его в настройке агента.");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      agent_id: Number(form.agentId),
      status: form.status,
      trigger_type: form.triggerType,
      trigger_config:
        form.triggerType === "date_offset"
          ? {
              reference_field: form.referenceField.trim(),
              offset_days: Number(form.offsetDays),
              time: form.time.trim(),
              timezone: form.timezone.trim(),
            }
          : {},
      conditions: [],
      action_config: {
        profile_id: form.profileId,
        reason: form.reason.trim(),
        channel: form.channel,
      },
      retry_policy: {},
    };

    try {
      const saved = initial ? await updateWorkflow(initial.id, payload) : await createWorkflow(payload);
      onSaved(saved);
    } catch (failure) {
      // The form (and whatever the operator typed) stays exactly as it was.
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="history-form" onSubmit={submit}>
      <label htmlFor="wf-name">Название</label>
      <input id="wf-name" value={form.name} onChange={set("name")} maxLength={120} required />

      <label htmlFor="wf-agent">Агент</label>
      <select id="wf-agent" value={form.agentId} onChange={set("agentId")} required>
        <option value="" disabled>
          {agents.length === 0 ? "Агентов пока нет — создайте агента" : "Выберите агента"}
        </option>
        {agents.map((agent) => (
          <option key={agent.id} value={String(agent.id)}>
            {agent.name}
          </option>
        ))}
      </select>

      <label htmlFor="wf-status">Статус</label>
      <select id="wf-status" value={form.status} onChange={set("status")}>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status] ?? status}
          </option>
        ))}
      </select>

      <label htmlFor="wf-trigger-type">Событие запуска</label>
      <select id="wf-trigger-type" value={form.triggerType} onChange={set("triggerType")}>
        {TRIGGER_TYPES.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>

      {form.triggerType === "date_offset" && (
        <div className="history-form-buttons">
          <input
            aria-label="Поле даты в карточке контакта"
            placeholder="Поле метаданных, напр. appointment_date"
            value={form.referenceField}
            onChange={set("referenceField")}
          />
          <input
            aria-label="Смещение в днях"
            type="number"
            placeholder="-1"
            value={form.offsetDays}
            onChange={set("offsetDays")}
          />
          <input aria-label="Время суток" placeholder="10:00" value={form.time} onChange={set("time")} />
          <input
            aria-label="Часовой пояс"
            placeholder="Europe/Moscow"
            value={form.timezone}
            onChange={set("timezone")}
          />
        </div>
      )}

      <label htmlFor="wf-profile">Профиль, который использует звонок</label>
      <select id="wf-profile" value={form.profileId} onChange={set("profileId")}>
        {PROFILES_FOR_FORM.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>

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
        <option value="phone">Телефонный звонок (звонит на их номер)</option>
        <option value="web">Ссылка в браузере (человек открывает её и отвечает)</option>
      </select>

      {error && (
        <p className="voice-notice" role="alert">
          {error}
        </p>
      )}

      <div className="history-form-buttons">
        <button type="button" onClick={onCancel} disabled={saving}>
          Отмена
        </button>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Сохраняем…" : initial ? "Сохранить изменения" : "Добавить сценарий"}
        </button>
      </div>
    </form>
  );
}

// Step 18E: what this workflow would do for one contact right now (eligibility) and the one-
// click run that reuses WorkflowEngine.run_for_contact - the exact judgment the scheduler makes.
function EligibilityPanel({ contacts, workflows }) {
  // What the operator picked, if anything. The lists load after this panel first mounts, so the
  // effective selection falls back to the first entry each time instead of being frozen at ""
  // from the empty first render (which left both buttons permanently disabled).
  const [picked, setPicked] = useState({ workflow: "", contact: "" });
  const stillThere = (list, id) => list.some((item) => String(item.id) === id);
  const workflowId = stillThere(workflows, picked.workflow) ? picked.workflow : workflows[0] ? String(workflows[0].id) : "";
  const contactId = stillThere(contacts, picked.contact) ? picked.contact : contacts[0] ? String(contacts[0].id) : "";
  const setWorkflowId = (value) => setPicked((current) => ({ ...current, workflow: value }));
  const setContactId = (value) => setPicked((current) => ({ ...current, contact: value }));
  const [evaluation, setEvaluation] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const ready = workflowId !== "" && contactId !== "";

  const run = async (kind) => {
    setBusy(true);
    setError(null);
    setEvaluation(null);
    setOutcome(null);

    try {
      if (kind === "eligibility") {
        setEvaluation(await checkWorkflowEligibility(Number(workflowId), Number(contactId)));
      } else {
        setOutcome(await triggerWorkflow(Number(workflowId), Number(contactId)));
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  if (workflows.length === 0 || contacts.length === 0) {
    return (
      <div className="state-block">
        {workflows.length === 0
          ? "Добавьте сценарий, чтобы проверить допуск и запустить его вручную."
          : "Добавьте контакт, чтобы проверить допуск и запустить на нём сценарий."}
      </div>
    );
  }

  return (
    <div className="history-form">
      <label htmlFor="ep-workflow">Сценарий</label>
      <select id="ep-workflow" value={workflowId} onChange={(event) => setWorkflowId(event.target.value)}>
        {workflows.map((workflow) => (
          <option key={workflow.id} value={String(workflow.id)}>
            {workflow.name}
          </option>
        ))}
      </select>

      <label htmlFor="ep-contact">Контакт</label>
      <select id="ep-contact" value={contactId} onChange={(event) => setContactId(event.target.value)}>
        {contacts.map((contact) => (
          <option key={contact.id} value={String(contact.id)}>
            {contact.name}
          </option>
        ))}
      </select>

      <div className="history-form-buttons">
        <button type="button" onClick={() => run("eligibility")} disabled={busy || !ready}>
          {busy ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              Выполняем…
            </>
          ) : (
            "Проверить допуск"
          )}
        </button>
        <button type="button" className="primary" onClick={() => run("trigger")} disabled={busy || !ready}>
          {busy ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              Working…
            </>
          ) : (
            "Запустить"
          )}
        </button>
      </div>

      {error && (
        <p className="voice-notice" role="alert">
          {error}
        </p>
      )}

      {evaluation && (
        <div className={`eligibility-result ${evaluation.eligible ? "" : "is-blocked"}`} role="status">
          <div className="er-head">{evaluation.eligible ? "Допуск есть" : "Допуска нет"}</div>
          <p className="er-copy">
            {evaluation.reason}
            {evaluation.detail ? ` — ${evaluation.detail}` : ""}.
          </p>
        </div>
      )}

      {outcome && (
        <div className={`eligibility-result ${outcome.call_job_created ? "" : "is-blocked"}`} role="status">
          <div className="er-head">{outcome.call_job_created ? "Звонок зафиксирован" : "Звонок не создан"}</div>
          <p className="er-copy">
            {outcome.call_job_created
              ? `Задача ${outcome.job_id} создана (зафиксирована, но ещё не набрана).`
              : `${outcome.reason}${outcome.detail ? ` — ${outcome.detail}` : ""}.`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Workflows({ serverAvailable }) {
  const [workflows, setWorkflows] = useState([]);
  const [agents, setAgents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null while adding a new workflow
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      const [workflowList, agentList, contactList] = await Promise.all([
        fetchWorkflows(),
        fetchAgents(),
        fetchContacts().catch(() => []), // no organization: the panel just shows its own hint
      ]);
      setWorkflows(workflowList);
      setAgents(agentList);
      setContacts(contactList);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Nothing to load: the render below shows the offline message instead of ever consulting
    // `loading`, regardless of its value.
    if (!serverAvailable) return undefined;

    // Deferred, same as CallHistory's own load effect: load() sets state synchronously at its
    // own start, which must not happen directly inside the effect body.
    const timer = setTimeout(load, 0);

    return () => clearTimeout(timer);
  }, [serverAvailable, load]);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (workflow) => {
    setEditingId(workflow.id);
    setFormOpen(true);
  };

  const saved = (workflow) => {
    setWorkflows((list) =>
      list.some((w) => w.id === workflow.id) ? list.map((w) => (w.id === workflow.id ? workflow : w)) : [...list, workflow]
    );
    setFormOpen(false);
  };

  const remove = async (workflowId) => {
    if (!window.confirm("Удалить этот сценарий? Это действие необратимо.")) return;

    setDeletingId(workflowId);
    setError(null);

    try {
      await deleteWorkflow(workflowId);
      setWorkflows((list) => list.filter((w) => w.id !== workflowId));
    } catch (failure) {
      // A workflow with call jobs cannot be deleted (409); the list is left exactly as it was.
      setError(failure.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!serverAvailable) {
    return (
      <section className="history-page">
        <h2>Сценарии</h2>
        <p className="callee-note">
          Сценарии хранятся на сервере. Запустите бэкенд (и войдите), чтобы ими управлять.
        </p>
      </section>
    );
  }

  const editingWorkflow = editingId ? workflows.find((w) => w.id === editingId) ?? null : null;

  return (
    <section className="history-page">
      <div className="history-head">
        <div>
          <h2>Сценарии</h2>
          <p className="page-sub">Автоматизируйте, когда и как действует ваш ИИ-агент.</p>
        </div>
        <div className="history-form-buttons">
          <button onClick={load}>Обновить</button>
          <button className="primary" onClick={() => (formOpen ? setFormOpen(false) : openCreate())}>
            {formOpen ? "Закрыть" : "Добавить сценарий"}
          </button>
        </div>
      </div>

      <div className="workflow-path" aria-label="Как выполняется сценарий">
        <span>Событие</span>
        <i />
        <span>Агент</span>
        <i />
        <span>Разговор</span>
        <i />
        <span>Действие</span>
      </div>

      {error && (
        <p className="voice-notice" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <WorkflowForm
          key={editingId ?? "new"}
          agents={agents}
          profiles={PROFILES_FOR_FORM}
          initial={editingWorkflow}
          onSaved={saved}
          onCancel={() => setFormOpen(false)}
        />
      )}

      <h3>Настроенные сценарии</h3>
      {loading ? (
        <div className="state-block is-loading">Загружаем сценарии...</div>
      ) : workflows.length === 0 ? (
        <div className="state-block">Сценариев пока нет.</div>
      ) : (
        <ScrollReveal>
          <ul className="workflow-list" aria-label="Настроенные сценарии">
            {workflows.map((workflow) => {
              const agent = agents.find((a) => a.id === workflow.agent_id);
              const trigger =
                workflow.trigger_type === "date_offset"
                  ? `через ${workflow.trigger_config?.offset_days ?? "?"} дн. от ${workflow.trigger_config?.reference_field ?? "?"} в ${workflow.trigger_config?.time ?? "?"}`
                  : workflow.trigger_type;
              const nodes = [
                ["Событие", trigger],
                ["ИИ-агент", agent ? agent.name : `агент #${workflow.agent_id}`],
                ["Разговор", `${workflow.action_config?.profile_id ?? "?"} · ${workflow.action_config?.channel ?? "?"}`],
                ["Действие", workflow.action_config?.reason ?? "—"],
              ];

              return (
                <li key={workflow.id} className={`workflow-card is-${workflow.status}`}>
                  <div className="wf-head">
                    <h4>{workflow.name}</h4>
                    <StatusBadge tone={STATUS_TONE[workflow.status] ?? "info"}>{STATUS_LABEL[workflow.status] ?? workflow.status}</StatusBadge>
                    <span className="wf-actions">
                      <button className="history-open" onClick={() => openEdit(workflow)}>
                        Изменить
                      </button>
                      <button
                        className="history-open"
                        onClick={() => remove(workflow.id)}
                        disabled={deletingId === workflow.id}
                      >
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

      <h3>Запуск сценария на контакте</h3>
      <EligibilityPanel contacts={contacts} workflows={workflows} />
    </section>
  );
}