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

function App() {
    return (
        <BrowserRouter>

            <AppStateProvider>

                <div className="app-shell">

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

            </AppStateProvider>

        </BrowserRouter>
    );
}

export default App;