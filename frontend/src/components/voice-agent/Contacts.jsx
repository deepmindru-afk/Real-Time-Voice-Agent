import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import ScrollReveal from "./ScrollReveal";
import {
  CONSENT_LABEL,
  CONSENT_OPTIONS,
  CONSENT_TONE,
  callPermission,
  createContact,
  deleteContact,
  readContacts,
  updateContact,
} from "../../runtime/contacts.js";
import { REFERENCE_FIELDS } from "../../runtime/workflows.js";

const DATE_FIELDS = REFERENCE_FIELDS;

function ConsentBadge({ status }) {
  return <StatusBadge tone={CONSENT_TONE[status] ?? "info"}>согласие: {CONSENT_LABEL[status] ?? status}</StatusBadge>;
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("") || "?";

// One form, reused for both "add a contact" (initial is null) and "edit this one" (initial
// is the contact being edited). The preferred window is edited as three plain fields and
// assembled back into the {start, end, timezone} shape the permission check reads, so no
// second scheduling format is invented. Leaving all three blank stores null, not an empty
// object, because "any time" and "an empty window" are different answers.
function ContactForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    consentStatus: initial?.consent_status ?? "unknown",
    preferredLanguage: initial?.preferred_language ?? "",
    contactStart: initial?.preferred_contact_time?.start ?? "",
    contactEnd: initial?.preferred_contact_time?.end ?? "",
    contactTimezone: initial?.preferred_contact_time?.timezone ?? "",
    dates: initial?.dates ?? {},
  }));
  const [error, setError] = useState(null);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const setDate = (key) => (event) => setForm({ ...form, dates: { ...form.dates, [key]: event.target.value } });

  const submit = (event) => {
    event.preventDefault();
    setError(null);

    const { contactStart, contactEnd, contactTimezone } = form;
    const preferred_contact_time =
      contactStart.trim() || contactEnd.trim() || contactTimezone.trim()
        ? { start: contactStart.trim(), end: contactEnd.trim(), timezone: contactTimezone.trim() }
        : null;

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      consent_status: form.consentStatus,
      preferred_language: form.preferredLanguage.trim() || null,
      preferred_contact_time,
      dates: form.dates,
    };

    // A name is the one thing the list cannot be read without, so it is the one thing
    // refused here rather than discovered later.
    if (!payload.name) {
      setError("Укажите имя контакта.");
      return;
    }

    try {
      const saved = initial ? updateContact(initial.id, payload) : createContact(payload);

      onSaved(saved);
    } catch (failure) {
      // The form (and whatever was typed) stays exactly as it was: nothing here pretends
      // the save worked.
      setError(failure.message ?? "Не удалось сохранить контакт.");
    }
  };

  return (
    <form className="history-form" onSubmit={submit} noValidate>
      <label htmlFor="contact-name">Имя</label>
      <input id="contact-name" value={form.name} onChange={set("name")} maxLength={120} required />

      <label htmlFor="contact-phone">Телефон</label>
      <input id="contact-phone" value={form.phone} onChange={set("phone")} placeholder="+7 999 123-45-67" maxLength={24} />

      <label htmlFor="contact-email">Электронная почта</label>
      <input id="contact-email" type="email" value={form.email} onChange={set("email")} maxLength={254} />

      <label htmlFor="contact-consent">Согласие на звонки</label>
      <select id="contact-consent" value={form.consentStatus} onChange={set("consentStatus")}>
        {CONSENT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {CONSENT_LABEL[option] ?? option}
          </option>
        ))}
      </select>

      <label htmlFor="contact-language">Предпочтительный язык</label>
      <input
        id="contact-language"
        value={form.preferredLanguage}
        onChange={set("preferredLanguage")}
        placeholder="например, тат"
        maxLength={16}
      />

      <label htmlFor="contact-window">Удобное время связи (необязательно)</label>
      <div className="history-form-buttons">
        <input aria-label="Начало интервала" placeholder="Начало, напр. 10:00" value={form.contactStart} onChange={set("contactStart")} />
        <input aria-label="Конец интервала" placeholder="Конец, напр. 18:00" value={form.contactEnd} onChange={set("contactEnd")} />
        <input aria-label="Часовой пояс" placeholder="Часовой пояс, напр. Europe/Moscow" value={form.contactTimezone} onChange={set("contactTimezone")} />
      </div>

      <h4 className="history-subsection">Даты для сценариев</h4>
      <p className="callee-note">
        Сценарий с событием по дате отсчитывает срок от этих дат. Пустое поле означает, что сценарий по
        этому полю для контакта не сработает.
      </p>
      <div className="history-form-buttons">
        {DATE_FIELDS.map((field) => (
          <label key={field.id} className="field-inline">
            {field.label}
            <input
              type="date"
              aria-label={field.label}
              value={form.dates[field.id] ?? ""}
              onChange={setDate(field.id)}
            />
          </label>
        ))}
      </div>

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
          {initial ? "Сохранить изменения" : "Добавить контакт"}
        </button>
      </div>
    </form>
  );
}

export default function Contacts() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null while adding a new contact
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(() => {
    setError(null);

    try {
      setRows(readContacts());
    } catch (failure) {
      setError(failure.message ?? "Не удалось прочитать контакты.");
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

  const openEdit = (contact) => {
    setEditingId(contact.id);
    setFormOpen(true);
  };

  const saved = (contact) => {
    setRows((list) => (list.some((row) => row.id === contact.id) ? list.map((row) => (row.id === contact.id ? contact : row)) : [...list, contact]));
    setFormOpen(false);
  };

  const remove = (contactId) => {
    if (!window.confirm("Удалить этот контакт? Это действие необратимо.")) return;

    setDeletingId(contactId);
    setError(null);

    try {
      deleteContact(contactId);
      setRows((list) => list.filter((row) => row.id !== contactId));
    } catch (failure) {
      setError(failure.message ?? "Не удалось удалить контакт.");
    } finally {
      setDeletingId(null);
    }
  };

  const editingContact = editingId ? rows.find((row) => row.id === editingId) ?? null : null;

  return (
    <section className="history-page">
      <div className="history-head">
        <div>
          <h2>Контакты</h2>
          <p className="page-sub">С кем могут говорить ваши агенты.</p>
        </div>
        <div className="history-form-buttons">
          <button onClick={load}>Обновить</button>
          <button className="primary" onClick={() => (formOpen ? setFormOpen(false) : openCreate())}>
            {formOpen ? "Закрыть" : "Добавить контакт"}
          </button>
        </div>
      </div>

      <p className="callee-note">Контакты хранятся только в этом браузере и не видны другим операторам.</p>

      {error && (
        <p className="voice-notice" role="alert">
          {error}
        </p>
      )}

      {formOpen && <ContactForm key={editingId ?? "new"} initial={editingContact} onSaved={saved} onCancel={() => setFormOpen(false)} />}

      {rows.length === 0 ? (
        <div className="state-block">Контактов пока нет.</div>
      ) : (
        <ScrollReveal>
          <ul className="contact-grid" aria-label="Контакты">
            {rows.map((contact) => {
              const permission = callPermission(contact);

              return (
                <li key={contact.id} className="contact-card">
                  <span className="contact-avatar" aria-hidden="true">
                    {initials(contact.name)}
                  </span>
                  <div className="contact-main">
                    <div className="contact-name">{contact.name}</div>
                    <div className="contact-line">{contact.phone ?? <span className="muted">нет телефона</span>}</div>
                    <div className="contact-line">{contact.email ?? <span className="muted">нет почты</span>}</div>
                    <div className="contact-tags">
                      <ConsentBadge status={contact.consent_status} />
                      <StatusBadge tone={permission.allowed ? "ok" : "warn"}>
                        {permission.allowed ? "звонить можно" : permission.reason}
                      </StatusBadge>
                      {contact.preferred_language && <span className="muted">{contact.preferred_language}</span>}
                    </div>
                  </div>
                  <div className="contact-actions">
                    <button className="history-open" onClick={() => openEdit(contact)}>
                      Изменить
                    </button>
                    <button className="history-open" onClick={() => remove(contact.id)} disabled={deletingId === contact.id}>
                      {deletingId === contact.id ? "Удаляем…" : "Удалить"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollReveal>
      )}
    </section>
  );
}
