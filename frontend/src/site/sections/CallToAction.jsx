import { useSignupOpen } from "../../auth/context.js";
import Link from "../../router/Link.jsx";
import Arrow from "../Arrow.jsx";
import { scrollToSection } from "../hooks/scrollTo.js";
import OrbAnchor from "../stage/OrbAnchor.jsx";
import { pulse } from "../stage/bus.js";
import Reveal from "../Reveal.jsx";
import "./CallToAction.css";

// The end of the story. The orb comes back, large, and reacts to the button: the product's own
// answer to "should I try it?" is to answer you.
export default function CallToAction() {
  const signupOpen = useSignupOpen();

  return (
    <section className="cta">
      <OrbAnchor name="cta" className="cta-orb" opacity={0.85} />

      <div className="lp-wrap cta-copy">
        <Reveal as="p" className="lp-eyebrow">
          <b>10</b> Начало работы
        </Reveal>

        <Reveal as="h2" className="cta-title" delay={0.08}>
          Создайте первого <em>голосового агента.</em>
        </Reveal>

        <Reveal className="cta-actions" delay={0.18}>
          <Link
            to={signupOpen ? "/signup" : "/signin"}
            transition
            className="lp-btn lp-btn--primary lp-btn--lg"
            onPointerEnter={() => pulse(1.1)}
            onFocus={() => pulse(1.1)}
            onPointerDown={() => pulse(1.4)}
          >
            Начать <Arrow size={20} />
          </Link>
          <a
            href="#product"
            className="lp-btn lp-btn--ghost lp-btn--lg"
            onPointerEnter={() => pulse(0.5)}
            onClick={(event) => {
              event.preventDefault();
              scrollToSection("product");
            }}
          >
            Посмотреть платформу
          </a>
        </Reveal>

        <Reveal as="p" className="cta-note" delay={0.26}>
          {signupOpen ? (
            <>
              Уже есть аккаунт? <Link to="/signin" transition>Войти</Link>. Впервые здесь? <Link to="/signup" transition>Создайте его</Link>.
            </>
          ) : (
            <>
              Регистрация на этом сервере закрыта. <Link to="/signin" transition>Войдите</Link> под учётной записью, созданной вашим администратором.
            </>
          )}
        </Reveal>
      </div>
    </section>
  );
}
