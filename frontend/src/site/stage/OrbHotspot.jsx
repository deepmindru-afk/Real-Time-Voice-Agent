import { useEffect, useRef } from "react";
import { subscribeScroll } from "../hooks/scrollTicker.js";
import { stage } from "./bus.js";
import { pickAnchor } from "./mode.js";

// The orb, as something you can press.
//
// The orb is a canvas behind the whole page, so it has no hit area of its own. This is one
// transparent, circular button that sits exactly where the orb is: it measures the same anchors
// in the same shared scroll ticker the scene uses (see VoiceStage), so it tracks the orb as it
// flies from section to section without ever forcing a layout of its own.
//
// It only appears over anchors that opted in (OrbAnchor's `interactive`), because further down the
// page the orb sits behind cards and buttons, and an invisible disc there would eat their clicks.
// Everything is written to style, never to state: a scroll frame must not render.
export default function OrbHotspot({ label, onActivate }) {
  const ref = useRef(null);

  useEffect(
    () =>
      subscribeScroll({
        read: (view) => {
          const elements = [...stage.anchors];
          const rects = elements.map((element) => element.getBoundingClientRect());
          const index = pickAnchor(rects, { width: view.vw, height: view.vh });

          // -1 is "no anchor is on screen": the orb is not here, so neither is its button.
          if (index === -1 || elements[index].dataset.orbInteractive === undefined) return null;

          return rects[index];
        },
        write: (rect) => {
          const element = ref.current;

          // React clears the ref the moment this leaves the page, but the subscription only goes
          // in the effect cleanup. A frame that lands in between finds nothing to write to.
          if (!element) return;

          if (!rect) {
            element.style.opacity = "0";
            element.style.pointerEvents = "none";
            element.tabIndex = -1;
            return;
          }

          element.style.opacity = "1";
          element.style.pointerEvents = "auto";
          element.style.transform = `translate3d(${Math.round(rect.left)}px, ${Math.round(rect.top)}px, 0)`;
          element.style.width = `${rect.width}px`;
          element.style.height = `${rect.height}px`;
        },
      }),
    []
  );

  return (
    <button
      ref={ref}
      type="button"
      className="orb-hotspot"
      style={{ opacity: 0, pointerEvents: "none" }}
      tabIndex={-1}
      aria-label={label}
      onClick={onActivate}
    />
  );
}
