/*
    Stores shared application state so user selections and data remain unchanged when navigating between different pages.
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import { useEffect, useState } from "react";

import { AppStateContext } from "./appStateContext.js";

/*
    Compare used to lose everything on a browser refresh while Inspect
    survived it, because Inspect wrote its picks to localStorage and Compare
    only ever held them in React state. Navigating between pages preserved
    both - it was F5 that told them apart, which made it look like a bug in
    one page rather than a missing feature in the other.

    Selections only. The uploaded File object cannot be serialised, and
    restoring a "there is an upload" flag without the file behind it would
    leave the page insisting on a corpus it cannot produce - so a refresh
    returns to the built-in corpus with the user's language and tokenizers
    intact, which is the part they chose.
*/

const STORAGE_KEYS = {
    compareLanguage: "compareLanguage",
    compareTokenizerOne: "compareTokenizerOne",
    compareTokenizerTwo: "compareTokenizerTwo",
    compareMetrics: "compareMetrics",
};

/*
    localStorage throws in a private window and returns whatever was last
    written otherwise - including "null", "7" or "{}", each of which parses
    fine and then breaks the first thing that reads it. Anything failing the
    caller's check is discarded in favour of the default.
*/
function readStored(key, fallback, isValid) {
    try {
        const raw = localStorage.getItem(key);

        if (raw === null) {
            return fallback;
        }

        const parsed = JSON.parse(raw);

        return isValid(parsed) ? parsed : fallback;
    }
    catch {
        return fallback;
    }
}

function writeStored(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        /* A full or unavailable store must not take the page down with it.
           Losing the selection on refresh is the cost, and it is survivable. */
    }
}

const isText = (value) => typeof value === "string";
const isTextList = (value) =>
    Array.isArray(value) && value.every((item) => typeof item === "string");

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

const [compareLanguage, setCompareLanguage] = useState(
    () => readStored(STORAGE_KEYS.compareLanguage, "isiZulu", isText)
);

// Two tokenizers used by Compare

const [compareTokenizerOne, setCompareTokenizerOne] = useState(
    () => readStored(STORAGE_KEYS.compareTokenizerOne, "", isText)
);

const [compareTokenizerTwo, setCompareTokenizerTwo] = useState(
    () => readStored(STORAGE_KEYS.compareTokenizerTwo, "", isText)
);

// Compare corpus source

const [compareSource, setCompareSource] =
    useState("default");

// Compare uploaded corpus

const [compareSelectedFile, setCompareSelectedFile] =
    useState(null);

const [compareFileName, setCompareFileName] =
    useState("default");

// Compare selected metrics

const [compareMetrics, setCompareMetrics] = useState(
    () => readStored(
        STORAGE_KEYS.compareMetrics,
        ["Token Count", "Fertility", "Compression", "Token Premium"],
        isTextList
    )
);

// Prevent Compare from reinitialising selections

const [compareInitialised, setCompareInitialised] =
    useState(false);

/*
    Written back whenever a selection changes, so a refresh restores the
    setup the user built rather than the defaults they started from.
*/

useEffect(() => {
    writeStored(STORAGE_KEYS.compareLanguage, compareLanguage);
}, [compareLanguage]);

useEffect(() => {
    writeStored(STORAGE_KEYS.compareTokenizerOne, compareTokenizerOne);
}, [compareTokenizerOne]);

useEffect(() => {
    writeStored(STORAGE_KEYS.compareTokenizerTwo, compareTokenizerTwo);
}, [compareTokenizerTwo]);

useEffect(() => {
    writeStored(STORAGE_KEYS.compareMetrics, compareMetrics);
}, [compareMetrics]);


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
