/*
    Stores shared application state so user selections and data remain unchanged when navigating between different pages.
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import { createContext, useContext, useState } from "react";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
    
    // Selected tokenizer and language
    const [language, setLanguage] = useState("English");
    const [tokenizer, setTokenizer] = useState("");

    // Corpus source
    const [source, setSource] = useState("default");

    // Uploaded corpus
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileName, setFileName] = useState("default");

    // User typed text
    const [inputText, setInputText] = useState("");

    // Corpus tokenization
    const [corpusTokenizedText, setCorpusTokenizedText] = useState([]);
    const [corpusMetrics, setCorpusMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: null
    });

    // Typed text tokenization
    const [typedTokenizedText, setTypedTokenizedText] = useState([]);
    const [textMetrics, setTextMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: null
    });

    // Prevent Inspect from reinitialising the state
    const [inspectInitialised, setInspectInitialised] = useState(false);

    return (
        <AppStateContext.Provider
            value={{
                language,
                setLanguage,

                tokenizer,
                setTokenizer,

                source,
                setSource,

                selectedFile,
                setSelectedFile,

                fileName,
                setFileName,

                inputText,
                setInputText,

                corpusTokenizedText,
                setCorpusTokenizedText,

                corpusMetrics,
                setCorpusMetrics,

                typedTokenizedText,
                setTypedTokenizedText,

                textMetrics,
                setTextMetrics,

                inspectInitialised,
                setInspectInitialised
            }}
        >
            {children}
        </AppStateContext.Provider>
    );
}

export function useAppState() {
    const context = useContext(AppStateContext);

    if (!context) {
        throw new Error(
            "useAppState must be used inside AppStateProvider"
        );
    }

    return context;
}