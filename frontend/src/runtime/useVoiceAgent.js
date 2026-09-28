// One call, one hook. It runs the call on whichever engine is available and keeps
// React state in step with it, and the screens above it never learn which one that was.
//
// Two engines exist:
//
//   livekit   a LiveKit room with a real agent in it. This is the product: the browser
//             publishes a microphone, plays the agent's audio and reads its
//             transcriptions. Recognition, turn detection, reasoning, tools and
//             interruption all happen on the agent side.
//   local     the browser's own rules plus SpeechRecognition/SpeechSynthesis. Used
//             when LiveKit is not configured or cannot be reached, so the console still
//             works offline. It is a demonstration, not the product.
//
// Both report the same state, so everything below is engine-agnostic:
//
//   callState   idle | connecting | listening | processing | speaking | ended
//   voice       { micState, interim, livekit }  micState: off | on | blocked | error
//   messages    [{ id, time, speaker: "You" | "Agent", text, toolCalls, blocked, interrupted }]
//   pending     { label } while the agent is waiting for a confirmation
//   brain       which engine is answering, and why

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "./format.js";
import { AI_DISCLOSURE, redactSensitive } from "./guardrails.js";
import { createLiveKitSession } from "./livekit/session.js";
import { isLiveKitConfigured, isLiveKitSupported } from "./livekit/support.js";
import { createLocalTransport, createRemoteTransport, detectBackend } from "./transports.js";
import { useVoice } from "./useVoice.js";

const CONNECTION_PROBLEM = "Связь с сервером прервана. Попробуйте повторить через минуту.";
const CALL_FAILED = "Не удалось соединиться. Возможно, звонок уже истёк или на него ответили раньше.";

export function useVoiceAgent(
  profile,
  { attach = null, customerRef = null, agentConfig = null, agentRecordId = null } = {}
) {
  const [callState, setCallState] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(null);
  const [duration, setDuration] = useState(0);
  const [summary, setSummary] = useState(null);
  const [callError, setCallError] = useState(null);
  const [callConfig, setCallConfig] = useState(null); // the configuration this call started with
  const [startedAt, setStartedAt] = useState(null);
  const [summaryPending, setSummaryPending] = useState(false);
  const [needsAudio, setNeedsAudio] = useState(false); // the browser is holding the agent's voice back

  // Reported through the same `voice` object the screens already read, whichever
  // engine is running: LiveKit fills these from the room, the local engine from the
  // browser's own recognizer.
  const [micState, setMicState] = useState("off");
  const [interim, setInterim] = useState("");
  const [livekit, setLivekit] = useState(false);

  // Which engine answers calls: checking | livekit | server | local
  const [brain, setBrain] = useState({ source: "checking", name: null, note: null, telephony: false, available: false });

  const engineRef = useRef(null);
  const sessionRef = useRef(null);
  const startedRef = useRef(0);
  const activeRef = useRef(false);
  const callGenerationRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const turnAbortRef = useRef(null);
  const messagesRef = useRef([]);
  const nextIdRef = useRef(1);
  const sendRef = useRef(null);
  const endCallRef = useRef(null);

  // The browser voice loop, used only by the local engine. It stays mounted either way
  // so switching engines mid-session cannot leave a recognizer running.
  const browserVoice = useVoice({
    onFinal: (text) => {
      if (activeRef.current) sendRef.current?.(text);
    },
    onBargeIn: () => {
      if (sessionRef.current) return; // LiveKit interrupts the agent on its own
      interruptRef.current?.();
    },
    voiceName: agentConfig?.voice ?? "",
  });
  const { openSpeech, cancelSpeech, startListening, stopListening } = browserVoice;

  const elapsed = () => Math.floor((Date.now() - startedRef.current) / 1000);
  const isActive = callState !== "idle" && callState !== "ended";

  useEffect(() => {
    if (!isActive) return undefined;

    const timer = setInterval(() => setDuration(elapsed()), 500);

    return () => clearInterval(timer);
  }, [isActive]);

  useEffect(() => {
    let cancelled = false;

    detectBackend().then((health) => {
      if (cancelled) return;

      if (isLiveKitConfigured(health)) {
        setBrain({ source: "livekit", name: "LiveKit", note: null, telephony: health.telephony, available: true });
        return;
      }

      if (health.available) {
        setBrain({ source: "server", name: health.brain, note: null, telephony: health.telephony, available: true });
        return;
      }

      setBrain({
        source: "local",
        name: "local-rules",
        note: isLiveKitSupported() ? null : "Браузер не поддерживает WebRTC — работает демонстрационный режим.",
        telephony: false,
        available: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Stops a local reply mid-sentence: playback, and the reply still being generated.
  const interruptAgent = useCallback(() => {
    turnAbortRef.current?.abort();
    cancelSpeech();
  }, [cancelSpeech]);

  const interruptRef = useRef(interruptAgent);

  useEffect(() => {
    interruptRef.current = interruptAgent;
  }, [interruptAgent]);

  useEffect(
    () => () => {
      // Never leave a room joined, or a microphone live, behind an unmounted console.
      sessionRef.current?.dispose();
      sessionRef.current = null;
    },
    []
  );

  // --- the LiveKit engine -----------------------------------------------------------------------

  // Every event the room produces lands here. The agent's audio is already playing by
  // the time its transcript arrives, so this only records what was said.
  const onSessionEvent = useCallback(
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
          // Tool calls arrive on the agent's own message while it is still talking, so
          // they are attached to it rather than shown as a separate turn.
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

          addMessage({
            speaker: event.speaker,
            text: event.speaker === "You" ? redactSensitive(event.text) : event.text,
            toolCalls: [],
          });
          return;
        }

        default:
      }
    },
    [addMessage, patchMessage]
  );

  // Everything the server needs to mint a room-scoped token and dispatch the right
  // agent to it. The browser never holds an API key or a secret.
  const startLiveKit = useCallback(async () => {
    const session = createLiveKitSession({
      onEvent: onSessionEvent,
      request: {
        profile_id: profile?.id ?? null,
        agent_id: agentRecordId || null,
        customer_ref: customerRef || null,
        // An outbound call the agent placed: the server already knows which job this
        // is, and which room the person answering it belongs in.
        ...(attach ? { job_id: attach.jobId, token: attach.token } : {}),
      },
    });

    sessionRef.current = session;

    await session.start();

    setLivekit(true);
    setCallState("listening");

    // The call always opens with the AI disclosure, before anything else.
    addMessage({ speaker: "Agent", text: AI_DISCLOSURE });
  }, [addMessage, agentRecordId, attach, customerRef, onSessionEvent, profile]);

  // Browsers will not autoplay until the page has been interacted with; this is called
  // from inside the click handler behind the "tap to hear" button.
  const unlockAudio = useCallback(async () => {
    if (!(await sessionRef.current?.unlockAudio())) return false;

    setNeedsAudio(false);

    return true;
  }, []);

  // --- the local engine ------------------------------------------------------------------------

  const speakWhole = useCallback(
    async (id, text) => {
      setCallState("speaking");

      const speech = openSpeech();

      speech.push(text);
      speech.end();

      if (!(await speech.done) && activeRef.current) {
        patchMessage(id, { interrupted: true });
        engineRef.current?.transport?.interrupted();
      }

      if (activeRef.current) setCallState("listening");
    },
    [openSpeech, patchMessage]
  );

  const runTurn = useCallback(
    async (text) => {
      const transport = engineRef.current?.transport;

      if (!activeRef.current || !transport) return;

      addMessage({ speaker: "You", text: redactSensitive(text) });
      setCallState("processing");

      const controller = new AbortController();
      const speech = openSpeech();
      let agentId = null;
      let agentHangsUp = false;

      turnAbortRef.current = controller;

      const ensureMessage = () => {
        agentId ??= addMessage({ speaker: "Agent", text: "", toolCalls: [] });

        return agentId;
      };

      try {
        for await (const event of transport.turn(text, controller.signal)) {
          if (!activeRef.current || controller.signal.aborted) break;

          if (event.type === "tool_call") {
            patchMessage(ensureMessage(), (message) => ({
              toolCalls: [...message.toolCalls, { ...event, guarded: Boolean(event.guarded) }],
            }));
          } else if (event.type === "sentence") {
            patchMessage(ensureMessage(), (message) => ({
              text: message.text ? `${message.text} ${event.text}` : event.text,
            }));
            speech.push(event.text);
            setCallState("speaking");
          } else if (event.type === "done") {
            agentHangsUp = Boolean(event.ended);
            setPending(event.pending ?? null);
            if (event.blocked) patchMessage(ensureMessage(), { blocked: true });
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          patchMessage(ensureMessage(), (message) => ({
            text: message.text ? `${message.text} ${CONNECTION_PROBLEM}` : CONNECTION_PROBLEM,
          }));
          speech.push(CONNECTION_PROBLEM);
        }
      } finally {
        // Also closes the stream when we stopped reading early.
        controller.abort();
      }

      speech.end();

      const completed = await speech.done;

      if (!activeRef.current) return;

      if (!completed) {
        if (agentId) patchMessage(agentId, { interrupted: true });
        transport.interrupted();
      }

      // The agent said goodbye and ended the call (wrong person, time limit).
      if (agentHangsUp) {
        endCallRef.current?.();
        return;
      }

      setCallState("listening");
    },
    [addMessage, openSpeech, patchMessage]
  );

  const enqueue = useCallback((job) => {
    queueRef.current = queueRef.current.then(job).catch((error) => console.error(error));
  }, []);

  const startLocal = useCallback(async () => {
    const health = await detectBackend();

    if (health.available) {
      const transport = createRemoteTransport(profile, health.brain, attach, customerRef);

      try {
        const greeting = await transport.open();

        setBrain({ source: "server", name: health.brain, note: null, telephony: health.telephony, available: true });

        return { transport, greeting };
      } catch (error) {
        console.error(error);
      }
    }

    const transport = createLocalTransport(profile);

    setBrain({
      source: "local",
      name: transport.name,
      note: health.available ? "Сервер недоступен, включён локальный демонстрационный режим." : null,
      telephony: false,
      available: false,
    });

    return { transport, greeting: await transport.open() };
  }, [attach, customerRef, profile]);

  // --- the call ---------------------------------------------------------------------------------

  // Should this call use LiveKit? The answer is the mount-time probe's, which already
  // asked the server whether it can mint a room token. Only a call started before that
  // probe answered has to ask for it here.
  const shouldUseLiveKit = useCallback(async () => {
    if (brain.source === "livekit") return true;
    if (brain.source !== "checking") return false;

    return isLiveKitConfigured(await detectBackend());
  }, [brain.source]);

  const teardown = useCallback(() => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setLivekit(false);
    stopListening();
    turnAbortRef.current?.abort();
  }, [stopListening]);

  const abortConnecting = useCallback(() => {
    activeRef.current = false;
    callGenerationRef.current += 1;
    teardown();
    engineRef.current = null;
  }, [teardown]);

  const beginCall = useCallback(
    async (firstText) => {
      const generation = ++callGenerationRef.current;

      activeRef.current = true;
      startedRef.current = Date.now();
      queueRef.current = Promise.resolve();
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
      setCallConfig(agentConfig);
      setCallState("connecting");

      // LiveKit is the product; the browser engine is the offline demonstration. A
      // LiveKit connection that cannot be made falls back to it rather than failing.
      if (await shouldUseLiveKit()) {
        try {
          await startLiveKit();

          if (!activeRef.current || callGenerationRef.current !== generation) {
            abortConnecting();
            return;
          }

          startedRef.current = Date.now();
          setStartedAt(startedRef.current);

          if (firstText) {
            sessionRef.current.sendText(firstText);
            addMessage({ speaker: "You", text: redactSensitive(firstText) });
          }

          return;
        } catch (error) {
          console.error(error);
          if (!activeRef.current) return;

          setBrain((current) => ({ ...current, note: "LiveKit недоступен, включён локальный режим." }));
          teardown();
        }
      }

      startListening();

      // Connecting happens inside the turn queue, so anything the caller says
      // meanwhile waits behind the greeting instead of being dropped.
      enqueue(async () => {
        let engine;

        try {
          engine = await startLocal();
        } catch (error) {
          console.error(error);
          activeRef.current = false;
          stopListening();
          setCallError(CALL_FAILED);
          setCallState("ended");
          return;
        }

        // The caller may have ended the call or switched profile while connecting.
        if (!activeRef.current || callGenerationRef.current !== generation) {
          engine.transport?.close(0, [])?.catch?.(() => {});
          return;
        }

        engineRef.current = engine;
        startedRef.current = Date.now();
        setStartedAt(startedRef.current);

        // The call always opens with the AI disclosure, before anything else.
        const greetingId = addMessage({ speaker: "Agent", text: engine.greeting });

        await speakWhole(greetingId, engine.greeting);
        if (firstText) await runTurn(firstText);
      });
    },
    [abortConnecting, addMessage, agentConfig, commit, enqueue, runTurn, shouldUseLiveKit, speakWhole, startLiveKit, startLocal, startListening, stopListening, teardown]
  );

  // Typed text, suggestion chips and recognized speech all take this one path.
  const sendText = useCallback(
    (raw) => {
      const text = raw.trim();

      if (!text) return;

      if (!activeRef.current) {
        beginCall(text);
        return;
      }

      if (sessionRef.current) {
        // LiveKit: the agent is already in the room and transcribes what it hears, so
        // the line is shown here and the room is told about it in the same moment.
        sessionRef.current.sendText(text);
        addMessage({ speaker: "You", text: redactSensitive(text) });
        return;
      }

      // A new caller turn always cuts whatever the agent is saying.
      interruptAgent();
      enqueue(() => runTurn(text));
    },
    [addMessage, beginCall, enqueue, interruptAgent, runTurn]
  );

  useEffect(() => {
    sendRef.current = sendText;
  }, [sendText]);

  const endCall = useCallback(async () => {
    if (!activeRef.current) return;

    activeRef.current = false;
    interruptAgent();
    stopListening();

    const seconds = elapsed();
    const session = sessionRef.current;

    setDuration(seconds);
    setPending(null);
    setInterim("");
    setCallState("ended");

    // LiveKit: the room's own result, falling back to one built from the transcript.
    if (session) {
      setSummaryPending(true);

      try {
        setSummary(await session.stop());
      } catch (error) {
        console.error(error);
      } finally {
        setSummaryPending(false);
        sessionRef.current = null;
        setLivekit(false);
      }

      return;
    }

    const transport = engineRef.current?.transport;

    if (!transport) return;

    setSummaryPending(true);

    try {
      setSummary(await transport.close(seconds, messagesRef.current));
    } catch (error) {
      console.error(error);
    } finally {
      setSummaryPending(false);
    }
  }, [interruptAgent, stopListening]);

  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  const reset = useCallback(() => {
    abortConnecting();

    commit([]);
    setPending(null);
    setSummary(null);
    setCallError(null);
    setSummaryPending(false);
    setInterim("");
    setMicState("off");
    setNeedsAudio(false);
    setLivekit(false);
    setStartedAt(null);
    setCallConfig(null);
    setDuration(0);
    setCallState("idle");
  }, [abortConnecting, commit]);

  const clearMessages = useCallback(() => commit([]), [commit]);

  return {
    callState,
    duration,
    messages,
    pending,
    summary,
    summaryPending,
    startedAt,
    callConfig,
    callError,
    brain,
    // The same shape the screens have always read. `voice.livekit` tells them which
    // engine produced it, so a browser-specific notice (no speech recognition here) is
    // only shown when the browser engine is the one actually running.
    voice: { ...browserVoice, micState, interim, livekit },
    needsAudio,
    unlockAudio,
    beginCall: () => beginCall(),
    sendText,
    endCall,
    reset,
    clearMessages,
  };
}
