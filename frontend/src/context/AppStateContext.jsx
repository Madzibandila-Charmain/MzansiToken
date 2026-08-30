/*
    Stores shared application state so user selections and data remain unchanged when navigating between different pages.
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import { createContext, useContext, useState } from "react";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {

// INSPECT STATE

// Selected tokenizer and language

const [language, setLanguage] = useState("English");

const [tokenizer, setTokenizer] = useState("");

// Corpus source

const [source, setSource] = useState("default");

// Uploaded corpus

const [selectedFile, setSelectedFile] = useState(null);

const [fileName, setFileName] = useState("default");

// User typed text

const [inspectInputText, setInspectInputText] = useState("");

const [compareInputText, setCompareInputText] = useState("");

// Corpus tokenization

const [corpusTokenizedText, setCorpusTokenizedText] = useState([]);

const [corpusMetrics, setCorpusMetrics] = useState({
    tokens: 0,
    fertility: 0,
    compression: 0,
    token_premium: 0
});

// Typed text tokenization

const [typedTokenizedText, setTypedTokenizedText] = useState([]);

const [textMetrics, setTextMetrics] = useState({
    tokens: 0,
    fertility: 0,
    compression: 0,
    token_premium: 0
});

// Prevent Inspect from reinitialising the state

const [inspectInitialised, setInspectInitialised] = useState(false);


// ---------------
// COMPARE STATE
// ---------------

// Compare language

const [compareLanguage, setCompareLanguage] = useState("isiZulu");

// Two tokenizers used by Compare

const [compareTokenizerOne, setCompareTokenizerOne] =
    useState("");

const [compareTokenizerTwo, setCompareTokenizerTwo] =
    useState("");

// Compare corpus source

const [compareSource, setCompareSource] =
    useState("default");

// Compare uploaded corpus

const [compareSelectedFile, setCompareSelectedFile] =
    useState(null);

const [compareFileName, setCompareFileName] =
    useState("default");

// Compare selected metrics

const [compareMetrics, setCompareMetrics] = useState([
    "Token Count",
    "Fertility",
    "Compression",
    "Token Premium"
]);

// Prevent Compare from reinitialising selections

const [compareInitialised, setCompareInitialised] =
    useState(false);


return (

    <AppStateContext.Provider
        value={{

            // ----------
            // INSPECT
            // ----------

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

            inspectInputText,
            setInspectInputText,

            compareInputText,
            setCompareInputText,

            corpusTokenizedText,
            setCorpusTokenizedText,

            corpusMetrics,
            setCorpusMetrics,

            typedTokenizedText,
            setTypedTokenizedText,

            textMetrics,
            setTextMetrics,

            inspectInitialised,
            setInspectInitialised,


            // -------------------------------------------------
            // COMPARE
            // -------------------------------------------------

            compareLanguage,
            setCompareLanguage,

            compareTokenizerOne,
            setCompareTokenizerOne,

            compareTokenizerTwo,
            setCompareTokenizerTwo,

            compareSource,
            setCompareSource,

            compareSelectedFile,
            setCompareSelectedFile,

            compareFileName,
            setCompareFileName,

            compareMetrics,
            setCompareMetrics,

            compareInitialised,
            setCompareInitialised

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
