// One call, one hook. A call is a LiveKit room with a real agent in it, and this is
// everything the React tree above it needs to know about that.
//
// The split of work is the whole point of a LiveKit agent: the browser joins the room
// with a token your service minted, publishes a microphone, plays the audio the agent
// publishes, and reads its transcriptions. Recognition, turn detection, reasoning, tools
// and interruption all happen on the agent side - in particular barge-in needs nothing
// from here, because the agent cuts itself off as soon as the caller speaks.
//
//   callState   idle | connecting | listening | thinking | speaking | ended
//   voice       { micState, interim }  micState: off | on | blocked | error
//   messages    [{ id, time, speaker: "You" | "Agent", text, toolCalls, interrupted }]
//   pending     { label } while the agent is waiting for a confirmation
//   engine      which engine is in the room, and why if it is not

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "./format.js";
import { isLiveKitSupported } from "./livekit/support.js";

const CALL_FAILED = "Не удалось соединиться. Проверьте настройки подключения в панели агента.";

export function useVoiceAgent({ connection = null, participantName = null } = {}) {
  const [callState, setCallState] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(null);
  const [duration, setDuration] = useState(0);
  const [summary, setSummary] = useState(null);
  const [callError, setCallError] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [summaryPending, setSummaryPending] = useState(false);
  const [needsAudio, setNeedsAudio] = useState(false); // the browser is holding the agent's voice back
  const [micState, setMicState] = useState("off");
  const [interim, setInterim] = useState("");

  // What the room is, and whether it can be one. The operator sees the note; a call
  // cannot start without one of them.
  const engine = !isLiveKitSupported()
    ? {
        state: "unsupported",
        name: null,
        note: "Браузер не поддерживает WebRTC. Нужен HTTPS и доступ к микрофону.",
        ok: false,
      }
    : connection?.token || connection?.tokenEndpoint
      ? { state: "ready", name: "LiveKit", note: null, ok: true }
      : {
          state: "unconfigured",
          name: null,
          note: "Укажите эндпоинт токенов LiveKit в настройках подключения.",
          ok: false,
        };

  const sessionRef = useRef(null);
  const startedRef = useRef(0);
  const activeRef = useRef(false);
  const callGenerationRef = useRef(0);
  const messagesRef = useRef([]);
  const nextIdRef = useRef(1);
  const endCallRef = useRef(null);

  const elapsed = () => Math.floor((Date.now() - startedRef.current) / 1000);
  const isActive = callState !== "idle" && callState !== "ended";

  useEffect(() => {
    if (!isActive) return undefined;

    const timer = setInterval(() => setDuration(elapsed()), 500);

    return () => clearInterval(timer);
  }, [isActive]);

  const commit = useCallback((next) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const addMessage = useCallback(
    (message) => {
      const entry = { id: nextIdRef.current++, time: formatTime(elapsed()), ...message };

      commit([...messagesRef.current, entry]);

      return entry.id;
    },
    [commit]
  );

  const patchMessage = useCallback(
    (id, patch) => {
      commit(
        messagesRef.current.map((message) =>
          message.id === id
            ? { ...message, ...(typeof patch === "function" ? patch(message) : patch) }
            : message
        )
      );
    },
    [commit]
  );

  // Every event the room produces lands here. The agent's audio is already playing by
  // the time its transcript arrives, so this only records what was said.
  const onEvent = useCallback(
    (event) => {
      switch (event.type) {
        case "state":
          setCallState(event.state);
          return;

        case "mic":
          setMicState(event.state);
          return;

        case "audio-blocked":
          setNeedsAudio(true);
          return;

        case "pending":
          setPending(event.label ? { label: event.label } : null);
          return;

        case "ended":
          endCallRef.current?.();
          return;

        case "error":
          setCallError(event.message);
          setCallState("ended");
          return;

        case "tool_call":
          // Tool calls arrive while the agent is still talking, so they are attached to
          // the message being spoken rather than shown as a turn of their own.
          patchMessage(messagesRef.current.at(-1)?.id, (message) => ({
            toolCalls: [...(message.toolCalls ?? []), { name: event.name, args: event.args, result: event.result, guarded: false }],
          }));
          return;

        case "transcript": {
          if (!event.final) {
            setInterim(event.text);
            return;
          }

          setInterim("");

          if (event.append && event.id != null) {
            patchMessage(event.id, (message) => ({
              text: message.text ? `${message.text} ${event.text}` : event.text,
            }));
            return;
          }

          addMessage({ speaker: event.speaker, text: event.text, toolCalls: [] });
          return;
        }

        default:
      }
    },
    [addMessage, patchMessage]
  );

  // Never leave a room joined, or a microphone live, behind an unmounted console.
  useEffect(
    () => () => {
      sessionRef.current?.dispose();
      sessionRef.current = null;
    },
    []
  );

  const teardown = useCallback(() => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
  }, []);

  const beginCall = useCallback(
    async (firstText) => {
      if (!engine.ok) {
        setCallError(engine.note ?? CALL_FAILED);
        setCallState("ended");
        return;
      }

      const generation = ++callGenerationRef.current;

      activeRef.current = true;
      startedRef.current = Date.now();
      nextIdRef.current = 1;

      commit([]);
      setPending(null);
      setSummary(null);
      setCallError(null);
      setInterim("");
      setMicState("off");
      setNeedsAudio(false);
      setDuration(0);
      setStartedAt(startedRef.current);
      setCallState("connecting");

      let session;

      try {
        // The LiveKit client is half a megabyte, and a call is the only thing that needs it. It
        // is fetched here rather than imported at the top of the module, so a screen that only
        // offers a call - the landing page, before its agent joins - still paints without it.
        const { createLiveKitSession } = await import("./livekit/session.js");

        // The caller may have hung up while the client was still on its way.
        if (!activeRef.current || callGenerationRef.current !== generation) return;

        // The endpoint names the room and the identity, and dispatches the agent this
        // deployment is configured with. The browser sends one thing: what to call us.
        session = createLiveKitSession({ onEvent, connection, request: { participantName } });

        sessionRef.current = session;

        await session.start();
      } catch (error) {
        console.error(error);
        session?.dispose();
        sessionRef.current = null;
        activeRef.current = false;
        setCallError(error?.message ?? CALL_FAILED);
        setCallState("ended");
        return;
      }

      // The caller may have ended the call while we were connecting.
      if (!activeRef.current || callGenerationRef.current !== generation) {
        session.dispose();
        sessionRef.current = null;
        return;
      }

      startedRef.current = Date.now();
      setStartedAt(startedRef.current);
      setCallState("listening");

      if (firstText) session.sendText(firstText);
    },
    [commit, connection, engine.note, engine.ok, onEvent, participantName]
  );

  const sendText = useCallback(
    (raw) => {
      const text = raw.trim();

      if (!text) return;

      if (!activeRef.current) {
        beginCall(text);
        return;
      }

      sessionRef.current?.sendText(text);
    },
    [beginCall]
  );

  const endCall = useCallback(async () => {
    if (!activeRef.current) return;

    activeRef.current = false;

    const seconds = elapsed();
    const session = sessionRef.current;

    setDuration(seconds);
    setPending(null);
    setInterim("");
    setCallState("ended");

    if (!session) return;

    setSummaryPending(true);

    try {
      setSummary(await session.stop());
    } catch (error) {
      console.error(error);
    } finally {
      setSummaryPending(false);
      sessionRef.current = null;
    }
  }, []);

  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  const reset = useCallback(() => {
    activeRef.current = false;
    callGenerationRef.current += 1;
    teardown();

    commit([]);
    setPending(null);
    setSummary(null);
    setCallError(null);
    setSummaryPending(false);
    setInterim("");
    setMicState("off");
    setNeedsAudio(false);
    setStartedAt(null);
    setDuration(0);
    setCallState("idle");
  }, [commit, teardown]);

  // Browsers will not autoplay until the page has been interacted with; this is called
  // from inside the click handler behind the "включить звук" button.
  const unlockAudio = useCallback(async () => {
    if (!(await sessionRef.current?.unlockAudio())) return false;

    setNeedsAudio(false);

    return true;
  }, []);

  // The microphone, mid-call. Turning it off leaves the room joined and the agent still able to
  // speak; it just stops hearing, which is what a visitor who did not mean to talk needs. The
  // console has no use for it - its panel starts and ends whole calls - so this exists for the
  // landing page, where an agent is on the line without being asked for.
  const toggleMic = useCallback(async () => {
    if (!sessionRef.current) return false;

    const next = micState !== "on";

    await sessionRef.current.setMicEnabled(next);

    return next;
  }, [micState]);

  const clearMessages = useCallback(() => commit([]), [commit]);

  return {
    callState,
    duration,
    messages,
    pending,
    summary,
    summaryPending,
    startedAt,
    callError,
    engine,
    voice: { micState, interim },
    needsAudio,
    unlockAudio,
    toggleMic,
    beginCall: () => beginCall(),
    sendText,
    endCall,
    reset,
    clearMessages,
  };
}
