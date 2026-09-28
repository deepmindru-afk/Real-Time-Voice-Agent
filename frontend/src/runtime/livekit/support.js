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

// LiveKit is also only usable when the build says where the server is, or when the
// token endpoint will tell us (a token alone is not enough - a URL is needed too).
// `VITE_LIVEKIT_URL` is the explicit opt-in for a deployment that serves the token
// from the same origin; without it, the server's /api/health is asked instead.
export const isLiveKitConfigured = (backend = null) =>
  isLiveKitSupported() && (Boolean(import.meta.env?.VITE_LIVEKIT_URL) || Boolean(backend?.livekit));
