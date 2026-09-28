import CalleeApp from "../components/voice-agent/CalleeApp";
import "../styles/voice-agent.css";

// The screen a person opens on a phone to take a call: /?call=1&name=... . The room is
// whatever room the minted grant opens - there is no call job to look up, because there is
// no server to ask.
export default function CalleeRoute(props) {
  return <CalleeApp {...props} />;
}
