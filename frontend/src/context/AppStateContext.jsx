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

    /*
        Rank used to hold its board in its own local state, so leaving the
        page for Compare or Inspect and coming back unmounted it and lost
        everything - the restore-or-measure flow ran again from scratch
        even though nothing had actually changed. These bring it in line
        with Inspect and Compare: the data lives here instead, survives
        navigating away, and is written to localStorage so a refresh does
        not cost a full remeasure of every tokenizer the user added either.
    */
    rankInitialised: "rankInitialised",
    rankRows: "rankRows",
    rankWeights: "rankWeights",
    rankFloresLanguages: "rankFloresLanguages",
    rankMatrix: "rankMatrix",
    rankSortKey: "rankSortKey",
    rankBestFirst: "rankBestFirst",
    rankFilter: "rankFilter",
    rankShowAllMetrics: "rankShowAllMetrics",
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
const isBoolean = (value) => typeof value === "boolean";
const isArray = (value) => Array.isArray(value);
const isPlainObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
const isWeights = (value) => value === null || isPlainObject(value);

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


// Compare options loaded from the backend
const [compareLanguages, setCompareLanguages] = useState([]);
const [compareLimits, setCompareLimits] = useState(null);
const [compareOptionsLoaded, setCompareOptionsLoaded] = useState(false);

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

// Corpus results, kept so leaving Compare doesn't throw them away.
// Deliberately NOT written to localStorage (large, and re-derivable).

const [compareTokenizerOneTokens, setCompareTokenizerOneTokens] = useState([]);
const [compareTokenizerTwoTokens, setCompareTokenizerTwoTokens] = useState([]);

const [compareTokenizerOneMetrics, setCompareTokenizerOneMetrics] = useState({
    tokens: 0, fertility: 0, compression: 0, token_premium: 0
});

const [compareTokenizerTwoMetrics, setCompareTokenizerTwoMetrics] = useState({
    tokens: 0, fertility: 0, compression: 0, token_premium: 0
});

// True once the built-in corpus has been loaded this session
const [compareCorpusLoaded, setCompareCorpusLoaded] = useState(false);

// The eight-language table's data: { key, a, b } for the tokenizer pair it
// was fetched for. Not written to localStorage - it is re-derivable.
const [compareChartsCache, setCompareChartsCache] = useState(null);

// The table's controls, so they are still as you left them on return.
const [compareChartsMeasure, setCompareChartsMeasure] = useState("fertility");
const [compareChartsShape, setCompareChartsShape] = useState("dots");

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


// ---------------
// RANK STATE
// ---------------

// Prevent Rank from re-running restore-or-measure on every mount

const [rankInitialised, setRankInitialised] = useState(
    () => readStored(STORAGE_KEYS.rankInitialised, false, isBoolean)
);

// The board itself

const [rankRows, setRankRows] = useState(
    () => readStored(STORAGE_KEYS.rankRows, [], isArray)
);

// The scoring formula's weights, for the "how this is scored" sentence

const [rankWeights, setRankWeights] = useState(
    () => readStored(STORAGE_KEYS.rankWeights, null, isWeights)
);

// Every FLORES language, for the heatmap's columns

const [rankFloresLanguages, setRankFloresLanguages] = useState(
    () => readStored(STORAGE_KEYS.rankFloresLanguages, [], isArray)
);

// name -> { cells: { language: premium }, mean }, for the heatmap

const [rankMatrix, setRankMatrix] = useState(
    () => readStored(STORAGE_KEYS.rankMatrix, {}, isPlainObject)
);

// Sort and filter controls above the board

const [rankSortKey, setRankSortKey] = useState(
    () => readStored(STORAGE_KEYS.rankSortKey, "overall_score", isText)
);

const [rankBestFirst, setRankBestFirst] = useState(
    () => readStored(STORAGE_KEYS.rankBestFirst, true, isBoolean)
);

const [rankFilter, setRankFilter] = useState(
    () => readStored(STORAGE_KEYS.rankFilter, "", isText)
);

const [rankShowAllMetrics, setRankShowAllMetrics] = useState(
    () => readStored(STORAGE_KEYS.rankShowAllMetrics, false, isBoolean)
);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankInitialised, rankInitialised);
}, [rankInitialised]);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankRows, rankRows);
}, [rankRows]);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankWeights, rankWeights);
}, [rankWeights]);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankFloresLanguages, rankFloresLanguages);
}, [rankFloresLanguages]);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankMatrix, rankMatrix);
}, [rankMatrix]);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankSortKey, rankSortKey);
}, [rankSortKey]);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankBestFirst, rankBestFirst);
}, [rankBestFirst]);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankFilter, rankFilter);
}, [rankFilter]);

useEffect(() => {
    writeStored(STORAGE_KEYS.rankShowAllMetrics, rankShowAllMetrics);
}, [rankShowAllMetrics]);


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
            
            compareLanguages,
            setCompareLanguages,

            compareLimits,
            setCompareLimits,

            compareOptionsLoaded,
            setCompareOptionsLoaded,

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
            setCompareInitialised,

            compareTokenizerOneTokens, 
            setCompareTokenizerOneTokens,

            compareTokenizerTwoTokens, 
            setCompareTokenizerTwoTokens,

            compareTokenizerOneMetrics, 
            setCompareTokenizerOneMetrics,

            compareTokenizerTwoMetrics, 
            setCompareTokenizerTwoMetrics,

            compareCorpusLoaded, 
            setCompareCorpusLoaded,

            compareChartsCache,
            setCompareChartsCache,

            compareChartsMeasure,
            setCompareChartsMeasure,

            compareChartsShape,
            setCompareChartsShape,


            // -------------------------------------------------
            // RANK
            // -------------------------------------------------

            rankInitialised,
            setRankInitialised,

            rankRows,
            setRankRows,

            rankWeights,
            setRankWeights,

            rankFloresLanguages,
            setRankFloresLanguages,

            rankMatrix,
            setRankMatrix,

            rankSortKey,
            setRankSortKey,

            rankBestFirst,
            setRankBestFirst,

            rankFilter,
            setRankFilter,

            rankShowAllMetrics,
            setRankShowAllMetrics

        }}
    >

        {children}

    </AppStateContext.Provider>
);


}
