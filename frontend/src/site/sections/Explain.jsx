import { useRef } from "react";
import { useSectionProgress } from "../hooks/useSectionProgress.js";
import SiteIcon from "../icons.jsx";
import { ADDRESS, CITY, FOUNDED, PHONE, SITE } from "../contacts.js";
import "./Explain.css";

// One sentence, lit word by word as the visitor scrolls. It carries the claim the whole page rests
// on: the reason to hire one agency rather than two.
const STATEMENT = "Один подрядчик на весь контур: от анализа и стратегии до сайта, интеграций и поддержки.";

const STORY =
  "FALX — маркетинговое и IT-агентство из Саратова. Берём задачу целиком и отвечаем за результат вместе с клиентом: показываем план до начала работ и отчитываемся о том, что приносит каждый канал.";

// The business card, as the page's only hard data. Everything here is checked and repeatable:
// a year, a city, an address, a phone, a site.
const FACTS = [
  { icon: "calendar", label: "Год основания", value: FOUNDED },
  { icon: "user", label: "Направления", value: "B2B и B2C", note: "компании и частные клиенты" },
  { icon: "layout", label: "Головной офис", value: CITY },
  { icon: "pin", label: "Адрес", value: ADDRESS },
  { icon: "phone", label: "Телефон", value: PHONE.label, href: PHONE.href, note: "приём заявок" },
  { icon: "globe", label: "Сайт", value: SITE.label, href: SITE.href, external: true },
];

const WORDS = STATEMENT.split(" ");
const FIRST_FACT = 0.44; // scroll progress at which the first fact lights
const LAST_FACT = 0.96;

export default function Explain() {
  const ref = useRef(null);

  // One CSS variable drives the words, the statement's lift and every fact in turn. Nothing here
  // needs React state: a scroll frame must not render.
  useSectionProgress(ref, (progress) => ref.current?.style.setProperty("--p", progress.toFixed(4)));

  return (
    <section ref={ref} className="explain" style={{ "--p": 0 }}>
      <div className="explain-pin">
        <div className="lp-wrap explain-inner">
          <p className="lp-eyebrow">
            <b>02</b> Кто мы
          </p>

          <div className="explain-grid">
            <div className="explain-lede">
              <h2 className="explain-statement" aria-label={STATEMENT}>
                {WORDS.map((word, index) => (
                  <span key={index} className="explain-word" style={{ "--w": (index / (WORDS.length - 1)).toFixed(3) }} aria-hidden="true">
                    {word}{" "}
                  </span>
                ))}
              </h2>

              <p className="lp-lead explain-story">{STORY}</p>
            </div>

            <div className="facts">
              <span className="facts-title">Факты о компании</span>

              <ul className="facts-list">
                {FACTS.map((fact, index) => (
                  <li
                    key={fact.label}
                    className="fact"
                    style={{ "--s": (FIRST_FACT + (index / FACTS.length) * (LAST_FACT - FIRST_FACT)).toFixed(3) }}
                  >
                    <span className="fact-icon">
                      <SiteIcon name={fact.icon} size={18} />
                    </span>
                    <span className="fact-body">
                      <span className="fact-label">{fact.label}</span>
                      {fact.href ? (
                        <a
                          className="fact-value"
                          href={fact.href}
                          target={fact.external ? "_blank" : undefined}
                          rel={fact.external ? "noreferrer" : undefined}
                        >
                          {fact.value}
                        </a>
                      ) : (
                        <b className="fact-value">{fact.value}</b>
                      )}
                      {fact.note && <span className="fact-note">{fact.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}