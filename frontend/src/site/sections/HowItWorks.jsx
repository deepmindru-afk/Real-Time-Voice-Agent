import { useRef } from "react";
import SiteIcon from "../icons.jsx";
import Wave from "../Wave.jsx";
import { stepOf } from "../hooks/progress.js";
import { useSectionProgress } from "../hooks/useSectionProgress.js";
import "./HowItWorks.css";

// Six steps, each with its own small scene. Scrolling through the pinned section moves from one
// to the next; only the active scene animates.
const STEPS = [
  {
    id: "configure",
    title: "Настройка",
    heading: "Объясните, кто он.",
    text: "Выберите сценарий, назовите агента и опишите его роль и назначение. Укажите, с кем он говорит, за что отвечает и какие задачи ему можно поручать.",
    points: ["Сценарий и отрасль", "Название и роль агента", "Назначение и целевые пользователи", "Обязанности и основные задачи"],
  },
  {
    id: "connect",
    title: "Подключение",
    heading: "Подключите линию и свои системы.",
    text: "Выберите, как до него добраться: телефонный номер или ссылка в браузере. Соедините свои системы через API и получайте каждый результат подписанным вебхуком.",
    points: ["Телефон или ссылка в браузере", "Ваши контакты и данные", "Подписанные вебхуки с результатом"],
  },
  {
    id: "workflows",
    title: "Сценарии",
    heading: "Решите, что и когда происходит.",
    text: "Задайте событие — например, дату в карточке контакта — и то, что агент должен сделать: кому позвонить, зачем и как. Согласие и часы допустимых звонков проверяются до каждого вызова.",
    points: ["События по датам", "Проверка согласия и часов звонков", "Телефонный или веб-канал"],
  },
  {
    id: "deploy",
    title: "Запуск",
    heading: "Включите его.",
    text: "Когда всё устроит, выполните развёртывание. Агент начинает работать на вашу организацию и сразу может принимать и совершать звонки.",
    points: ["Одно нажатие для запуска", "Можно остановить и изменить в любой момент", "Сначала проверьте в браузере"],
  },
  {
    id: "interact",
    title: "Диалог",
    heading: "Он говорит. Дела сделаны.",
    text: "Агент разговаривает в реальном времени, ищет данные инструментами и спрашивает перед любыми изменениями. Его можно перебить — он замолчит и выслушает.",
    points: ["Голос в реальном времени", "Инструменты с подтверждением", "Перебитие из коробки"],
  },
  {
    id: "analyze",
    title: "Анализ",
    heading: "Виден каждый звонок и его результат.",
    text: "У каждого звонка есть расшифровка, итог, предпринятые действия и результат. Дашборды показывают, как работает каждый агент.",
    points: ["Расшифровки и итоги", "Действия и результаты", "Эффективность по каждому агенту"],
  },
];

function Scene({ id }) {
  switch (id) {
    case "configure":
      return (
        <div className="sc-config">
          <div className="sc-row">
            <label>Сценарий</label>
            <span className="sc-select">Медицина</span>
          </div>
          <div className="sc-row">
            <label>Название агента</label>
            <span className="sc-type" style={{ "--n": 8 }}>АссистентПортал</span>
          </div>
          <div className="sc-row">
            <label>Роль агента</label>
            <span className="sc-type" style={{ "--n": 25, "--t": "0.7s" }}>Координатор приёма</span>
          </div>
          <div className="sc-row">
            <label>Целевые пользователи</label>
            <span className="sc-chips">
              <b style={{ "--i": 0 }}>Пациенты</b>
              <b style={{ "--i": 1 }}>Родственники</b>
            </span>
          </div>
          <div className="sc-row">
            <label>Основные задачи</label>
            <span className="sc-chips">
              <b style={{ "--i": 2 }}>Записывать на приём</b>
              <b style={{ "--i": 3 }}>Отвечать на вопросы</b>
            </span>
          </div>
        </div>
      );
    case "connect":
      return (
        <div className="sc-connect">
          <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <path pathLength="1" d="M118 82 C 168 82, 160 150, 200 150" />
            <path pathLength="1" d="M118 218 C 168 218, 160 150, 200 150" />
            <path pathLength="1" d="M200 150 L 282 150" />
          </svg>
          <span className="sc-node" style={{ left: "4%", top: "17%" }}>
            <SiteIcon name="phone" size={16} /> Телефонная линия
          </span>
          <span className="sc-node" style={{ left: "4%", top: "68%" }}>
            <SiteIcon name="plug" size={16} /> Ссылка в браузере
          </span>
          <span className="sc-hub">
            <i />
            <SiteIcon name="agent" size={26} />
          </span>
          <span className="sc-node sc-node--right" style={{ right: "3%", top: "43%" }}>
            <SiteIcon name="workflow" size={16} /> Ваши системы
            <small>API · вебхуки</small>
          </span>
        </div>
      );
    case "workflows":
      return (
        <ol className="sc-flow">
          {[
            ["calendar", "Событие", "за 3 дня до приёма"],
            ["check", "Допуск", "согласие получено · в рабочие часы"],
            ["phone", "Звонок", "агент звонит контакту"],
            ["chart", "Результат", "итог зафиксирован и передан"],
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
    case "deploy":
      return (
        <div className="sc-deploy">
          <span className="sc-deploy-ring" />
          <span className="sc-deploy-ring" style={{ "--d": "1.2s" }} />
          <div className="sc-deploy-card">
            <span className="sc-deploy-av">
              <SiteIcon name="agent" size={22} />
            </span>
            <span>
              <b>АссистентПортал</b>
              <em>Координатор приёма</em>
            </span>
            <span className="sc-status">
              <i /> <span className="sc-status-a">Черновик</span>
              <span className="sc-status-b">Работает</span>
            </span>
          </div>
          <span className="sc-deploy-btn">
            <SiteIcon name="rocket" size={16} /> Развернуть агента
          </span>
        </div>
      );
    case "interact":
      return (
        <div className="sc-talk">
          <p className="sc-b sc-b--user" style={{ "--i": 0 }}>Можно перенести мой приём?</p>
          <p className="sc-b sc-b--agent" style={{ "--i": 1 }}>Конечно. Подойдёт четверг на 15:00?</p>
          <p className="sc-b sc-b--user" style={{ "--i": 2 }}>Да, отлично.</p>
          <p className="sc-b sc-b--done" style={{ "--i": 3 }}>
            <SiteIcon name="check" size={14} /> Перенесено · Чт 15:00
          </p>
          <Wave level={0.5} bars={28} />
        </div>
      );
    default:
      return (
        <div className="sc-analyze">
          <div className="sc-kpis">
            <p>
              <b>128</b>
              <em>Звонков</em>
            </p>
            <p>
              <b>94%</b>
              <em>Завершено</em>
            </p>
            <p>
              <b>71</b>
              <em>Задач</em>
            </p>
          </div>
          <div className="sc-bars">
            {[38, 52, 44, 68, 60, 82, 74].map((height, index) => (
              <i key={index} style={{ "--h": `${height}%`, "--i": index }} />
            ))}
          </div>
          <ul className="sc-calls">
            {[
              ["Прия Ш.", "Приём записан"],
              ["Рахул М.", "Напоминание подтверждено"],
              ["Анита К.", "Запрошен перенос"],
            ].map(([who, what], index) => (
              <li key={who} style={{ "--i": index }}>
                <i />
                <b>{who}</b>
                <span>{what}</span>
              </li>
            ))}
          </ul>
        </div>
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
    <section ref={ref} className="how" data-step="0" style={{ "--p": 0, "--step": 0 }}>
      <div className="how-pin">
        <div className="lp-wrap how-grid">
          <div className="how-left">
            <p className="lp-eyebrow">
              <b>05</b> Как это работает
            </p>
            <h2 className="lp-h2">
              От идеи до <em>работающего агента</em> за шесть шагов.
            </h2>

            <div className="how-count" aria-hidden="true">
              <span>
                <span className="how-roll">
                  {STEPS.map((step, index) => (
                    <b key={step.id}>{String(index + 1).padStart(2, "0")}</b>
                  ))}
                </span>
              </span>
              <i>/ 06</i>
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

        <ol className="how-rail" aria-label="Шаги">
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
