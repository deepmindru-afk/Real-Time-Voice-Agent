import { useEffect, useRef, useState } from "react";
import { useAuth, useSignupOpen } from "../auth/context.js";
import { canEnterApp } from "../auth/state.js";
import Link from "../router/Link.jsx";
import Arrow from "./Arrow.jsx";
import Logo from "../components/Logo.jsx";
import { subscribeScroll } from "./hooks/scrollTicker.js";
import { scrollToSection } from "./hooks/scrollTo.js";

const BRAND = (
  <>
    <b>АО «Портал»</b> Голосовые ИИ-агенты
  </>
);

const LINKS = [
  ["Как это работает", "how"],
  ["Сценарии", "use-cases"],
  ["Платформа", "product"],
];

export default function Nav() {
  const { status } = useAuth();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const inApp = canEnterApp(status);
  const signupOpen = useSignupOpen();

  // Solid, blurred bar once the page has moved; transparent over the hero.
  useEffect(
    () =>
      subscribeScroll({
        read: ({ y }) => y > 24,
        write: (scrolled) => ref.current?.classList.toggle("is-scrolled", scrolled),
      }),
    []
  );

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => event.key === "Escape" && setOpen(false);

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id) => (event) => {
    event.preventDefault();
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <header ref={ref} className={`lp-nav ${open ? "is-open" : ""}`}>
      <div className="lp-nav-bar">
        <Link to="/" className="lp-brand" aria-label="АО «Портал», на главную">
          <Logo />
          <span>{BRAND}</span>
        </Link>

        <nav className="lp-nav-links" aria-label="Разделы">
          {LINKS.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={go(id)}>
              {label}
            </a>
          ))}
        </nav>

        <div className="lp-nav-actions">
          {inApp ? (
            <Link to="/app/dashboard" transition className="lp-btn lp-btn--primary lp-btn--sm">
              Открыть консоль <Arrow size={16} />
            </Link>
          ) : (
            <>
              {/* with sign-up open, "Войти" is the quiet link and "Регистрация" the button; with it closed, sign-in is the only way in */}
              <Link
                to="/signin"
                transition
                className={signupOpen ? "lp-nav-signin" : "lp-btn lp-btn--primary lp-btn--sm"}
              >
                Войти {!signupOpen && <Arrow size={16} />}
              </Link>
              {signupOpen && (
                <Link to="/signup" transition className="lp-btn lp-btn--primary lp-btn--sm">
                  Регистрация <Arrow size={16} />
                </Link>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          className="lp-nav-toggle"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
        </button>
      </div>

      <div className="lp-nav-sheet" aria-hidden={!open}>
        {LINKS.map(([label, id]) => (
          <a key={id} href={`#${id}`} onClick={go(id)} tabIndex={open ? 0 : -1}>
            {label}
          </a>
        ))}
        {inApp ? (
          <Link to="/app/dashboard" transition tabIndex={open ? 0 : -1} className="lp-btn lp-btn--primary">
            Открыть консоль <Arrow size={16} />
          </Link>
        ) : (
          <>
            <Link
              to="/signin"
              transition
              tabIndex={open ? 0 : -1}
              className={signupOpen ? "lp-btn lp-btn--ghost" : "lp-btn lp-btn--primary"}
            >
              Войти
            </Link>
            {signupOpen && (
              <Link to="/signup" transition tabIndex={open ? 0 : -1} className="lp-btn lp-btn--primary">
                Регистрация
              </Link>
            )}
          </>
        )}
      </div>
    </header>
  );
}
