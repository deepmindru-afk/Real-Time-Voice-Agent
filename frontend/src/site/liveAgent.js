import { useCallback, useEffect, useMemo, useRef } from "react";
import { loadConnection } from "../runtime/livekit/connection.js";
import { useVoiceAgent } from "../runtime/useVoiceAgent.js";
import { pulse, setLive } from "./stage/bus.js";

// The real agent, on the public page.
//
// Everywhere else on the site the orb is an illustration: the hero walks three phases, the demo
// plays a recording. Here it is a LiveKit call - the same one the console makes, through the same
// token endpoint, with the same agent behind it - and the orb is that call's state rather than a
// script's.
//
// Three rules this file keeps, so the page stays a page:
//
//   * it joins once, on load, and never again behind the visitor's back. A second attempt needs
//     a click, because the first one may have been refused (no microphone permission, no LiveKit
//     in this deployment) and asking again is not the page's decision to make
//   * the page's own animations step aside while the call is up (see stage/bus.js), so nothing
//     here has to know that the hero and the demo are also writing a mode
//   * nothing is written to the call history. That history is the operator's; a passer-by on
//     the landing page is not a call they made

// What the agent is called in the room. The endpoint names the room and the agent; a display
// name is the one thing a browser is allowed to send.
export const LANDING_PARTICIPANT = "Гость сайта";

const STATE_LABEL = {
  connecting: "Подключаем агента",
  listening: "Слушает вас",
  thinking: "Думает",
  speaking: "Говорит",
};

// tone: what the status line is doing, not what happened - the panel colours itself from it.
const TONE_BY_STATE = { connecting: "busy", listening: "live", thinking: "busy", speaking: "live" };

// The call's state as an orb mode, or null when there is no call and the page's own script should
// have the orb back. "connecting" is a thinking orb: something is happening, and it is not the
// visitor's voice.
export function liveModeFor(callState) {
  if (callState === "listening" || callState === "speaking") return callState;
  if (callState === "thinking" || callState === "connecting") return "thinking";

  return null;
}

// The one line the visitor is told, out of everything the call knows. Ordered by what a visitor
// can act on: an error first (nothing else matters while it lasts), then the sound the browser is
// holding back, then their own microphone, then what the agent is doing.
export function liveStatusFor({ callState = "idle", micState = "off", needsAudio = false, callError = null } = {}) {
  if (callError) return { tone: "error", label: callError };

  if (callState === "idle") return { tone: "idle", label: "Готов говорить" };

  if (callState === "ended") return { tone: "idle", label: "Разговор завершён" };

  if (needsAudio) return { tone: "warn", label: "Браузер придержал звук — нажмите, чтобы услышать агента" };

  if (callState === "connecting") return { tone: "busy", label: STATE_LABEL.connecting };

  if (micState !== "on") return { tone: "muted", label: "Микрофон выключен" };

  return { tone: TONE_BY_STATE[callState] ?? "live", label: STATE_LABEL[callState] ?? "На связи" };
}

// The live agent for the landing page: the call itself (useVoiceAgent does that) plus everything
// the page needs to show it and stay out of its way.
export function useLiveAgent({ autoStart = true } = {}) {
  // The site has no settings form, so this is the connection the console would use: whatever this
  // browser has already saved, or the endpoint the app ships (see livekit/connection.js).
  const connection = useMemo(() => loadConnection(), []);

  const agent = useVoiceAgent({ connection, participantName: LANDING_PARTICIPANT });

  // The call's own functions are stable useCallbacks; only its state changes. Taking them apart
  // here keeps the effects below from re-running on every state the call publishes.
  const { beginCall, endCall, toggleMic, unlockAudio, needsAudio, engine } = agent;

  const live = agent.callState !== "idle" && agent.callState !== "ended";
  const attempted = useRef(false);

  // As soon as the page is there, the agent is too. Guarded by a ref, not by the effect's
  // dependencies: a second call in a room that is already joined would be a second room.
  useEffect(() => {
    if (!autoStart || attempted.current || !engine.ok) return;

    attempted.current = true;
    beginCall();
  }, [autoStart, beginCall, engine.ok]);

  // While the call is up the orb is the agent's, not the page's. The cleanup hands it back.
  useEffect(() => {
    if (!live) return undefined;

    setLive(liveModeFor(agent.callState));

    return () => setLive(null);
  }, [agent.callState, live]);

  const start = useCallback(() => {
    pulse(1.1); // the orb takes the visitor's click as its own
    beginCall();
  }, [beginCall]);

  const stop = useCallback(() => {
    pulse(0.4);
    endCall();
  }, [endCall]);

  // What the orb, and the panel's own button, do: whatever the call is doing, the other thing.
  const toggle = useCallback(() => {
    if (live) {
      stop();
      return;
    }

    start();

    // A press is a gesture, which is what the browser wants before it will play anything. The
    // room is usually not connected yet, so this often does nothing - the panel keeps a real
    // "tap to hear" button for the case where it does not.
    if (needsAudio) unlockAudio();
  }, [live, needsAudio, start, stop, unlockAudio]);

  return {
    live,
    callState: agent.callState,
    duration: agent.duration,
    messages: agent.messages,
    interim: agent.voice.interim,
    micState: agent.voice.micState,
    needsAudio,
    callError: agent.callError,
    engine,
    status: liveStatusFor({
      callState: agent.callState,
      micState: agent.voice.micState,
      needsAudio,
      callError: agent.callError,
    }),
    start,
    stop,
    toggle,
    toggleMic,
    unlockAudio,
  };
}
