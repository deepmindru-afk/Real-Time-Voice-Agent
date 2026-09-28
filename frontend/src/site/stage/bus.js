// The small shared state between the parts of the page that talk (the hero's status line, the
// demo, the call-to-action button) and the 3D orb that listens. The orb reads it once per frame
// from its own render loop, so nothing here causes a React render.
//
//   mode      what the page's own script says the agent is doing: idle | listening | thinking |
//             speaking. The hero walks through three phases, the demo plays its recording
//   live      the same four, but from a real LiveKit call (see site/liveAgent.js). While it is
//             set it wins over `mode`: a real agent on the line should never be overwritten by
//             an animation, and the animations do not know they are being overridden
//   boost     a short-lived extra energy (button hover, a click), decays by itself
//   analyser  a WebAudio AnalyserNode while the visitor has chosen to speak to the orb, else null
//   anchors   elements marked as "the orb goes here" (see OrbAnchor)
//   ready     the WebGL scene is up and drawing (the CSS orbs fade out when it is)

export const stage = {
  mode: "idle",
  live: null,
  boost: 0,
  analyser: null,
  anchors: new Set(),
  ready: false,
};

export function setMode(mode) {
  stage.mode = mode;
}

// What the orb should show right now: the real call if there is one, the page's script if not.
// Pure, so the scene can be handed the bus it should read rather than importing it.
export function currentMode(bus) {
  return bus.live ?? bus.mode;
}

// The real call's state, while there is one. `null` hands the orb back to the page's script.
export function setLive(mode) {
  stage.live = mode;
}

export function pulse(amount = 1) {
  stage.boost = Math.min(1.5, stage.boost + amount);
}
