import { useEffect, useRef, useState } from "react";
import SiteIcon from "../icons.jsx";
import OrbAnchor from "../stage/OrbAnchor.jsx";
import "./Architecture.css";

// The real-time loop, drawn as a loop. Seven stages sit on a closed track; light pulses travel
// around it and each stage glows as one passes. The point is not the parts, it is that the
// track never ends: what the agent says becomes what the person hears becomes what it hears next.

const NODES = [
  { id: "user", icon: "user", label: "Человек", note: "Любой, у кого есть телефон или браузер.", x: 90, y: 290 },
  { id: "mic", icon: "mic", label: "Микрофон", note: "Голос захватывается на телефонной линии или в браузере.", x: 280, y: 120 },
  { id: "stream", icon: "stream", label: "Поток голоса", note: "Звук передаётся непрерывно, мелкими кадрами, а не готовой записью.", x: 600, y: 120 },
  { id: "agent", icon: "agent", label: "Голосовой агент", note: "Ваш настроенный агент. Его роль, правила и ограничения определяют ответ.", x: 940, y: 120 },
  { id: "model", icon: "brain", label: "ИИ-модель", note: "Рассуждает, опираясь только на ту информацию, которую агент имеет право видеть.", x: 1110, y: 290 },
  { id: "tools", icon: "tools", label: "Инструменты и сценарии", note: "Ищут данные, записывают, обновляют, запускают перезвонки. Всё, что меняет данные, ждёт подтверждения.", x: 860, y: 460 },
  { id: "response", icon: "speaker", label: "Голосовой ответ", note: "Речь начинается с первой законченной фразы и останавливается, как только заговорил человек.", x: 440, y: 460 },
];

// A rounded rectangle through every node, clockwise from the User node.
const LOOP = "M 90 290 V 190 A 70 70 0 0 1 160 120 H 1040 A 70 70 0 0 1 1110 190 V 390 A 70 70 0 0 1 1040 460 H 160 A 70 70 0 0 1 90 390 Z";

const PERIOD = 11000; // ms for one full trip
const PULSES = 3;
const SPREAD = 0.045; // how wide a node's glow is, as a fraction of the loop

// Where each node sits along the loop, as 0..1. Found by sampling the path: cheaper and safer
// than working out arc lengths by hand, and it stays right if the nodes are moved.
function fractionsFor(path) {
  const total = path.getTotalLength();
  const samples = 720;
  const points = Array.from({ length: samples }, (_, index) => path.getPointAtLength((index / samples) * total));

  return NODES.map((node) => {
    let best = 0;
    let bestDistance = Infinity;

    points.forEach((point, index) => {
      const distance = Math.hypot(point.x - node.x, point.y - node.y);

      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });

    return best / samples;
  });
}

// The shortest way round the loop between two positions, 0..0.5.
const around = (a, b) => {
  const distance = Math.abs(a - b) % 1;

  return Math.min(distance, 1 - distance);
};

export default function Architecture() {
  const rootRef = useRef(null);
  const pathRef = useRef(null);
  const pulseRefs = useRef([]);
  const nodeRefs = useRef([]);
  const [inView, setInView] = useState(false);
  const [auto, setAuto] = useState(0);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });

    observer.observe(rootRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const path = pathRef.current;
    const total = path.getTotalLength();
    const fractions = fractionsFor(path);
    let frame = 0;
    let start = 0;
    let lastAuto = 0;

    const loop = (time) => {
      start ||= time;

      const base = ((time - start) % PERIOD) / PERIOD;

      pulseRefs.current.forEach((pulse, index) => {
        const point = path.getPointAtLength(((base + index / PULSES) % 1) * total);

        pulse.setAttribute("cx", point.x.toFixed(1));
        pulse.setAttribute("cy", point.y.toFixed(1));
      });

      fractions.forEach((fraction, index) => {
        let glow = 0;

        for (let pulse = 0; pulse < PULSES; pulse += 1) {
          const distance = around((base + pulse / PULSES) % 1, fraction);

          glow = Math.max(glow, Math.exp(-((distance / SPREAD) ** 2)));
        }

        nodeRefs.current[index]?.style.setProperty("--g", glow.toFixed(3));
      });

      // The description follows the lead pulse: the stage it has most recently reached.
      const reached = fractions.reduce((best, fraction, index) => (base >= fraction && fraction >= fractions[best] ? index : best), fractions.indexOf(Math.min(...fractions)));

      if (reached !== lastAuto) {
        lastAuto = reached;
        setAuto(reached);
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
  }, [inView]);

  const shown = NODES[picked ?? auto];

  return (
    <section ref={rootRef} className="arch">
      <div className="lp-wrap">
        <header className="arch-head">
          <p className="lp-eyebrow">
            <b>07</b> Контур реального времени
          </p>
          <h2 className="lp-h2">
            Контур, который <em>никогда не останавливается.</em>
          </h2>
          <p className="lp-lead">Ничто не ждёт предыдущего шага. Каждый этап передаёт данные следующему, поэтому ответ начинается, пока разговор ещё идёт.</p>
        </header>

        <div className="arch-stage">
          <svg className="arch-svg" viewBox="0 0 1200 580" aria-hidden="true">
            <path ref={pathRef} className="arch-track" d={LOOP} />
            <path className="arch-flow" d={LOOP} />
            {Array.from({ length: PULSES }, (_, index) => (
              <circle key={index} ref={(node) => (pulseRefs.current[index] = node)} className="arch-pulse" r="5" cx="90" cy="290" />
            ))}
          </svg>

          {NODES.map((node, index) => (
            <button
              key={node.id}
              type="button"
              ref={(element) => (nodeRefs.current[index] = element)}
              className={`arch-node ${node.y < 200 ? "is-top" : ""} ${(picked ?? auto) === index ? "is-shown" : ""}`}
              style={{ left: `${(node.x / 1200) * 100}%`, top: `${(node.y / 580) * 100}%` }}
              onPointerEnter={() => setPicked(index)}
              onPointerLeave={() => setPicked(null)}
              onFocus={() => setPicked(index)}
              onBlur={() => setPicked(null)}
              aria-label={`${node.label}: ${node.note}`}
            >
              <span className="arch-dot">
                <SiteIcon name={node.icon} size={20} />
              </span>
              <b>{node.label}</b>
            </button>
          ))}

          <div className="arch-core">
            <OrbAnchor name="arch" className="arch-orb" />
            <p aria-live="polite">
              <b>{shown.label}</b>
              <span>{shown.note}</span>
            </p>
          </div>
        </div>

        <ol className="arch-list" aria-label="Контур по шагам">
          {NODES.map((node, index) => (
            <li key={node.id} style={{ "--i": index }}>
              <span>
                <SiteIcon name={node.icon} size={18} />
              </span>
              <b>{node.label}</b>
              <em>{node.note}</em>
            </li>
          ))}
          <li className="arch-list-back">
            <span>
              <SiteIcon name="user" size={18} />
            </span>
            <b>Возврат к человеку</b>
            <em>И контур запускается снова: каждый ответ меняет то, что агент услышит дальше.</em>
          </li>
        </ol>
      </div>
    </section>
  );
}
