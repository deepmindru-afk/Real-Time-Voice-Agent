import Logo from "../components/Logo.jsx";
import Link from "../router/Link.jsx";
import { useAuth } from "./context.js";

// Shown instead of a spinner when the server cannot be reached (or answered nonsense). Retry asks
// again; "Continue offline" is the browser-only console the app has always had when there is no
// server, but now it is something the person chooses, not something that happens silently.
export default function ServerUnavailable() {
  const { error, retry, enterOffline } = useAuth();

  return (
    <div className="gate" role="alert">
      <div className="gate-card">
        <Logo size={28} />
        <h1>Не удалось связаться с сервером</h1>
        <p>
          {error ?? "Что-то пошло не так при проверке сессии."} Убедитесь, что сервер запущен, и попробуйте
          снова.
        </p>

        <div className="gate-actions">
          <button type="button" className="gate-btn gate-btn--primary" onClick={retry}>
            Попробовать снова
          </button>
          <button type="button" className="gate-btn" onClick={enterOffline}>
            Продолжить без сервера
          </button>
        </div>

        <small>
          Офлайн-режим запускает голосовую консоль только в этом браузере: без входа и без сохранённых
          звонков. <Link to="/">Вернуться на сайт</Link>
        </small>
      </div>
    </div>
  );
}
