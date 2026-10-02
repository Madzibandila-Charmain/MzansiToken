import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import Header from "./components/Header";
import ErrorBoundary from "./components/ErrorBoundary";
import SouthAfricaMap from "./components/SouthAfricaMap";

import Home from "./pages/Home";
import Inspect from "./pages/Inspect";
import Compare from "./pages/Compare";
import Rank from "./pages/Rank";
import { AppStateProvider } from "./context/AppStateContext.jsx";

/*
    The boundary sits inside the router rather than around it, so a crash on
    one page leaves the header and the navigation usable. Keying it on the
    path also means moving to another page clears the crash by itself.
*/
function PageBoundary({ children }) {

    const location = useLocation();

    return (
        <ErrorBoundary resetKey={location.pathname}>
            {children}
        </ErrorBoundary>
    );
}

/*
    The background is the whole app's, not one page's.

    The lava-lamp layer lives out here, as a sibling of <main>, so a page
    cannot reach it with a CSS descendant selector. The country-and-flag
    map now sits beside it for the same reason: it started as a <div> inside
    Home, Rank copied that <div>, and a third page would have copied it
    again. Three copies of one backdrop is three places to fix it. It is
    rendered once, here, and every page it should appear on gets it by
    being in FLAG_PAGES.

    `is-flag` is the flag treatment - white page, flag-coloured lava, the
    map behind both. `is-home` is only the landing page's own layout on top
    of that, which is why they are separate classes.
*/
const FLAG_PAGES = new Set(["/", "/inspect", "/compare", "/rank"]);

function Shell() {

    const location = useLocation();

    const path = location.pathname;

    const onFlagPage = FLAG_PAGES.has(path);

    const shellClass = [
        "app-shell",
        path === "/" ? "is-home" : "",
        onFlagPage ? "is-flag" : "",
    ].filter(Boolean).join(" ");

    return (
        <div className={shellClass}>

            <div className="ambient-gradient"></div>

            {/* Decorative, so it is hidden from screen readers. */}
            {onFlagPage && (
                <div className="app-backdrop" aria-hidden="true">
                    <SouthAfricaMap decorative />
                </div>
            )}

            <Header />

            <main>

                <PageBoundary>

                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/inspect" element={<Inspect />} />
                        <Route path="/compare" element={<Compare />} />
                        <Route path="/rank" element={<Rank />} />
                    </Routes>

                </PageBoundary>

            </main>

        </div>
    );
}

function App() {
    return (
        <BrowserRouter>

            <AppStateProvider>

                <Shell />

            </AppStateProvider>

        </BrowserRouter>
    );
}

export default App;