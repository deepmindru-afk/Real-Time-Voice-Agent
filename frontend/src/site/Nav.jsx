import { useEffect, useRef, useState } from "react";
import Link from "../router/Link.jsx";
import Arrow from "./Arrow.jsx";
import Logo from "../components/Logo.jsx";
import { subscribeScroll } from "./hooks/scrollTicker.js";
import { scrollToSection } from "./hooks/scrollTo.js";
import { BRAND } from "./contacts.js";

const LINE = "маркетинг и IT";

const BRAND_BLOCK = (
  <>
    <b>{BRAND}</b> {LINE}
  </>
);

// Every id here is a real section on the page: the ones that used to point at #product never
// existed, so the link scrolled nowhere.
const LINKS = [
  ["О компании", "what"],
  ["Услуги", "use-cases"],
  ["Как мы работаем", "how"],
  ["Контакты", "get-started"],
];

const CONSOLE = "Демо-консоль";

export default function Nav() {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

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
        <Link to="/" className="lp-brand" aria-label={`${BRAND}, на главную`}>
          <Logo />
          <span>{BRAND_BLOCK}</span>
        </Link>

        <nav className="lp-nav-links" aria-label="Разделы">
          {LINKS.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={go(id)}>
              {label}
            </a>
          ))}
        </nav>

        <div className="lp-nav-actions">
          <Link to="/app/dashboard" transition className="lp-btn lp-btn--primary lp-btn--sm">
            {CONSOLE} <Arrow size={16} />
          </Link>
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
        <Link to="/app/dashboard" transition tabIndex={open ? 0 : -1} className="lp-btn lp-btn--primary">
          {CONSOLE} <Arrow size={16} />
        </Link>
      </div>
    </header>
  );
}