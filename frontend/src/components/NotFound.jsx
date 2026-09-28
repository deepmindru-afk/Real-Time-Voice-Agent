import Logo from "./Logo.jsx";
import { useSignupOpen } from "../auth/context.js";
import Link from "../router/Link.jsx";

export default function NotFound() {
  const signupOpen = useSignupOpen();

  return (
    <div className="gate">
      <div className="gate-card">
        <Logo size={28} />
        <h1>Страница не найдена</h1>
        <p>По этому адресу ничего нет.</p>
        <div className="gate-actions">
          <Link to="/" className="gate-btn gate-btn--primary">
            Вернуться на сайт
          </Link>
          <Link to="/signin" className="gate-btn">
            Войти
          </Link>
          {signupOpen && (
            <Link to="/signup" className="gate-btn">
              Регистрация
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
