/*
    Compare Page

    Author: Madzibandila Charmain

    Date: 21 August 2026
*/

import { useEffect, useRef, useState } from "react";

import "./Compare.css";

import {
    getOptions,
    getDefaultCorpus,
    uploadCorpus,
    tokenizeText,
    compareMBI
} from "../api/client";

import { useAppState } from "../context/AppStateContext";

import CorpusUpload from "../components/CorpusUpload";

import TokenizationMetrics from "../components/TokenizationMetrics";

import TypeAnything from "../components/TypeAnything";

const GPT2_SPACE = "\u0120";
const SENTENCEPIECE_SPACE = "\u2581";
const WORDPIECE_PREFIX = "##";

function readable(token) {

    if (
        token.startsWith(GPT2_SPACE) ||
        token.startsWith(SENTENCEPIECE_SPACE)
    ) {
        return {
            text: token.slice(1),
            newWord: true
        };
    }

    if (
        token.startsWith(WORDPIECE_PREFIX)
    ) {
        return {
            text: token.slice(2),
            newWord: false
        };
    }

    return {
        text: token,
        newWord: false
    };
}

function Compare() {

    const {
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
        compareInitialised,
        setCompareInitialised
    } = useAppState();

    /*
        Type Anything text is kept locally to Compare.
        This prevents the Compare text box from sharing
        its value with the Inspect text box.
    */
    const [inputText, setInputText] = useState("");

    const [showCustomize, setShowCustomize] = useState(false);

    /*
        Languages and tokenizers provided by the backend.
    */
    const [languages, setLanguages] = useState([]);
    const [tokenizers, setTokenizers] = useState([]);

    /*
        Tokenized corpus for each tokenizer.
    */
    const [tokenizerOneTokens, setTokenizerOneTokens] = useState([]);
    const [tokenizerTwoTokens, setTokenizerTwoTokens] = useState([]);

    /*
        Tokenized text entered by the user for each tokenizer.
    */
    const [typedTokenizerOneTokens, setTypedTokenizerOneTokens] =
        useState([]);

    const [typedTokenizerTwoTokens, setTypedTokenizerTwoTokens] =
        useState([]);

    /*
        Metrics for typed text for each tokenizer.
    */
    const [typedTokenizerOneMetrics, setTypedTokenizerOneMetrics] =
        useState({
            tokens: 0,
            fertility: 0,
            compression: 0,
            token_premium: 0
        });

    const [typedTokenizerTwoMetrics, setTypedTokenizerTwoMetrics] =
        useState({
            tokens: 0,
            fertility: 0,
            compression: 0,
            token_premium: 0
        });

    const [mbiLoading, setMbiLoading] = useState(false);
    const [mbiError, setMbiError] = useState("");
    const [mbiUnavailable, setMbiUnavailable] = useState("");

    const [mbiComparison, setMbiComparison] = useState({
        tokenizerA: {
            precision: 0,
            recall: 0,
            f1: 0,
            words_evaluated: 0
        },
        tokenizerB: {
            precision: 0,
            recall: 0,
            f1: 0,
            words_evaluated: 0
        }
    });

    /*
        Metrics for each tokenizer.
    */
    const [tokenizerOneMetrics, setTokenizerOneMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: 0
    });

    const [tokenizerTwoMetrics, setTokenizerTwoMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: 0
    });

    /*
        Loading / status state.
    */
    const [loading, setLoading] = useState(false);

    /*
        General selection status is used for language
        changes and returning to the default corpus.
    */
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [selectionStatus, setSelectionStatus] = useState("");
    const [selectionType, setSelectionType] = useState("");

    /*
        Each tokenizer has its own loading and status state.
        This keeps Tokenizer 1 and Tokenizer 2 independent.
    */
    const [tokenizerOneLoading, setTokenizerOneLoading] = useState(false);
    const [tokenizerOneStatus, setTokenizerOneStatus] = useState("");

    const [tokenizerTwoLoading, setTokenizerTwoLoading] = useState(false);
    const [tokenizerTwoStatus, setTokenizerTwoStatus] = useState("");

    const [error, setError] = useState("");

    /*
        File input reference.
    */
    const fileInputRef = useRef(null);

    /*
        Load backend options when Compare opens.
    */
    useEffect(() => {

        async function initialiseCompare() {

            try {

                setLoading(true);
                setError("");

                const result = await getOptions();

                setLanguages(result.languages || []);
                setTokenizers(result.tokenizers || []);

                const defaultLanguage =
                    result.defaults?.language || "isiZulu";

                const defaultTokenizer =
                    result.defaults?.tokenizer ||
                    result.tokenizers?.[0] ||
                    "";

                /*
                    Initialise Compare selections only once.
                    The selections are stored in AppStateContext,
                    so navigating away from Compare does not reset them.
                */
                if (!compareInitialised) {

                    if (!compareLanguage) {
                        setCompareLanguage(defaultLanguage);
                    }

                    if (!compareTokenizerOne) {

                        setCompareTokenizerOne(
                            defaultTokenizer
                        );

                        /*
                            Use a different tokenizer for panel 2 when possible.
                        */
                        const secondTokenizer =
                            result.tokenizers?.find(
                                (item) =>
                                    item !== defaultTokenizer
                            ) || defaultTokenizer;

                        setCompareTokenizerTwo(
                            secondTokenizer
                        );
                    }

                    setCompareInitialised(true);
                }

            } catch (err) {

                setError(err.message);

            } finally {

                setLoading(false);

            }
        }

        initialiseCompare();

    }, [
        compareInitialised,
        compareLanguage,
        compareTokenizerOne,
        setCompareLanguage,
        setCompareTokenizerOne,
        setCompareTokenizerTwo,
        setCompareInitialised
    ]);

    useEffect(() => {

        if (
            !compareInitialised ||
            !compareLanguage ||
            !compareTokenizerOne ||
            !compareTokenizerTwo
        ) {
            return;
        }

        let cancelled = false;

        async function loadMbiComparison() {

            try {

                setMbiLoading(true);
                setMbiError("");
                setMbiUnavailable("");

                const result = await compareMBI(
                    compareTokenizerOne,
                    compareTokenizerTwo,
                    compareLanguage
                );

                if (cancelled) {
                    return;
                }

                setMbiComparison({
                    tokenizerA: {
                        precision:
                            result.tokenizer_a.metrics.precision ?? 0,
                        recall:
                            result.tokenizer_a.metrics.recall ?? 0,
                        f1:
                            result.tokenizer_a.metrics.f1 ?? 0,
                        words_evaluated:
                            result.tokenizer_a.words_evaluated ?? 0
                    },

                    tokenizerB: {
                        precision:
                            result.tokenizer_b.metrics.precision ?? 0,
                        recall:
                            result.tokenizer_b.metrics.recall ?? 0,
                        f1:
                            result.tokenizer_b.metrics.f1 ?? 0,
                        words_evaluated:
                            result.tokenizer_b.words_evaluated ?? 0
                    }
                });

            } catch (err) {

                if (
                    err.message?.includes(
                        "Unsupported language"
                    )
                ) {

                    if (!cancelled) {

                        setMbiComparison({
                            tokenizerA: {
                                precision: 0,
                                recall: 0,
                                f1: 0,
                                words_evaluated: 0
                            },

                            tokenizerB: {
                                precision: 0,
                                recall: 0,
                                f1: 0,
                                words_evaluated: 0
                            }
                        });

                        setMbiUnavailable(
                            `${compareLanguage} does not have MBI metrics.`
                        );
                    }

                    return;
                }

                if (!cancelled) {
                    setMbiError(err.message);
                }

            } finally {

                if (!cancelled) {
                    setMbiLoading(false);
                }

            }
        }

        loadMbiComparison();

        return () => {
            cancelled = true;
        };

    }, [
        compareInitialised,
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo
    ]);

    /*
        Load the default corpus for both tokenizers.
    */
    useEffect(() => {

        if (
            !compareTokenizerOne ||
            !compareTokenizerTwo ||
            !compareLanguage
        ) {
            return;
        }

        loadDefaultCorpus(
            compareLanguage,
            compareTokenizerOne,
            compareTokenizerTwo
        );

    }, [
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo
    ]);

    /*
        Tokenizes text entered by the user using both
        comparison tokenizers.
        A short delay prevents a backend request from being
        sent for every individual keystroke.
    */
    useEffect(() => {

        if (
            !inputText.trim() ||
            !compareTokenizerOne ||
            !compareTokenizerTwo ||
            !compareLanguage
        ) {

            setTypedTokenizerOneTokens([]);
            setTypedTokenizerTwoTokens([]);

            setTypedTokenizerOneMetrics({
                tokens: 0,
                fertility: 0,
                compression: 0,
                token_premium: 0
            });

            setTypedTokenizerTwoMetrics({
                tokens: 0,
                fertility: 0,
                compression: 0,
                token_premium: 0
            });

            return;
        }

        const timeoutId = setTimeout(async () => {

            try {

                setError("");

                const [
                    resultOne,
                    resultTwo
                ] = await Promise.all([

                    tokenizeText(
                        inputText,
                        compareLanguage,
                        compareTokenizerOne
                    ),

                    tokenizeText(
                        inputText,
                        compareLanguage,
                        compareTokenizerTwo
                    )

                ]);

                setTypedTokenizerOneTokens(
                    formatTokenizedText(
                        resultOne.tokenized_text
                    )
                );

                setTypedTokenizerTwoTokens(
                    formatTokenizedText(
                        resultTwo.tokenized_text
                    )
                );

                /*
                    Token Premium for typed text is always zero.
                */
                const typedMetricsOne =
                    formatMetrics(resultOne);

                const typedMetricsTwo =
                    formatMetrics(resultTwo);

                setTypedTokenizerOneMetrics({
                    ...typedMetricsOne,
                    token_premium: 0
                });

                setTypedTokenizerTwoMetrics({
                    ...typedMetricsTwo,
                    token_premium: 0
                });

            } catch (err) {

                setError(err.message);

            }

        }, 400);

        return () => clearTimeout(timeoutId);

    }, [
        inputText,
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo
    ]);

    /*
        Converts backend tokenized text into an array.
    */
    function formatTokenizedText(tokenizedText) {

        if (!tokenizedText) {
            return [];
        }

        if (Array.isArray(tokenizedText)) {
            return tokenizedText;
        }

        if (typeof tokenizedText === "string") {

            return tokenizedText
                .split(/\n+/)
                .map((sentence) =>
                    sentence
                        .split(/\s+/)
                        .filter(Boolean)
                )
                .filter(
                    (sentence) =>
                        sentence.length > 0
                );
        }

        return [];
    }

    /*
        Render tokens using the same token-pill style as Inspect.
    */
    function renderTokens(tokens) {

        if (
            !tokens ||
            tokens.length === 0
        ) {
            return "Your tokenized text will appear here.";
        }

        let sentences;

        if (
            Array.isArray(tokens[0])
        ) {
            sentences = tokens;
        } else {
            sentences = [
                tokens
            ];
        }

        const visibleSentences =
            sentences.slice(0, 10);

        return (
            <>
                {visibleSentences.map(
                    (
                        sentence,
                        sentenceIndex
                    ) => (

                        <div
                            key={`sentence-${sentenceIndex}`}
                            className="token-sentence"
                        >

                            {sentence.map(
                                (
                                    token,
                                    tokenIndex
                                ) => {

                                    const colourIndex =
                                        tokenIndex % 8;

                                    const {
                                        text,
                                        newWord
                                    } = readable(
                                        Array.isArray(token)
                                            ? token.join("")
                                            : String(token)
                                    );

                                    return (

                                        <span
                                            key={`${sentenceIndex}-${tokenIndex}-${token}`}
                                            className={
                                                `token-pill token-colour-${colourIndex}` +
                                                (
                                                    newWord
                                                        ? " token-new-word"
                                                        : ""
                                                )
                                            }
                                            title={String(token)}
                                        >
                                            {text}
                                        </span>

                                    );

                                }
                            )}

                        </div>

                    )
                )}
            </>
        );
    }

    /*
        Converts backend metrics into the Compare format.
    */
    function formatMetrics(result) {

        return {
            tokens:
                result?.metrics?.token_count ?? 0,

            fertility:
                result?.metrics?.fertility ?? 0,

            compression:
                result?.metrics?.compression ?? 0,

            token_premium:
                result?.metrics?.token_premium ?? 0
        };
    }

    function getMetricValue(metric, metrics) {

        if (metric === "Tokens") {

            return Number(
                metrics?.tokens ?? 0
            ).toLocaleString();

        }

        if (metric === "Fertility") {

            return Number(
                metrics?.fertility ?? 0
            ).toFixed(2);

        }

        if (metric === "Compression") {

            return Number(
                metrics?.compression ?? 0
            ).toFixed(2);

        }

        return "0.00";
    }

    function formatMbiMetric(value) {

        return Number(
            value ?? 0
        ).toFixed(2);
    }

    function getMbiMetricDisplay(value) {

        if (mbiUnavailable) {
            return "N/A";
        }

        if (mbiLoading) {
            return "Loading...";
        }

        return formatMbiMetric(value);
    }

    /*
        English corpus won't display Precision/F1/Recall.
    */
    function hasMbiMetrics() {

        return compareLanguage !== "English";
    }

    /*
        Loads the default corpus through both tokenizers.
    */
    async function loadDefaultCorpus(
        selectedLanguage = compareLanguage,
        selectedTokenizerOne = compareTokenizerOne,
        selectedTokenizerTwo = compareTokenizerTwo
    ) {

        try {

            setLoading(true);
            setError("");

            const [
                resultOne,
                resultTwo
            ] = await Promise.all([

                getDefaultCorpus(
                    selectedLanguage,
                    selectedTokenizerOne
                ),

                getDefaultCorpus(
                    selectedLanguage,
                    selectedTokenizerTwo
                )

            ]);

            setTokenizerOneTokens(
                formatTokenizedText(
                    resultOne.tokenized_text
                )
            );

            setTokenizerTwoTokens(
                formatTokenizedText(
                    resultTwo.tokenized_text
                )
            );

            setTokenizerOneMetrics(
                formatMetrics(resultOne)
            );

            setTokenizerTwoMetrics(
                formatMetrics(resultTwo)
            );

            setCompareSource("default");
            setCompareSelectedFile(null);
            setCompareFileName("default");

        } catch (err) {

            setError(err.message);

        } finally {

            setLoading(false);

        }
    }

    /*
        Sends an uploaded corpus through both tokenizers.
    */
    async function processUploadedCorpus(
        file,
        selectedLanguage,
        selectedTokenizerOne,
        selectedTokenizerTwo
    ) {

        try {

            setLoading(true);
            setError("");

            const [
                resultOne,
                resultTwo
            ] = await Promise.all([

                uploadCorpus(
                    file,
                    selectedTokenizerOne
                ),

                uploadCorpus(
                    file,
                    selectedTokenizerTwo
                )

            ]);

            setCompareSource("upload");
            setCompareSelectedFile(file);
            setCompareFileName(file.name);

            setTokenizerOneTokens(
                formatTokenizedText(
                    resultOne.tokenized_text
                )
            );

            setTokenizerTwoTokens(
                formatTokenizedText(
                    resultTwo.tokenized_text
                )
            );

            setTokenizerOneMetrics(
                formatMetrics(resultOne)
            );

            setTokenizerTwoMetrics(
                formatMetrics(resultTwo)
            );

        } catch (err) {

            console.error(
                "Upload corpus error:",
                err
            );

            setError(
                err.message ||
                "Could not process the uploaded corpus."
            );

        } finally {

            setLoading(false);
            setSelectionLoading(false);

        }
    }

    /*
        Handle corpus file selection.
    */
    async function handleFileChange(event) {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        await processUploadedCorpus(
            file,
            compareLanguage,
            compareTokenizerOne,
            compareTokenizerTwo
        );
    }

    /*
        Changing the language reloads the same corpus
        using both tokenizers.
    */
    async function handleLanguageChange(newLanguage) {

        if (selectionLoading) {
            return;
        }

        setCompareLanguage(newLanguage);

        setSelectionLoading(true);
        setSelectionType("language");
        setSelectionStatus("Loading language...");

        try {

            setError("");

            if (compareSource === "default") {

                await loadDefaultCorpus(
                    newLanguage,
                    compareTokenizerOne,
                    compareTokenizerTwo
                );

            } else if (compareSelectedFile) {

                await processUploadedCorpus(
                    compareSelectedFile,
                    newLanguage,
                    compareTokenizerOne,
                    compareTokenizerTwo
                );
            }

            setSelectionStatus(
                "Language ready"
            );

        } catch (err) {

            setError(err.message);

            setSelectionStatus(
                "Language failed"
            );

        } finally {

            setSelectionLoading(false);

        }
    }

    /*
        Change Tokenizer 1.
    */
    async function handleTokenizerOneChange(event) {

        const newTokenizer =
            event.target.value;

        setCompareTokenizerOne(
            newTokenizer
        );

        setTokenizerOneLoading(true);

        setTokenizerOneStatus(
            "Loading tokenizer 1..."
        );

        try {

            setError("");

            if (
                compareSource === "upload" &&
                compareSelectedFile
            ) {

                const result =
                    await uploadCorpus(
                        compareSelectedFile,
                        newTokenizer
                    );

                setTokenizerOneTokens(
                    formatTokenizedText(
                        result?.tokenized_text
                    )
                );

                setTokenizerOneMetrics(
                    formatMetrics(result)
                );

            } else {

                const result =
                    await getDefaultCorpus(
                        compareLanguage,
                        newTokenizer
                    );

                setTokenizerOneTokens(
                    formatTokenizedText(
                        result?.tokenized_text
                    )
                );

                setTokenizerOneMetrics(
                    formatMetrics(result)
                );
            }

            setTokenizerOneStatus(
                "Tokenizer 1 is ready"
            );

        } catch (err) {

            setTokenizerOneStatus(
                err.message ||
                "Could not load tokenizer."
            );

        } finally {

            setTokenizerOneLoading(false);

        }
    }

    /*
        Change Tokenizer 2.
    */
    async function handleTokenizerTwoChange(event) {

        const newTokenizer =
            event.target.value;

        setCompareTokenizerTwo(
            newTokenizer
        );

        setTokenizerTwoLoading(true);

        setTokenizerTwoStatus(
            "Loading tokenizer 2..."
        );

        try {

            setError("");

            if (
                compareSource === "upload" &&
                compareSelectedFile
            ) {

                const result =
                    await uploadCorpus(
                        compareSelectedFile,
                        newTokenizer
                    );

                setTokenizerTwoTokens(
                    formatTokenizedText(
                        result?.tokenized_text
                    )
                );

                setTokenizerTwoMetrics(
                    formatMetrics(result)
                );

            } else {

                const result =
                    await getDefaultCorpus(
                        compareLanguage,
                        newTokenizer
                    );

                setTokenizerTwoTokens(
                    formatTokenizedText(
                        result?.tokenized_text
                    )
                );

                setTokenizerTwoMetrics(
                    formatMetrics(result)
                );
            }

            setTokenizerTwoStatus(
                "Tokenizer 2 is ready"
            );

        } catch (err) {

            setTokenizerTwoStatus(
                err.message ||
                "Could not load tokenizer."
            );

        } finally {

            setTokenizerTwoLoading(false);

        }
    }

    /*
        Return to the default corpus.
    */
    async function handleDefault() {

        if (selectionLoading) {
            return;
        }

        setSelectionLoading(true);
        setSelectionType("default");
        setSelectionStatus(
            "Loading default corpus..."
        );

        setError("");

        try {

            await loadDefaultCorpus(
                compareLanguage,
                compareTokenizerOne,
                compareTokenizerTwo
            );

            setCompareFileName("default");
            setCompareSelectedFile(null);
            setCompareSource("default");

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            setSelectionStatus(
                "Default corpus ready"
            );

        } catch (err) {

            setError(err.message);

            setSelectionStatus(
                "Default corpus failed"
            );

        } finally {

            setSelectionLoading(false);

        }
    }

    return (

        <div className="compare-page">

            {/* Compare Header */}

            <section className="compare-intro">

                {/* Description of what the Compare page does */}

                <p className="compare-label">
                    COMPARE
                </p>

                <h1>
                    Put Two Tokenizers Through the Same Test.
                </h1>

                <p className="compare-description">
                    See exactly where they differ, side by side, across the same
                    language and corpus.
                </p>

                <button
                    className="customize-button"
                    onClick={() =>
                        setShowCustomize(!showCustomize)
                    }
                >
                    {showCustomize
                        ? "Close"
                        : "Customize"}
                </button>

            </section>

            {/* Tokenizer Selection */}

            <section className="compare-tokenizer-filter">

                <div className="compare-tokenizer-filter-heading">
                    Compare Tokenizers
                </div>

                <div className="compare-tokenizer-filter-options">

                    {/* Tokenizer 1 */}

                    <div className="compare-tokenizer-filter-item">

                        <label
                            htmlFor="compare-tokenizer-one"
                            className="compare-tokenizer-filter-label"
                        >
                            Tokenizer 1
                        </label>

                        <select
                            id="compare-tokenizer-one"
                            className="compare-tokenizer-filter-select"
                            value={compareTokenizerOne}
                            onChange={handleTokenizerOneChange}
                            disabled={
                                tokenizerOneLoading ||
                                selectionLoading ||
                                loading
                            }
                        >

                            {tokenizers.map((item) => (

                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>

                            ))}

                        </select>

                        {/* Tokenizer 1 status */}

                        {tokenizerOneStatus && (

                            <div
                                className={`selection-status ${
                                    tokenizerOneStatus.startsWith("Loading ")
                                        ? "is-loading"
                                        : tokenizerOneStatus.includes("could not")
                                            ? "is-error"
                                            : "is-ready"
                                }`}
                            >

                                <span className="status-dot"></span>

                                <span>
                                    {tokenizerOneStatus}
                                </span>

                            </div>

                        )}

                    </div>

                    {/* Tokenizer 2 */}

                    <div className="compare-tokenizer-filter-item">

                        <label
                            htmlFor="compare-tokenizer-two"
                            className="compare-tokenizer-filter-label"
                        >
                            Tokenizer 2
                        </label>

                        <select
                            id="compare-tokenizer-two"
                            className="compare-tokenizer-filter-select"
                            value={compareTokenizerTwo}
                            onChange={handleTokenizerTwoChange}
                            disabled={
                                tokenizerTwoLoading ||
                                selectionLoading ||
                                loading
                            }
                        >

                            {tokenizers.map((item) => (

                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>

                            ))}

                        </select>

                        {/* Tokenizer 2 status */}

                        {tokenizerTwoStatus && (

                            <div
                                className={`selection-status ${
                                    tokenizerTwoStatus.startsWith("Loading ")
                                        ? "is-loading"
                                        : tokenizerTwoStatus.includes("could not")
                                            ? "is-error"
                                            : "is-ready"
                                }`}
                            >

                                <span className="status-dot"></span>

                                <span>
                                    {tokenizerTwoStatus}
                                </span>

                            </div>

                        )}

                    </div>

                </div>

            </section>

            {/* Customize Panel */}

            {showCustomize && (

                <div className="customize-panel">

                    <div className="customize-section">

                        <h2>
                            Corpus language
                        </h2>

                        <div className="round-options">

                            {languages.map((item) => (

                                <button
                                    key={item}
                                    className={`round-option ${
                                        compareLanguage === item
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        handleLanguageChange(item)
                                    }
                                    disabled={
                                        selectionLoading ||
                                        loading
                                    }
                                >
                                    {item}
                                </button>

                            ))}

                        </div>

                    </div>

                    <div className="selection-summary">

                        <span>
                            {compareLanguage}
                        </span>

                        <span>
                            Comparing two tokenizers
                        </span>

                    </div>

                </div>

            )}

            {/* Error */}

            {error && (

                <div className="compare-error">
                    {error}
                </div>

            )}

            {/* Mzansi Explorer */}

            <section className="compare-corpus-box">

                <div className="compare-corpus-heading">
                    Mzansi Explorer • Corpus Tokenization
                </div>

                <p className="compare-corpus-label">
                    {compareFileName} • {compareLanguage}
                </p>

                <CorpusUpload
                    inputId="compare-corpus-upload"
                    fileInputRef={fileInputRef}
                    onFileChange={handleFileChange}
                    onDefault={handleDefault}
                    showDefault={
                        compareFileName !== "default"
                    }
                    disabled={
                        selectionLoading ||
                        loading ||
                        tokenizerOneLoading ||
                        tokenizerTwoLoading
                    }
                />

                {/* Status */}

                {selectionStatus && (

                    <div
                        className={`compare-selection-status ${
                            selectionLoading
                                ? "is-loading"
                                : "is-ready"
                        }`}
                    >

                        <span className="compare-status-dot"></span>

                        <span>
                            {selectionStatus}
                        </span>

                    </div>

                )}

                {/* Two Tokenizer Displays */}

                <div className="compare-tokenization-results">

                    {/* TOKENIZER 1 */}

                    <TokenizationMetrics
                        title={
                            compareTokenizerOne ||
                            "Tokenizer 1"
                        }
                        tokens={tokenizerOneTokens}
                        metrics={tokenizerOneMetrics}
                        mbi={
                            mbiComparison.tokenizerA
                        }
                        showMbi={hasMbiMetrics()}
                        renderTokens={renderTokens}
                        tokenizerType="1"
                    />

                    {/* TOKENIZER 2 */}

                    <TokenizationMetrics
                        title={
                            compareTokenizerTwo ||
                            "Tokenizer 2"
                        }
                        tokens={tokenizerTwoTokens}
                        metrics={tokenizerTwoMetrics}
                        mbi={
                            mbiComparison.tokenizerB
                        }
                        showMbi={hasMbiMetrics()}
                        renderTokens={renderTokens}
                        tokenizerType="2"
                    />

                </div>

            </section>

            {/* Type Anything */}
            <TypeAnything
                inputText={inputText}
                onInputChange={setInputText}
                results={[
                    {
                        id: "tokenizer-a",
                        title: compareTokenizerOne,
                        tokens: typedTokenizerOneTokens,
                        metrics: typedTokenizerOneMetrics
                    },
                    {
                        id: "tokenizer-b",
                        title: compareTokenizerTwo,
                        tokens: typedTokenizerTwoTokens,
                        metrics: typedTokenizerTwoMetrics
                    }
                ]}
                renderTokens={renderTokens}
            />

        </div>
    );
}

export default Compare;