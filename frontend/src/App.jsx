import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import Header from "./components/Header";
import ErrorBoundary from "./components/ErrorBoundary";

import Home from "./pages/Home";
import Inspect from "./pages/Inspect";
import Compare from "./pages/Compare";
import Rank from "./pages/Rank";

import { AppStateProvider } from "./context/AppStateContext";

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
    The lava-lamp layer lives out here, as a sibling of <main>, so a page
    cannot reach it with a CSS descendant selector. The home page needs it
    in the flag's colours and behind the map, so the shell carries a class
    saying which page is open and the stylesheet keys off that.
*/
function Shell() {

    const location = useLocation();

    const isHome = location.pathname === "/";

    return (
        <div className={"app-shell" + (isHome ? " is-home" : "")}>

            <div className="ambient-gradient"></div>

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