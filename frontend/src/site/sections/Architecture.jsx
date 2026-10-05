import { useEffect, useRef, useState } from "react";
import SiteIcon from "../icons.jsx";
import OrbAnchor from "../stage/OrbAnchor.jsx";
import "./Architecture.css";

// The stack the work runs on, drawn as a loop. Seven parts sit on a closed track; light pulses
// travel around it and each part glows as one passes. The point is not the parts, it is that the
// track closes: a campaign writes into the CRM, the CRM feeds the next campaign, and the report
// comes back to the same place the plan started.

const NODES = [
  { id: "site", icon: "layout", label: "Сайт", note: "Сайт, лендинги, кабинет: то, где клиент видит вас.", x: 90, y: 290 },
  { id: "crm", icon: "contacts", label: "CRM", note: "Заявки, сделки, воронка и задачи менеджерам — в одной базе.", x: 280, y: 120 },
  { id: "marketing", icon: "funnel", label: "Маркетинг", note: "Кампании, контент, рассылки и работа с обращениями.", x: 600, y: 120 },
  { id: "integrations", icon: "plug", label: "Интеграции", note: "Обмен данными между системами без ручного переноса.", x: 940, y: 120 },
  { id: "analytics", icon: "chart", label: "Отчётность", note: "Срез по каналам, продуктам и сделкам в понятном виде.", x: 1110, y: 290 },
  { id: "phone", icon: "phone", label: "Телефония", note: "Звонки, запись на приём, маршрутизация обращений.", x: 860, y: 460 },
  { id: "automation", icon: "workflow", label: "Автоматизация", note: "Сценарии: событие запускает действие без участия человека.", x: 440, y: 460 },
];

// A rounded rectangle through every node, clockwise from the site node.
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
            <b>07</b> Технологический контур
          </p>
          <h2 className="lp-h2">
            Один контур для <em>маркетинга и IT.</em>
          </h2>
          <p className="lp-lead">Сайт, CRM, реклама, телефония и отчётность связаны между собой. Данные из одного канала доступны в другом, поэтому маркетинг и разработка видят одну и ту же картину бизнеса.</p>
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

        <ol className="arch-list" aria-label="Технологический контур по частям">
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
              <SiteIcon name="branch" size={18} />
            </span>
            <b>Контур замыкается</b>
            <em>И результаты кампании становятся основой для следующего плана: цикл начинается заново, уже на следующих данных.</em>
          </li>
        </ol>
      </div>
    </section>
  );
}