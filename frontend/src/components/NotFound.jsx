import Logo from "./Logo.jsx";
import Link from "../router/Link.jsx";

export default function NotFound() {
  return (
    <div className="gate">
      <div className="gate-card">
        <Logo size={28} />
        <h1>Страница не найдена</h1>
        <p>По этому адресу ничего нет.</p>
        <div className="gate-actions">
          <Link to="/app/dashboard" className="gate-btn gate-btn--primary">
            Открыть консоль
          </Link>
          <Link to="/" className="gate-btn">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
