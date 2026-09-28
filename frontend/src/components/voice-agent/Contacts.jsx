import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import ScrollReveal from "./ScrollReveal";
import { createContact, deleteContact, fetchContacts, updateContact } from "../../runtime/contacts.js";

// The server speaks in these codes; the operator sees them in Russian.
const CONSENT_OPTIONS = ["unknown", "granted", "revoked"];
const CONSENT_LABEL = { granted: "дано", revoked: "отозвано", unknown: "неизвестно" };
const CONSENT_TONE = { granted: "ok", revoked: "warn", unknown: "info" };

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

// One form, reused for both "add a contact" (initial is null) and "edit this one" (initial is the
// contact being edited). Preferred contact time is edited as three plain fields and assembled back
// into the model's own {start, end, timezone} shape (app/models/contact.py's own example) - no new
// scheduling format is invented, and leaving all three blank sends null, not an empty object.
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
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
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
    };

    try {
      const saved = initial ? await updateContact(initial.id, payload) : await createContact(payload);
      onSaved(saved);
    } catch (failure) {
      // The form (and whatever the operator typed) stays exactly as it was: nothing here
      // pretends the save worked.
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="history-form" onSubmit={submit}>
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
          {saving ? "Сохраняем…" : initial ? "Сохранить изменения" : "Добавить контакт"}
        </button>
      </div>
    </form>
  );
}

export default function Contacts({ serverAvailable }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null while adding a new contact
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      setContacts(await fetchContacts());
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Nothing to load: the render below shows the offline message instead of ever
    // consulting `loading`, regardless of its value.
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

  const openEdit = (contact) => {
    setEditingId(contact.id);
    setFormOpen(true);
  };

  const saved = (contact) => {
    setContacts((list) => (list.some((c) => c.id === contact.id) ? list.map((c) => (c.id === contact.id ? contact : c)) : [...list, contact]));
    setFormOpen(false);
  };

  const remove = async (contactId) => {
    if (!window.confirm("Удалить этот контакт? Это действие необратимо.")) return;

    setDeletingId(contactId);
    setError(null);

    try {
      await deleteContact(contactId);
      setContacts((list) => list.filter((c) => c.id !== contactId));
    } catch (failure) {
      // A contact with call jobs cannot be deleted (409); whatever the reason, the list is
      // left exactly as it was - nothing here removes the row before the server confirms it.
      setError(failure.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!serverAvailable) {
    return (
      <section className="history-page">
        <h2>Контакты</h2>
        <p className="callee-note">Контакты хранятся на сервере. Запустите бэкенд (и войдите), чтобы ими управлять.</p>
      </section>
    );
  }

  const editingContact = editingId ? contacts.find((c) => c.id === editingId) ?? null : null;

  return (
    <section className="history-page">
      <div className="history-head">
        <div>
          <h2>Контакты</h2>
          <p className="page-sub">Люди, с которыми общается ваш ИИ-агент.</p>
        </div>
        <div className="history-form-buttons">
          <button onClick={load}>Обновить</button>
          <button className="primary" onClick={() => (formOpen ? setFormOpen(false) : openCreate())}>
            {formOpen ? "Закрыть" : "Добавить контакт"}
          </button>
        </div>
      </div>

      {error && (
        <p className="voice-notice" role="alert">
          {error}
        </p>
      )}

      {formOpen && <ContactForm key={editingId ?? "new"} initial={editingContact} onSaved={saved} onCancel={() => setFormOpen(false)} />}

      {loading ? (
        <div className="state-block is-loading">Загружаем контакты...</div>
      ) : contacts.length === 0 ? (
        <div className="state-block">Контактов пока нет.</div>
      ) : (
        <ScrollReveal>
          <ul className="contact-grid" aria-label="Контакты">
            {contacts.map((contact) => (
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
            ))}
          </ul>
        </ScrollReveal>
      )}
    </section>
  );
}
