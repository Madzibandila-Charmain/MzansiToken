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