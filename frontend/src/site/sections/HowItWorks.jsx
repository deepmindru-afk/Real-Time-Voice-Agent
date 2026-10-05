import { useRef } from "react";
import SiteIcon from "../icons.jsx";
import { stepOf } from "../hooks/progress.js";
import { useSectionProgress } from "../hooks/useSectionProgress.js";
import { CITY } from "../contacts.js";
import "./HowItWorks.css";

// Five steps, each with its own small scene. Scrolling through the pinned section moves from one
// to the next; only the active scene animates.
const STEPS = [
  {
    id: "audit",
    title: "Анализ",
    heading: "Сначала смотрим, что есть.",
    text: "Начинаем с аудита: чем занимается компания, кто её клиент, какие каналы уже работают и какие данные в ней накоплены.",
    points: ["Отрасль и задача бизнеса", "Клиенты и конкуренты", "Текущие каналы и данные"],
  },
  {
    id: "plan",
    title: "Стратегия",
    heading: "Даём план, а не обещания.",
    text: "По результатам аудита собираем стратегию: позиционирование, сообщения, каналы, последовательность кампаний, бюджет и сроки. Вы видите план до начала работ.",
    points: ["Позиционирование и сообщения", "Каналы и календарь кампаний", "Бюджет и сроки работ"],
  },
  {
    id: "work",
    title: "Реализация",
    heading: "Делаем и согласуем с вами.",
    text: "Готовим тексты, макеты, сайты и настройки кампаний. Каждый материал показываем до публикации, правки вносим по вашим замечаниям.",
    points: ["Контент и креативы", "Сайт и цифровые продукты", "Согласование до запуска"],
  },
  {
    id: "launch",
    title: "Запуск",
    heading: "Включаем всё вместе.",
    text: "Запускаем кампании, подключаем CRM, интеграции и телефонию, переносим накопленные данные. Объясняем вашей команде, как этим пользоваться.",
    points: ["Кампании и реклама", "CRM, интеграции, телефония", "Обучение вашей команды"],
  },
  {
    id: "measure",
    title: "Измерение",
    heading: "Смотрим результат и меняем.",
    text: "Собираем отчёт по каналам и продуктам, сверяем его с планом и предлагаем, что менять дальше. Сопровождение продолжается, пока оно нужно.",
    points: ["Отчёт по каналам и продуктам", "Сравнение с планом", "Гипотезы на следующий период"],
  },
];

function Scene({ id }) {
  switch (id) {
    case "audit":
      return (
        <div className="sc-config">
          <div className="sc-row">
            <label>Отрасль</label>
            <span className="sc-select">Услуги</span>
          </div>
          <div className="sc-row">
            <label>Задача</label>
            <span className="sc-type" style={{ "--n": 25, "--t": "0.7s" }}>Больше заявок из интернета</span>
          </div>
          <div className="sc-row">
            <label>Каналы сейчас</label>
            <span className="sc-chips">
              <b style={{ "--i": 0 }}>Сайт</b>
              <b style={{ "--i": 1 }}>Соцсети</b>
            </span>
          </div>
          <div className="sc-row">
            <label>Данные</label>
            <span className="sc-chips">
              <b style={{ "--i": 2 }}>CRM</b>
              <b style={{ "--i": 3 }}>1С</b>
              <b style={{ "--i": 4 }}>Телефония</b>
            </span>
          </div>
        </div>
      );
    case "plan":
      return (
        <div className="sc-connect">
          <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <path pathLength="1" d="M118 82 C 168 82, 160 150, 200 150" />
            <path pathLength="1" d="M118 218 C 168 218, 160 150, 200 150" />
            <path pathLength="1" d="M200 150 L 282 150" />
          </svg>
          <span className="sc-node" style={{ left: "4%", top: "17%" }}>
            <SiteIcon name="user" size={16} /> Задача бизнеса
          </span>
          <span className="sc-node" style={{ left: "4%", top: "68%" }}>
            <SiteIcon name="chart" size={16} /> Данные аудита
          </span>
          <span className="sc-hub">
            <i />
            <SiteIcon name="branch" size={26} />
          </span>
          <span className="sc-node sc-node--right" style={{ right: "3%", top: "43%" }}>
            <SiteIcon name="sliders" size={16} /> План работ
            <small>каналы · бюджет · сроки</small>
          </span>
        </div>
      );
    case "work":
      return (
        <div className="sc-talk">
          <p className="sc-b sc-b--user" style={{ "--i": 0 }}>Нужен новый сайт и заявки из рекламы.</p>
          <p className="sc-b sc-b--agent" style={{ "--i": 1 }}>Соберём структуру и покажем макет до сборки.</p>
          <p className="sc-b sc-b--user" style={{ "--i": 2 }}>Берём этот вариант.</p>
          <p className="sc-b sc-b--done" style={{ "--i": 3 }}>
            <SiteIcon name="check" size={14} /> Согласовано · макет
          </p>
        </div>
      );
    case "launch":
      return (
        <div className="sc-deploy">
          <span className="sc-deploy-ring" />
          <span className="sc-deploy-ring" style={{ "--d": "1.2s" }} />
          <div className="sc-deploy-card">
            <span className="sc-deploy-av">
              <SiteIcon name="rocket" size={22} />
            </span>
            <span>
              <b>Маркетинг и IT</b>
              <em>Проект под задачу клиента · {CITY}</em>
            </span>
            <span className="sc-status">
              <i /> <span className="sc-status-a">Черновик</span>
              <span className="sc-status-b">Работает</span>
            </span>
          </div>
          <span className="sc-deploy-btn">
            <SiteIcon name="rocket" size={16} /> Запустить работы
          </span>
        </div>
      );
    default:
      return (
        <ol className="sc-flow">
          {[
            ["chart", "Срез данных", "по каналам и продуктам"],
            ["layout", "Отчёт", "что сработало, а что нет"],
            ["brain", "Гипотезы", "что проверить дальше"],
            ["check", "Следующий период", "план работ на основе выводов"],
          ].map(([icon, label, note], index) => (
            <li key={label} style={{ "--i": index }}>
              <span>
                <SiteIcon name={icon} size={16} />
              </span>
              <b>{label}</b>
              <em>{note}</em>
            </li>
          ))}
        </ol>
      );
  }
}

export default function HowItWorks() {
  const ref = useRef(null);

  // Discrete step -> classes on the copy, scenes and rail. Continuous progress -> --p.
  useSectionProgress(ref, (progress) => {
    const section = ref.current;

    if (!section) return;

    const step = stepOf(progress, STEPS.length);

    section.style.setProperty("--p", progress.toFixed(4));

    if (section.dataset.step !== String(step)) {
      section.dataset.step = String(step);
      section.style.setProperty("--step", String(step));
      section.querySelectorAll("[data-i]").forEach((node) => node.classList.toggle("is-active", Number(node.dataset.i) === step));
    }
  });

  // A rail tick scrolls to the middle of its step.
  const go = (index) => {
    const section = ref.current;
    const travel = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;

    window.scrollTo({ top: top + ((index + 0.5) / STEPS.length) * travel, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <section ref={ref} className="how" data-step="0" style={{ "--p": 0, "--step": 0, "--n": STEPS.length }}>
      <div className="how-pin">
        <div className="lp-wrap how-grid">
          <div className="how-left">
            <p className="lp-eyebrow">
              <b>05</b> Как мы работаем
            </p>
            <h2 className="lp-h2">
              Пять шагов <em>от аудита до отчёта.</em>
            </h2>

            <div className="how-count" aria-hidden="true">
              <span>
                <span className="how-roll">
                  {STEPS.map((step, index) => (
                    <b key={step.id}>{String(index + 1).padStart(2, "0")}</b>
                  ))}
                </span>
              </span>
              <i>/ {String(STEPS.length).padStart(2, "0")}</i>
            </div>

            <div className="how-copy">
              {STEPS.map((step, index) => (
                <div key={step.id} data-i={index} className={`how-step ${index === 0 ? "is-active" : ""}`}>
                  <h3>{step.heading}</h3>
                  <p>{step.text}</p>
                  <ul>
                    {step.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="how-stage" aria-hidden="true">
            <div className="how-window">
              <div className="how-window-bar">
                <i />
                <i />
                <i />
                <span>{STEPS.map((step, index) => (
                  <em key={step.id} data-i={index} className={index === 0 ? "is-active" : ""}>{step.title}</em>
                ))}</span>
              </div>
              <div className="how-scenes">
                {STEPS.map((step, index) => (
                  <div key={step.id} data-i={index} className={`how-scene ${index === 0 ? "is-active" : ""}`}>
                    <Scene id={step.id} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ol className="how-rail" aria-label="Шаги работы">
          {STEPS.map((step, index) => (
            <li key={step.id} data-i={index} className={index === 0 ? "is-active" : ""}>
              <button type="button" onClick={() => go(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {step.title}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}