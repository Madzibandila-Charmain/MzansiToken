import { BrowserRouter, Routes, Route } from "react-router-dom";

import Header from "./components/Header";

import Home from "./pages/Home";
import Inspect from "./pages/Inspect";
import Compare from "./pages/Compare";
import Rank from "./pages/Rank";

import { AppStateProvider } from "./context/AppStateContext";

function App() {
    return (
        <BrowserRouter>

            <AppStateProvider>

                <Header />

                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/inspect" element={<Inspect />} />
                    <Route path="/compare" element={<Compare />} />
                    <Route path="/rank" element={<Rank />} />
                </Routes>

            </AppStateProvider>

        </BrowserRouter>
    );
}

export default App;