import { lazy, Suspense } from "react";
import Link from "../router/Link.jsx";
import Chapters from "./Chapters.jsx";
import Logo from "../components/Logo.jsx";
import Nav from "./Nav.jsx";
import Hero from "./sections/Hero.jsx";
import LiveAgentPanel from "./LiveAgentPanel.jsx";
import OrbHotspot from "./stage/OrbHotspot.jsx";
import { useLiveAgent } from "./liveAgent.js";
import { useVoiceStage } from "./stage/useVoiceStage.js";
import "./landing.css";

import Defer from "./Defer.jsx";

const VoiceStage = lazy(() => import("./stage/VoiceStage.jsx"));
const Explain = lazy(() => import("./sections/Explain.jsx"));
const Demo = lazy(() => import("./sections/Demo.jsx"));
const UseCases = lazy(() => import("./sections/UseCases.jsx"));
const HowItWorks = lazy(() => import("./sections/HowItWorks.jsx"));
const ConfigPreview = lazy(() => import("./sections/ConfigPreview.jsx"));
const Architecture = lazy(() => import("./sections/Architecture.jsx"));
const RealtimeMatters = lazy(() => import("./sections/RealtimeMatters.jsx"));
const CallToAction = lazy(() => import("./sections/CallToAction.jsx"));

// The public site. It renders at once (text, CSS orb, buttons); the 3D scene and every section
// below the hero are fetched afterwards, so the first paint never waits for them.
//
// It also runs a real agent (see liveAgent.js), which is why the hero and the orb are not only
// an illustration here: the orb is that call, and pressing it ends the call.
export default function Landing() {
  const voiceStage = useVoiceStage();
  const agent = useLiveAgent();

  return (
    <div className="lp" data-stage={voiceStage.status}>
      <Nav />
      <Chapters />

      {voiceStage.enabled && (
        <VoiceStageBoundary tier={voiceStage.tier} onReady={voiceStage.onReady} onGiveUp={voiceStage.onGiveUp} />
      )}

      <OrbHotspot
        label={agent.live ? "Завершить разговор с агентом" : "Поговорить с голосовым агентом"}
        onActivate={agent.toggle}
      />
      <LiveAgentPanel agent={agent} />

      <main>
        <Hero agent={agent} />
        <Defer id="what" chapter="Что это" minHeight="430vh">
          <Explain />
        </Defer>
        <Defer id="demo" chapter="Живая демонстрация" minHeight="820px">
          <Demo />
        </Defer>
        <Defer id="use-cases" chapter="Что он умеет" minHeight="330vh">
          <UseCases />
        </Defer>
        <Defer id="how" chapter="Как это работает" minHeight="640vh">
          <HowItWorks />
        </Defer>
        <Defer id="build" chapter="Создание агента" minHeight="860px">
          <ConfigPreview />
        </Defer>
        <Defer id="architecture" chapter="Контур реального времени" minHeight="900px">
          <Architecture />
        </Defer>
        <Defer id="realtime" chapter="Почему реальное время" minHeight="1000px">
          <RealtimeMatters />
        </Defer>
        <Defer id="get-started" chapter="Начало работы" minHeight="100vh">
          <CallToAction />
        </Defer>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <Link to="/" className="lp-brand">
            <Logo />
            <span>
              <b>АО «Портал»</b> Голосовые ИИ-агенты
            </span>
          </Link>
          <nav aria-label="Подвал">
            <Link to="/app/dashboard" transition>
              Консоль
            </Link>
            <Link to="/app/settings" transition>
              Настройки
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function VoiceStageBoundary(props) {
  return (
    <Suspense fallback={null}>
      <VoiceStage {...props} />
    </Suspense>
  );
}
