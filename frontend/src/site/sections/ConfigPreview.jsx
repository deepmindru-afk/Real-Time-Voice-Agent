import { useEffect, useRef, useState } from "react";
import SiteIcon from "../icons.jsx";
import { useClock } from "../hooks/useClock.js";
import { progressAt, typedSlice, typingDuration } from "../typing.js";
import "./ConfigPreview.css";

// What a project with us looks like on paper: what it is, who it is for, what is inside it and
// how we work. The form fills itself so the visitor sees the shape of an engagement - not a
// promise - and the card beside it assembles from the very same values.

const DIRECTION = "Маркетинг и IT";
const FORMAT = "Сопровождение";
const TASK = "Продвижение и продажи";
const GOAL = "Продвинуть продукты и услуги на рынке, получать заявки из интернета и видеть, что приносит каждый канал.";
const AUDIENCE = ["B2B", "B2C"];
const SCOPE = ["Стратегия", "Реклама", "Сайт", "Интеграции"];
const RULES = "Сначала аудит и план, потом реализация. Каждый этап согласуем с вами, результат смотрим по цифрам.";

// When each part starts (ms). Text parts type at 34 characters a second.
const AT = { direction: 300, format: 900, task: 1600, goal: 2700 };

AT.audience = AT.goal + typingDuration(GOAL) + 350;
AT.scope = AT.audience + 900;
AT.rules = AT.scope + 1300;
AT.deploy = AT.rules + typingDuration(RULES) + 700;
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

  const format = typedSlice(FORMAT, t - AT.format);
  const task = typedSlice(TASK, t - AT.task);
  const goal = typedSlice(GOAL, t - AT.goal);
  const rules = typedSlice(RULES, t - AT.rules);
  const audience = AUDIENCE.filter((_, index) => t >= AT.audience + index * 250);
  const scope = SCOPE.filter((_, index) => t >= AT.scope + index * 300);
  const agreed = t >= AT.live;
  const pressing = t >= AT.deploy && !agreed;

  // which field the "cursor" is in, for the focus ring
  const focus =
    t >= AT.rules && t < AT.deploy ? "rules"
    : t >= AT.scope && t < AT.rules ? "scope"
    : t >= AT.audience && t < AT.scope ? "audience"
    : t >= AT.goal && t < AT.audience ? "goal"
    : t >= AT.task && t < AT.goal ? "task"
    : t >= AT.format && t < AT.task ? "format"
    : t >= AT.direction && t < AT.format ? "direction"
    : "";

  const caret = (field, text, full) => focus === field && text.length < full.length && <span className="cp-caret" />;

  return (
    <section ref={ref} className="cp">
      <div className="lp-wrap cp-grid">
        <div className="cp-copy">
          <p className="lp-eyebrow">
            <b>06</b> Ваш проект
          </p>
          <h2 className="lp-h2">
            Из чего состоит <em>работа с нами.</em>
          </h2>
          <p className="lp-lead">Ничего готовить заранее не нужно. Опишите задачу — покажем формат: направление, состав работ, сроки и то, как будем считать результат.</p>

          <div className={`cp-card ${agreed ? "is-live" : ""}`} aria-label="Проект в текущей конфигурации">
            <span className="cp-card-av">
              <SiteIcon name="workflow" size={22} />
            </span>
            <span className="cp-card-id">
              <b>{format || "Формат не выбран"}{format.length < FORMAT.length && format && <span className="cp-caret" />}</b>
              <em>{task || "Задача не сформулирована"}</em>
            </span>
            <span className={`cp-status ${agreed ? "is-live" : ""}`}>
              <i /> {agreed ? "В работе" : "Черновик"}
            </span>
            <span className="cp-card-tags">
              {t >= AT.direction && <span>{DIRECTION}</span>}
              {audience.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </span>
            <span className="cp-card-meta">
              <b>{agreed ? "Согласовано" : "Ждёт согласования"}</b> · {DIRECTION}
            </span>
          </div>
        </div>

        <div className="cp-window" role="group" aria-label="Формат работы с FALX — услуги, сроки и порядок работы, иллюстрация">
          <header className="cp-head">
            <div>
              <b>Формат работы с FALX</b>
              <span>Что входит в проект и как он идёт.</span>
            </div>
            <button type="button" className="cp-replay" onClick={restart} disabled={t < DURATION}>
              Повторить
            </button>
          </header>

          <div className="cp-form">
            <Field label="Направление" focus={focus === "direction"}>
              <span className={`cp-select ${t < AT.direction ? "is-empty" : ""}`}>
                {t >= AT.direction ? DIRECTION : "Выберите направление…"}
              </span>
            </Field>
            <Field label="Формат работы" focus={focus === "format"}>
              <span className={format ? "" : "is-empty"}>{format || "например, Сопровождение"}{caret("format", format, FORMAT)}</span>
            </Field>
            <Field label="Задача" focus={focus === "task"}>
              <span className={task ? "" : "is-empty"}>{task || "Что нужно бизнесу?"}{caret("task", task, TASK)}</span>
            </Field>
            <Field label="Что нужно получить" focus={focus === "goal"} wide>
              <span className={goal ? "" : "is-empty"}>{goal || "Какой результат считаем успехом?"}{caret("goal", goal, GOAL)}</span>
            </Field>
            <Field label="Кому работаем" focus={focus === "audience"}>
              <span className="cp-chips">
                {audience.length === 0 && <span className="is-empty">B2B или B2C?</span>}
                {audience.map((item) => (
                  <b key={item}>{item}</b>
                ))}
              </span>
            </Field>
            <Field label="Что входит в работу" focus={focus === "scope"}>
              <span className="cp-chips">
                {scope.length === 0 && <span className="is-empty">Какие направления?</span>}
                {scope.map((item) => (
                  <b key={item}>{item}</b>
                ))}
              </span>
            </Field>
            <Field label="Как работаем" focus={focus === "rules"} wide>
              <span className={rules ? "" : "is-empty"}>
                {rules || "Порядок работ и правила согласования"}
                {caret("rules", rules, RULES)}
              </span>
            </Field>
          </div>

          <footer className="cp-foot">
            <span className={`cp-toast ${agreed ? "is-in" : ""}`} aria-live="polite">
              <SiteIcon name="check" size={15} /> {format || FORMAT} согласован и передан в работу
            </span>
            <span className={`cp-deploy ${pressing ? "is-pressed" : ""} ${agreed ? "is-done" : ""}`} style={{ "--k": progressAt(t, AT.deploy, 300) }}>
              <SiteIcon name="rocket" size={16} /> {agreed ? "Согласовано" : "Согласовать и начать"}
            </span>
          </footer>
        </div>
      </div>
    </section>
  );
}