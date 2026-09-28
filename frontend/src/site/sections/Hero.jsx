import { useEffect, useRef, useState } from "react";
import Link from "../../router/Link.jsx";
import Arrow from "../Arrow.jsx";
import { scrollToSection } from "../hooks/scrollTo.js";
import { useSectionProgress } from "../hooks/useSectionProgress.js";
import OrbAnchor from "../stage/OrbAnchor.jsx";
import { pulse, setMode } from "../stage/bus.js";
import { useMicrophone } from "./useMicrophone.js";
import "./Hero.css";

// The hero tells the whole product in one loop: a voice comes in, the agent works out what it
// means, and something gets done. The orb behind it follows the same three beats - until a real
// call is on the line (see site/liveAgent.js), when the beats are the call's own.
const PHASES = [
  { id: "voice", mode: "listening", label: "Слушает", caption: "«Мне нужно перенести приём»" },
  { id: "ai", mode: "thinking", label: "Понимает", caption: "Намерение: перенос приёма · звонящий подтверждён" },
  { id: "action", mode: "speaking", label: "Выполняет", caption: "«Готово. Вы записаны на четверг на 15:00»" },
];

const STEPS = [
  ["voice", "Голос"],
  ["ai", "ИИ"],
  ["action", "Действие"],
];

// Which of the three beats a live call is on. The agent publishes its state; the hero only has to
// know which of its three words to light up.
const STEP_FOR_MODE = { listening: "voice", thinking: "ai", speaking: "action" };

const MIC_LABEL = {
  off: "Говорите, чтобы увидеть, как он слушает",
  asking: "Ожидаем разрешения…",
  on: "Слушаю вас. Нажмите, чтобы остановить",
  blocked: "Микрофон заблокирован, шар продолжает пульсировать сам",
  unsupported: "Микрофон здесь недоступен",
};

// While the call is up the button is not a local microphone any more: it is the agent's, and it
// is the difference between being heard and not.
const LIVE_MIC_LABEL = {
  on: "Микрофон включён. Нажмите, чтобы заглушить",
  off: "Микрофон заглушен. Нажмите, чтобы говорить",
};

export default function Hero({ agent = null }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(true);
  const mic = useMicrophone();
  const talking = mic.state === "on";

  const live = Boolean(agent?.live);
  // "connecting" is the agent thinking: something is happening, and it is not the visitor's voice.
  const mode = agent?.callState === "connecting" ? "thinking" : agent?.callState;

  // Peel away as the visitor leaves: copy drifts up and fades, the orb (an anchor, so its box is
  // its size) shrinks and lifts. Only a CSS variable changes.
  useSectionProgress(ref, (progress) => ref.current?.style.setProperty("--leave", progress.toFixed(4)), { mode: "leave" });

  useEffect(() => {
    const element = ref.current;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Walk voice -> AI -> action while the hero is on screen and the visitor is not speaking. A
  // real call is already doing this, so the script stops instead of talking over it.
  useEffect(() => {
    if (!visible || talking || live) return undefined;

    const timer = setInterval(() => {
      if (!document.hidden) setPhase((current) => (current + 1) % PHASES.length);
    }, 2900);

    return () => clearInterval(timer);
  }, [visible, talking, live]);

  const current = PHASES[phase];

  useEffect(() => {
    if (!visible || live) return undefined;

    setMode(talking ? "listening" : current.mode);

    return () => setMode("idle");
  }, [visible, talking, current.mode, live]);

  // The local microphone belongs to the script. While the agent is on the line there is no reason
  // to hold the device open a second time, so it is released and the button drives the agent's
  // microphone instead.
  const stopLocalMic = mic.stop;

  useEffect(() => {
    if (live) stopLocalMic();
  }, [live, stopLocalMic]);

  const step = live ? STEP_FOR_MODE[mode] : talking ? "voice" : current.id;
  const caption = live
    ? agent.messages.at(-1)?.text ?? "Агент на линии. Нажмите на шар, чтобы закончить разговор."
    : talking
      ? "Говорите что угодно. Шар движется вместе с вашим голосом."
      : current.caption;

  return (
    <section ref={ref} className="hero" id="top" data-chapter="Вступление">
      <OrbAnchor name="hero" className="hero-orb" interactive />

      <div className="hero-status">
        <ol className="hero-steps" aria-label="Голос, ИИ, действие">
          {STEPS.map(([id, label], index) => (
            <li key={id} className={step === id ? "is-on" : ""}>
              <span>{label}</span>
              {index < STEPS.length - 1 && <i aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <p className="hero-caption" aria-live="off">
          <b>{live ? agent.status.label : talking ? "Вы" : current.label}</b>
          <span key={caption}>{caption}</span>
        </p>

        {live ? (
          <button
            type="button"
            className={`hero-mic ${agent.micState === "on" ? "is-on" : ""}`}
            onClick={agent.toggleMic}
            aria-pressed={agent.micState === "on"}
          >
            <i aria-hidden="true" />
            {LIVE_MIC_LABEL[agent.micState] ?? LIVE_MIC_LABEL.off}
          </button>
        ) : (
          <button
            type="button"
            className={`hero-mic ${talking ? "is-on" : ""}`}
            onClick={talking ? mic.stop : mic.start}
            disabled={mic.state === "asking"}
            title="Звук остаётся в вашем браузере. Он не записывается и никуда не отправляется."
          >
            <i aria-hidden="true" />
            {MIC_LABEL[mic.state]}
          </button>
        )}
      </div>

      <div className="hero-copy">
        <p className="lp-eyebrow hero-rise" style={{ "--i": 0 }}>
          <span className="live-dot" aria-hidden="true" /> Голосовой ИИ реального времени
        </p>

        <h1 className="hero-title">
          <span className="hero-line">
            <span style={{ "--i": 1 }}>ИИ-агенты, которые</span>
          </span>
          <span className="hero-line">
            <span style={{ "--i": 2 }}>
              действительно <em>говорят.</em>
            </span>
          </span>
        </h1>

        <div className="hero-foot hero-rise" style={{ "--i": 4 }}>
          <p className="lp-lead">
            Создавайте голосовых агентов, которые ведут естественный разговор, понимают, что нужно
            человеку, и выполняют задачу прямо во время звонка.
          </p>

          <div className="hero-actions">
            <Link
              to="/app/dashboard"
              transition
              className="lp-btn lp-btn--primary"
              onPointerEnter={() => pulse(0.9)}
              onFocus={() => pulse(0.9)}
            >
              Начать <Arrow />
            </Link>
            <a
              href="#demo"
              className="lp-btn lp-btn--ghost"
              onClick={(event) => {
                event.preventDefault();
                scrollToSection("demo");
              }}
            >
              Послушать, как это работает
            </a>
          </div>
        </div>
      </div>

      <a
        href="#what"
        className="hero-scroll"
        onClick={(event) => {
          event.preventDefault();
          scrollToSection("what");
        }}
      >
        <span>Листайте</span>
        <i aria-hidden="true" />
      </a>
    </section>
  );
}
