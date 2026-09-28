import Icon from "./Icon";
import { useEffect, useState } from "react";
import { formatClock, formatLongDate } from "../../runtime/format.js";

const MESSAGE = {
  idle: (agent) => `${agent} готов к работе.`,
  live: (agent) => `${agent} на линии с вами.`,
  summarizing: () => "Формируем итоги звонка.",
  completed: () => "Итоги звонка готовы.",
  unavailable: () => "По последнему звонку нет итогов.",
};

export default function WelcomeBar({ contact, agentName, status }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="welcome-bar">
      <span className="summary-icon">
        <Icon name="document" size={22} />
      </span>

      <div>
        <h2>С возвращением, {contact}!</h2>
        <p>{MESSAGE[status](agentName)}</p>
      </div>

      <div className="welcome-date">
        <span>{formatLongDate(now)}</span>
        <strong>{formatClock(now)}</strong>
      </div>
    </header>
  );
}
