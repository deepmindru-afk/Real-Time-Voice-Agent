import { scrollToSection } from "../hooks/scrollTo.js";
import Arrow from "../Arrow.jsx";
import OrbAnchor from "../stage/OrbAnchor.jsx";
import { pulse } from "../stage/bus.js";
import Reveal from "../Reveal.jsx";
import { ADDRESS, CITY, FOUNDED, LEGAL, PHONE, SITE } from "../contacts.js";
import "./CallToAction.css";

// The end of the story. The orb comes back, large, and reacts to the button: the agency's own
// answer to "с чего начать" is to pick up the phone.
export default function CallToAction() {
  return (
    <section className="cta">
      <OrbAnchor name="cta" className="cta-orb" opacity={0.85} />

      <div className="lp-wrap cta-copy">
        <Reveal as="p" className="lp-eyebrow">
          <b>09</b> Начало работы
        </Reveal>

        <Reveal as="h2" className="cta-title" delay={0.08}>
          Позвоните — <em>начнём с разговора.</em>
        </Reveal>

        <Reveal className="cta-actions" delay={0.18}>
          <a
            href={PHONE.href}
            className="lp-btn lp-btn--primary lp-btn--lg lp-btn--phone"
            onPointerEnter={() => pulse(1.1)}
            onFocus={() => pulse(1.1)}
            onPointerDown={() => pulse(1.4)}
          >
            {PHONE.label} <Arrow size={20} />
          </a>
          <a
            href="#use-cases"
            className="lp-btn lp-btn--ghost lp-btn--lg"
            onPointerEnter={() => pulse(0.5)}
            onClick={(event) => {
              event.preventDefault();
              scrollToSection("use-cases");
            }}
          >
            Сначала посмотрите услуги
          </a>
        </Reveal>

        <Reveal className="cta-contacts" delay={0.26}>
          <div className="cta-contact">
            <b>Головной офис</b>
            <span>{CITY}, {ADDRESS}</span>
          </div>
          <div className="cta-contact">
            <b>Телефон</b>
            <a href={PHONE.href}>{PHONE.label}</a>
          </div>
          <div className="cta-contact">
            <b>Сайт</b>
            <a href={SITE.href} target="_blank" rel="noreferrer">
              {SITE.label}
            </a>
          </div>
          <div className="cta-contact">
            <b>Год основания</b>
            <span>{FOUNDED}</span>
          </div>
        </Reveal>

        <Reveal as="p" className="cta-note" delay={0.32}>
          Расскажите о задаче по телефону или напишите через {SITE.label}. {LEGAL} работает с
          компаниями и частными клиентами: аудит, стратегия, реализация и сопровождение в одном
          контуре.
        </Reveal>
      </div>
    </section>
  );
}