import { lazy, Suspense } from "react";
import NotFound from "./components/NotFound.jsx";
import Splash from "./components/Splash.jsx";
import { useRouter } from "./router/context.js";
import RouterProvider from "./router/RouterProvider.jsx";
import { isAppRoute } from "./router/router.js";

const Landing = lazy(() => import("./site/Landing.jsx"));
const OperatorConsole = lazy(() => import("./app/OperatorConsole.jsx"));
const CalleeRoute = lazy(() => import("./app/CalleeRoute.jsx"));

// Every URL lands on something: the console, the call screen, the site, or "not found".
// Nothing falls through to a loading mark, and there is no sign-in to get past.
function Screen() {
  const { route, search } = useRouter();

  // A link like /?call=1&name=... is a person joining a call: the incoming-call screen,
  // whatever else the app is doing. The room comes from the grant, not from the URL, so
  // the link only has to say that a call is wanted and who is calling.
  if (search.get("call")) return <CalleeRoute name={search.get("name")} />;

  if (route === "landing") return <Landing />;

  if (isAppRoute(route)) return <OperatorConsole />;

  return <NotFound />;
}

export default function App() {
  return (
    <RouterProvider>
      <Suspense fallback={<Splash />}>
        <Screen />
      </Suspense>
    </RouterProvider>
  );
}
