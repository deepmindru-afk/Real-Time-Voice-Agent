// What this browser is actually able to do with LiveKit, asked of the browser
// itself rather than assumed. Everything the console says about readiness comes
// from here, so a machine that genuinely cannot run a call is told so instead of
// being allowed to start one and fail silently.

const globals = typeof window === "undefined" ? {} : window;

// A LiveKit room is WebRTC, so it needs a secure context: https, or localhost in
// development. A plain-http page on a LAN address cannot connect at all.
const secure =
  typeof globals.isSecureContext === "boolean"
    ? globals.isSecureContext
    : ["localhost", "127.0.0.1", "::1"].includes(globals.location?.hostname ?? "");

export const liveKitSupport = {
  // WebRTC itself.
  rtc: typeof globals.RTCPeerConnection !== "undefined",
  // Capturing the microphone.
  microphone: Boolean(globals.navigator?.mediaDevices?.getUserMedia),
  // Carrying the agent's audio back and the typed input out.
  dataChannels: typeof globals.RTCDataChannel !== "undefined",
  // wss:// requires https, and so does getUserMedia outside localhost.
  secure,
};

export const isLiveKitSupported = () =>
  liveKitSupport.rtc && liveKitSupport.microphone && liveKitSupport.dataChannels && liveKitSupport.secure;

// LiveKit is also only usable when there is somewhere to get a token. This app ships
// that endpoint itself (api/livekit/token.js), so unless it has been switched off the
// answer is yes - no backend to ask. A deployment that mints tokens elsewhere says so
// either with VITE_LIVEKIT_URL, which is the ws:// the token will be used with, or
// through `GET /api/health`, whose `livekit: true` is the server's own answer to "can
// you mint a room token for me?".
//
// VITE_LIVEKIT_TOKEN_ENDPOINT=false turns the shipped endpoint off, for a build that
// has no credentials behind it and would rather show the demo engine than fail a call.
const tokenEndpoint = import.meta.env?.VITE_LIVEKIT_TOKEN_ENDPOINT !== "false";

export const isLiveKitConfigured = (backend = null) =>
  isLiveKitSupported() && (tokenEndpoint || Boolean(import.meta.env?.VITE_LIVEKIT_URL) || Boolean(backend?.livekit));
