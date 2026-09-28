// One LiveKit room = one call.
//
// This is the whole client side of a LiveKit Agents call, and it is deliberately
// small. The browser does four things and nothing else:
//
//   1. joins the room with a token the server minted
//   2. publishes its microphone
//   3. plays whatever audio the agent publishes (and unlocks playback if the
//      browser will not autoplay it)
//   4. reads the agent's transcriptions and its state, and sends typed text
//      back on the `lk.chat` topic
//
// Everything else - speech recognition, turn detection, the reasoning, the tools,
// the interruption handling - happens on the agent side. In particular barge-in
// needs nothing from us: the agent cuts itself off as soon as the caller speaks.
//
// Events out (the union is documented in useVoiceAgent.js):
//   { type: "state", state }        connecting | listening | thinking | speaking
//   { type: "transcript", ... }     speaker, text, final, id, append
//   { type: "tool_call", ... }      an agent tool call, if the agent publishes one
//   { type: "mic", state }          on | blocked | error | off
//   { type: "audio-blocked" }       playback needs a user gesture
//   { type: "ended", reason }       the room closed
//   { type: "error", message }

import { ParticipantEvent, Room, RoomEvent, Track } from "livekit-client";
import { getJson } from "../api.js";
import { mapResult } from "../results.js";
import { buildTranscriptSummary } from "./summary.js";
import { fetchLiveKitToken } from "./token.js";

// The topic a LiveKit agent listens on for typed input. The agent interrupts its own
// speech to answer, exactly as it would if the words had been spoken.
const CHAT_TOPIC = "lk.chat";

// Some agent deployments mirror their transcriptions onto this topic instead of (or
// as well as) the room's transcription events.
const TRANSCRIPTION_TOPIC = "lk.transcription";

// The attribute the agents SDK writes the agent's own state to.
const AGENT_STATE_ATTRIBUTE = "lk.agent_state";

// Typed text comes back to us as a transcript, because the agent transcribes what it
// hears. A repeat of something we just sent is therefore expected, not a second
// message - these decide when a repeat is "just our own echo" and when a gap in the
// speech means a genuinely new message.
const ECHO_WINDOW_MS = 5000;
const MERGE_WINDOW_MS = 15000;

// How long to wait for the agent to publish its first audio track before deciding it
// is not going to. The agent is dispatched by the token, so it should be there almost
// immediately; this only guards against a dispatch that silently never happened.
const AGENT_JOIN_TIMEOUT_MS = 20000;

// The agents SDK's own state names -> the call states the console renders.
const STATE_FOR_AGENT = {
  initializing: "connecting",
  connecting: "connecting",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
};

const normalize = (text) => text.toLowerCase().replace(/\s+/g, " ").trim();

export function createLiveKitSession({ onEvent, request = {} }) {
  let room = null;
  let stopped = false;
  let callId = null;
  let startedAt = 0;
  let lastState = null;
  let agentRef = null;
  let nextId = 1;

  const elements = new Set(); // attached <audio> elements, so they can be released
  const transcript = [];
  const tools = [];
  const sent = []; // typed text we are still expecting to see echoed back
  let open = null; // the message final speech is currently being appended to

  const emit = (event) => {
    if (!stopped) onEvent?.(event);
  };

  const setState = (state) => {
    if (state === lastState) return;

    lastState = state;
    emit({ type: "state", state });
  };

  // A repeat of something this client just sent is the agent transcribing our own typed
  // line back. Drop it (and stop expecting it) rather than showing it twice.
  const isEcho = (text) => {
    const value = normalize(text);
    const at = Date.now();

    for (let index = sent.length - 1; index >= 0; index -= 1) {
      const entry = sent[index];

      if (at - entry.at > ECHO_WINDOW_MS) break;

      if (entry.value === value) {
        sent.splice(index, 1);
        return true;
      }
    }

    return false;
  };

  // Merges a finalized piece of speech into the message it belongs to, so the
  // transcript reads as sentences rather than as a stream of unrelated fragments.
  const appendFinal = (speaker, text) => {
    const value = text.trim();

    if (!value) return;

    const now = Date.now();
    const mergeable =
      open && open.speaker === speaker && now - open.at < MERGE_WINDOW_MS && !open.closed;

    if (mergeable) {
      const entry = transcript.find((item) => item.id === open.id);

      entry.text = entry.text ? `${entry.text} ${value}` : value;
      open.at = now;

      emit({ type: "transcript", speaker, text: value, final: true, id: open.id, append: true });
      return;
    }

    const id = nextId++;

    transcript.push({ id, speaker, text: value, at: now });
    open = { id, speaker, at: now, closed: false };

    emit({ type: "transcript", speaker, text: value, final: true, id, append: false });
  };

  const onTranscription = (segments, participant) => {
    if (!segments?.length) return;

    // Only the agent's speech becomes agent messages; ours is handled here too, so the
    // console can show the caller while they are still talking.
    const fromAgent = participant ? participant.isAgent : false;

    for (const segment of segments) {
      const text = segment.text?.trim();

      if (!text) continue;

      if (!segment.final) {
        emit({ type: "transcript", speaker: fromAgent ? "Agent" : "You", text, final: false, id: null, append: true });
      } else if (fromAgent) {
        appendFinal("Agent", text);
      } else if (!isEcho(text)) {
        appendFinal("You", text);
      }
    }
  };

  const onData = (payload, participant, kind, topic) => {
    if (kind !== 1) return; // DataPacket_Kind.BYTE; 2 is ARRAY_BUFFER (binary)

    let message;

    try {
      message = JSON.parse(new TextDecoder().decode(payload));
    } catch {
      return;
    }

    if (topic === TRANSCRIPTION_TOPIC) {
      onTranscription([{ text: message?.text ?? "", final: message?.final !== false }], participant);
      return;
    }

    if (topic !== CHAT_TOPIC || !message) return;

    // The agent asking the operator to confirm something before it changes anything.
    // The consent gate itself lives on the agent side; this only mirrors the question so
    // the console can offer its usual confirm/cancel buttons.
    if (message.awaiting_confirmation) {
      emit({
        type: "pending",
        label: typeof message.awaiting_confirmation === "string" ? message.awaiting_confirmation : "подтвердить действие",
      });
    } else if (message.cleared === true || message.awaiting_confirmation === false) {
      emit({ type: "pending", label: null });
    }

    // An agent publishing its tool calls, so the console can show what it is doing.
    const name = message.tool_name ?? message.name;

    if (name) {
      const args = message.args ?? message.arguments ?? {};

      tools.push({ name, args });
      emit({ type: "tool_call", name, args, result: message.result ?? null });
    }

    if (participant?.isAgent && typeof message.text === "string") appendFinal("Agent", message.text);
  };

  const attach = (track) => {
    if (track.kind !== Track.Kind.Audio) return;

    // LiveKit attaches and starts playback itself; the element is only kept so it can
    // be released when the track goes away.
    elements.add(track.attach());
  };

  const detach = (track) => {
    track.detach();

    // attach() puts the element in the document, so dropping the set is not enough.
    for (const element of elements) element.remove();
    elements.clear();
  };

  const rememberAgent = (participant) => {
    if (!participant?.isAgent) return false;

    agentRef = participant;
    participant.on(ParticipantEvent.IsSpeakingChanged, syncState);

    return true;
  };

  // The agent publishes its own state; the active-speaker list is the fallback for
  // deployments that do not. Speaking is the loudest signal we have, so it wins.
  function syncState() {
    if (!room) return;

    const published = agentRef?.attributes?.[AGENT_STATE_ATTRIBUTE];

    if (published) {
      setState(STATE_FOR_AGENT[published] ?? "listening");
      return;
    }

    setState(agentRef?.isSpeaking ? "speaking" : "listening");
  }

  const findAgent = () => [...(room?.remoteParticipants.values() ?? [])].find((item) => item.isAgent);

  // Resolves true as soon as an agent participant is in the room. A dispatch that never
  // happens would otherwise look like a silent call, so it is turned into a real error.
  function waitForAgent(timeoutMs) {
    return new Promise((resolve) => {
      if (!room) return resolve(false);

      let timer = 0;

      const check = (participant) => {
        if (participant?.isAgent) {
          clearTimeout(timer);
          room.off(RoomEvent.ParticipantConnected, check);
          resolve(true);
        }
      };

      timer = setTimeout(() => {
        room.off(RoomEvent.ParticipantConnected, check);
        resolve(false);
      }, timeoutMs);

      room.on(RoomEvent.ParticipantConnected, check);
    });
  }

  const release = () => {
    for (const element of elements) element.remove();
    elements.clear();
    room?.removeAllListeners();
    room = null;
    agentRef = null;
  };

  return {
    name: "livekit",

    get callId() {
      return callId;
    },

    // Joins the room, publishes the microphone, and waits for the agent to arrive.
    async start() {
      const grant = await fetchLiveKitToken(request);

      callId = grant.callId;
      startedAt = Date.now();

      room = new Room({ adaptiveStream: false, dynacast: false });
      setState("connecting");

      room
        .on(RoomEvent.TrackSubscribed, attach)
        .on(RoomEvent.TrackUnsubscribed, detach)
        .on(RoomEvent.ActiveSpeakersChanged, syncState)
        .on(RoomEvent.ParticipantConnected, rememberAgent)
        .on(RoomEvent.TranscriptionReceived, onTranscription)
        .on(RoomEvent.DataReceived, onData)
        .on(RoomEvent.Reconnecting, () => setState("connecting"))
        .on(RoomEvent.Reconnected, syncState)
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (room && !room.canPlaybackAudio) emit({ type: "audio-blocked" });
        })
        .on(RoomEvent.Disconnected, () => {
          if (!stopped) emit({ type: "ended", reason: "disconnected" });
        });

      await room.connect(grant.url, grant.token);

      const agent = findAgent();

      if (agent) rememberAgent(agent);

      // The agent may already be publishing before we started listening for it.
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.audioTrackPublications.values()) {
          if (publication.track) attach(publication.track);
        }
      }

      if (!room.canPlaybackAudio) emit({ type: "audio-blocked" });

      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        emit({ type: "mic", state: "on" });
      } catch (error) {
        emit({ type: "mic", state: error?.name === "NotAllowedError" ? "blocked" : "error" });
      }

      if (!findAgent() && !(await waitForAgent(AGENT_JOIN_TIMEOUT_MS))) {
        throw new Error("Голосовой агент не подключился к комнате.");
      }

      syncState();

      return { callId: grant.callId };
    },

    // Typed input. The agent treats it exactly like something that was said, and
    // interrupts itself to answer.
    sendText(text) {
      const value = text.trim();

      if (!value || !room) return;

      sent.push({ value: normalize(value), at: Date.now() });

      room.localParticipant.sendText(value, { topic: CHAT_TOPIC }).catch(() => {
        // Losing a typed line must never break the call that is already running.
      });
    },

    // Browsers will not autoplay until the page has been interacted with. This must be
    // called from inside the click handler behind the "tap to hear" button.
    async unlockAudio() {
      if (room?.canPlaybackAudio) return true;

      try {
        await room?.startAudio();

        return Boolean(room?.canPlaybackAudio);
      } catch {
        return false;
      }
    },

    async setMicEnabled(enabled) {
      if (!room) return;

      try {
        await room.localParticipant.setMicrophoneEnabled(enabled);
        emit({ type: "mic", state: enabled ? "on" : "off" });
      } catch {
        emit({ type: "mic", state: "error" });
      }
    },

    // Leaves the room and produces the call's result.
    async stop() {
      if (stopped) return null;

      stopped = true;

      const seconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

      try {
        await room?.disconnect();
      } catch {
        // The socket may already be gone; the call result does not depend on it.
      }

      release();

      // When the deployment ties this room to a call record, the server's own summary is
      // the authoritative one. Otherwise build it from the transcript already in hand.
      if (callId) {
        try {
          return mapResult(await getJson(`/api/calls/${encodeURIComponent(callId)}/result`));
        } catch {
          // Fall through to the local one.
        }
      }

      return buildTranscriptSummary({
        callId,
        startedAt,
        durationSeconds: seconds,
        transcript: transcript.map(({ id, speaker, text, at }) => ({ id, speaker, text, time: at })),
        tools,
      });
    },

    // Unmounts without producing a result.
    dispose() {
      stopped = true;
      release();
      room?.disconnect().catch(() => {});
    },
  };
}
