import { useEffect, useRef, useState } from "react";
import SiteIcon from "../icons.jsx";
import { useClock } from "../hooks/useClock.js";
import { progressAt, typedSlice, typingDuration } from "../typing.js";
import "./ConfigPreview.css";

// The same fields as the real "Agent Use Case & Configuration" form, filled in by a script:
// the visitor watches an agent being defined and comes out with the sense "I can make one."
// The card beside it assembles from the very same values.

const INDUSTRY = "Медицина";
const NAME = "АссистентПортал";
const ROLE = "Координатор приёма";
const PURPOSE = "Подтверждает запись и помогает пациентам переносить приём — по телефону, на их языке.";
const DUTIES = "Прежде чем сообщать детали, убедиться, с кем говорит. Любой вопрос о лечении передавать сотруднику.";
const USERS = ["Пациенты", "Родственники"];
const TASKS = ["Записывать на приём", "Отвечать на вопросы", "Выполнять действия в системах"];

// When each part starts (ms). Text parts type at 34 characters a second.
const AT = { industry: 300, name: 900, role: 1600, purpose: 2700 };

AT.users = AT.purpose + typingDuration(PURPOSE) + 350;
AT.tasks = AT.users + 900;
AT.duties = AT.tasks + 1300;
AT.deploy = AT.duties + typingDuration(DUTIES) + 700;
AT.live = AT.deploy + 500;

const DURATION = AT.live + 1600;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function Field({ label, focus, children, wide = false }) {
  return (
    <div className={`cp-field ${focus ? "is-focus" : ""} ${wide ? "is-wide" : ""}`}>
      <label>{label}</label>
      <div className="cp-control">{children}</div>
    </div>
  );
}

export default function ConfigPreview() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const [reduced] = useState(reducedMotion);
  const [elapsed, restart] = useClock({ active: inView && !reduced, duration: DURATION });
  const t = reduced ? DURATION : elapsed;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  const name = typedSlice(NAME, t - AT.name);
  const role = typedSlice(ROLE, t - AT.role);
  const purpose = typedSlice(PURPOSE, t - AT.purpose);
  const duties = typedSlice(DUTIES, t - AT.duties);
  const users = USERS.filter((_, index) => t >= AT.users + index * 250);
  const tasks = TASKS.filter((_, index) => t >= AT.tasks + index * 300);
  const deployed = t >= AT.live;
  const pressing = t >= AT.deploy && !deployed;

  // which field the "cursor" is in, for the focus ring
  const focus =
    t >= AT.duties && t < AT.deploy ? "duties"
    : t >= AT.tasks && t < AT.duties ? "tasks"
    : t >= AT.users && t < AT.tasks ? "users"
    : t >= AT.purpose && t < AT.users ? "purpose"
    : t >= AT.role && t < AT.purpose ? "role"
    : t >= AT.name && t < AT.role ? "name"
    : t >= AT.industry && t < AT.name ? "industry"
    : "";

  const caret = (field, text, full) => focus === field && text.length < full.length && <span className="cp-caret" />;

  return (
    <section ref={ref} className="cp">
      <div className="lp-wrap cp-grid">
        <div className="cp-copy">
          <p className="lp-eyebrow">
            <b>06</b> Создание агента
          </p>
          <h2 className="lp-h2">
            Опишите задачу. <em>Получите агента.</em>
          </h2>
          <p className="lp-lead">Никакой промпт писать не нужно. Скажите, для чего агент, с кем он говорит и за что отвечает, — и он готов к проверке.</p>

          <div className={`cp-card ${deployed ? "is-live" : ""}`} aria-label="Агент в текущей конфигурации">
            <span className="cp-card-av">
              <SiteIcon name="agent" size={22} />
            </span>
            <span className="cp-card-id">
              <b>{name || "Безымянный агент"}{name.length < NAME.length && name && <span className="cp-caret" />}</b>
              <em>{role || "Роль не задана"}</em>
            </span>
            <span className={`cp-status ${deployed ? "is-live" : ""}`}>
              <i /> {deployed ? "Работает" : "Черновик"}
            </span>
            <span className="cp-card-tags">
              {t >= AT.industry && <span>{INDUSTRY}</span>}
              {users.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </span>
            <span className="cp-card-meta">
              <b>{tasks.length}</b> задач · <b>{deployed ? "Готов к звонкам" : "Не развёрнут"}</b>
            </span>
          </div>
        </div>

        <div className="cp-window" role="group" aria-label="Сценарий применения и настройка агента — иллюстрация">
          <header className="cp-head">
            <div>
              <b>Сценарий применения и настройка агента</b>
              <span>Опишите, что должен делать ваш голосовой агент.</span>
            </div>
            <button type="button" className="cp-replay" onClick={restart} disabled={t < DURATION}>
              Повторить
            </button>
          </header>

          <div className="cp-form">
            <Field label="Сценарий применения / отрасль" focus={focus === "industry"}>
              <span className={`cp-select ${t < AT.industry ? "is-empty" : ""}`}>
                {t >= AT.industry ? INDUSTRY : "Выберите сценарий…"}
              </span>
            </Field>
            <Field label="Название агента" focus={focus === "name"}>
              <span className={name ? "" : "is-empty"}>{name || "например, АссистентПортал"}{caret("name", name, NAME)}</span>
            </Field>
            <Field label="Роль агента" focus={focus === "role"}>
              <span className={role ? "" : "is-empty"}>{role || "Какую роль он должен выполнять?"}{caret("role", role, ROLE)}</span>
            </Field>
            <Field label="Назначение" focus={focus === "purpose"} wide>
              <span className={purpose ? "" : "is-empty"}>{purpose || "В чём он поможет пользователям?"}{caret("purpose", purpose, PURPOSE)}</span>
            </Field>
            <Field label="Целевые пользователи" focus={focus === "users"}>
              <span className="cp-chips">
                {users.length === 0 && <span className="is-empty">С кем он говорит?</span>}
                {users.map((item) => (
                  <b key={item}>{item}</b>
                ))}
              </span>
            </Field>
            <Field label="Основные задачи" focus={focus === "tasks"}>
              <span className="cp-chips">
                {tasks.length === 0 && <span className="is-empty">Что он должен делать?</span>}
                {tasks.map((item) => (
                  <b key={item}>{item}</b>
                ))}
              </span>
            </Field>
            <Field label="Обязанности" focus={focus === "duties"} wide>
              <span className={duties ? "" : "is-empty"}>
                {duties || "За что он отвечает, а что ему делать нельзя?"}
                {caret("duties", duties, DUTIES)}
              </span>
            </Field>
          </div>

          <footer className="cp-foot">
            <span className={`cp-toast ${deployed ? "is-in" : ""}`} aria-live="polite">
              <SiteIcon name="check" size={15} /> {name || NAME} работает и готов к звонкам
            </span>
            <span className={`cp-deploy ${pressing ? "is-pressed" : ""} ${deployed ? "is-done" : ""}`} style={{ "--k": progressAt(t, AT.deploy, 300) }}>
              <SiteIcon name="rocket" size={16} /> {deployed ? "Развёрнут" : "Развернуть агента"}
            </span>
          </footer>
        </div>
      </div>
    </section>
  );
}
